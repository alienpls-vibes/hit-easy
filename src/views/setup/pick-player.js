/**
 * Who is going to sit in this seat.
 *
 * Whoever already played on this device shows up on the list - typing the
 * name again for every match would be the kind of friction nobody puts up with
 * by the third week.
 *
 * The list is of PEOPLE, not of typed names. With the raw names, whoever was
 * added as "Alex" one Thursday and "Alexandre" the next showed up twice, each
 * row with half the decks - and picking one or the other decided, without
 * warning, which half today's match would land on. Whoever has an account is
 * called by the @, which is the only label that is the same on every device.
 *
 * Picking someone does not close the panel: it slides straight to their deck.
 */

import { el, clear, icon, closeSheet, buzz, toast } from '../../ui.js';
import * as store from '../../store.js';
import { t, tn } from '../../i18n.js';
import { identityOf } from '../../stats.js';
import * as cloud from '../../cloud.js';
import { isHandleValid, displayHandle } from '../../cloud.js';
import { commanderStep } from './pick-deck.js';
import {
  accountAtTable, ensureDraft, nameAtTable, canLinkAccounts,
} from './draft.js';

export function playerStep(seat, refresh) {
  return {
    title: t('player.whoPlays'),
    subtitle: t('player.whoPlaysSub'),
    build: (pane, api) => {
      const d = ensureDraft();
      const aliases = store.knownHandles();
      // Who is ALREADY seated, by identity and not by name. By name, "Alex" in
      // one seat and "Alexandre" on the list did not recognize each other as
      // the same person, and the same person could sit twice at the same
      // table.
      const inUse = new Set(
        d.seats.filter((s) => s !== seat).map((s) => identityOf(s, aliases)),
      );

      const choose = (name) => {
        if (nameAtTable(seat, name)) { toast(t('player.nameTaken')); return; }
        seat.name = name;
        store.rememberPlayer(name);
        // If it is already known which account this name belongs to, do not
        // ask again.
        const remembered = store.handleOf(name);
        if (remembered) { seat.handle = remembered; seat.userId = null; }
        else if (seat.handle) { seat.handle = ''; seat.userId = null; }
        buzz(12);
        refresh();
        api.next(commanderStep(seat, 0, refresh));
      };

      /**
       * Picking someone from the people list.
       *
       * Separate from `choose(name)`, which serves the name typed on the spot:
       * here the account is already known, and the name taken to the seat is
       * the most recent one the table used - the record of the day is still
       * the name, and the identity is still the @.
       */
      const choosePerson = (person) => {
        const name = person.names[0];
        if (person.handle) {
          if (accountAtTable(seat, person.handle)) {
            toast(t('handle.accountTaken'));
            return;
          }
          seat.name = name;
          seat.handle = person.handle;
          seat.userId = null;
        } else {
          if (nameAtTable(seat, name)) { toast(t('player.nameTaken')); return; }
          seat.name = name;
          seat.handle = '';
          seat.userId = null;
        }
        store.rememberPlayer(name);
        buzz(12);
        refresh();
        api.next(commanderStep(seat, 0, refresh));
      };

      const input = el('input', {
        class: 'search-input',
        placeholder: t('player.namePlaceholder'),
        maxlength: '18',
        'aria-label': t('player.namePlaceholder'),
        onKeyDown: (e) => {
          if (e.key === 'Enter' && e.target.value.trim()) choose(e.target.value.trim());
        },
      });

      pane.append(el('p', { class: 'sheet-legend', text: t('player.createNew') }));
      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', {
          class: 'btn primary',
          onClick: () => { if (input.value.trim()) choose(input.value.trim()); },
        }, [t('player.use')]),
      ]));

      // The other path: instead of typing a loose name, find the person's
      // ACCOUNT. The match is born linked to it, and their statistics receive
      // this table without anyone needing to remember to link later.
      if (canLinkAccounts()) {
        pane.append(el('button', {
          class: 'player-row is-find',
          onClick: () => api.next(findHandleStep(seat, refresh, {
            adoptName: true,
            then: 'deck',
          })),
        }, [
          el('span', { class: 'player-avatar', text: '@' }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: t('player.findUser') }),
            el('span', { class: 'player-sub', text: t('player.findUserSub') }),
          ]),
        ]));
      }

      const people = store.knownPeople();
      if (!people.length) {
        pane.append(el('p', { class: 'search-status', text: t('player.noneSaved') }));
        setTimeout(() => input.focus(), 160);
        return;
      }

      const personRow = (person, busy) => {
        const decks = store.decksOfPlayer(person.names[0], person.handle);
        // With an account, the label is the @ - and the names the table used go
        // below, otherwise nobody would recognize whose row it is.
        const deckCount = decks.length
          ? tn(decks.length, 'player.deckSaved', 'player.decksSaved')
          : t('player.noMatches');
        const sub = busy
          ? t('player.isAtTable')
          : [person.handle ? person.names.join(', ') : '', deckCount]
            .filter(Boolean).join(' · ');

        return el('button', {
          class: 'player-row' + (busy ? ' is-busy' : ''),
          disabled: busy,
          onClick: () => choosePerson(person),
        }, [
          // The initial comes from the name, not the label: the label of
          // someone with an account starts with '@', and a circle with '@' on
          // every row tells nobody apart.
          el('span', {
            class: 'player-avatar',
            text: (person.names[0] || person.handle || '?').slice(0, 1).toUpperCase(),
          }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: person.label }),
            el('span', { class: 'player-sub', text: sub }),
          ]),
          el('span', {
            class: 'player-forget',
            role: 'button',
            'aria-label': t('common.remove') + ' ' + person.label,
            onClick: (e) => {
              e.stopPropagation(); // do not select the player while removing them
              // The whole person: forgetting only one of their names would
              // leave them half on the list, and they would come back on the
              // next open through the other name.
              store.forgetPerson(person.key);
              clear(pane);
              playerStep(seat, refresh).build(pane, api);
              api.remeasure();
            },
          }, [icon('close')]),
        ]);
      };

      // Whoever is already seated goes to the end: the list exists to pick
      // whoever is NOT at the table yet, and unclickable names in the middle
      // of the way only spoil the aim.
      const available = people.filter((x) => !inUse.has(x.key));
      const seated = people.filter((x) => inUse.has(x.key));
      const list = el('div', { class: 'result-list' });

      if (available.length) {
        pane.append(el('p', { class: 'sheet-legend', text: t('player.playedHere') }));
        available.forEach((x) => list.append(personRow(x, false)));
      } else {
        pane.append(el('p', {
          class: 'search-status',
          text: t('player.allAtTable'),
        }));
      }

      if (seated.length) {
        list.append(el('p', { class: 'sheet-legend', text: t('player.atTable') }));
        seated.forEach((x) => list.append(personRow(x, true)));
      }

      pane.append(list);
    },
  };
}

