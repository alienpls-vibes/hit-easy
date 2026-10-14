/**
 * Footer: brand, link columns, contact and social links (from config.js) and
 * the legal line.
 */

import { html, format } from '../lib/dom.js';
import { linkTo } from '../lib/links.js';

export default function render({ text, site, content }) {
  return html`
    <footer class="footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <a class="brand" href="index.html">
            <img class="brand-logo" src="${site.logo}" alt="" width="32" height="32">
            <span class="brand-name">${site.name}</span>
          </a>
          <p class="footer-tagline">${site.tagline}</p>
          <p class="footer-text">${text.text}</p>
          ${site.contactEmail ? html`
            <p class="footer-text">${text.contact}:
              <a class="text-link" href="mailto:${site.contactEmail}">${site.contactEmail}</a></p>` : null}
          ${site.social && site.social.length ? html`
            <ul class="footer-social">
              ${site.social.map((s) => html`<li>${linkTo(s, 'text-link')}</li>`)}
            </ul>` : null}
        </div>
        ${text.columns.map((col) => html`
          <nav class="footer-col" aria-label="${col.title}">
            <h2 class="footer-title">${col.title}</h2>
            <ul>${col.links.map((l) => html`<li>${linkTo(l, 'footer-link')}</li>`)}</ul>
          </nav>`)}
      </div>
      <div class="container footer-legal">
        <p>${format(text.copyright, { year: content.meta.year })}</p>
        <p>${text.legal}</p>
      </div>
    </footer>`;
}
