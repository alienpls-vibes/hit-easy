/*
 * Runs in <head>, before the first paint - a classic script, not a module,
 * because a module would only run after the page is drawn.
 *
 * 1. Theme. The site follows the theme chosen in the app (same origin, same
 *    localStorage) and, without one, the system's. Doing it here avoids a dark
 *    flash for whoever uses light. 'claro' and 'escuro' are the app's stored
 *    values.
 *
 * 2. Install prompt. Chrome fires `beforeinstallprompt` whenever it decides,
 *    often before the modules load; the app's src/install.js reads it from
 *    this same drawer (window.__hitEasyInstall), exactly as in the app's
 *    index.html.
 */
(function () {
  try {
    var cfg = (JSON.parse(localStorage.getItem('mtglc.db.v1')) || {}).settings || {};
    var light = cfg.theme === 'claro'
      || (cfg.theme !== 'escuro' && window.matchMedia
        && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f4f4f2' : '#08080a');
  } catch (e) { /* blocked storage: the CSS follows the system */ }

  window.__hitEasyInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__hitEasyInstall = e;
  });
  window.addEventListener('appinstalled', function () {
    window.__hitEasyInstall = null;
  });
})();
