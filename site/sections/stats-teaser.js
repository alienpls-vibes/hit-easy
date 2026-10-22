/**
 * The pitch for the account: text on one side, a sample of the statistics on
 * the other. The sample numbers come from content['stats-teaser'].sample and
 * carry an "Exemplo" tag - they illustrate, they are nobody's data.
 *
 * Deck rows are painted like the app's deck cards: the commander's art, the
 * identity pips and a thin win bar in the deck's solid accent.
 */

import { html } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { linkTo } from '../lib/links.js';
import { accentOf, artUrl, pips } from '../lib/mana.js';

export default function render({ text }) {
  const s = text.sample;
  return html`
    <section class="section teaser" id="estatisticas">
      <div class="container teaser-grid">
        <div class="teaser-copy reveal">
          <p class="eyebrow">${text.eyebrow}</p>
          <h2 class="section-title">${text.title}</h2>
          <p class="section-text">${text.text}</p>
          <ul class="checklist">
            ${text.bullets.map((b) => html`<li>${icon('check')}<span>${b}</span></li>`)}
          </ul>
          <div class="button-row">
            ${linkTo(text.primary, 'btn btn-primary')}
            ${linkTo(text.secondary, 'btn btn-ghost')}
          </div>
          <p class="fine-print">${text.note}</p>
        </div>
        <div class="teaser-sample card reveal" aria-hidden="true">
          <div class="sample-head">
            <span class="sample-title">${s.title}</span>
            <span class="tag">${s.tag}</span>
          </div>
          <div class="sample-kpis">
            ${s.kpis.map((k) => html`
              <div class="sample-kpi"><strong>${k.value}</strong><span>${k.label}</span></div>`)}
          </div>
          <ul class="sample-decks">
            ${s.decks.map((d) => {
              const art = artUrl([{ art: d.art }]);
              return html`
                <li class="sample-deck" style="--accent: ${accentOf(d.colors)}">
                  <span class="deck-thumb" style="${art ? 'background-image: ' + art : ''}"></span>
                  <span class="sample-deck-name">${d.name}</span>
                  <span class="sample-deck-rate">${Math.round(d.winrate * 100)}%</span>
                  <span class="sample-deck-meta"><span class="pips">${pips(d.colors)}</span> · ${d.games} ${s.gamesLabel}</span>
                  <span class="bar"><span style="width: ${Math.round(d.winrate * 100)}%"></span></span>
                </li>`;
            })}
          </ul>
        </div>
      </div>
    </section>`;
}
