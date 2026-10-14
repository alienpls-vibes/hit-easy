/**
 * Download / install.
 *
 * The app is a PWA, so "download" means installing from the browser - and the
 * gesture changes with every device and browser. The section guesses the
 * visitor's (lib/platform.js) and opens on its steps; tabs show the other
 * devices, for whoever is reading on the computer to install on the phone.
 *
 * Where the browser offers it (Chrome, Edge and Samsung Internet on Android
 * and desktop), the "Instalar o Hit Easy" button opens the real install
 * prompt right here - the page links the app's manifest, so what gets
 * installed is the app. Everywhere else the steps lead through the app page,
 * which is the one place every browser can install from.
 *
 * Used on the home page and on download.html (where its title becomes the h1).
 */

import { html, fill, toast, copyText } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { detect, isStandalone } from '../lib/platform.js';
import { resolve } from '../lib/links.js';

const TABS = ['android', 'ios', 'desktop'];

export default function render({ text, page }) {
  const title = page === 'download'
    ? html`<h1 class="section-title">${text.title}</h1>`
    : html`<h2 class="section-title">${text.title}</h2>`;
  return html`
    <section class="section install${page === 'download' ? ' is-page' : ''}" id="baixar">
      <div class="container">
        <header class="section-head reveal">
          <p class="eyebrow">${text.eyebrow}</p>
          ${title}
          <p class="section-text">${text.text}</p>
        </header>
        <div class="install-card card reveal">
          <div class="tabs" role="tablist" aria-label="${text.others}">
            ${TABS.map((t) => html`
              <button class="tab" type="button" role="tab" id="install-tab-${t}"
                aria-controls="install-panel" aria-selected="false" data-tab="${t}">
                ${icon(t === 'desktop' ? 'monitor' : 'phone')}<span>${text.tabs[t]}</span>
              </button>`)}
          </div>
          <div class="install-panel" id="install-panel" role="tabpanel" aria-live="polite"></div>
        </div>
      </div>
    </section>`;
}

function guideFor(text, key, os) {
  return text.guides[key] || text.guides[os + '-default'] || text.guides[text.tabGuides[os]];
}

export function mount(node, { text }) {
  const device = detect();
  const panel = node.querySelector('.install-panel');
  const appHref = resolve('{app}');
  let current = device.os;
  let installer = null; // lib/app.js, loaded below

  const canPrompt = () => installer && installer.installState().mode === 'ready';

  const paint = () => {
    node.querySelectorAll('.tab').forEach((tab) => {
      const on = tab.getAttribute('data-tab') === current;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-detected', tab.getAttribute('data-tab') === device.os);
    });
    panel.setAttribute('aria-labelledby', 'install-tab-' + current);

    const mine = current === device.os;
    const guide = mine ? guideFor(text, device.key, device.os) : text.guides[text.tabGuides[current]];

    if (mine && isStandalone()) {
      fill(panel, html`
        <p class="install-done">${icon('check')}<span>${text.standalone}</span></p>
        <div class="button-row"><a class="btn btn-primary" href="${appHref}">${text.openApp}</a></div>`);
      return;
    }

    const prompt = mine && guide.action === 'prompt' && canPrompt();
    const actions = [];
    if (prompt) {
      actions.push(html`<button class="btn btn-primary btn-lg" type="button" data-install>
        ${icon('download')}<span>${text.installButton}</span></button>`);
    }
    if (mine && guide.action === 'copy-link') {
      actions.push(html`<button class="btn btn-primary" type="button" data-copy>
        ${icon('copy')}<span>${text.copyLink}</span></button>`);
    } else {
      actions.push(html`<a class="btn ${prompt ? 'btn-ghost' : 'btn-primary'}" href="${appHref}">
        ${icon('external')}<span>${text.openApp}</span></a>`);
    }

    fill(panel, html`
      ${mine ? html`<p class="tag tag-accent">${text.detected}</p>` : null}
      <h3 class="install-title">${guide.title}</h3>
      <ol class="install-steps">
        ${guide.steps.map((s, i) => html`
          <li class="install-step">
            <span class="install-step-icon">${icon(s.icon)}<span class="install-step-n">${i + 1}</span></span>
            <span class="install-step-text">${s.text}</span>
          </li>`)}
      </ol>
      ${guide.note ? html`<p class="fine-print">${guide.note}</p>` : null}
      <div class="button-row">${actions}</div>`);

    const installBtn = panel.querySelector('[data-install]');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        const outcome = await installer.promptInstall();
        if (outcome === 'accepted') toast(text.installed);
        else if (outcome === 'dismissed') toast(text.dismissed);
        paint();
      });
    }
    const copyBtn = panel.querySelector('[data-copy]');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const link = new URL(appHref, location.href).href;
        toast((await copyText(link)) ? text.copied : text.copyFailed);
      });
    }
  };

  const tabs = Array.prototype.slice.call(node.querySelectorAll('.tab'));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => { current = tab.getAttribute('data-tab'); paint(); });
    // Arrow keys move between tabs, as the tab pattern expects.
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.indexOf(current);
      current = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      paint();
      tabs[TABS.indexOf(current)].focus();
    });
  });

  paint();

  // The install prompt may arrive late (Chrome decides on its own time), so
  // the panel redraws when it does.
  import('../lib/app.js').then((mod) => {
    installer = mod;
    mod.onInstallChange(paint);
    paint();
  }).catch(() => { /* without the module the steps still work */ });
}
