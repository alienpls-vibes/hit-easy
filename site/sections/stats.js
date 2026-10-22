/**
 * The statistics page: the signed-in person's numbers, from the matches in
 * their account.
 *
 * The numbers are computed by the app's own statistics code
 * (lib/app-stats.js), on the matches the database hands this account. The
 * gate is the same as the app's: without access the database returns an
 * empty list (RLS), and this page shows the lock instead - deleting the check
 * here would reveal nothing.
 *
 * States: loading -> signed out | locked | empty | error | dashboard.
 *
 * Colors follow the app's two families: a DECK is colored by its commander's
 * identity (art, pips, solid accent); a PERSON by their own color
 * (playerColor), the same one they get in the app's Players and Rivals tabs.
 */

import { html, fill, format, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { resolve } from '../lib/links.js';
import {
  accentOf, artUrl, deckIdentity, identityTint, pips,
} from '../lib/mana.js';

export default function render({ text }) {
  return html`
    <section class="section stats-page">
      <div class="container">
        <header class="section-head section-head-left stats-head">
          <div>
            <h1 class="section-title">${text.title}</h1>
            <p class="section-text" data-sub></p>
          </div>
        </header>
        <div class="stats-body" aria-live="polite">
          <p class="muted loading-line">${text.checking}</p>
        </div>
      </div>
    </section>`;
}

/* ------------------------------------------------------------- helpers */

function plural(text, n) {
  return n === 1 ? text.gamesOne : format(text.gamesMany, { n });
}

/** A number the way the visitor's language writes it (2,5 / 2.5). */
function decimal(value, digits, locale) {
  if (!isFinite(value)) return '--';
  return Number(value).toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/**
 * The commander's art, like the app's deck card. Without art (a deck picked
 * offline, before Scryfall answered), the faint identity tint keeps the slot.
 */
function deckThumb(commanders) {
  const art = artUrl(commanders);
  const style = art
    ? 'background-image: ' + art
    : 'background-image: ' + identityTint(deckIdentity(commanders), 0.35);
  return html`<span class="deck-thumb" style="${style}"></span>`;
}

/** A person's initial in their own color - the app's tinted avatar. */
function personAvatar(label, color) {
  return html`<span class="avatar avatar-sm is-tinted" style="--accent: ${color}"
    aria-hidden="true">${(label || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}</span>`;
}

function stateBlock(iconName, title, body, actions, note) {
  return html`
    <div class="card state-block">
      <span class="state-icon">${icon(iconName)}</span>
      <h2 class="state-title">${title}</h2>
      ${body ? html`<p class="state-text">${body}</p>` : null}
      ${actions ? html`<div class="button-row button-row-center">${actions}</div>` : null}
      ${note ? html`<p class="fine-print">${note}</p>` : null}
    </div>`;
}

/* --------------------------------------------------------------- mount */

export async function mount(node, { text, lang, locale }) {
  const body = node.querySelector('.stats-body');
  const sub = node.querySelector('[data-sub]');
  const appHref = resolve('{app}');

  let app;
  try {
    app = await import('../lib/app.js');
  } catch {
    fill(body, stateBlock('offline', text.error, null, null));
    return;
  }
  const { cloud } = app;
  if (!app.cloudEnabled()) {
    fill(body, stateBlock('lock', text.lockedTitle, text.earlyAccess, null));
    return;
  }

  await cloud.boot();

  if (!cloud.account.session) {
    fill(body, stateBlock('user', text.signedOutTitle, text.signedOutText,
      html`<a class="btn btn-primary" href="account.html?next=stats">${text.signedOutButton}</a>`));
    return;
  }

  if (cloud.state() !== 'subscriber') {
    showLocked();
    return;
  }
  load();

  function showLocked() {
    fill(body, stateBlock('lock', text.lockedTitle, text.lockedText, html`
      <button class="btn btn-primary" type="button" data-recheck>${text.recheck}</button>`,
    text.earlyAccess));
    const btn = body.querySelector('[data-recheck]');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await cloud.loadSubscription(); } catch { /* stays as it was */ }
      if (cloud.state() === 'subscriber') load();
      else { btn.disabled = false; toast(text.stillLocked); }
    });
  }

  async function load() {
    fill(body, html`<p class="muted loading-line">${text.loading}</p>`);
    let stats;
    let matches;
    try {
      stats = await import('../lib/app-stats.js');
      stats.setLang(lang);
      matches = await cloud.downloadMatches();
    } catch {
      fill(body, stateBlock('offline', text.error, null, html`
        <button class="btn btn-primary" type="button" data-retry>${text.retry}</button>`));
      body.querySelector('[data-retry]').addEventListener('click', load);
      return;
    }
    matches = (matches || []).filter((m) => m && Array.isArray(m.seats) && m.seats.length
      && Array.isArray(m.events));

    if (!matches.length) {
      fill(body, stateBlock('chart', text.emptyTitle, text.emptyText,
        html`<a class="btn btn-primary" href="${appHref}">${text.openApp}</a>`));
      return;
    }

    // Who each @ is today and what name they chose - the same consolidation
    // the app does, so someone who changed @ is still one person here.
    const aliases = {};
    try {
      const handles = [];
      matches.forEach((m) => m.seats.forEach((s) => { if (s.handle) handles.push(s.handle); }));
      const known = await cloud.profilesByHandle(handles);
      aliases[stats.CURRENT_HANDLES] = known.current;
      aliases[stats.DISPLAY_NAMES] = known.names;
    } catch { /* names fall back to what the table typed */ }

    showDashboard(stats, matches, aliases);
  }

  function showDashboard(stats, matches, aliases) {
    const profile = cloud.myProfile();
    const myKey = profile && profile.handle ? stats.identityOf({ handle: profile.handle }, aliases) : null;
    const agg = stats.aggregate(matches, aliases);
    const me = myKey ? agg.players.find((p) => p.key === myKey) : null;

    // Each person's color, by first appearance in the history - the app's
    // rule, so the same friend has the same color here and on the phone.
    stats.setPalette(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    const colorOrder = stats.playerColorOrder(matches, aliases);
    const colorOf = (key) => stats.playerColor(colorOrder, key);

    // One summary per match (replay, standings, winner), reused below.
    const summaries = matches.map((m) => ({ m, s: stats.summarize(m) }));
    const placeOf = (s, seatId) => {
      const row = s.standings.find((x) => x.seatId === seatId);
      return row ? row.place : null;
    };
    const mySeat = (m) => (myKey ? m.seats.find((seat) => stats.identityOf(seat, aliases) === myKey) : null);

    sub.textContent = (profile && profile.handle ? '@' + profile.handle + ' · ' : '')
      + plural(text, me ? me.games : matches.length);

    const k = text.kpis;
    const kpis = me ? [
      { label: k.games, value: me.games },
      { label: k.wins, value: me.wins },
      { label: k.winrate, value: stats.pct(me.winrate) },
      { label: k.avgPlace, value: format(text.placeValue, { n: decimal(me.avgPlace, 1, locale) }) },
      { label: k.avgDamage, value: decimal(me.avgDamageDealt, 0, locale) },
      { label: k.kills, value: me.kills },
      { label: k.avgTurn, value: stats.formatDuration(me.avgTurnTime) },
      { label: k.avgMatch, value: stats.formatDuration(me.avgMatchTime) },
    ] : [
      { label: k.games, value: matches.length },
      { label: k.avgMatch, value: stats.formatDuration(
        summaries.reduce((t, x) => t + (x.s.duration || 0), 0) / summaries.length) },
    ];

    // Decks: with an identified person, THEIR record with each deck; without,
    // every deck in the account.
    let decks;
    if (me) {
      const rows = new Map();
      summaries.forEach(({ m, s }) => {
        const seat = mySeat(m);
        if (!seat) return;
        const key = stats.deckKeyOf(seat.commanders);
        if (!rows.has(key)) {
          rows.set(key, {
            name: stats.deckNameOf(seat.commanders), commanders: seat.commanders, games: 0, wins: 0, placeSum: 0,
          });
        }
        const r = rows.get(key);
        r.games += 1;
        if (s.winnerId === seat.id) r.wins += 1;
        r.placeSum += placeOf(s, seat.id) || m.seats.length;
      });
      decks = [...rows.values()].map((r) => ({ ...r, winrate: r.wins / r.games, avgPlace: r.placeSum / r.games }));
    } else {
      decks = agg.decks.map((d) => ({
        name: d.label, commanders: d.commanders, games: d.games, wins: d.wins,
        winrate: d.winrate, avgPlace: d.avgPlace,
      }));
    }
    decks.sort((a, b) => b.games - a.games || b.winrate - a.winrate);

    // Rivals: who shares the table with me most, and who finished ahead.
    let rivals = [];
    if (me) {
      const rows = new Map();
      summaries.forEach(({ m, s }) => {
        const seat = mySeat(m);
        if (!seat) return;
        const mine = placeOf(s, seat.id);
        m.seats.forEach((other) => {
          if (other.id === seat.id) return;
          const key = stats.identityOf(other, aliases);
          if (key === myKey) return;
          if (!rows.has(key)) {
            rows.set(key, {
              key, label: stats.labelOf(other, aliases), together: 0, ahead: 0, behind: 0,
            });
          }
          const r = rows.get(key);
          const theirs = placeOf(s, other.id);
          r.together += 1;
          if (mine && theirs && mine < theirs) r.ahead += 1;
          else if (mine && theirs && mine > theirs) r.behind += 1;
        });
      });
      rivals = [...rows.values()].sort((a, b) => b.together - a.together).slice(0, 6);
    }

    const players = me ? [] : agg.players.slice().sort((a, b) => b.games - a.games).slice(0, 10);

    const recent = summaries
      .filter(({ m }) => !me || mySeat(m))
      .slice(0, 8)
      .map(({ m, s }) => {
        const seat = mySeat(m);
        const place = seat ? placeOf(s, seat.id) : null;
        const won = seat && s.winnerId === seat.id;
        let result = text.noWinner;
        if (won) result = text.youWon;
        else if (s.winner) result = format(text.winner, { name: stats.seatName(s.winner, aliases) });
        return {
          date: stats.formatDate(m.startedAt),
          deck: seat ? stats.deckNameOf(seat.commanders) : null,
          commanders: seat ? seat.commanders : (s.winner ? s.winner.commanders : []),
          players: format(text.players, { n: m.seats.length }),
          duration: stats.formatDuration(s.duration),
          place, won, result,
        };
      });

    const notice = !profile || !profile.handle
      ? html`<p class="notice">${icon('user')}<span>${text.noHandle}</span>
          <a class="text-link" href="account.html">${text.noHandleButton}</a></p>`
      : (!me ? html`<p class="notice">${icon('user')}<span>${text.notFound}</span></p>` : null);

    fill(body, html`
      ${notice}
      <div class="kpi-grid">
        ${kpis.map((x) => html`
          <div class="kpi card">
            <span class="kpi-value">${x.value}</span>
            <span class="kpi-label">${x.label}</span>
          </div>`)}
      </div>

      <div class="dash-grid${rivals.length || players.length ? '' : ' is-single'}">
        <section class="card dash-card">
          <h2 class="block-title">${text.decksTitle}</h2>
          <p class="muted">${text.decksText}</p>
          <ul class="deck-list">
            ${decks.slice(0, 12).map((d) => {
              const identity = deckIdentity(d.commanders);
              return html`
                <li class="deck-row" style="--accent: ${accentOf(identity)}">
                  ${deckThumb(d.commanders)}
                  <span class="deck-info">
                    <span class="deck-name">${d.name}</span>
                    <span class="deck-meta"><span class="pips">${pips(identity)}</span>
                      · ${plural(text, d.games)} · ${format(text.avgPlace, { n: decimal(d.avgPlace, 1, locale) })}</span>
                    <span class="bar"><span style="width: ${Math.round(d.winrate * 100)}%"></span></span>
                  </span>
                  <span class="deck-rate">
                    <span class="deck-rate-value">${stats.pct(d.winrate)}</span>
                    <span class="deck-rate-label">${format(text.winsShort, { n: d.wins })}</span>
                  </span>
                </li>`;
            })}
          </ul>
        </section>

        ${rivals.length ? html`
          <section class="card dash-card">
            <h2 class="block-title">${text.rivalsTitle}</h2>
            <p class="muted">${text.rivalsText}</p>
            <ul class="rival-list">
              ${rivals.map((r) => html`
                <li class="rival-row">
                  ${personAvatar(r.label, colorOf(r.key))}
                  <span class="rival-info">
                    <span class="rival-name">${r.label}</span>
                    <span class="rival-meta">${plural(text, r.together)}</span>
                  </span>
                  <span class="rival-score">${format(text.rivalScore, { a: r.ahead, b: r.behind })}</span>
                </li>`)}
            </ul>
          </section>` : null}

        ${players.length ? html`
          <section class="card dash-card">
            <h2 class="block-title">${text.playersTitle}</h2>
            <p class="muted">${text.playersText}</p>
            <ul class="rival-list">
              ${players.map((p) => html`
                <li class="rival-row">
                  ${personAvatar(p.label, colorOf(p.key))}
                  <span class="rival-info">
                    <span class="rival-name">${p.label}</span>
                    <span class="rival-meta">${plural(text, p.games)}</span>
                  </span>
                  <span class="rival-score">${stats.pct(p.winrate)}</span>
                </li>`)}
            </ul>
          </section>` : null}
      </div>

      <section class="card dash-card">
        <h2 class="block-title">${text.recentTitle}</h2>
        <ul class="match-list">
          ${recent.map((r) => html`
            <li class="match-row">
              ${deckThumb(r.commanders)}
              <span class="match-info">
                <span class="match-result${r.won ? ' is-win' : ''}">${r.result}</span>
                <span class="match-meta">${r.date} · ${r.players} · ${r.duration}</span>
                ${r.deck ? html`<span class="match-deck">${r.deck}</span>` : null}
              </span>
              ${r.place ? html`<span class="match-place${r.won ? ' is-win' : ''}">${format(text.place, { n: r.place })}</span>` : null}
            </li>`)}
        </ul>
      </section>

      <p class="fine-print center">${text.moreInApp}
        <a class="text-link" href="${appHref}">${text.openAppStats}</a></p>
      <div class="button-row button-row-center">
        <button class="btn btn-ghost btn-sm" type="button" data-refresh>${text.refresh}</button>
      </div>`);

    body.querySelector('[data-refresh]').addEventListener('click', load);
  }
}
