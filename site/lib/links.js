/**
 * Links in content.js can use two placeholders, so the copy never hardcodes
 * where the app is:
 *
 *   {app}      the app itself (SITE.appUrl)
 *   {privacy}  the privacy policy (SITE.privacyUrl)
 *
 * Everything else passes through untouched (`download.html`,
 * `index.html#recursos`, `https://...`).
 */

import { SITE } from '../config.js';
import { html, raw } from './dom.js';

export function resolve(href) {
  return String(href || '#')
    .replace('{app}', SITE.appUrl)
    .replace('{privacy}', SITE.privacyUrl);
}

/** Opens in a new tab only when it leaves the site's origin. */
export function isExternal(href) {
  try {
    return new URL(resolve(href), location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

/**
 * A link from content.js ({ label, href }) as an <a>, with a class.
 * Links that leave the site open in a new tab.
 */
export function linkTo(link, className = '') {
  if (!link) return null;
  const extra = isExternal(link.href) ? raw(' target="_blank" rel="noopener"') : null;
  return html`<a class="${className}" href="${resolve(link.href)}"${extra}>${link.label}</a>`;
}
