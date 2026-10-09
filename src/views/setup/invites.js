/**
 * Invites: matches someone recorded saying you were at the table.
 *
 * They show up WITHOUT a subscription, on purpose - it is the gate working,
 * not a hole. A non-subscriber needs to be able to see that matches are
 * waiting, otherwise they never accept and never knew they existed. The invite
 * is free; the content is what is paid, and "3 matches waiting for you" is the
 * best argument the app has.
 */

import { el, clear, openSheet, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { displayHandle } from '../../cloud.js';
import { cloudEnabled } from '../../config.js';

export function invitesBlock() {
  const box = el('div', { class: 'account-invites' });

  const paint = async () => {
    clear(box);
    let invites = cloud.openInvites();
    try {
      invites = await cloud.pendingInvites();
    } catch {
      /* no network: shows what this device already knew */
    }
    if (!invites.length) return;

    box.append(el('p', { class: 'sheet-legend', text: t('invites.title') }));
    box.append(el('p', {
      class: 'account-note',
      text: invites.length === 1
        ? t('invites.one')
        : t('invites.many', { n: invites.length }),
    }));

    for (const invite of invites) box.append(inviteRow(invite, paint));
  };

  paint();
  return box;
}

function inviteRow(invite, reload) {
  const node = el('div', { class: 'invite' });
  const who = el('span', { class: 'menu-sub', text: t('invites.locked') });

  // Only the server can say who invited without handing over the whole match.
  cloud.inviteHost(invite.match_id).then((host) => {
    if (!host) return;
    who.textContent = displayHandle(host.handle)
      + (host.display_name ? ' - ' + host.display_name : '');
    trust.hidden = false;
    trust.dataset.host = host.id;
    block.hidden = false;
    block.dataset.host = host.id;
  }).catch(() => {});

  const answer = async (accept) => {
    try {
      await cloud.answerInvite(invite.match_id, invite.seat_id, accept);
      buzz(12);
      reload();
    } catch {
      toast(t('account.failed'));
    }
  };

  const trust = el('button', { class: 'btn ghost block' }, [t('invites.trust')]);
  trust.hidden = true;
  trust.addEventListener('click', async () => {
    try {
      await cloud.trustHost(trust.dataset.host);
      await answer(true);
    } catch {
      toast(t('account.failed'));
    }
  });

  // The opposite, and it has to exist.
  //
  // Invites from whoever already played with you now come in by themselves,
  // derived from the history. Without this button, one table with a stranger
  // at a tournament would count forever with no way to undo it - deleting the
  // trust does not help, because the rule rebuilds itself from the matches
  // played.
  const block = el('button', { class: 'invite-never' }, [t('invites.never')]);
  block.hidden = true;
  block.addEventListener('click', async () => {
    try {
      await cloud.untrustHost(block.dataset.host);
      await answer(false);
      toast(t('invites.neverDone'));
    } catch {
      toast(t('account.failed'));
    }
  });

  node.append(el('div', { class: 'invite-who' }, [
    el('span', {
      class: 'menu-label',
      text: t('invites.seat', { handle: displayHandle(invite.handle) }),
    }),
    who,
  ]));
  node.append(el('div', { class: 'invite-acts' }, [
    el('button', { class: 'btn primary', onClick: () => answer(true) },
      [t('invites.accept')]),
    el('button', { class: 'btn ghost', onClick: () => answer(false) },
      [t('invites.decline')]),
  ]));
  node.append(trust);
  node.append(block);
  return node;
}

/**
 * The invite notice on the home screen.
 *
 * A match recorded by someone else used to show up only inside Settings >
 * Account. Whoever did not know it existed would never find it - and there is
 * no reason to expect someone to look for a feature nobody told them about.
 *
 * It disappears by itself when nothing is waiting: a permanent notice becomes
 * part of the scenery and stops being a notice.
 */
export function invitesBanner(onRefresh) {
  const open = cloudEnabled() ? cloud.openInvites() : [];
  if (!open.length) return null;

  return el('button', {
    class: 'invite-banner',
    onClick: () => openSheet({
      title: t('invites.title'),
      subtitle: t('invites.sub'),
      build: (pane) => {
        const list = el('div', { class: 'account-invites' });
        const paint = async () => {
          clear(list);
          let invites = cloud.openInvites();
          try {
            invites = await cloud.pendingInvites();
          } catch {
            /* no network: what this device already knew */
          }
          if (!invites.length) {
            list.append(el('p', { class: 'search-status', text: t('invites.none') }));
            if (onRefresh) onRefresh();
            return;
          }
          for (const c of invites) list.append(inviteRow(c, paint));
        };
        paint();
        pane.append(list);
        pane.append(el('p', { class: 'account-note', text: t('invites.explain') }));
      },
    }),
  }, [
    el('span', { class: 'invite-banner-n', text: String(open.length) }),
    el('span', { class: 'invite-banner-txt' }, [
      el('span', { class: 'menu-label', text: open.length === 1
        ? t('invites.one') : t('invites.many', { n: open.length }) }),
      el('span', { class: 'menu-sub', text: t('invites.cta') }),
    ]),
  ]);
}
