/**
 * Drives one tab the way a person does.
 *
 * The rules that make a journey worth trusting:
 *
 * - A tap is a real input event at the element's centre - a touch on the
 *   phone profile, a mouse click on the desktop one - never `el.click()`.
 *   Before tapping, the element must be the one the finger would actually
 *   hit (`elementFromPoint`): an invisible overlay or a panel stuck at
 *   opacity 0 makes the tap fail here, as it does on the phone.
 * - Every wait has a deadline and a message saying what was expected.
 * - Every uncaught exception, rejected promise and console.error on the page
 *   (and in its service worker, see run.js) is collected. A journey with any
 *   of them fails, even if every step "worked": a thrown error is how the
 *   1.10.1 Start button died.
 */

export const PHONE = {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true, touch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};

export const DESKTOP = {
  width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, touch: false,
  userAgent: null,
};

export class Page {
  constructor(conn, sessionId, targetId, device) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.device = device;
    this.errors = [];
    this.loadWaiters = [];
    this.off = conn.on((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Page.loadEventFired') {
        const waiters = this.loadWaiters;
        this.loadWaiters = [];
        waiters.forEach((fn) => fn());
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        this.errors.push('exception: ' + ((d.exception && d.exception.description) || d.text)
          + (d.url ? ' at ' + d.url + ':' + (d.lineNumber + 1) : '') + (d.scriptId && !d.url ? ' (script ' + d.scriptId + ')' : ''));
      }
      // A native alert/confirm freezes the page - and every command sent to it
      // - until someone answers. The app has its own dialogs; a native one is
      // a finding, recorded and dismissed so the journey can report it.
      if (m.method === 'Page.javascriptDialogOpening') {
        this.errors.push('native ' + m.params.type + ' dialog: ' + m.params.message);
        this.send('Page.handleJavaScriptDialog', { accept: m.params.type !== 'beforeunload' ? false : true }).catch(() => {});
      }
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'assert')) {
        this.errors.push('console.' + m.params.type + ': '
          + m.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' '));
      }
    });
  }

  static async open(conn, browserContextId, device) {
    const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(conn, sessionId, targetId, device);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: device.width, height: device.height,
      deviceScaleFactor: device.deviceScaleFactor, mobile: device.mobile,
    });
    if (device.touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (device.userAgent) await page.send('Emulation.setUserAgentOverride', { userAgent: device.userAgent });
    return page;
  }

  send(method, params = {}) {
    return this.conn.send(method, params, this.sessionId);
  }

  async goto(url) {
    const loaded = new Promise((r) => this.loadWaiters.push(r));
    await this.send('Page.navigate', { url });
    await withDeadline(loaded, 20000, 'page did not load: ' + url);
  }

  async reload() {
    const loaded = new Promise((r) => this.loadWaiters.push(r));
    await this.send('Page.reload', {});
    await withDeadline(loaded, 20000, 'page did not reload');
  }

  /** Runs an expression in the page; promises are awaited. Throws on page errors. */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('in page: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.value;
  }

  /** Polls an expression until it is truthy. */
  async waitFor(expression, what, timeout = 8000) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
      try {
        last = await this.eval(expression);
        if (last) return last;
      } catch (err) {
        last = err.message;
      }
      await sleep(60);
    }
    throw new Error('timed out waiting for ' + what + (last !== undefined ? ' (last: ' + JSON.stringify(last) + ')' : ''));
  }

  count(selector) {
    return this.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  }

  text(selector, index = 0) {
    return this.eval(`(document.querySelectorAll(${JSON.stringify(selector)})[${index}] || {}).textContent`);
  }

  /**
   * Where a finger would land on the element, once it is really there:
   * attached, visible, not disabled, and the topmost thing at its centre.
   */
  async target(selector, { index = 0, text = null, timeout = 8000 } = {}) {
    // Waits two frames and compares: a panel still sliding in would take the
    // tap somewhere else, exactly like a finger that is too quick.
    const find = `(async () => {
      const all = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const pool = ${text === null ? 'all' : `all.filter((e) => e.textContent.trim().includes(${JSON.stringify(text)}))`};
      const el = pool[${index}];
      if (!el) return 'missing';
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const before = el.getBoundingClientRect();
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const r = el.getBoundingClientRect();
      if (Math.abs(r.top - before.top) > 0.5 || Math.abs(r.left - before.left) > 0.5) return 'still moving';
      if (!r.width || !r.height) return 'zero-size';
      if (el.disabled) return 'disabled';
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) {
        return 'covered by ' + (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').join('.') : 'nothing');
      }
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || Number(style.opacity) < 0.1) return 'invisible';
      return { x, y };
    })()`;
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
      last = await this.eval(find);
      if (last && typeof last === 'object') return last;
      await sleep(60);
    }
    throw new Error('cannot tap ' + selector + (text ? ' "' + text + '"' : '') + ' #' + index + ': ' + last);
  }

  /** A real tap (touch on the phone, click on the desktop). */
  async tap(selector, opts = {}) {
    const { x, y } = await this.target(selector, opts);
    await this.tapAt(x, y);
  }

  async tapAt(x, y) {
    if (this.device.touch) {
      const point = [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
      await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
      await sleep(40);
      await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(30);
      await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    // Gives the app a frame to react, like a person would wait.
    await sleep(80);
  }

  /** Taps a field and types into it, as the keyboard does. */
  async type(selector, text, opts = {}) {
    await this.tap(selector, opts);
    await this.send('Input.insertText', { text });
  }

  async screenshot() {
    const r = await withDeadline(this.send('Page.captureScreenshot', { format: 'png' }), 5000, 'screenshot timed out');
    return Buffer.from(r.data, 'base64');
  }

  async close() {
    this.off();
    try { await this.conn.send('Target.closeTarget', { targetId: this.targetId }); } catch { /* gone */ }
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function withDeadline(promise, ms, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]);
}
