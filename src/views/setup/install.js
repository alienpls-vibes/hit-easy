/**
 * The install block of the settings.
 *
 * Each situation gets a useful answer - hiding the option when it is not
 * available would only leave the person searching. On the iPhone Safari does
 * not let the app ask to be installed by itself, and the screen says exactly
 * what to do instead.
 */

import { el, clear, toast, openSheet } from '../../ui.js';
import { t } from '../../i18n.js';
import {
  state as installState, promptInstall, onInstallChange, updateApp,
  iosBrowser,
} from '../../install.js';
import { row } from './rows.js';

/**
 * The step by step for installing on iPhone and iPad.
 *
 * Apple does not let a page ask to be installed: there is no prompt, no event,
 * no button the app can press for the person. The most that can be done is
 * saying exactly where to tap - and that had to be one tap away from the home
 * screen, not a sentence inside the settings, which is where nobody found it.
 * The report was "on the iPhone you can't download the app".
 */
export function openIOSInstall() {
  const where = iosBrowser();
  const steps = [
    where === 'in-app' ? t('install.iosStep1Embedded')
      : where === 'other' ? t('install.iosStep1Other')
        : t('install.iosStep1'),
    t('install.iosStep2'),
    t('install.iosStep3'),
    t('install.iosStep4'),
  ];

  openSheet({
    title: t('install.iosTitle'),
    subtitle: t('install.iosSub'),
    build: (pane, close) => {
      pane.append(el('ol', { class: 'install-steps' }, steps.map((text, i) => el('li', {
        class: 'install-step' + (i === 0 && where !== 'safari' ? ' is-alert' : ''),
      }, [
        el('span', { class: 'install-step-n', text: String(i + 1) }),
        el('span', { class: 'install-step-text', text }),
      ]))));

      const actions = [el('button', { class: 'btn primary', onClick: close }, [t('common.done')])];
      // Outside Safari step 1 is taking the address there. Copying saves the
      // person from typing a long URL on the phone keyboard.
      if (where !== 'safari') {
        actions.unshift(el('button', {
          class: 'btn ghost',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(location.href.split('#')[0]);
              toast(t('install.copied'));
            } catch {
              toast(location.href.split('#')[0]);
            }
          },
        }, [t('install.copyLink')]));
      }
      pane.append(el('div', { class: 'sheet-actions' }, actions));
    },
  });
}

/**
 * The install row, in the settings. A single row, which changes with the
 * device - hiding the option when it is not available would leave the person
 * searching, but it also does not need a paragraph for each case:
 *
 *   installed   Update the app (the everyday case for whoever installed)
 *   ready       Install, with the browser's own prompt
 *   ios         Install on iPhone, which opens the step by step
 *   the rest    the row says where it works, with no action
 *
 * It sits inside a wrapper that repaints itself: the browser prompt may arrive
 * after the screen opens.
 */
export function installBlock(onRefresh) {
  const box = el('div', { class: 'set-slot' });

  const paint = () => {
    clear(box);
    const { mode } = installState();

    if (mode === 'installed') {
      // Installed, the app often goes days without ever being closed - and the
      // open page keeps running the old code even after the service worker
      // replaces itself. Without this button, whoever reports an already fixed
      // defect cannot be helped with "update".
      // The label changes during the wait because it is long and silent:
      // `updateApp` checks the network and then waits for the new worker to
      // take over, up to ten seconds. With the button only disabled, nothing
      // moves - and a button that dims and stays still looks like a button
      // that did not work.
      const update = row({
        label: t('settings.update'),
        sub: t('settings.updateSub'),
        className: 'is-update',
        onTap: () => {},
      });
      const label = update._label;
      const sub = update._sub;

      /**
       * Swaps the label content, in place.
       *
       * Goes through the same path `el` uses for text children. Appending the
       * string directly works in the browser and NOT in the simulated DOM,
       * which does not turn strings into nodes - so the spinner test would
       * report a failure where the app works, and I would "fix" the app to
       * silence the test.
       */
      const paintLabel = (...children) => {
        clear(label);
        for (const c of children) {
          label.append(c && c.nodeType ? c : document.createTextNode(String(c)));
        }
      };

      update.addEventListener('click', async () => {
        if (update.disabled) return;
        update.disabled = true;
        update.classList.add('is-updating');
        paintLabel(el('span', { class: 'spinner' }), t('settings.updating'));
        sub.textContent = t('settings.updatingSub');

        let r;
        try {
          r = await updateApp();
        } catch {
          // It is not just hygiene: without this a failure leaves the button
          // spinning forever, and the person keeps watching a wait that is
          // already over.
          r = 'current';
        }

        if (r === 'current') {
          update.disabled = false;
          update.classList.remove('is-updating');
          paintLabel(t('settings.update'));
          sub.textContent = t('settings.updateSub');
          toast(t('settings.updateNone'));
        }
        // 'updating' reloads the page by itself: spinning until then is right,
        // because the wait really goes on.
      });
      box.append(update);
      return;
    }

    if (mode === 'ready') {
      box.append(row({
        label: t('settings.installNow'),
        sub: t('settings.installNowSub'),
        arrow: true,
        onTap: async () => {
          const r = await promptInstall();
          if (r === 'accepted') toast(t('settings.installDone'));
          paint();
          if (onRefresh) onRefresh();
        },
      }));
      return;
    }

    if (mode === 'ios') {
      box.append(row({
        label: t('settings.installIOS'),
        sub: t('settings.installIOSSub'),
        arrow: true,
        onTap: openIOSInstall,
      }));
      return;
    }

    box.append(row({
      label: t('settings.installNo'),
      sub: mode === 'insecure' ? t('settings.installInsecure') : t('settings.installUnsupported'),
      className: 'is-muted',
    }));
  };

  paint();
  onInstallChange(paint); // the prompt may arrive after the screen is already open
  return box;
}
