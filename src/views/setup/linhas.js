/**
 * As pecas das configuracoes: grupos de linhas, no desenho dos ajustes do
 * proprio celular.
 *
 * Antes cada bloco tinha um formato - um cartao aqui, um botao solto ali, um
 * paragrafo explicando embaixo de quase tudo - e os subtitulos de dentro da
 * conta tinham o mesmo peso dos titulos de secao. A tela nao dizia o que era
 * parte de que. Agora ha uma forma so: um titulo curto, e um cartao com linhas
 * separadas por um fio. Toda linha tem o mesmo tamanho minimo de toque.
 *
 * Arquivo proprio porque conta, instalar e sincronizar desenham com as mesmas
 * pecas, e importar de configuracoes.js faria um ciclo.
 */

import { el, clear, icon, buzz } from '../../ui.js';

/**
 * Um grupo: titulo opcional e o cartao com as linhas.
 * Linha `null` e ignorada, para quem monta poder escrever `cond ? linha : null`.
 */
export function grupo(titulo, linhas) {
  return el('section', { class: 'set-section' }, [
    titulo ? el('p', { class: 'sheet-legend', text: titulo }) : null,
    el('div', { class: 'set-group' }, linhas.filter(Boolean)),
  ]);
}

/**
 * Uma linha. Com `aoTocar` e botao; com `href` e link; sem nenhum e so texto.
 *
 * `valor` e o que fica a direita - a versao, o nome do idioma, "Trocar".
 * Os nos de rotulo, subtitulo e valor ficam pendurados na linha (`_rotulo`,
 * `_sub`, `_valor`) para quem precisa mudar o texto sem remontar - o botao de
 * atualizar troca o rotulo pelo girador enquanto espera.
 */
export function linha({
  rotulo, sub, valor, aoTocar, href, seta, perigo, classe, extra,
}) {
  const rotuloEl = el('span', { class: 'set-label', text: rotulo });
  const subEl = el('span', { class: 'set-sub', text: sub || '' });
  subEl.hidden = !sub;
  const valorEl = valor !== undefined && valor !== null
    ? el('span', { class: 'set-value', text: valor })
    : null;

  const filhos = [
    el('span', { class: 'set-text' }, [rotuloEl, subEl]),
    valorEl,
    extra || null,
    seta ? el('span', { class: 'set-chevron' }, [icon('arrow')]) : null,
  ];

  const nomes = 'set-row'
    + (aoTocar || href ? ' is-tap' : '')
    + (perigo ? ' is-danger' : '')
    + (classe ? ' ' + classe : '');

  let no;
  if (href) {
    no = el('a', { class: nomes, href, target: '_blank', rel: 'noopener' }, filhos);
  } else if (aoTocar) {
    no = el('button', { class: nomes, onClick: aoTocar }, filhos);
  } else {
    no = el('div', { class: nomes }, filhos);
  }
  no._rotulo = rotuloEl;
  no._sub = subEl;
  no._valor = valorEl;
  return no;
}

/** Linha com interruptor. O estado vive no proprio botao. */
export function linhaInterruptor(rotulo, sub, inicial, aoMudar) {
  let ligado = inicial !== false;
  const knob = el('span', { class: 'switch' + (ligado ? ' is-on' : '') });

  const no = linha({
    rotulo,
    sub,
    extra: knob,
    classe: 'is-toggle',
    aoTocar: (e) => {
      ligado = !ligado;
      knob.classList.toggle('is-on', ligado);
      e.currentTarget.setAttribute('aria-pressed', String(ligado));
      aoMudar(ligado);
      buzz();
    },
  });
  no.setAttribute('aria-pressed', String(ligado));
  return no;
}

/**
 * Linha com o seletor nativo a direita.
 *
 * Para quatro opcoes de texto longo (os idiomas), chips lado a lado nao cabem
 * no celular. O <select> resolve o espaco e entrega o seletor que o aparelho
 * ja usa em todo lugar.
 */
export function linhaSelect(rotulo, valor, opcoes, aoMudar) {
  const campo = el('select', { class: 'select-input set-select', 'aria-label': rotulo },
    opcoes.map(([v, texto]) => el('option', { value: v, text: texto })));
  campo.value = valor;
  campo.addEventListener('change', () => aoMudar(campo.value));

  return linha({
    rotulo,
    classe: 'is-select',
    extra: el('span', { class: 'set-select-box' }, [
      campo,
      el('span', { class: 'select-caret' }, [icon('arrow')]),
    ]),
  });
}

/** Linha com escolha entre poucas opcoes curtas (o tema), em segmentos. */
export function linhaSegmentos(rotulo, opcoes, atual, aoEscolher) {
  const caixa = el('span', { class: 'set-segments', role: 'group', 'aria-label': rotulo });
  let escolhido = atual;

  const pintar = () => {
    clear(caixa);
    opcoes.forEach(([id, texto]) => {
      caixa.append(el('button', {
        class: 'set-segment' + (escolhido === id ? ' is-on' : ''),
        'aria-pressed': String(escolhido === id),
        onClick: () => {
          escolhido = id;
          pintar();
          buzz();
          aoEscolher(id);
        },
      }, [texto]));
    });
  };
  pintar();

  return linha({ rotulo, classe: 'is-segments', extra: caixa });
}
