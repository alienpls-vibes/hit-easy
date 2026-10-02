/**
 * Preferencias do aplicativo - o que vale para todas as partidas.
 *
 * Vida inicial e disposicao da mesa ficam de fora daqui de proposito: mudam a
 * cada jogo, entao vivem na home e na tela de antes de comecar.
 */

import {
  el, clear, icon, openSheet, buzz, toast, setHaptics,
} from '../../ui.js';
import * as store from '../../store.js';
import { MODES, currentMode, applyTheme } from '../../theme.js';
import { t, LANGS, currentLang, setLang } from '../../i18n.js';
import { buildDoBeta, versaoDoWorker } from '../../install.js';
import { APP_VERSION } from '../../version.js';
import { canal } from '../../canal.js';
import { cloudEnabled } from '../../config.js';
import { accountBlock } from './conta.js';
import { installBlock } from './instalar.js';
import { abrirNovidades } from './notas-de-versao.js';

/**
 * Preferencias do aplicativo - o que vale para todas as partidas. Ajuste de
 * vida inicial e da mesa fica na home mesmo, porque muda a cada jogo.
 */
export function openSettings(onRefresh) {
  const s = store.getDB().settings;

  openSheet({
    title: t('settings.title'),
    subtitle: t('settings.sub'),
    build: (pane) => {
      if (cloudEnabled()) {
        pane.append(el('p', { class: 'sheet-legend', text: t('account.title') }));
        pane.append(accountBlock(onRefresh));
      }

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.language') }));

      /*
       * Dropdown, e nao quatro chips: "Português / English / Español / Deutsch"
       * nao cabe numa linha de celular, e quebrar em duas fileiras dava um
       * bloco desalinhado. O <select> nativo ainda abre o seletor do proprio
       * sistema, que e o controle que a pessoa ja conhece.
       */
      pane.append(selectRow(currentLang(), LANGS, (codigo) => {
        store.setSetting('lang', codigo);
        setLang(codigo);
        buzz(12);

        // Cada texto foi lido na hora de desenhar, entao os dois precisam ser
        // refeitos: a home por baixo, e este painel - que continuaria em
        // portugues ate ser fechado na mao.
        if (onRefresh) onRefresh();
        openSettings(onRefresh);
      }));

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.theme') }));

      const temaLinha = el('div', { class: 'chips chips-fill' });
      const pintarTema = () => {
        clear(temaLinha);
        MODES.forEach(([id, chave]) => {
          temaLinha.append(el('button', {
            class: 'chip' + (currentMode() === id ? ' is-on' : ''),
            onClick: () => {
              store.setSetting('theme', id);
              applyTheme(id);
              pintarTema();
              buzz();
              // A paleta WUBRG mudou: o resto da tela precisa ser redesenhado.
              if (onRefresh) onRefresh();
            },
          }, [t(chave)]));
        });
      };
      pintarTema();
      pane.append(temaLinha);

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.onTable') }));
      pane.append(
        toggleRow(t('settings.haptics'), t('settings.hapticsSub'), s.haptics, (v) => {
          store.setSetting('haptics', v);
          setHaptics(v);
        }),
        toggleRow(t('settings.keepAwake'), t('settings.keepAwakeSub'), s.keepAwake, (v) => {
          store.setSetting('keepAwake', v);
        }),
        toggleRow(
          t('settings.autoRotate'),
          t('settings.autoRotateSub'),
          s.autoRotate,
          (v) => store.setSetting('autoRotate', v),
        ),
      );

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.install') }));
      pane.append(installBlock(onRefresh));

      pane.append(el('p', { class: 'sheet-legend', text: t('settings.help') }));
      pane.append(el('div', { class: 'menu' }, [
        el('button', {
          class: 'menu-item',
          onClick: () => {
            store.setSetting('dragHintSeen', false);
            toast(t('settings.hintBack'));
          },
        }, [
          el('span', { class: 'menu-label', text: t('settings.showHint') }),
          el('span', { class: 'menu-sub', text: t('settings.showHintSub') }),
        ]),

        // Caminho relativo, e nao absoluto: o app roda em /hit-easy/ e em
        // /hit-easy/beta/, e um link com barra na frente levaria o beta para a
        // politica de producao.
        el('button', {
          class: 'menu-item',
          onClick: () => abrirNovidades(),
        }, [
          el('span', { class: 'menu-label', text: t('news.title') }),
          el('span', { class: 'menu-sub', text: t('news.sub', { v: APP_VERSION }) }),
        ]),

        el('a', {
          class: 'menu-item',
          href: './privacidade.html',
          target: '_blank',
          rel: 'noopener',
        }, [
          el('span', { class: 'menu-label', text: t('settings.privacy') }),
          el('span', { class: 'menu-sub', text: t('settings.privacySub') }),
        ]),
      ]));

      pane.append(el('p', {
        class: 'settings-note',
        text: t('settings.dataNote'),
      }));

      // A versao fecha as configuracoes.
      //
      // Quem relata um problema precisa conseguir dizer QUAL app quebrou, e o
      // canal precisa aparecer junto: um defeito do beta investigado como se
      // fosse de producao custa horas.
      const linhaVersao = el('button', {
        class: 'settings-version',
        onClick: () => abrirNovidades(),
        text: 'Hit Easy ' + APP_VERSION
          + (canal() === 'beta' ? ' \u00b7 beta' : ''),
      });
      pane.append(linhaVersao);

      // No beta, qual commit esta no ar. A versao sozinha nao distingue duas
      // idas ao beta, porque ela so anda quando ha publicacao em producao.
      if (canal() === 'beta') {
        buildDoBeta().then((b) => {
          if (b) linhaVersao.textContent += ' \u00b7 ' + b.build;
        });
      }

      // Se o worker disser outra versao, e cache velho servindo codigo antigo.
      // Sem isto o defeito e invisivel: a tela mostra a versao do modulo, o
      // modulo vem do cache, e o cache mente com toda a confianca do mundo.
      versaoDoWorker().then((v) => {
        if (v && v !== APP_VERSION) {
          linhaVersao.textContent += ' \u00b7 ' + t('settings.staleCache', { n: v });
        }
      });
    },
  });
}

/**
 * Campo de escolha unica, com o seletor nativo do sistema.
 *
 * Para tres ou quatro opcoes de texto longo, chips lado a lado nao cabem no
 * celular. O <select> resolve o espaco e, de quebra, entrega o seletor que o
 * aparelho ja usa em todo lugar.
 */
function selectRow(valor, opcoes, onChange) {
  const campo = el('select', { class: 'select-input', 'aria-label': t('settings.language') },
    opcoes.map(([v, rotulo]) => el('option', { value: v, text: rotulo })));

  campo.value = valor;
  campo.addEventListener('change', () => onChange(campo.value));

  return el('div', { class: 'select-row' }, [campo, el('span', { class: 'select-caret' }, [icon('arrow')])]);
}

/** Linha com interruptor. O estado vive no proprio botao. */
function toggleRow(label, sub, initial, onChange) {
  let value = initial !== false;
  const knob = el('span', { class: 'switch' + (value ? ' is-on' : '') });

  return el('button', {
    class: 'toggle-row',
    'aria-pressed': String(value),
    onClick: (e) => {
      value = !value;
      knob.classList.toggle('is-on', value);
      e.currentTarget.setAttribute('aria-pressed', String(value));
      onChange(value);
      buzz();
    },
  }, [
    el('span', { class: 'toggle-text' }, [
      el('span', { class: 'toggle-label', text: label }),
      sub ? el('span', { class: 'toggle-sub', text: sub }) : null,
    ]),
    knob,
  ]);
}
