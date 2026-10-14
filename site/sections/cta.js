/** Closing call to action, before the footer. */

import { html } from '../lib/dom.js';
import { linkTo } from '../lib/links.js';

export default function render({ text, site }) {
  return html`
    <section class="section cta">
      <div class="container">
        <div class="cta-box reveal">
          <img class="cta-logo" src="${site.logo}" alt="" width="64" height="64">
          <h2 class="section-title">${text.title}</h2>
          <p class="section-text">${text.text}</p>
          <div class="button-row button-row-center">
            ${linkTo(text.primary, 'btn btn-primary btn-lg')}
            ${linkTo(text.secondary, 'btn btn-ghost btn-lg')}
          </div>
        </div>
      </div>
    </section>`;
}
