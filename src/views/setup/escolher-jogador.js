/**
 * Quem vai sentar neste assento.
 *
 * Quem ja jogou neste aparelho aparece na lista - digitar o nome de novo a cada
 * partida seria o tipo de atrito que ninguem aguenta na terceira semana. O nome
 * tambem e a chave das estatisticas, entao escolher da lista evita que "Alex" e
 * "alex" virem dois jogadores diferentes.
 *
 * Escolher alguem nao fecha o painel: desliza direto para o deck dele.
 */

import { el, clear, icon, closeSheet, buzz, toast } from '../../ui.js';
import * as store from '../../store.js';
import { t, tn } from '../../i18n.js';
import { identityOf } from '../../stats.js';
import * as cloud from '../../cloud.js';
import { handleValido, exibirHandle } from '../../cloud.js';
import { commanderStep } from './escolher-deck.js';
import {
  contaNaMesa, ensureDraft, nomeNaMesa, podeVincular,
} from './rascunho.js';

/**
 * Quem vai sentar neste assento.
 *
 * Quem ja jogou neste aparelho aparece na lista - digitar o nome de novo a
 * cada partida seria o tipo de atrito que ninguem aguenta na terceira semana.
 *
 * A lista e de PESSOAS, e nao dos nomes digitados. Com os nomes crus, quem foi
 * cadastrado como "Alex" numa quinta e "Alexandre" na outra aparecia duas
 * vezes, cada linha com metade dos decks - e escolher uma ou outra decidia,
 * sem avisar, em qual metade a partida de hoje ia cair. Quem tem conta se
 * chama pelo @, que e o unico rotulo igual em todo aparelho.
 *
 * Escolher alguem nao fecha o painel: desliza direto para o deck dele.
 */
export function playerStep(seat, refresh) {
  return {
    title: t('player.whoPlays'),
    subtitle: t('player.whoPlaysSub'),
    build: (pane, api) => {
      const d = ensureDraft();
      const apelidos = store.knownHandles();
      // Quem JA esta sentado, por identidade e nao por nome. Com nome, "Alex"
      // numa cadeira e "Alexandre" na lista nao se reconheciam como a mesma
      // pessoa, e dava para sentar a mesma gente duas vezes na mesma mesa.
      const emUso = new Set(
        d.seats.filter((s) => s !== seat).map((s) => identityOf(s, apelidos)),
      );

      const escolher = (nome) => {
        if (nomeNaMesa(seat, nome)) { toast(t('player.nameTaken')); return; }
        seat.name = nome;
        store.rememberPlayer(nome);
        // Se ja se soube a que conta este nome pertence, nao pergunta de novo.
        const lembrado = store.handleOf(nome);
        if (lembrado) { seat.handle = lembrado; seat.userId = null; }
        else if (seat.handle) { seat.handle = ''; seat.userId = null; }
        buzz(12);
        refresh();
        api.next(commanderStep(seat, 0, refresh));
      };

      /**
       * Escolher alguem da lista de pessoas.
       *
       * Separado de `escolher(nome)`, que serve ao nome digitado na hora: aqui
       * ja se sabe a conta, e o nome levado para a cadeira e o mais recente que
       * a mesa usou - o registro do dia continua sendo o nome, e a identidade
       * continua sendo o @.
       */
      const escolherPessoa = (pessoa) => {
        const nome = pessoa.nomes[0];
        if (pessoa.handle) {
          if (contaNaMesa(seat, pessoa.handle)) {
            toast(t('handle.accountTaken'));
            return;
          }
          seat.name = nome;
          seat.handle = pessoa.handle;
          seat.userId = null;
        } else {
          if (nomeNaMesa(seat, nome)) { toast(t('player.nameTaken')); return; }
          seat.name = nome;
          seat.handle = '';
          seat.userId = null;
        }
        store.rememberPlayer(nome);
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
          if (e.key === 'Enter' && e.target.value.trim()) escolher(e.target.value.trim());
        },
      });

      pane.append(el('p', { class: 'sheet-legend', text: t('player.createNew') }));
      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', {
          class: 'btn primary',
          onClick: () => { if (input.value.trim()) escolher(input.value.trim()); },
        }, [t('player.use')]),
      ]));

      // O outro caminho: em vez de digitar um nome solto, achar a CONTA da
      // pessoa. A partida ja nasce ligada a ela, e a estatistica dela recebe
      // esta mesa sem ninguem precisar lembrar de vincular depois.
      if (podeVincular()) {
        pane.append(el('button', {
          class: 'player-row is-find',
          onClick: () => api.next(buscaHandleStep(seat, refresh, {
            adotarNome: true,
            aoFim: 'deck',
          })),
        }, [
          el('span', { class: 'player-avatar', text: '@' }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: t('player.findUser') }),
            el('span', { class: 'player-sub', text: t('player.findUserSub') }),
          ]),
        ]));
      }

      const pessoas = store.pessoasConhecidas();
      if (!pessoas.length) {
        pane.append(el('p', { class: 'search-status', text: t('player.noneSaved') }));
        setTimeout(() => input.focus(), 160);
        return;
      }

      const linha = (pessoa, ocupado) => {
        const decks = store.decksOfPlayer(pessoa.nomes[0], pessoa.handle);
        // Com conta, o rotulo e o @ - e os nomes que a mesa usou entram embaixo,
        // senao ninguem reconheceria de quem e a linha.
        const quantosDecks = decks.length
          ? tn(decks.length, 'player.deckSaved', 'player.decksSaved')
          : t('player.noMatches');
        const sub = ocupado
          ? t('player.isAtTable')
          : [pessoa.handle ? pessoa.nomes.join(', ') : '', quantosDecks]
            .filter(Boolean).join(' · ');

        return el('button', {
          class: 'player-row' + (ocupado ? ' is-busy' : ''),
          disabled: ocupado,
          onClick: () => escolherPessoa(pessoa),
        }, [
          // A inicial sai do nome, e nao do rotulo: o rotulo de quem tem conta
          // comeca com '@', e um circulo com '@' em toda linha nao distingue
          // ninguem.
          el('span', {
            class: 'player-avatar',
            text: (pessoa.nomes[0] || pessoa.handle || '?').slice(0, 1).toUpperCase(),
          }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: pessoa.label }),
            el('span', { class: 'player-sub', text: sub }),
          ]),
          el('span', {
            class: 'player-forget',
            role: 'button',
            'aria-label': t('common.remove') + ' ' + pessoa.label,
            onClick: (e) => {
              e.stopPropagation(); // nao selecionar o jogador ao remove-lo
              // A pessoa inteira: esquecer so um dos nomes dela a deixaria meia
              // na lista, e ela voltaria na proxima abertura pelo outro nome.
              store.esquecerPessoa(pessoa.chave);
              clear(pane);
              playerStep(seat, refresh).build(pane, api);
              api.remeasure();
            },
          }, [icon('close')]),
        ]);
      };

      // Quem ja esta sentado vai para o fim: a lista existe para escolher quem
      // AINDA nao esta na mesa, e nomes inclicaveis no meio do caminho so
      // atrapalham a mira.
      const disponiveis = pessoas.filter((x) => !emUso.has(x.chave));
      const naMesa = pessoas.filter((x) => emUso.has(x.chave));
      const lista = el('div', { class: 'result-list' });

      if (disponiveis.length) {
        pane.append(el('p', { class: 'sheet-legend', text: t('player.playedHere') }));
        disponiveis.forEach((x) => lista.append(linha(x, false)));
      } else {
        pane.append(el('p', {
          class: 'search-status',
          text: t('player.allAtTable'),
        }));
      }

      if (naMesa.length) {
        lista.append(el('p', { class: 'sheet-legend', text: t('player.atTable') }));
        naMesa.forEach((x) => lista.append(linha(x, true)));
      }

      pane.append(lista);
    },
  };
}

