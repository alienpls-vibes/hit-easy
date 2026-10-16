/**
 * "Tell me when there is a new card" - the service worker side.
 *
 * A classic script pulled into sw.js with importScripts: a worker does not
 * import modules (see the note at the top of sw.js). Everything the daily
 * challenge needs from the worker lives here, so sw.js only gains one line.
 *
 * When the browser wakes the worker (Periodic Background Sync, tag
 * 'hiteasy-daily'), it shows ONE notice per day, and only:
 *   - if the person turned the notice on (config written by notify.js),
 *   - between 08:00 and 22:00 on the device's clock - the card turns at
 *     midnight, and nobody wants a phone buzzing about it at 00:01,
 *   - if today's card was not played yet.
 *
 * Tapping the notice opens the app straight into the challenge.
 */

(function () {
  var TAG = 'hiteasy-daily';
  var BETA = /(^|\/)beta(\/|$)/.test(self.location.pathname);
  var DB_NAME = 'hiteasy-daily' + (BETA ? '-beta' : '');
  var STORE = 'kv';
  var KEY = 'notify';
  var FIRST_HOUR = 8;
  var LAST_HOUR = 22;

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function readConfig(db) {
    return new Promise(function (resolve) {
      var req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = function () { resolve(req.result || {}); };
      req.onerror = function () { resolve({}); };
    });
  }

  function writeConfig(db, config) {
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(config, KEY);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  /* The same 'YYYY-MM-DD' in local time as dayKey() in schedule.js. */
  function today() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function maybeNotify() {
    var hour = new Date().getHours();
    if (hour < FIRST_HOUR || hour >= LAST_HOUR) return Promise.resolve();
    return openDb().then(function (db) {
      return readConfig(db).then(function (config) {
        var key = today();
        if (!config.enabled || config.lastNotified === key || config.playedOn === key) return null;
        config.lastNotified = key;
        return self.registration.showNotification(config.title || 'Hit Easy', {
          body: config.body || '',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: TAG,
          data: { url: './?daily=1' },
        }).then(function () { return writeConfig(db, config); });
      });
    }).catch(function () { /* no IndexedDB: no notice, nothing else breaks */ });
  }

  self.addEventListener('periodicsync', function (event) {
    if (event.tag !== TAG) return;
    event.waitUntil(maybeNotify());
  });

  self.addEventListener('notificationclick', function (event) {
    if (event.notification.tag !== TAG) return;
    event.notification.close();
    var url = new URL('./?daily=1', self.registration.scope).href;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        // An open app is reused: it gets a message and opens the challenge
        // itself, keeping whatever was on screen underneath.
        for (var i = 0; i < list.length; i += 1) {
          var client = list[i];
          // Production's scope also covers /beta/: a beta tab is not ours.
          var otherChannel = !BETA && /\/beta(\/|$)/.test(new URL(client.url).pathname);
          if (client.url.indexOf(self.registration.scope) === 0 && !otherChannel && 'focus' in client) {
            client.postMessage({ type: 'DAILY_OPEN' });
            return client.focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(url) : null;
      }),
    );
  });
})();
