/**
 * A minimal Chrome DevTools Protocol client.
 *
 * The project has no dependencies, and Playwright or Puppeteer would be the
 * first. Node 24 ships a WebSocket, and the protocol is JSON messages with
 * ids - the whole client fits here, and nothing has to be installed on a
 * phone-sized laptop or in CI to run the browser journeys.
 *
 * One connection to the BROWSER, with "flat" sessions: every page and service
 * worker is a session id on the same socket. That is what lets the network
 * rules reach the service worker too (see network.js), which a per-page
 * connection cannot do.
 */

export class Connection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (e) => this.onMessage(JSON.parse(e.data)));
    ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('browser connection closed'));
      this.pending.clear();
    });
  }

  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('could not reach the browser at ' + url)), { once: true });
    });
    return new Connection(ws);
  }

  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject, method } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(method + ': ' + msg.error.message));
      else resolve(msg.result || {});
      return;
    }
    if (msg.method) for (const fn of this.listeners) fn(msg);
  }

  /** Sends a command; `sessionId` null talks to the browser itself. */
  send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(msg));
    });
  }

  /** Every event, from every session: `fn({ method, params, sessionId })`. */
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    try { this.ws.close(); } catch { /* already gone */ }
  }
}
