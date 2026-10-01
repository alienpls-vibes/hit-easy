/**
 * O marcador de mana.
 *
 * Zera ao passar a vez - e mana flutuante, nao recurso permanente. Nao entra no
 * log de eventos, e isso e decisao e nao esquecimento: cada toque viraria uma
 * linha no historico e sujaria as estatisticas para sempre. Fica guardada junto
 * da partida, fora dos eventos, entao sobrevive a recarregar o navegador - mas
 * `replay` a ignora por completo.
 */

import { el, icon, openSheet, buzz } from '../../ui.js';
import { colorHex } from '../../colors.js';
import { t } from '../../i18n.js';
import { MANA, MANA_ZERO } from './constantes.js';
import { bindHold } from './pecas.js';

export function criarMana(mesa) {
  /* ---------------------------------------------------------------- */
  /* Marcador de mana                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Mana flutuante do turno.
   *
   * NAO entra no log de eventos, e isso e decisao, nao esquecimento: mana e
   * efemera, some ao passar a vez e nao diz nada sobre a partida depois. Cada
   * toque viraria uma linha no historico e sujaria as estatisticas para sempre.
   *
   * Fica guardada junto da partida (fora dos eventos), entao sobrevive a
   * recarregar o navegador no meio do turno - mas `replay` a ignora por
   * completo, e o placar continua saindo so do log.
   */
  function poolMana() {
    if (!mesa.match.mana) mesa.match.mana = { ...MANA_ZERO };
    return mesa.match.mana;
  }

  function limparMana() {
    mesa.match.mana = { ...MANA_ZERO };
  }

  function totalMana() {
    return Object.values(poolMana()).reduce((a, b) => a + b, 0);
  }

  /** O atalho aparece e some com a mana; o numero e o proprio rotulo dele. */
  function syncManaBtn() {
    const total = totalMana();
    mesa.hub.manaCount.textContent = String(total);
    mesa.hub.manaBtn.hidden = total === 0;
  }

  function gravarManaDepois() {
    clearTimeout(mesa.manaSaveTimer);
    mesa.manaSaveTimer = setTimeout(() => mesa.ctx.onChange(), 400);
  }

  function openMana() {
    const pool = poolMana();
    const ativo = mesa.match.seats
      .find((s) => s.id === mesa.state.activeSeatId);
    const refs = {};
    const total = el('span', { class: 'mana-total-value' });

    const pintar = () => {
      MANA.forEach((k) => {
        refs[k].num.textContent = String(pool[k]);
        refs[k].tile.classList.toggle('is-on', pool[k] > 0);
      });
      total.textContent = String(totalMana());
      syncManaBtn();
    };

    const mexer = (k, d) => {
      pool[k] = Math.max(0, Math.min(99, pool[k] + d));
      pintar();
      buzz(6);
      gravarManaDepois();
    };

    openSheet({
      title: t('mana.title'),
      subtitle: (ativo ? ativo.name + ' · ' : '') + t('mana.sub'),
      build: (pane, close) => {
        // Nome proprio: a grade da MESA tambem se chama grid no escopo de
        // cima, e as duas no mesmo arquivo confundiam a leitura.
        const gradeMana = el('div', { class: 'mana-grid' });

        MANA.forEach((k) => {
          const num = el('span', { class: 'mana-count' });

          // Mesma gramatica do painel de vida: metade esquerda tira, metade
          // direita poe, segurar repete. Nada novo para aprender.
          const menos = el('div', { class: 'mana-tap mana-minus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('minus')]),
          ]);
          const mais = el('div', { class: 'mana-tap mana-plus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('plus')]),
          ]);
          bindHold(menos, () => mexer(k, -1));
          bindHold(mais, () => mexer(k, +1));

          const tile = el('div', {
            class: 'mana-tile',
            style: { '--accent': colorHex(k) },
          }, [
            menos,
            mais,
            el('div', { class: 'mana-face' }, [
              el('span', { class: 'mana-pip', text: k }),
              el('span', { class: 'mana-name', text: t('mana.' + k) }),
              num,
            ]),
          ]);
          refs[k] = { num, tile };
          gradeMana.append(tile);
        });

        pane.append(
          gradeMana,
          el('div', { class: 'mana-total' }, [
            el('span', { class: 'mana-total-label', text: t('mana.available') }),
            total,
          ]),
          el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn ghost',
              onClick: () => { limparMana(); pintar(); mesa.ctx.onChange(); buzz(12); },
            }, [t('mana.clear')]),
            el('button', { class: 'btn primary', onClick: close }, [t('common.done')]),
          ]),
        );

        pintar();
      },
      onClose: () => { clearTimeout(mesa.manaSaveTimer); mesa.ctx.onChange(); },
    });
  }

  return {
    poolMana, limparMana, totalMana, syncManaBtn, gravarManaDepois, openMana,
  };
}
