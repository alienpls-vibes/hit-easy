/**
 * Top bar: logo, links, account and the download button.
 *
 * On phones the links fold into a menu button. The account link says "Entrar"
 * or "Minha conta" depending on whether this browser already has a session -
 * read from the disk, without a network trip, so the bar never waits.
 *
 * The language picker is a native <select>, invisible over a compact face
 * (globe + "PT"): the bar stays short, and a tap opens the system's own list
 * with the full names, which every phone browser already knows how to show.
 */

import { html, raw } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { linkTo } from '../lib/links.js';
import { switchLang } from '../lib/lang.js';
import { LANGS } from '../content.js';

export default function render({ site, text, lang }) {
  return html`
    <header class="nav">
      <div class="container nav-inner">
        <a class="brand" href="index.html">
          <img class="brand-logo" src="${site.logo}" alt="" width="32" height="32">
          <span class="brand-name">${site.name}</span>
        </a>
        <nav class="nav-links" id="nav-links" aria-label="${text.menuLabel}">
          ${text.links.map((l) => linkTo(l, 'nav-link'))}
          <a class="nav-link nav-account" href="account.html" data-account-link>
            ${icon('user')}<span>${text.signIn}</span>
          </a>
          <label class="nav-lang">
            <span class="nav-lang-face" aria-hidden="true">${icon('globe')}<span>${lang.toUpperCase()}</span></span>
            <span class="nav-lang-name">${text.language}</span>
            <select class="nav-lang-select" data-lang aria-label="${text.language}">
              ${LANGS.map(([code, name]) => html`
                <option value="${code}"${code === lang ? raw(' selected') : null}>${name}</option>`)}
            </select>
          </label>
          ${linkTo(text.cta, 'btn btn-primary btn-sm nav-cta')}
        </nav>
        <button class="nav-toggle" type="button" aria-expanded="false"
          aria-controls="nav-links" aria-label="${text.openMenu}">
          <span class="nav-toggle-open">${icon('menu')}</span>
          <span class="nav-toggle-close">${icon('close')}</span>
        </button>
      </div>
    </header>`;
}

export function mount(node, { text }) {
  const toggle = node.querySelector('.nav-toggle');
  const setOpen = (open) => {
    node.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? text.closeMenu : text.openMenu);
  };
  toggle.addEventListener('click', () => setOpen(!node.classList.contains('is-open')));
  // Tapping a link closes the menu - otherwise an in-page anchor scrolls
  // behind an open menu that still covers the screen.
  node.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // Marks where we are: the link to this page gets aria-current.
  const here = location.pathname.split('/').pop() || 'index.html';
  node.querySelectorAll('.nav-links a').forEach((a) => {
    const target = (a.getAttribute('href') || '').split('#')[0];
    if (target && target === here && !a.getAttribute('href').includes('#')) {
      a.setAttribute('aria-current', 'page');
    }
  });

  const picker = node.querySelector('[data-lang]');
  picker.addEventListener('change', () => switchLang(picker.value));

  // A shadow under the bar only once the page has scrolled.
  const onScroll = () => node.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  import('../lib/app.js').then(({ cloud }) => {
    const paint = () => {
      const label = node.querySelector('[data-account-link] span');
      if (label) label.textContent = cloud.account.session ? text.account : text.signIn;
    };
    paint();
    cloud.onAccountChange(paint);
  }).catch(() => { /* no cloud: the link keeps saying "Entrar" */ });
}
