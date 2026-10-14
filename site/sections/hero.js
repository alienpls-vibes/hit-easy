/**
 * The opening block: headline, the two main buttons and an illustration of
 * the table on a phone lying flat.
 *
 * The illustration is drawn in HTML/CSS from content.hero.mockup, not an
 * image: it stays sharp on any screen and changes with the copy. The top row
 * is upside down on purpose - that is how the app draws it, facing the
 * players across the table.
 */

import { html } from '../lib/dom.js';
import { linkTo } from '../lib/links.js';
import { icon } from '../lib/icons.js';
import { identityGradient, manaColors } from '../lib/mana.js';

function panel(p, flipped) {
  const accent = manaColors(p.colors)[0];
  return html`
    <div class="mock-panel${flipped ? ' is-flipped' : ''}${p.active ? ' is-active' : ''}"
      style="--panel-bg: ${identityGradient(p.colors, '160deg')}; --panel-accent: ${accent}">
      <div class="mock-panel-inner">
        <span class="mock-minus" aria-hidden="true">−</span>
        <span class="mock-name">${p.name}</span>
        <span class="mock-life">${p.life}</span>
        <span class="mock-plus" aria-hidden="true">+</span>
      </div>
    </div>`;
}

export default function render({ text }) {
  const m = text.mockup;
  const players = m.players || [];
  const top = players.slice(0, Math.ceil(players.length / 2));
  const bottom = players.slice(top.length);
  return html`
    <section class="hero" id="inicio">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">${text.eyebrow}</p>
          <h1 class="hero-title">${text.title}</h1>
          <p class="hero-text">${text.text}</p>
          <div class="hero-actions">
            ${linkTo(text.primary, 'btn btn-primary btn-lg')}
            ${linkTo(text.secondary, 'btn btn-ghost btn-lg')}
          </div>
          <ul class="hero-badges">
            ${text.badges.map((b) => html`<li>${icon('check')}<span>${b}</span></li>`)}
          </ul>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="mock-phone">
            <div class="mock-screen">
              <div class="mock-row">${top.map((p) => panel(p, true))}</div>
              <div class="mock-row">${bottom.map((p) => panel(p, false))}</div>
              <div class="mock-hub"><span>${m.turn}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
