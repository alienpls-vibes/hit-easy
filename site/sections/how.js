/** "Como funciona": numbered steps from content.how.steps. */

import { html } from '../lib/dom.js';

export default function render({ text }) {
  return html`
    <section class="section how" id="como-funciona">
      <div class="container">
        <header class="section-head reveal">
          <p class="eyebrow">${text.eyebrow}</p>
          <h2 class="section-title">${text.title}</h2>
        </header>
        <ol class="how-steps">
          ${text.steps.map((s, i) => html`
            <li class="how-step reveal">
              <span class="how-number" aria-hidden="true">${i + 1}</span>
              <h3 class="how-title">${s.title}</h3>
              <p class="how-text">${s.text}</p>
            </li>`)}
        </ol>
      </div>
    </section>`;
}
