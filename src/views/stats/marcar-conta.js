/**
 * Dizer que alguem e uma conta, e com isso juntar o historico dela.
 *
 * Dois caminhos chegam aqui, e a tela de busca e a mesma nos dois:
 *
 *   do detalhe de uma partida   escolhe a cadeira, depois a conta;
 *   da linha do jogador         a pessoa ja esta escolhida - e o caso de ver
 *                               duas linhas que sao a mesma gente, porque cada
 *                               aparelho digitou um nome, e consertar ali.
 *
 * O que muda entre eles e so o que se faz com o perfil achado, entao a busca
 * recebe `aoConfirmar` em vez de saber de partida ou de cadeira.
 */

import { el, clear, openFlow, closeSheet, toast } from '../../ui.js';
import * as cloud from '../../cloud.js';
import * as sync from '../../sync.js';
import { cloudEnabled } from '../../config.js';
import { t } from '../../i18n.js';

/** Marcar conta so faz sentido para quem esta numa conta. */
export function podeMarcar() {
  return cloudEnabled() && cloud.state() !== 'deslogado';
}

/**
 * Escolher a cadeira e a conta dela, numa partida ja jogada.
 *
 * Duas telas em vez de uma: quem senta aqui, e quem e essa pessoa no app. Pedir
 * as duas coisas juntas numa lista so obrigaria a repetir a busca por @ para
 * cada cadeira.
 */
export function openMarcar(match, refresh) {
  openFlow({
    title: t('stats.tagPlayer'),
    subtitle: t('stats.tagWhich'),
    build: (pane, api) => {
      for (const seat of match.seats || []) {
        const jaTem = String(seat.handle || '').trim();
        pane.append(el('button', {
          class: 'player-row',
          onClick: () => api.next(passoDaConta({
            nome: seat.name,
            refresh,
            aoConfirmar: (perfil) => sync.marcarJogador(match, seat.id, perfil),
          })),
        }, [
          el('span', { class: 'player-avatar', text: (seat.name || '?').slice(0, 1).toUpperCase() }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: seat.name }),
            el('span', {
              class: 'player-sub',
              text: jaTem ? '@' + jaTem.replace(/^@+/, '') : t('stats.tagNone'),
            }),
          ]),
        ]));
      }
      pane.append(el('p', { class: 'account-note', text: t('stats.tagHint') }));
    },
  });
}

/**
 * A pessoa ja esta escolhida: so falta dizer qual conta e.
 *
 * Usado pela linha do jogador nas estatisticas, onde o que se ve e "esta pessoa
 * e a mesma que aquela outra linha" - e marcar aqui reescreve TODAS as partidas
 * dela, nao uma.
 */
export function openAssociarPessoa(nome, refresh) {
  openFlow({
    ...passoDaConta({
      nome,
      refresh,
      aoConfirmar: (perfil) => sync.associarConta(nome, perfil),
    }),
  });
}

function passoDaConta({ nome, refresh, aoConfirmar }) {
  return {
    title: t('player.findUser'),
    subtitle: t('handle.sub', { name: nome }),
    build: (pane) => {
      const achado = el('div', { class: 'handle-result' });
      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        'aria-label': t('player.findUser'),
      });

      const procurar = async () => {
        clear(achado);
        achado.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const perfil = await cloud.buscarHandle(input.value);
          clear(achado);
          if (!perfil) {
            achado.append(el('p', { class: 'account-note', text: t('handle.notFound', { handle: input.value }) }));
            return;
          }
          achado.append(el('div', { class: 'handle-found' }, [
            el('span', { class: 'menu-label', text: '@' + perfil.handle }),
            perfil.display_name ? el('span', { class: 'menu-sub', text: perfil.display_name }) : null,
          ]));
          achado.append(el('button', {
            class: 'btn primary block',
            onClick: async () => {
              const r = await aoConfirmar(perfil);
              if (!r.ok) {
                toast(r.motivo === 'repetida' ? t('handle.accountTaken') : t('account.failed'));
                return;
              }
              // Quantas partidas mudaram: e a diferenca entre "marquei uma
              // cadeira" e "juntei o historico desta pessoa", e sem dizer o
              // numero ninguem sabe qual das duas aconteceu.
              toast(r.alteradas > 1
                ? t('stats.tagMerged', { n: r.alteradas })
                : (r.convidou ? t('stats.tagSent') : t('stats.tagLocal')));
              closeSheet();
              refresh();
            },
          }, [t('handle.use')]));
        } catch {
          clear(achado);
          achado.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') procurar(); });
      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: procurar }, [t('handle.search')]),
      ]));
      pane.append(achado);
      pane.append(el('p', { class: 'account-note', text: t('stats.tagWhy') }));
    },
  };
}
