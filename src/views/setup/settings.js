/**
 * App preferences - what applies to every match.
 *
 * Starting life and table arrangement are left out on purpose: they change
 * every game, so they live on the home screen and on the pre-game screen.
 *
 * The order follows how often things are used, and each group answers one
 * question:
 *
 *   Account      a single row, which opens its own screen. It used to be the
 *                longest block and came first, pushing down what really gets
 *                touched - language, theme, vibration.
 *   Appearance   how the app shows itself.
 *   At the table how the app behaves during the match.
 *   App          install or update, what changed, help and privacy.
 *
 * Text only where it changes the decision. "Vibration" does not need "haptic
 * feedback on each tap" underneath; locking the screen in landscape needs to
 * say it goes fullscreen, because that is surprising.
 */

import { el, openFlow, toast, setHaptics } from '../../ui.js';
import * as store from '../../store.js';
import { MODES, currentMode, applyTheme } from '../../theme.js';
import { t, LANGS, currentLang, setLang } from '../../i18n.js';
import { betaBuild, workerVersion, isIOS } from '../../install.js';
import { APP_VERSION } from '../../version.js';
import { channel } from '../../channel.js';
import { cloudEnabled } from '../../config.js';
import { accountSummary } from './account.js';
import { installBlock } from './install.js';
import { openReleaseNotes } from './release-notes.js';
import {
  group, row, toggleRow, selectRow, segmentRow,
} from './rows.js';

export function openSettings(onRefresh) {
  const s = store.getDB().settings;

  openFlow({
    title: t('settings.title'),
    build: (pane, api) => {
      if (cloudEnabled()) pane.append(group(null, [accountSummary(api, onRefresh)]));

      pane.append(group(t('settings.appearance'), [
        selectRow(t('settings.language'), currentLang(), LANGS, (code) => {
          store.setSetting('lang', code);
          setLang(code);
          // Every text was read at draw time, so both need to be redone: the
          // home screen underneath, and this panel - which would stay in the
          // old language until closed by hand.
          if (onRefresh) onRefresh();
          openSettings(onRefresh);
        }),
        segmentRow(
          t('settings.theme'),
          MODES.map(([id, key]) => [id, t(key)]),
          currentMode(),
          (id) => {
            store.setSetting('theme', id);
            applyTheme(id);
            // The WUBRG palette changed: the rest of the screen has to be
            // redrawn.
            if (onRefresh) onRefresh();
          },
        ),
      ]));

      pane.append(group(t('settings.onTable'), [
        toggleRow(t('settings.haptics'), null, s.haptics, (v) => {
          store.setSetting('haptics', v);
          setHaptics(v);
        }),
        toggleRow(t('settings.keepAwake'), null, s.keepAwake, (v) => {
          store.setSetting('keepAwake', v);
        }),
        // On the iPhone Safari neither locks the orientation nor goes
        // fullscreen: the switch would exist only to do nothing.
        isIOS() ? null : toggleRow(
          t('settings.autoRotate'),
          t('settings.autoRotateSub'),
          s.autoRotate,
          (v) => store.setSetting('autoRotate', v),
        ),
      ]));

      pane.append(group(t('settings.app'), [
        installBlock(onRefresh),
        row({
          label: t('news.title'),
          value: APP_VERSION,
          arrow: true,
          onTap: () => openReleaseNotes(),
        }),
        row({
          label: t('settings.showHint'),
          onTap: () => {
            store.setSetting('dragHintSeen', false);
            toast(t('settings.hintBack'));
          },
        }),
        // A relative path, not absolute: the app runs at /hit-easy/ and at
        // /hit-easy/beta/, and a link with a leading slash would take beta to
        // the production policy. (`privacidade.html` is a public URL, so the
        // file keeps its name.)
        row({ label: t('settings.privacy'), href: './privacidade.html', arrow: true }),
      ]));

      pane.append(el('p', { class: 'settings-note', text: t('settings.dataNote') }));

      // The version closes the settings.
      //
      // Whoever reports a problem needs to be able to say WHICH app broke, and
      // the channel has to show along with it: a beta defect investigated as
      // if it were production costs hours.
      const versionLine = el('button', {
        class: 'settings-version',
        onClick: () => openReleaseNotes(),
        text: 'Hit Easy ' + APP_VERSION
          + (channel() === 'beta' ? ' · beta' : ''),
      });
      pane.append(versionLine);

      // In beta, which commit is live. The version alone does not tell two
      // beta pushes apart, because it only moves with a production release.
      if (channel() === 'beta') {
        betaBuild().then((b) => {
          if (b) versionLine.textContent += ' · ' + b.build;
        });
      }

      // If the worker reports another version, a stale cache is serving old
      // code. Without this the defect is invisible: the screen shows the
      // module version, the module comes from the cache, and the cache lies
      // with all the confidence in the world.
      workerVersion().then((v) => {
        if (v && v !== APP_VERSION) {
          versionLine.textContent += ' · ' + t('settings.staleCache', { n: v });
        }
      });
    },
  });
}
