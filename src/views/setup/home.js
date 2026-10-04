/**
 * A home: a tela que monta a mesa.
 *
 * Desenha o cabecalho, a vida inicial, a lista de assentos e o botao de
 * comecar - e nada mais. Cada peca da lista vem de um arquivo proprio desta
 * pasta, entao mexer no cartao do jogador nao passa por aqui.
 *
 * A partida so comeca quando todo assento tem comandante: e o comandante que
 * amarra a estatistica ao deck.
 */

import { el, clear, icon, brandMark, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import { state as installState, promptInstall } from '../../install.js';
import { openPreGame } from './antes-de-comecar.js';
import { bindReorder, seatCard } from './cartao-jogador.js';
import { openSettings } from './configuracoes.js';
import { abrirInstalarNoIOS } from './instalar.js';
import { convitesBanner } from './convites.js';
import {
  continuarMesaBanner, mesaPassadaBanner, receberMesaBotao,
} from './passar-mesa.js';
import {
  LIFE_PRESETS, MAX_SEATS, ensureDraft, freshSeat,
} from './rascunho.js';

export function renderSetup(root, { onStart, onStats, onRefresh, onAbrirMesa }) {
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
          d.layoutId = null; // a disposicao muda com a quantidade de gente
          refresh();
        } }, [icon('plus'), t('setup.addPlayer')]),
      );
    }
    bindReorder(seatList, d, refresh);

    const faltam = d.seats.filter((s) => !s.commanders.length).length;
    startBtn.disabled = faltam > 0;
    startBtn.textContent = faltam
      ? (faltam === 1 ? t('setup.missingCommander') : t('setup.missingCommanders', { n: faltam }))
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
          // Aparece quando o navegador diz que dá para instalar agora - e no
          // iPhone, onde ele nunca diz: lá o botão abre o passo a passo, porque
          // esconder a opção era o que fazia parecer que não dava para instalar.
          installState().mode === 'ios'
            ? el('button', {
                class: 'icon-btn is-install',
                'aria-label': t('setup.installApp'),
                onClick: abrirInstalarNoIOS,
              }, [icon('download')])
            : installState().mode === 'pronto'
            ? el('button', {
                class: 'icon-btn is-install',
                'aria-label': t('setup.installApp'),
                onClick: async () => {
                  const r = await promptInstall();
                  if (r === 'accepted') toast(t('settings.installDone'));
                  if (onRefresh) onRefresh();
                },
              }, [icon('download')])
            : null,
          el('button', { class: 'icon-btn', 'aria-label': t('common.settings'), onClick: () => openSettings(onRefresh) }, [icon('gear')]),
          el('button', { class: 'icon-btn', 'aria-label': t('common.stats'), onClick: onStats }, [icon('chart')]),
        ]),
      ]),

      // Logo abaixo do cabeçalho: é a primeira coisa depois do nome do app,
      // que é onde um aviso é visto sem precisar rolar nada.
      convitesBanner(onRefresh),

      // A mesa que saiu deste aparelho. Mesmo lugar e mesmo motivo: quem
      // passou a mesa e voltou aqui precisa entender por que o jogo sumiu,
      // sem procurar.
      mesaPassadaBanner(onRefresh, onAbrirMesa),

      // Partida aberta que a home encontrou: oferece entrar. So aparece
      // quando o estado existe, e normalmente ele nao existe.
      continuarMesaBanner(onAbrirMesa),

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
        // Dentro do rodapé de propósito: ele já tem área no grid da versão
        // deitada, então a assinatura acompanha sem mexer no layout.
        // Não entra no dicionário de idiomas — apelido não se traduz.
        // Receber uma mesa fica no pé, e não no cabeçalho: é raro, e quem
        // precisa dele sabe que precisa - alguém acabou de dizer "te mandei a
        // partida". Pôr no alto custaria espaço permanente por um uso
        // ocasional.
        receberMesaBotao(onAbrirMesa),
        el('p', { class: 'signature', text: 'designed by @AlienPls' }),
      ]),
    ]),
  );

  refresh();
}