/**
 * Procura a conta pelo @ e prende a cadeira nela.
 *
 * A busca e por igualdade exata, do lado do servidor. Nao existe lista nem
 * sugestao por prefixo: da para confirmar um @ que voce ja conhece, nunca para
 * descobrir quem tem conta no app.
 *
 * Serve aos dois caminhos, porque sao a mesma tela com dois destinos:
 *
 *   adotarNome  a pessoa esta ESCOLHENDO quem senta aqui, entao o nome da
 *               cadeira passa a ser o nome da conta encontrada;
 *   aoFim       'deck' segue para o comandante (veio do fluxo de montar a
 *               mesa), 'fechar' so fecha (veio do cartao, para editar).
 */
export function buscaHandleStep(
  seat,
  refresh,
  { adotarNome = false, aoFim = 'fechar' } = {},
) {
  return {
    title: adotarNome ? t('player.findUser') : t('handle.title'),
    subtitle: adotarNome ? t('player.findUserSub') : t('handle.sub', { name: seat.name }),
    build: (pane, api) => {
      const achado = el('div', { class: 'handle-result' });

      const adiante = () => {
        if (aoFim === 'deck') api.next(commanderStep(seat, 0, refresh));
        else closeSheet();
      };

      const soltar = () => {
        seat.handle = '';
        seat.userId = null;
        store.rememberHandle(seat.name, '');
        refresh();
        adiante();
      };

      const prender = (perfilAchado) => {
        if (contaNaMesa(seat, perfilAchado.handle)) {
          clear(achado);
          achado.append(el('p', { class: 'account-erro is-on', text: t('handle.accountTaken') }));
          return;
        }
        if (adotarNome) {
          // O nome da conta e o que o resto da mesa reconhece. Sem isto a
          // cadeira ficaria com "Jogador 2" enquanto a estatistica registra
          // outra pessoa - dois nomes para a mesma cadeira.
          const nome = (perfilAchado.display_name || perfilAchado.handle).slice(0, 18);
          seat.name = nome;
          store.rememberPlayer(nome);
        }
        seat.handle = perfilAchado.handle;
        seat.userId = perfilAchado.id;
        store.rememberHandle(seat.name, perfilAchado.handle);
        buzz(12);
        refresh();
        adiante();
      };

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        value: !adotarNome && seat.handle ? exibirHandle(seat.handle) : '',
        'aria-label': t('handle.title'),
      });

      const procurar = async () => {
        const bruto = input.value;
        clear(achado);
        if (!handleValido(bruto)) {
          achado.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        achado.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const perfilAchado = await cloud.buscarHandle(bruto);
          clear(achado);
          if (!perfilAchado) {
            achado.append(el('p', {
              class: 'account-note',
              text: t('handle.notFound', { handle: exibirHandle(bruto) }),
            }));
            return;
          }
          achado.append(el('div', { class: 'handle-found' }, [
            el('span', { class: 'menu-label', text: exibirHandle(perfilAchado.handle) }),
            perfilAchado.display_name
              ? el('span', { class: 'menu-sub', text: perfilAchado.display_name })
              : null,
          ]));
          achado.append(el('button', {
            class: 'btn primary block',
            onClick: () => prender(perfilAchado),
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
      pane.append(el('p', { class: 'account-note', text: t('handle.why') }));

      if (!adotarNome && handleValido(seat.handle)) {
        pane.append(el('button', { class: 'btn ghost block', onClick: soltar },
          [t('handle.unlink')]));
      }
    },
  };
}
