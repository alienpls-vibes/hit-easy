/**
 * The markup helpers every section uses.
 *
 * Sections write their HTML as a tagged template - `html\`<h2>${title}</h2>\``
 * - because markup reads as markup, and that is what makes a section easy to
 * edit by hand. Every `${value}` is ESCAPED: a name typed at the table cannot
 * inject HTML into the statistics page. Arrays are joined, so
 * `${items.map((i) => html\`<li>${i}</li>\`)}` works, and null, undefined and
 * false render nothing, so `${cond ? html\`...\` : null}` works too.
 *
 * Only `raw()` skips the escaping - use it for markup you wrote yourself,
 * never for data.
 */

const SAFE = '__safeHtml';

export function raw(markup) {
  const out = {};
  out[SAFE] = String(markup);
  return out;
}

export function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function piece(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(piece).join('');
  if (typeof value === 'object' && SAFE in value) return value[SAFE];
  return escape(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += piece(v) + strings[i + 1]; });
  return raw(out);
}

/** The markup as real DOM nodes (a fragment). */
export function toNodes(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = typeof markup === 'object' && SAFE in markup ? markup[SAFE] : String(markup);
  return tpl.content;
}

/** Replaces what is inside `target` with `markup`. */
export function fill(target, markup) {
  while (target.firstChild) target.removeChild(target.firstChild);
  target.appendChild(toNodes(markup));
}

/** `{ name }` interpolation for texts in content/<lang>.js: 'Olá, {name}'. */
export function format(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (whole, key) => (
    vars && Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole
  ));
}

/**
 * A short message near the bottom of the screen.
 *
 * `role="status"` so screen readers announce it; it removes itself.
 */
export function toast(text) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.textContent = text;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-on'));
  setTimeout(() => {
    node.classList.remove('is-on');
    setTimeout(() => node.remove(), 400);
  }, 3200);
}

/**
 * Copies text, with a fallback for browsers without the clipboard API.
 *
 * `navigator.clipboard` only exists on https and is missing in some in-app
 * browsers (Instagram, Facebook) - exactly where "copy the link" matters most.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* falls through to the old way */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}
