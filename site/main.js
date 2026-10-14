/**
 * Builds the page from its sections.
 *
 * Every section is a module in sections/ with:
 *
 *   export default function render(ctx)   -> markup (lib/dom.js `html`)
 *   export function mount(node, ctx)      -> optional: behavior, after it is on the page
 *
 * `ctx` carries { site, content, page, text }, where `text` is this section's
 * group in content.js. All sections are fetched in parallel and drawn in the
 * order of pages.js. A section that fails to load is skipped and logged - one
 * broken block must not leave the visitor with a blank page.
 */

import { SITE } from './config.js';
import { CONTENT } from './content.js';
import { PAGES } from './pages.js';
import { toNodes } from './lib/dom.js';

const root = document.getElementById('site');
const page = document.body.getAttribute('data-page') || 'home';

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
  const sections = await Promise.all(names.map(load));

  const mounts = [];
  const frag = document.createDocumentFragment();
  for (const { name, mod } of sections) {
    if (!mod || typeof mod.default !== 'function') continue;
    const ctx = { site: SITE, content: CONTENT, page, text: CONTENT[name] || {} };
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

  for (const run of mounts) {
    try {
      const pending = run();
      if (pending && typeof pending.catch === 'function') {
        pending.catch((error) => console.error('[site] mount failed:', error));
      }
    } catch (error) {
      console.error('[site] mount failed:', error);
    }
  }

  scrollToHash();
  reveal();
}

/**
 * The page is drawn after the browser tried to jump to `#anchor`, so the jump
 * found nothing. Doing it again now that the target exists.
 */
function scrollToHash() {
  if (!location.hash || location.hash.length < 2) return;
  let target = null;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* bad hash */ }
  if (target) target.scrollIntoView();
}

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
