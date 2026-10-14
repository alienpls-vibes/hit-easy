/**
 * Questions and answers. Native <details>: opens and closes with no script,
 * on every browser, and screen readers already know what it is.
 */

import { html } from '../lib/dom.js';
import { linkTo } from '../lib/links.js';

export default function render({ text }) {
  return html`
    <section class="section faq" id="perguntas">
      <div class="container container-narrow">
        <header class="section-head reveal">
          <p class="eyebrow">${text.eyebrow}</p>
          <h2 class="section-title">${text.title}</h2>
        </header>
        <div class="faq-list">
          ${text.items.map((item) => html`
            <details class="faq-item reveal">
              <summary class="faq-q"><span>${item.q}</span><span class="faq-mark" aria-hidden="true"></span></summary>
              <div class="faq-a">
                <p>${item.a}</p>
                ${item.link ? html`<p>${linkTo(item.link, 'text-link')}</p>` : null}
              </div>
            </details>`)}
        </div>
      </div>
    </section>`;
}
