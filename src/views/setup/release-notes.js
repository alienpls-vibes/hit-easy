/**
 * The release notes.
 *
 * The text comes from src/release-notes.js; this is only the screen that
 * presents it.
 *
 * The default slice is the DIFFERENCE: what came in since the version the app
 * was on. Showing the whole history on every open buries the three new lines
 * under nine versions already read, and what people learn is to close the
 * screen without reading. The history stays one tap away at the end of the
 * list - hiding is not the same as deleting.
 */

import { el, openSheet } from '../../ui.js';
import { t, currentLang, locale } from '../../i18n.js';
import { APP_VERSION } from '../../version.js';
import {
  RELEASE_NOTES, releaseNotesSince, releaseNotesFor, noteIn,
} from '../../release-notes.js';
import * as store from '../../store.js';

/**
 * The slice to show when nobody asked for a specific one.
 *
 * Three situations, in this order:
 *
 * 1. Came from an earlier version: only what came in since then. This is the
 *    case the menu has to get right, because it is the only one where a
 *    "difference" exists.
 * 2. Just installed: only this version's notes. The change history of an app
 *    the person never used is not news, it is noise before the first use.
 * 3. This version has no notes: fall back to the history, which beats an
 *    empty screen. `npm test` does not let anyone publish without notes, so
 *    this is a safety net.
 */
function defaultSlice() {
  // `versaoAnterior` is a stored setting name: do not translate.
  const previous = store.getDB().settings.versaoAnterior || null;
  if (previous) {
    const since = releaseNotesSince(previous);
    if (since.length) return since;
  }

  const current = releaseNotesFor(APP_VERSION);
  return current ? [current] : RELEASE_NOTES;
}

/**
 * What changed.
 *
 * An empty or missing `list` means the default slice - which is what the menu
 * and the startup use. Passing a list covers two cases: the startup, which
 * already knows exactly what the person has not seen, and the "see all
 * versions" button here.
 */
export function openReleaseNotes(list = null) {
  const versions = list && list.length ? list : defaultSlice();
  const everything = versions.length === RELEASE_NOTES.length;

  openSheet({
    title: t('news.title'),
    subtitle: t('news.sub', { v: APP_VERSION }),
    build: (pane) => {
      for (const v of versions) pane.append(versionBlock(v));

      // The way to the history goes at the end, not the top: whoever opened
      // this wants to see what came in, and the rest is for those looking.
      if (!everything) {
        pane.append(el('button', {
          class: 'news-all',
          onClick: () => openReleaseNotes(RELEASE_NOTES),
          text: t('news.seeAll', { n: RELEASE_NOTES.length }),
        }));
      }
    },
  });
}

/**
 * The order the groups appear in: what to try, what works differently, and
 * then what was fixed.
 */
const TYPE_ORDER = ['new', 'changed', 'fixed'];

/**
 * One version: the title as the headline, number and date under it, and the
 * notes grouped by type.
 *
 * Grouped, and not a tag on every line: a tag per item repeated "NOVO"
 * seventeen times, and since the tags have different widths the text started
 * at a different place on each line. One label per group says it once and
 * lets every line start at the same edge.
 */
function versionBlock(v) {
  const groups = TYPE_ORDER
    .map((type) => ({ type, items: (v.items || []).filter((i) => i.type === type) }))
    .filter((g) => g.items.length);

  return el('section', { class: 'news-version-block' }, [
    el('div', { class: 'news-head' }, [
      v.title ? el('h3', { class: 'news-title', text: noteText(v.title) }) : null,
      el('div', { class: 'news-meta' }, [
        el('span', { class: 'news-version', text: v.version }),
        v.date ? el('span', { class: 'news-date', text: formatNoteDate(v.date) }) : null,
      ]),
    ]),
    ...groups.map((g) => el('div', { class: 'news-group is-' + g.type }, [
      el('p', { class: 'news-group-label', text: t('news.' + g.type) }),
      el('ul', { class: 'news-list' }, g.items.map((item) =>
        el('li', { class: 'news-item', text: noteText(item.text) }))),
    ])),
  ]);
}

/**
 * '2026-10-10' the way the chosen language writes dates. Read as local noon,
 * so no timezone moves it to the day before.
 */
function formatNoteDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A note's title or item in the app's language (see src/release-notes.js). */
function noteText(text) {
  return noteIn(text, currentLang());
}
