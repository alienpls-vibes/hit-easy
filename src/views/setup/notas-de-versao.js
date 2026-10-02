/**
 * As notas da versao.
 *
 * O texto vem de src/novidades.js; aqui e so a tela que o apresenta.
 *
 * O recorte padrao e a DIFERENCA: o que entrou desde a versao em que o app
 * estava. Mostrar o historico inteiro a cada abertura enterra as tres linhas
 * novas embaixo de nove versoes ja lidas, e o que a pessoa aprende e a fechar a
 * tela sem ler. O historico continua alcancavel por um toque no fim da lista -
 * esconder nao e o mesmo que apagar.
 */

import { el, openSheet } from '../../ui.js';
import { t, currentLang } from '../../i18n.js';
import { APP_VERSION } from '../../version.js';
import { NOVIDADES, novidadesDesde, novidadesDe } from '../../novidades.js';
import * as store from '../../store.js';

/**
 * O recorte a mostrar quando ninguem pediu um especifico.
 *
 * Tres situacoes, nessa ordem:
 *
 * 1. Veio de uma versao anterior: so o que entrou desde ela. E o caso que o
 *    menu precisa acertar, porque e o unico em que existe "diferenca".
 * 2. Instalou agora: so as notas desta versao. O historico de mudancas de um
 *    app que a pessoa nunca usou nao e novidade, e ruido antes do primeiro uso.
 * 3. Esta versao nao tem notas: cai no historico, que e melhor que uma tela
 *    vazia. `npm test` nao deixa publicar sem notas, entao e rede de seguranca.
 */
function recortePadrao() {
  const anterior = store.getDB().settings.versaoAnterior || null;
  if (anterior) {
    const desde = novidadesDesde(anterior);
    if (desde.length) return desde;
  }

  const atual = novidadesDe(APP_VERSION);
  return atual ? [atual] : NOVIDADES;
}

/**
 * O que mudou.
 *
 * `lista` vazia ou ausente significa o recorte padrao - e o que o menu e o
 * arranque usam. Passar uma lista serve a dois casos: o arranque, que ja sabe
 * exatamente o que a pessoa nao viu, e o "ver todas as versoes" daqui.
 */
export function abrirNovidades(lista = null) {
  const versoes = lista && lista.length ? lista : recortePadrao();
  const tudo = versoes.length === NOVIDADES.length;

  openSheet({
    title: t('news.title'),
    subtitle: versoes.length === 1 ? versoes[0].titulo : t('news.sub', { v: APP_VERSION }),
    build: (pane) => {
      for (const v of versoes) {
        pane.append(el('div', { class: 'news-head' }, [
          el('span', { class: 'news-version', text: v.versao }),
          el('span', { class: 'news-date', text: v.data }),
        ]));
        if (v.titulo && versoes.length > 1) {
          pane.append(el('p', { class: 'sheet-legend', text: v.titulo }));
        }
        const lista2 = el('div', { class: 'news-list' });
        for (const item of v.itens || []) {
          lista2.append(el('div', { class: 'news-item' }, [
            el('span', { class: 'news-tag is-' + item.tipo, text: t('news.' + item.tipo) }),
            el('span', { class: 'news-text', text: textoDaNota(item.texto) }),
          ]));
        }
        pane.append(lista2);
      }

      // A saida para o historico, no fim e nao no topo: quem abriu quer ver o
      // que entrou, e o resto e para quem foi procurar.
      if (!tudo) {
        pane.append(el('button', {
          class: 'news-all',
          onClick: () => abrirNovidades(NOVIDADES),
          text: t('news.seeAll', { n: NOVIDADES.length }),
        }));
      }
    },
  });
}

/**
 * O texto de uma nota no idioma de agora.
 *
 * Aceita string simples - o caso normal, escrito uma vez - ou um objeto com
 * traducoes. Sem o objeto obrigatorio, escrever uma nota nao vira trabalho em
 * quatro linguas a cada publicacao, que e o tipo de peso que faz as notas
 * deixarem de ser escritas.
 */
function textoDaNota(texto) {
  if (typeof texto === 'string') return texto;
  if (!texto) return '';
  return texto[currentLang()] || texto.pt || Object.values(texto)[0] || '';
}
