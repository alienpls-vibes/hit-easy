/** Feature grid: one card per item of content.features.items. */

import { html } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

export default function render({ text }) {
  return html`
    <section class="section features" id="recursos">
      <div class="container">
        <header class="section-head reveal">
          <p class="eyebrow">${text.eyebrow}</p>
          <h2 class="section-title">${text.title}</h2>
          <p class="section-text">${text.text}</p>
        </header>
        <ul class="feature-grid">
          ${text.items.map((f) => html`
            <li class="feature card reveal">
              <span class="feature-icon">${icon(f.icon)}</span>
              <h3 class="feature-title">${f.title}</h3>
              <p class="feature-text">${f.text}</p>
            </li>`)}
        </ul>
      </div>
    </section>`;
}
