/**
 * Como as vitorias foram ganhas.
 *
 * So aparece quando alguem declarou motivo: vitoria por ultimo vivo nao tem
 * causa registrada, e um bloco vazio em todo cartao seria ruido.
 */

import { el } from '../../ui.js';
import { t } from '../../i18n.js';

/**
 * Como as vitorias foram ganhas.
 *
 * So aparece quando alguem declarou motivo - vitoria por ultimo vivo nao tem
 * causa registrada, e um bloco vazio em todo cartao seria ruido.
 */
export function winReasonBlock(row) {
  const motivos = Object.entries(row.winReasons || {});
  if (!motivos.length) return null;

  const ROTULOS = {
    combate: 'win.combat', comandante: 'win.commander', combo: 'win.combo',
    veneno: 'win.poison', mill: 'win.mill', alternativa: 'win.alt',
    concessao: 'win.concede', outro: 'win.other',
  };

  return el('div', { class: 'vote-history' }, [
    el('span', { class: 'vote-history-title' }, [
      t('stats.winReasons'),
      el('span', {
        class: 'vote-history-count',
        text: String(motivos.reduce((a, [, n]) => a + n, 0)),
      }),
    ]),
    el('div', { class: 'win-reason-tags' }, motivos
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => el('span', {
        class: 'win-reason-tag',
        text: t(ROTULOS[id] || 'win.other') + (n > 1 ? ' ×' + n : ''),
      }))),
  ]);
}
