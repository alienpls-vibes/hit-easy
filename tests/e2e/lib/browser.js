/**
 * Finds and launches a headless Chromium (Chrome or Edge).
 *
 * Any Chromium works: the journeys only need the DevTools protocol. CI has
 * Google Chrome on ubuntu-latest; a Windows laptop always has Edge. CHROME_PATH
 * overrides the search.
 *
 * Every launch gets a brand-new profile in a temp folder, deleted on close: a
 * journey must never inherit the service worker, cache or localStorage of the
 * previous one - that is exactly the "works on my phone" trap.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Connection } from './cdp.js';

const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge',
  ],
};

function onPath(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function findBrowser() {
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) {
      throw new Error('CHROME_PATH points to a file that does not exist: ' + process.env.CHROME_PATH);
    }
    return process.env.CHROME_PATH;
  }
  for (const c of CANDIDATES[process.platform] || CANDIDATES.linux) {
    const found = path.isAbsolute(c) ? (fs.existsSync(c) ? c : null) : onPath(c);
    if (found) return found;
  }
  throw new Error('No Chrome, Chromium or Edge found. Install one or set CHROME_PATH.');
}

/** Launches the browser and connects to it. Returns { conn, close }. */
export async function launch() {
  const exe = findBrowser();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-easy-e2e-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--mute-audio',
    '--hide-scrollbars',
    // The install prompt depends on engagement heuristics; the journeys test
    // the app's own fallback, so the browser should not decide for them.
    '--disable-features=Translate,MediaRouter,OptimizationHints',
  ];
  // GitHub's Ubuntu runners restrict unprivileged user namespaces, which the
  // Chrome sandbox needs. The page under test is our own code.
  if (process.platform === 'linux') args.push('--no-sandbox');
  args.push('about:blank');

  const child = spawn(exe, args, { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  let endpoint = null;
  while (!endpoint) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error('The browser did not open its DevTools port: ' + exe);
    }
    if (child.exitCode !== null) throw new Error('The browser exited on start (' + child.exitCode + '): ' + exe);
    try {
      const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (port && wsPath) endpoint = 'ws://127.0.0.1:' + port + wsPath;
    } catch { /* not written yet */ }
    if (!endpoint) await new Promise((r) => setTimeout(r, 100));
  }

  const conn = await Connection.open(endpoint);
  const close = async () => {
    try { await conn.send('Browser.close'); } catch { /* already closing */ }
    conn.close();
    await new Promise((r) => {
      if (child.exitCode !== null) return r();
      child.once('exit', r);
      setTimeout(() => { child.kill(); r(); }, 3000);
    });
    // The profile can stay locked for a moment on Windows.
    for (let i = 0; i < 10; i += 1) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
  };
  return { conn, close, exe };
}
