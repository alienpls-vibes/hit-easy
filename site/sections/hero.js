/**
 * The opening block: headline, the two main buttons and the app's real table
 * screen on a phone lying flat.
 *
 * The picture is a screenshot of the actual app (assets/table.webp, with a
 * JPEG for browsers without WebP), taken from a simulated match - see
 * README.md, "The table screenshot". Which file and its description come from
 * content.hero.screenshot.
 */

import { html } from '../lib/dom.js';
import { linkTo } from '../lib/links.js';
import { icon } from '../lib/icons.js';

export default function render({ text }) {
  const shot = text.screenshot;
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
        <figure class="hero-art">
          <div class="phone">
            <span class="phone-button phone-volume" aria-hidden="true"></span>
            <span class="phone-button phone-power" aria-hidden="true"></span>
            <div class="phone-body">
              <span class="phone-camera" aria-hidden="true"></span>
              <div class="phone-glass">
                <picture>
                  <source srcset="${shot.webp}" type="image/webp">
                  <img class="phone-screen" src="${shot.jpg}" alt="${shot.alt}"
                    width="${shot.width}" height="${shot.height}" decoding="async">
                </picture>
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>`;
}
