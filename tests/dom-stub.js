/**
 * A minimal simulated DOM, just enough to exercise the panels' state machine
 * (`openFlow`) outside the browser.
 *
 * Why it exists: a panel whose first screen was born with the `is-next` class
 * (opacity:0, pointer-events:none) and never lost it left EVERY panel in the
 * app invisible and unclickable. Valid syntax, correct imports, 28 green
 * tests - and the app broken. No check reached that.
 *
 * What this verifies: which classes each screen carries after coming in,
 * leaving and coming back. What it does NOT verify: painting, layout,
 * gestures. For that it is still the finger on the device - this file only
 * keeps the bulb from burning out the same way again.
 *
 * It installs itself only when there is no real DOM, so in the browser
 * (`tests.html`) it touches nothing and the cases that depend on it are
 * skipped.
 */

export const simulated = typeof globalThis.document === 'undefined';

const frames = [];

/** Runs the pending requestAnimationFrame callbacks, in order. */
export function flushFrames() {
  let guard = 0;
  while (frames.length && guard < 100) {
    frames.shift()();
    guard += 1;
  }
}

class ClassList {
  constructor() { this.set = new Set(); }
  add(...names) { names.forEach((n) => n && this.set.add(n)); }
  remove(...names) { names.forEach((n) => this.set.delete(n)); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : Boolean(force);
    if (on) this.set.add(name); else this.set.delete(name);
    return on;
  }
  toString() { return [...this.set].join(' '); }
}

/**
 * A `style` that imitates the browser where it matters: a custom property
 * (--something) ONLY exists if it goes through setProperty. Assigning by index
 * registers nothing - and that is how the decks' color identity stayed
 * invisible for a long time without anyone noticing.
 */
