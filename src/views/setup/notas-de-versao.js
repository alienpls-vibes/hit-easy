/**
 * As notas da versao, mostradas uma vez por atualizacao.
 *
 * O texto vem de src/novidades.js; aqui e so a tela que o apresenta.
 */

import { el, openSheet } from '../../ui.js';
import { t, currentLang } from '../../i18n.js';
import { APP_VERSION } from '../../version.js';
import { NOVIDADES } from '../../novidades.js';

/**
 * O que mudou.
 *
 * `lista` vazia significa "mostre tudo" - e o padrao ao abrir pelo menu. Depois
 * de atualizar, o app passa so o que a pessoa ainda nao viu: ler de novo o que
 * ja se leu treina a ignorar a tela.
 */
export function abrirNovidades(lista = NOVIDADES) {
  const versoes = lista.length ? lista : NOVIDADES;
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
