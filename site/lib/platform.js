/**
 * Which device and browser the visitor is on - only to pick which install
 * steps to show first.
 *
 * Installing a PWA is a different gesture on every combination, and showing
 * the wrong one is worse than showing none: the person looks for a button that
 * is not there. The other platforms stay one tap away in the install section,
 * so a wrong guess here never leaves anyone stuck.
 *
 * Returns { os, browser, key }:
 *   os       'ios' | 'android' | 'desktop'
 *   browser  'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'in-app' | 'other'
 *   key      `${os}-${browser}`, the name used by content.install.guides
 */

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|TikTok|musical_ly|Snapchat|GSA\/|Twitter|; wv\)/i;

export function detect(ua, touchPoints) {
  const agent = ua !== undefined ? ua : (navigator.userAgent || '');
  const touch = touchPoints !== undefined ? touchPoints : (navigator.maxTouchPoints || 0);

  // A modern iPad announces itself as a Mac; touch is what gives it away.
  const ios = /iphone|ipad|ipod/i.test(agent) || (/Macintosh/.test(agent) && touch > 1);
  const android = !ios && /android/i.test(agent);
  const os = ios ? 'ios' : android ? 'android' : 'desktop';

  let browser = 'other';
  if (IN_APP.test(agent)) browser = 'in-app';
  else if (ios) {
    if (/CriOS/.test(agent)) browser = 'chrome';
    else if (/EdgiOS/.test(agent)) browser = 'edge';
    else if (/FxiOS/.test(agent)) browser = 'firefox';
    else if (/OPiOS|OPT\/|DuckDuckGo|YaBrowser/.test(agent)) browser = 'other';
    else browser = 'safari';
  } else if (/SamsungBrowser/.test(agent)) browser = 'samsung';
  else if (/Edg\//.test(agent)) browser = 'edge';
  else if (/Firefox\//.test(agent)) browser = 'firefox';
  else if (/OPR\/|Opera/.test(agent)) browser = 'other';
  else if (/Chrome\//.test(agent)) browser = 'chrome';
  else if (/Safari\//.test(agent)) browser = 'safari';

  return { os, browser, key: os + '-' + browser };
}

/** Already running as an installed app (home screen icon)? */
export function isStandalone() {
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
}