function makeStyle() {
  const custom = new Map();
  const style = {};
  const hidden = (name, fn) => Object.defineProperty(style, name, {
    value: fn, enumerable: false,
  });

  hidden('setProperty', (k, v) => {
    if (String(k).startsWith('--')) custom.set(k, String(v));
    else style[k] = v;
  });
  hidden('removeProperty', (k) => {
    custom.delete(k);
    delete style[k];
  });
  hidden('getPropertyValue', (k) => {
    if (String(k).startsWith('--')) return custom.get(k) || '';
    return style[k] === undefined ? '' : String(style[k]);
  });
  return style;
}

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.parentNode = null;
    this.style = makeStyle();
    this.dataset = {};
    this.attributes = {};
    this.events = {};
    this.textContent = '';
    this.hidden = false;
    this.classList = new ClassList();
  }

  set className(v) {
    this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get className() { return this.classList.toString(); }

  /** Any non-zero value works: we only need the measurement to happen. */
  get scrollHeight() { return 40 + this.childNodes.length * 20; }

  append(...kids) {
    for (const kid of kids) {
      if (kid === null || kid === undefined) continue;
      kid.parentNode = this;
      this.childNodes.push(kid);
    }
  }
  removeChild(kid) {
    const i = this.childNodes.indexOf(kid);
    if (i >= 0) this.childNodes.splice(i, 1);
    kid.parentNode = null;
    return kid;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  get firstChild() { return this.childNodes[0] || null; }
  /** Like in the browser: on the page is whoever reaches the body through real parents. */
  get isConnected() {
    let n = this;
    while (n.parentNode) {
      if (!n.parentNode.childNodes.includes(n)) return false;
      n = n.parentNode;
    }
    return n === globalThis.document.body || n === globalThis.document.documentElement;
  }
  get parentElement() { return this.parentNode; }
  // <select> keeps the chosen value in a property, not an attribute.
  get value() { return this._value === undefined ? '' : this._value; }
  set value(v) { this._value = String(v); }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    // In the real DOM, setAttribute('class') feeds the classList - and that is
    // how SVGs set their class.
    if (k === 'class') this.className = v;
    // And an input's `value` attribute sets the INITIAL value: `.value`
    // reflects it until someone types. Since el() builds everything through
    // setAttribute, without this every field created by the app was born empty
    // for the test - and any case reading `.value` was reading '' and passing
    // without proving anything.
    if (k === 'value' && this._value === undefined) this._value = String(v);
  }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  addEventListener(type, fn) { (this.events[type] = this.events[type] || []).push(fn); }
  removeEventListener() {}

  /**
   * A real `click()`, not just the event fired from outside.
   *
   * The app uses `field.click()` to open the file picker and to download a
   * blob - both are code running in production that blew up here with "click
   * is not a function", so the whole path was out of reach. It does not
   * bubble: no case needs it, and bubbling without `stopPropagation` would be
   * inventing behavior.
   */
  click() {
    for (const fn of (this.events.click || []).slice()) {
      fn({ type: 'click', target: this, currentTarget: this,
        preventDefault() {}, stopPropagation() {} });
    }
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }

  /**
   * Simple selectors: `.class` and tag names, separated by commas.
   *
   * Always returning null, as before, hid behavior: `zoneOf` on the panel uses
   * closest('.tap-minus') to know WHERE the finger touched, so every edge tap
   * was read as a center tap inside the tests.
   */
  matches(sel) {
    return String(sel).split(',').some((part) => {
      const target = part.trim();
      if (!target) return false;
      if (target.startsWith('.')) return this.classList.contains(target.slice(1));
      return this.tagName === target.toUpperCase();
    });
  }
  closest(sel) {
    let n = this;
    while (n) {
      if (typeof n.matches === 'function' && n.matches(sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  /** Fixed measurements: the views only need the call to exist and return numbers. */
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
  blur() {}
  scrollIntoView() {}
  get offsetHeight() { return 60; }
  get offsetTop() { return 0; }
}

const viewportListeners = {};
const windowListeners = {};

/** How many history entries were pushed and given back. */
export const historyLog = { pushed: 0, back: 0 };

/** Fires a `window` event - popstate, pagehide, resize. */
export function fireWindow(type, event = {}) {
  for (const fn of windowListeners[type] || []) fn({ type, ...event });
}

/**
 * Simulates the phone keyboard going up.
 *
 * It models the browser where the defect showed: `innerHeight` follows the
 * VISUAL viewport (it shrinks with the keyboard), while
 * `documentElement.clientHeight` - the reference `position: fixed` and `100%`
 * resolve against - is still the whole layout.
 *
 * That difference is what the test needs: the old math, reading
 * `innerHeight`, gave zero precisely here.
 */
export function simulateKeyboard({
  layout, visible, offset = 0, withField = true,
}) {
  if (!globalThis.visualViewport) return;
  globalThis.document.documentElement.clientHeight = layout;
  globalThis.innerHeight = visible;
  globalThis.visualViewport.height = visible;
  globalThis.visualViewport.offsetTop = offset;

  // A keyboard only exists with a focused text field. `withField: false`
  // models the other way the visual viewport shrinks: the phone URL bar, which
  // is not a keyboard and cannot push any panel.
  const doc = globalThis.document;
  doc.activeElement = withField ? doc.createElement('input') : doc.body;

  for (const fn of viewportListeners.resize || []) fn();
}

/**
 * Who is under the finger, for the drag.
 *
 * The stub has no layout, so there is no computing who occupies a point on
 * the screen. The test points: `pointAt(node)` is what `elementFromPoint`
 * returns on the next query. Without this, the central gesture of the table -
 * dragging from one panel to another - cannot be exercised.
 */
let underFinger = null;

export function pointAt(node) {
  underFinger = node || null;
}

/** How much the app thinks the keyboard took, in px. */
export function currentKb() {
  return globalThis.document.documentElement.style.getPropertyValue('--kb');
}

/**
 * Fires an event on the node. It covers addEventListener AND the `on<type>`
 * property, because the real DOM accepts both forms.
 */
export function fire(node, type, event = {}) {
  // Firing on a node that does not exist cannot be silent: a selector that
  // missed the target would make the test 'pass' without exercising anything,
  // and the next assertion would fail far from the cause.
  if (!node) throw new Error('fire(): missing node — the test selector did not find the target');
  let stopped = false;
  const ev = {
    target: node,
    currentTarget: node,
    preventDefault() {},
    stopPropagation() { stopped = true; },
    ...event,
  };

  // Bubbles up the tree, like the real DOM. Without it, a tap on a panel strip
  // never reached the handler - which sits on the whole panel, not on the
  // strip - and the gesture tests measured something that did not happen.
  let target = node;
  while (target && !stopped) {
    ev.currentTarget = target;
    for (const fn of (target.events && target.events[type]) || []) {
      fn(ev);
      if (stopped) break;
    }
    const prop = target['on' + type];
    if (!stopped && typeof prop === 'function') prop(ev);
    target = target.parentNode;
  }
}

/** All the text of a subtree, to find buttons by their label. */
export function textOf(node) {
  let s = node.textContent || '';
  for (const k of node.childNodes || []) s += textOf(k);
  return s;
}

/** Walks the tree and returns every node carrying the given class. */
export function findAll(node, className, out = []) {
  if (node.classList && node.classList.contains(className)) out.push(node);
  for (const kid of node.childNodes || []) findAll(kid, className, out);
  return out;
}

if (simulated) {
  const doc = new Node('document');
  doc.body = new Node('body');
  // The app looks for #app on load; without it there is nowhere to draw.
  doc.byId = new Map();
  const appRoot = new Node('main');
  doc.byId.set('app', appRoot);
  doc.body.append(appRoot);
  doc.documentElement = new Node('html');
  doc.createElement = (tag) => new Node(tag);
  doc.createElementNS = (_ns, tag) => new Node(tag);
  doc.getElementById = (id) => doc.byId.get(id) || null;
  doc.createTextNode = (text) => {
    const n = new Node('#text');
    n.nodeType = 3;
    n.textContent = text;
    return n;
  };

  // See pointAt(): the test says who is under the finger.
  doc.elementFromPoint = () => underFinger;

  globalThis.document = doc;

  // Enough for the views to come up: store reads localStorage on load, and
  // theme asks matchMedia.
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  /**
   * An ENGLISH browser, on purpose.
   *
   * The app detects the language at startup, and the screens drawn there stay
   * in the system language - runAll only switches to Portuguese AFTERWARDS.
   * Node has its own `navigator.language`, which reflects the MACHINE locale:
   * Portuguese on the author's Windows, English on the CI Ubuntu. A test that
   * compared fixed text passed here and broke there. Pinning English makes the
   * startup deterministic, and the same as CI.
   */
  // `globalThis.navigator` cannot be reassigned in Node - it is read-only - so
  // the property is redefined on the object that already exists.
  try {
    Object.defineProperty(globalThis.navigator, 'languages', {
      value: ['en-US', 'en'], configurable: true,
    });
  } catch { /* navigator locked: the startup language varies again */ }

  /**
   * visualViewport: enough to check the keyboard math.
   *
   * It exists because "the panel stays behind the keyboard" was a real defect,
   * and the cause was which height was read. Testing that needs a viewport the
   * test can move.
   */
  globalThis.visualViewport = {
    height: 800,
    offsetTop: 0,
    addEventListener(type, fn) {
      (viewportListeners[type] = viewportListeners[type] || []).push(fn);
    },
    removeEventListener() {},
  };
  globalThis.window = globalThis;
  globalThis.isSecureContext = true;

  // `window` listeners really work.
  //
  // They were a no-op, and with that nothing hung on window existed in the
  // tests - `popstate` and `pagehide` were out of reach. They are precisely
  // lifecycle events, the kind nobody notices broken.
  globalThis.addEventListener = (type, fn) => {
    (windowListeners[type] = windowListeners[type] || []).push(fn);
  };
  globalThis.removeEventListener = (type, fn) => {
    windowListeners[type] = (windowListeners[type] || []).filter((x) => x !== fn);
  };

  globalThis.location = {
    href: 'http://localhost/', pathname: '/', search: '', hash: '',
    assign() {}, replace() {}, reload() {},
  };
  // `back()` counts the calls: that is how it is proven that leaving through
  // the arrow GIVES BACK the pushed entry, instead of piling up history behind
  // the app.
  globalThis.history = {
    replaceState() {},
    pushState() { historyLog.pushed += 1; },
    back() { historyLog.back += 1; },
  };

  // The network is always refused in the tests. The cloud module handles
  // failure on every path, so this exercises the offline behavior - and makes
  // sure running the suite never fires a real call to Supabase.
  globalThis.fetch = () => Promise.reject(new Error('no network in the tests'));
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
}
