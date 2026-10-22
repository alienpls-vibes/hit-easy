/**
 * Builds the page from its sections.
 *
 * Every section is a module in sections/ with:
 *
 *   export default function render(ctx)   -> markup (lib/dom.js `html`)
 *   export function mount(node, ctx)      -> optional: behavior, after it is on the page
 *
 * `ctx` carries { site, content, page, text, lang, locale }, where `text` is
 * this section's group in the content of the visitor's language
 * (content/<lang>.js, laid over Portuguese - see content.js) and `locale` is
 * for dates and numbers. All sections are fetched in parallel and drawn in
 * the order of pages.js. A section that fails to load is skipped and logged - one
 * broken block must not leave the visitor with a blank page.
 */

import { SITE } from './config.js';
import { LANGS, LOCALES, loadContent } from './content.js';
import { PAGES } from './pages.js';
import { toNodes } from './lib/dom.js';
import { pickLang } from './lib/lang.js';

const root = document.getElementById('site');
const page = document.body.getAttribute('data-page') || 'home';
const lang = pickLang(LANGS.map((l) => l[0]));
const locale = LOCALES[lang] || LOCALES.pt;

/**
 * The tab title, search description and <html lang> of the page, in the
 * visitor's language. The HTML carries the Portuguese ones, for whoever reads
 * the page without running it (search engines, link previews).
 */
function applyMeta(content) {
  document.documentElement.setAttribute('lang', locale);
  const meta = content.meta && content.meta.pages && content.meta.pages[page];
  if (!meta) return;
  if (meta.title) document.title = meta.title;
  const description = document.querySelector('meta[name="description"]');
  if (description && meta.description) description.setAttribute('content', meta.description);
}

function load(name) {
  return import('./sections/' + name + '.js')
    .then((mod) => ({ name, mod }))
    .catch((error) => {
      console.error('[site] section "' + name + '" did not load:', error);
      return { name, mod: null };
    });
}

async function start() {
  const names = PAGES[page] || PAGES.home;
  const [content, sections] = await Promise.all([loadContent(lang), Promise.all(names.map(load))]);
  applyMeta(content);

  const mounts = [];
  const frag = document.createDocumentFragment();
  for (const { name, mod } of sections) {
    if (!mod || typeof mod.default !== 'function') continue;
    const ctx = {
      site: SITE, content, page, text: content[name] || {}, lang, locale,
    };
    try {
      const nodes = toNodes(mod.default(ctx));
      const node = nodes.firstElementChild;
      if (!node) continue;
      // Lets anyone inspecting the page find the file that drew it.
      node.setAttribute('data-section', name);
      frag.appendChild(nodes);
      if (typeof mod.mount === 'function') mounts.push(() => mod.mount(node, ctx));
    } catch (error) {
      console.error('[site] section "' + name + '" failed to render:', error);
    }
  }
  root.appendChild(frag);
  root.removeAttribute('aria-busy');

  const settled = [];
  for (const run of mounts) {
    try {
      const pending = run();
      if (pending && typeof pending.then === 'function') {
        settled.push(pending.catch((error) => console.error('[site] mount failed:', error)));
      }
    } catch (error) {
      console.error('[site] mount failed:', error);
    }
  }

  scrollToHash();
  reveal();

  // Sections that finish drawing later (install guide, account) change the
  // height of the page; once they are done, land on the anchor again - unless
  // the visitor already scrolled away on their own.
  const landedAt = window.scrollY;
  Promise.all(settled).then(() => {
    if (Math.abs(window.scrollY - landedAt) < 4) scrollToHash();
  });
}

/**
 * The page is drawn after the browser tried to jump to `#anchor`, so the jump
 * found nothing. Doing it again now that the target exists.
 *
 * Instant, not smooth: arriving from another page, a smooth scroll crosses
 * thousands of pixels while the rest of the page is still settling, and it
 * stopped short of the section. The smooth behavior in base.css is switched
 * off for this one jump only.
 */
function scrollToHash() {
  if (!location.hash || location.hash.length < 2) return;
  let target = null;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* bad hash */ }
  if (!target) return;
  const html = document.documentElement;
  const before = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  target.scrollIntoView(true);
  html.style.scrollBehavior = before;
}

/** '/site/' and '/site/index.html' are the same page. */
function samePage(url) {
  const path = (p) => p.replace(/index\.html$/, '');
  return url.origin === location.origin && path(url.pathname) === path(location.pathname);
}

/**
 * Links to an anchor on THIS page scroll instead of reloading it.
 *
 * Content links say `index.html#recursos` so they work from every page. But
 * the home page is usually opened as `/site/`, and to the browser
 * `/site/index.html#recursos` is another document: it reloaded the whole page
 * and redrew every section just to scroll. Same-page anchors are handled
 * here; links to other pages pass through untouched.
 */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest ? e.target.closest('a[href*="#"]') : null;
  if (!link || link.target === '_blank') return;
  let url;
  try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
  if (!samePage(url) || url.hash.length < 2) return;
  let target = null;
  try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* bad hash */ }
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (history.pushState) history.pushState(null, '', url.hash);
});

/**
 * Soft entrance of blocks marked with `.reveal` as they scroll into view.
 *
 * Content is visible by default and only hidden once this runs (the
 * `.js-reveal` class), so a browser without IntersectionObserver - or with
 * reduced motion turned on - simply shows everything.
 */
function reveal() {
  const reduced = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  document.documentElement.classList.add('js-reveal');
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      seen.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((item) => seen.observe(item));
}

start();