/**
 * Looks up the account by @ and attaches the seat to it.
 *
 * The lookup is an exact match, on the server side. There is no list and no
 * prefix suggestion: it can confirm an @ you already know, never discover who
 * has an account in the app.
 *
 * It serves both paths, because they are the same screen with two
 * destinations:
 *
 *   adoptName   the person is CHOOSING who sits here, so the seat name becomes
 *               the name of the account found;
 *   then        'deck' moves on to the commander (it came from the table
 *               setup flow), 'close' just closes (it came from the card, to
 *               edit).
 */
export function findHandleStep(
  seat,
  refresh,
  { adoptName = false, then = 'close' } = {},
) {
  return {
    title: adoptName ? t('player.findUser') : t('handle.title'),
    subtitle: adoptName ? t('player.findUserSub') : t('handle.sub', { name: seat.name }),
    build: (pane, api) => {
      const result = el('div', { class: 'handle-result' });

      const proceed = () => {
        if (then === 'deck') api.next(commanderStep(seat, 0, refresh));
        else closeSheet();
      };

      const unlink = () => {
        seat.handle = '';
        seat.userId = null;
        store.rememberHandle(seat.name, '');
        refresh();
        proceed();
      };

      const attach = (found) => {
        if (accountAtTable(seat, found.handle)) {
          clear(result);
          result.append(el('p', { class: 'account-error is-on', text: t('handle.accountTaken') }));
          return;
        }
        if (adoptName) {
          // The account's name is what the rest of the table recognizes.
          // Without this the seat would stay "Player 2" while the statistics
          // record another person - two names for the same seat.
          const name = (found.display_name || found.handle).slice(0, 18);
          seat.name = name;
          store.rememberPlayer(name);
        }
        seat.handle = found.handle;
        seat.userId = found.id;
        store.rememberHandle(seat.name, found.handle);
        buzz(12);
        refresh();
        proceed();
      };

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        value: !adoptName && seat.handle ? displayHandle(seat.handle) : '',
        'aria-label': t('handle.title'),
      });

      const search = async () => {
        const raw = input.value;
        clear(result);
        if (!isHandleValid(raw)) {
          result.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        result.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const found = await cloud.findHandle(raw);
          clear(result);
          if (!found) {
            result.append(el('p', {
              class: 'account-note',
              text: t('handle.notFound', { handle: displayHandle(raw) }),
            }));
            return;
          }
          result.append(el('div', { class: 'handle-found' }, [
            el('span', { class: 'menu-label', text: displayHandle(found.handle) }),
            found.display_name
              ? el('span', { class: 'menu-sub', text: found.display_name })
              : null,
          ]));
          result.append(el('button', {
            class: 'btn primary block',
            onClick: () => attach(found),
          }, [t('handle.use')]));
        } catch {
          clear(result);
          result.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: search }, [t('handle.search')]),
      ]));
      pane.append(result);
      pane.append(el('p', { class: 'account-note', text: t('handle.why') }));

      if (!adoptName && isHandleValid(seat.handle)) {
        pane.append(el('button', { class: 'btn ghost block', onClick: unlink },
          [t('handle.unlink')]));
      }
    },
  };
}
