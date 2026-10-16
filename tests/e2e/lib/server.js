/**
 * A static server shaped like GitHub Pages.
 *
 * Same paths as the real site - production at /hit-easy/, beta at
 * /hit-easy/beta/ - and the same `Cache-Control: max-age=600`, because both
 * matter: the app resolves everything relative to its folder, the service
 * worker's scope is that folder, and the channel comes from the path. A server
 * at `/` would test an app nobody runs.
 *
 * Each mount can be swapped while running (`mount`), which is how the upgrade
 * journey replaces the previous release with this one under the same URL, the
 * way a deploy does. `offline(true)` drops every connection, which is what a
 * phone without signal looks like to the browser.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export async function startServer() {
  const mounts = new Map(); // prefix -> folder
  let isOffline = false;
  const requests = [];
  const overrides = new Map(); // pathname -> body served instead of the file

  const server = http.createServer((req, res) => {
    if (isOffline) { req.socket.destroy(); return; }
    const url = new URL(req.url, 'http://localhost');
    requests.push(url.pathname);
    if (overrides.has(url.pathname)) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(url.pathname)] || 'text/plain', 'Cache-Control': 'no-store' });
      res.end(overrides.get(url.pathname));
      return;
    }

    // Longest prefix wins, so /hit-easy/beta/ is not served by /hit-easy/.
    const prefix = [...mounts.keys()].sort((a, b) => b.length - a.length)
      .find((p) => url.pathname.startsWith(p));
    if (!prefix) { res.writeHead(404).end('not found'); return; }

    const root = mounts.get(prefix);
    let rel = decodeURIComponent(url.pathname.slice(prefix.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403).end(); return; }

    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'max-age=600',
      });
      res.end(body);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  // `localhost` and not 127.0.0.1: it is a secure context, so the service
  // worker registers, exactly as on https.
  const origin = 'http://localhost:' + port;

  return {
    origin,
    requests,
    mount(prefix, folder) { mounts.set(prefix, folder); },
    offline(on) { isOffline = Boolean(on); },
    /** Serves `body` at `pathname` instead of the file (null restores it). */
    override(pathname, body) { if (body === null) overrides.delete(pathname); else overrides.set(pathname, body); },
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
