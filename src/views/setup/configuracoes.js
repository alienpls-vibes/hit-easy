/**
 * Preferencias do aplicativo - o que vale para todas as partidas.
 *
 * Vida inicial e disposicao da mesa ficam de fora daqui de proposito: mudam a
 * cada jogo, entao vivem na home e na tela de antes de comecar.
 *
 * A ordem segue a frequencia de uso, e cada grupo responde a uma pergunta:
 *
 *   Conta        uma linha so, que abre a propria tela. Era o bloco mais
 *                comprido e vinha primeiro, empurrando para baixo o que se
 *                mexe de verdade - idioma, tema, vibracao.
 *   Aparencia    como o app se mostra.
 *   Na mesa      como o app se comporta durante a partida.
 *   Aplicativo   instalar ou atualizar, o que mudou, ajuda e privacidade.
 *
 * Texto so onde ele muda a decisao. "Vibracao" nao precisa de "retorno tatil a
 * cada toque" embaixo; travar a tela na horizontal precisa dizer que entra em
 * tela cheia, porque isso surpreende.
 */

import { el, openFlow, toast, setHaptics } from '../../ui.js';
import * as store from '../../store.js';
import { MODES, currentMode, applyTheme } from '../../theme.js';
import { t, LANGS, currentLang, setLang } from '../../i18n.js';
import { buildDoBeta, versaoDoWorker, ehIOS } from '../../install.js';
import { APP_VERSION } from '../../version.js';
import { canal } from '../../canal.js';
import { cloudEnabled } from '../../config.js';
import { contaResumo } from './conta.js';
import { installBlock } from './instalar.js';
import { abrirNovidades } from './notas-de-versao.js';
import {
  grupo, linha, linhaInterruptor, linhaSelect, linhaSegmentos,
} from './linhas.js';

export function openSettings(onRefresh) {
  const s = store.getDB().settings;

  openFlow({
    title: t('settings.title'),
    build: (pane, api) => {
      if (cloudEnabled()) pane.append(grupo(null, [contaResumo(api, onRefresh)]));

      pane.append(grupo(t('settings.appearance'), [
        linhaSelect(t('settings.language'), currentLang(), LANGS, (codigo) => {
          store.setSetting('lang', codigo);
          setLang(codigo);
          // Cada texto foi lido na hora de desenhar, entao os dois precisam
          // ser refeitos: a home por baixo, e este painel - que continuaria
          // no idioma antigo ate ser fechado na mao.
          if (onRefresh) onRefresh();
          openSettings(onRefresh);
        }),
        linhaSegmentos(
          t('settings.theme'),
          MODES.map(([id, chave]) => [id, t(chave)]),
          currentMode(),
          (id) => {
            store.setSetting('theme', id);
            applyTheme(id);
            // A paleta WUBRG mudou: o resto da tela precisa ser redesenhado.
            if (onRefresh) onRefresh();
          },
        ),
      ]));

      pane.append(grupo(t('settings.onTable'), [
        linhaInterruptor(t('settings.haptics'), null, s.haptics, (v) => {
          store.setSetting('haptics', v);
          setHaptics(v);
        }),
        linhaInterruptor(t('settings.keepAwake'), null, s.keepAwake, (v) => {
          store.setSetting('keepAwake', v);
        }),
        // No iPhone o Safari nao trava orientacao nem entra em tela cheia: o
        // interruptor existiria so para nao fazer nada.
        ehIOS() ? null : linhaInterruptor(
          t('settings.autoRotate'),
          t('settings.autoRotateSub'),
          s.autoRotate,
          (v) => store.setSetting('autoRotate', v),
        ),
      ]));

      pane.append(grupo(t('settings.app'), [
        installBlock(onRefresh),
        linha({
          rotulo: t('news.title'),
          valor: APP_VERSION,
          seta: true,
          aoTocar: () => abrirNovidades(),
        }),
        linha({
          rotulo: t('settings.showHint'),
          aoTocar: () => {
            store.setSetting('dragHintSeen', false);
            toast(t('settings.hintBack'));
          },
        }),
        // Caminho relativo, e nao absoluto: o app roda em /hit-easy/ e em
        // /hit-easy/beta/, e um link com barra na frente levaria o beta para a
        // politica de producao.
        linha({ rotulo: t('settings.privacy'), href: './privacidade.html', seta: true }),
      ]));

      pane.append(el('p', { class: 'settings-note', text: t('settings.dataNote') }));

      // A versao fecha as configuracoes.
      //
      // Quem relata um problema precisa conseguir dizer QUAL app quebrou, e o
      // canal precisa aparecer junto: um defeito do beta investigado como se
      // fosse de producao custa horas.
      const linhaVersao = el('button', {
        class: 'settings-version',
        onClick: () => abrirNovidades(),
        text: 'Hit Easy ' + APP_VERSION
          + (canal() === 'beta' ? ' · beta' : ''),
      });
      pane.append(linhaVersao);

      // No beta, qual commit esta no ar. A versao sozinha nao distingue duas
      // idas ao beta, porque ela so anda quando ha publicacao em producao.
      if (canal() === 'beta') {
        buildDoBeta().then((b) => {
          if (b) linhaVersao.textContent += ' · ' + b.build;
        });
      }

      // Se o worker disser outra versao, e cache velho servindo codigo antigo.
      // Sem isto o defeito e invisivel: a tela mostra a versao do modulo, o
      // modulo vem do cache, e o cache mente com toda a confianca do mundo.
      versaoDoWorker().then((v) => {
        if (v && v !== APP_VERSION) {
          linhaVersao.textContent += ' · ' + t('settings.staleCache', { n: v });
        }
      });
    },
  });
}
