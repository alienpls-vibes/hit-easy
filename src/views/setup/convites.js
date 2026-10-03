/**
 * Convites: partidas que alguem registrou dizendo que voce estava na mesa.
 *
 * Aparece SEM assinatura, de proposito - e o portao funcionando, nao um furo.
 * Quem nao assina precisa poder ver que ha partidas esperando, senao nunca
 * aceita e nunca soube que existiam. O convite e livre; o conteudo e que e
 * pago, e "3 partidas esperando por voce" e o melhor argumento que o app tem.
 */

import { el, clear, openSheet, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { exibirHandle } from '../../cloud.js';
import { cloudEnabled } from '../../config.js';

/**
 * Convites: partidas que alguem registrou dizendo que voce estava na mesa.
 *
 * Aparece SEM assinatura, de proposito - e o portao funcionando, nao um furo.
 * Quem nao assina precisa poder ver que ha partidas esperando, senao nunca
 * aceita e nunca soube que existiam. O convite e livre; o conteudo e que e
 * pago, e "3 partidas esperando por voce" e o melhor argumento que o app tem.
 */
export function invitesBlock() {
  const caixa = el('div', { class: 'account-invites' });

  const pintar = async () => {
    clear(caixa);
    let convites = cloud.convitesAbertos();
    try {
      convites = await cloud.convitesPendentes();
    } catch {
      /* sem rede: mostra o que este aparelho ja sabia */
    }
    if (!convites.length) return;

    caixa.append(el('p', { class: 'sheet-legend', text: t('invites.title') }));
    caixa.append(el('p', {
      class: 'account-note',
      text: convites.length === 1
        ? t('invites.one')
        : t('invites.many', { n: convites.length }),
    }));

    for (const convite of convites) caixa.append(inviteRow(convite, pintar));
  };

  pintar();
  return caixa;
}

function inviteRow(convite, recarregar) {
  const linha = el('div', { class: 'invite' });
  const quem = el('span', { class: 'menu-sub', text: t('invites.locked') });

  // Quem convidou so o servidor sabe dizer sem entregar a partida inteira.
  cloud.anfitriaoDoConvite(convite.match_id).then((anfitriao) => {
    if (!anfitriao) return;
    quem.textContent = exibirHandle(anfitriao.handle)
      + (anfitriao.display_name ? ' - ' + anfitriao.display_name : '');
    confiar.hidden = false;
    confiar.dataset.host = anfitriao.id;
    bloquear.hidden = false;
    bloquear.dataset.host = anfitriao.id;
  }).catch(() => {});

  const responder = async (aceitar) => {
    try {
      await cloud.responderConvite(convite.match_id, convite.seat_id, aceitar);
      buzz(12);
      recarregar();
    } catch {
      toast(t('account.failed'));
    }
  };

  const confiar = el('button', { class: 'btn ghost block' }, [t('invites.trust')]);
  confiar.hidden = true;
  confiar.addEventListener('click', async () => {
    try {
      await cloud.confiarEm(confiar.dataset.host);
      await responder(true);
    } catch {
      toast(t('account.failed'));
    }
  });

  // O contrario, e ele precisa existir.
  //
  // Convite de quem ja jogou com voce passou a entrar sozinho, derivado do
  // historico. Sem este botao, uma mesa com um estranho num torneio valeria
  // para sempre e nao haveria como desfazer - apagar a confianca nao adianta,
  // porque a regra se refaz a partir das partidas jogadas.
  const bloquear = el('button', { class: 'invite-never' }, [t('invites.never')]);
  bloquear.hidden = true;
  bloquear.addEventListener('click', async () => {
    try {
      await cloud.deixarDeConfiar(bloquear.dataset.host);
      await responder(false);
      toast(t('invites.neverDone'));
    } catch {
      toast(t('account.failed'));
    }
  });

  linha.append(el('div', { class: 'invite-who' }, [
    el('span', {
      class: 'menu-label',
      text: t('invites.seat', { handle: exibirHandle(convite.handle) }),
    }),
    quem,
  ]));
  linha.append(el('div', { class: 'invite-acts' }, [
    el('button', { class: 'btn primary', onClick: () => responder(true) },
      [t('invites.accept')]),
    el('button', { class: 'btn ghost', onClick: () => responder(false) },
      [t('invites.decline')]),
  ]));
  linha.append(confiar);
  linha.append(bloquear);
  return linha;
}

/**
 * Aviso de convite na home.
 *
 * Antes, uma partida registrada por outra pessoa so aparecia dentro de
 * Configuracoes > Conta. Quem nao soubesse que aquilo existia nunca ia
 * encontrar - e nao ha por que esperar que alguem procure por um recurso que
 * ninguem contou que existe.
 *
 * Some sozinho quando nao ha nada esperando: um aviso permanente vira parte do
 * cenario e deixa de ser aviso.
 */
export function convitesBanner(onRefresh) {
  const abertos = cloudEnabled() ? cloud.convitesAbertos() : [];
  if (!abertos.length) return null;

  return el('button', {
    class: 'invite-banner',
    onClick: () => openSheet({
      title: t('invites.title'),
      subtitle: t('invites.sub'),
      build: (pane) => {
        const lista = el('div', { class: 'account-invites' });
        const pintar = async () => {
          clear(lista);
          let convites = cloud.convitesAbertos();
          try {
            convites = await cloud.convitesPendentes();
          } catch {
            /* sem rede: o que este aparelho ja sabia */
          }
          if (!convites.length) {
            lista.append(el('p', { class: 'search-status', text: t('invites.none') }));
            if (onRefresh) onRefresh();
            return;
          }
          for (const c of convites) lista.append(inviteRow(c, pintar));
        };
        pintar();
        pane.append(lista);
        pane.append(el('p', { class: 'account-note', text: t('invites.explain') }));
      },
    }),
  }, [
    el('span', { class: 'invite-banner-n', text: String(abertos.length) }),
    el('span', { class: 'invite-banner-txt' }, [
      el('span', { class: 'menu-label', text: abertos.length === 1
        ? t('invites.one') : t('invites.many', { n: abertos.length }) }),
      el('span', { class: 'menu-sub', text: t('invites.cta') }),
    ]),
  ]);
}
