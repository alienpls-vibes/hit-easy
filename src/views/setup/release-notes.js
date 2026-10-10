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
import { t, currentLang } from '../../i18n.js';
import { APP_VERSION } from '../../version.js';
import { RELEASE_NOTES, releaseNotesSince, releaseNotesFor } from '../../release-notes.js';
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
    subtitle: versions.length === 1 ? versions[0].title : t('news.sub', { v: APP_VERSION }),
    build: (pane) => {
      for (const v of versions) {
        pane.append(el('div', { class: 'news-head' }, [
          el('span', { class: 'news-version', text: v.version }),
          el('span', { class: 'news-date', text: v.date }),
        ]));
        if (v.title && versions.length > 1) {
          pane.append(el('p', { class: 'sheet-legend', text: v.title }));
        }
        const items = el('div', { class: 'news-list' });
        for (const item of v.items || []) {
          items.append(el('div', { class: 'news-item' }, [
            el('span', { class: 'news-tag is-' + item.type, text: t('news.' + item.type) }),
            el('span', { class: 'news-text', text: noteText(item.text) }),
          ]));
        }
        pane.append(items);
      }

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
 * A note's text in the current language.
 *
 * Accepts a plain string - the normal case, written once - or an object with
 * translations. Without making the object mandatory, writing a note does not
 * turn into work in four languages on every release, which is the kind of
 * weight that makes notes stop being written.
 */
function noteText(text) {
  if (typeof text === 'string') return text;
  if (!text) return '';
  return text[currentLang()] || text.pt || Object.values(text)[0] || '';
}
