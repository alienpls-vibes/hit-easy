/**
 * The home screen: the screen that sets up the table.
 *
 * It draws the header, the starting life, the list of seats and the start
 * button - and nothing else. Each piece of the list comes from its own file in
 * this folder, so changing the player card does not go through here.
 *
 * The match only starts when every seat has a commander: the commander is
 * what ties the statistics to the deck.
 */

import { el, clear, icon, brandMark, buzz } from '../../ui.js';
import { t } from '../../i18n.js';
import { canOfferInstall, onInstallChange } from '../../install.js';
import { openPreGame } from './pre-game.js';
import { bindReorder, seatCard } from './seat-card.js';
import { openSettings } from './settings.js';
import { startInstall } from './install.js';
import { invitesBanner } from './invites.js';
import { dailyButton } from '../../daily/entry.js';
import {
  resumeTableBanner, handedOffBanner, receiveTableButton,
} from './pass-table.js';
import {
  LIFE_PRESETS, MAX_SEATS, ensureDraft, freshSeat,
} from './draft.js';

export function renderSetup(root, {
  onStart, onStats, onRefresh, onOpenTable,
}) {
  const d = ensureDraft();
  clear(root);

  const seatList = el('div', { class: 'seat-list' });
  const startBtn = el('button', { class: 'btn primary block', onClick: () => openPreGame(d, onStart) }, []);

  const refresh = () => {
    clear(seatList);
    d.seats.forEach((seat, i) => seatList.append(seatCard(seat, i, refresh)));
    if (d.seats.length < MAX_SEATS) {
      seatList.append(
        el('button', { class: 'seat-add', onClick: () => {
          d.seats.push(freshSeat(d.seats.length));
          d.layoutId = null; // the arrangement changes with the number of people
          refresh();
        } }, [icon('plus'), t('setup.addPlayer')]),
      );
    }
    bindReorder(seatList, d, refresh);

    const missing = d.seats.filter((s) => !s.commanders.length).length;
    startBtn.disabled = missing > 0;
    startBtn.textContent = missing
      ? (missing === 1 ? t('setup.missingCommander') : t('setup.missingCommanders', { n: missing }))
      : t('setup.startMatch');
  };

  root.append(
    el('div', { class: 'setup' }, [
      el('header', { class: 'setup-head' }, [
        el('div', { class: 'brand' }, [
          brandMark(),
          el('div', { class: 'brand-words' }, [
            el('span', { class: 'brand-text' }, ['Hit Easy']),
            el('span', { class: 'brand-tag', text: t('brand.tag') }),
          ]),
        ]),
        el('div', { class: 'head-actions' }, [
          installButton(onRefresh),
          // The daily color challenge (src/daily/). Its code only loads on the tap.
          dailyButton(onRefresh),
          el('button', { class: 'icon-btn', 'aria-label': t('common.settings'), onClick: () => openSettings(onRefresh) }, [icon('gear')]),
          el('button', { class: 'icon-btn', 'aria-label': t('common.stats'), onClick: onStats }, [icon('chart')]),
        ]),
      ]),

      // Right below the header: it is the first thing after the app name,
      // which is where a notice is seen without scrolling.
      invitesBanner(onRefresh),

      // The table that left this device. Same place and same reason: whoever
      // passed the table and came back here needs to understand why the game
      // vanished, without looking for it.
      handedOffBanner(onRefresh, onOpenTable),

      // An open match the home screen found: offers to go in. It only shows
      // when that state exists, and normally it does not.
      resumeTableBanner(onOpenTable),

      el('div', { class: 'field-row setup-life' }, [
        el('span', { class: 'label' }, [t('setup.startingLife')]),
        el('div', { class: 'chips' }, LIFE_PRESETS.map((v) =>
          el('button', {
            class: 'chip' + (d.startingLife === v ? ' is-on' : ''),
            onClick: (e) => {
              d.startingLife = v;
              e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
              e.currentTarget.classList.add('is-on');
              buzz();
            },
          }, [String(v)]),
        )),
      ]),

      el('div', { class: 'field-row setup-players' }, [
        el('span', { class: 'label' }, [t('setup.players')]),
        el('span', { class: 'hint', text: t('setup.dragToReorder') }),
      ]),
      seatList,
      el('div', { class: 'setup-foot' }, [
        startBtn,
        // Inside the footer on purpose: it already has an area in the grid of
        // the lying-down version, so the signature follows without touching
        // the layout. It is not in the language dictionary - a nickname is not
        // translated.
        // Receiving a table sits in the footer, not the header: it is rare,
        // and whoever needs it knows they need it - someone just said "I sent
        // you the match". Putting it at the top would cost permanent space for
        // an occasional use.
        receiveTableButton(onOpenTable),
        el('p', { class: 'signature', text: 'designed by @AlienPls' }),
      ]),
    ]),
  );

  refresh();
}

/**
 * The install button: always there in the browser, until the app is installed.
 *
 * It used to exist only while Chrome held an install prompt, so it came and
 * went with the browser's mood and vanished as soon as it was tapped. Now the
 * tap fires the prompt when there is one, and opens the steps for the
 * browser's menu when there is not (see startInstall).
 *
 * `display: contents` keeps the slot out of the header's layout. It repaints
 * when the install state changes (installed from this tab), and drops the
 * listener once the screen is gone - setup redraws often.
 */
function installButton(onRefresh) {
  const slot = el('span', { style: { display: 'contents' } });
  const paint = () => {
    clear(slot);
    if (!canOfferInstall()) return;
    slot.append(el('button', {
      class: 'icon-btn is-install',
      'aria-label': t('setup.installApp'),
      onClick: () => startInstall(onRefresh),
    }, [icon('download')]));
  };
  paint();
  const stop = onInstallChange(() => {
    if (!slot.isConnected) { stop(); return; }
    paint();
  });
  return slot;
}
