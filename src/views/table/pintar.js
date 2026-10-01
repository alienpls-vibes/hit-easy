/**
 * Desenhar a mesa a partir do estado.
 *
 * `sync()` e chamado depois de toda mudanca e nao recebe nada: le `mesa.state`
 * e ajusta o que estiver diferente. Ele nao decide nada - so mostra.
 */

import { el, clear, icon, toast } from '../../ui.js';
import { accentOf, identityGradient, withAlpha } from '../../colors.js';
import {
  canUndo, standings, deckNameOf, CMD_LETHAL, POISON_LETHAL,
} from '../../engine.js';
import * as store from '../../store.js';
import { grausNaMesa, apontadorPreciso } from '../../orientation.js';
import { t, ordinal } from '../../i18n.js';

export function criarPintura(mesa) {
  // ---------- render ----------

  function sync() {
    // A colocação vem da mesma fonte que a tela de encerramento: com empate
    // por turno, dois cálculos diferentes discordariam na mesma partida.
    const lugarNaMesa = new Map(standings(mesa.match, mesa.state).map((x) => [x.seatId, x.place]));

    for (const seat of mesa.match.seats) {
      const p = mesa.state.players[seat.id];
      const tile = mesa.tiles.get(seat.id);
      const extra = mesa.pending.get(seat.id);
      const shown = p.life + (extra ? extra.delta : 0);

      tile.life.textContent = String(shown);
      tile.life.classList.toggle('is-low', shown <= 5 && !p.dead);

      if (extra && extra.delta) {
        tile.delta.textContent = (extra.delta > 0 ? '+' : '') + extra.delta;
        tile.delta.classList.add('is-on');
      } else {
        tile.delta.classList.remove('is-on');
      }

      tile.root.classList.toggle('is-active', seat.id === mesa.state.activeSeatId && !mesa.state.finished);
      tile.root.classList.toggle('is-dead', p.dead);

      const worstCmd = Math.max(0, ...Object.values(p.cmd), 0);
      const badges = [];
      if (worstCmd > 0) badges.push({ k: 'cmd', v: worstCmd + '/' + CMD_LETHAL, hot: worstCmd >= CMD_LETHAL - 4 });
      if (p.poison > 0) badges.push({ k: 'poison', v: p.poison + '/' + POISON_LETHAL, hot: p.poison >= POISON_LETHAL - 2 });
      clear(tile.badges);
      badges.forEach((b) => tile.badges.append(
        el('span', { class: 'badge badge-' + b.k + (b.hot ? ' is-hot' : ''), text: b.v }),
      ));

      clear(tile.status);
      if (p.dead) {
        tile.status.append(
          icon('skull'),
          el('span', {
            // A mesma colocacao da tela de encerramento.
            //
            // Antes saia de elim.place, que e a ORDEM de saida - e com empate
            // por turno os dois numeros passariam a discordar: o painel diria
            // 3o e o resumo diria 4o para a mesma pessoa, na mesma partida.
            text: lugarNaMesa.has(seat.id)
              ? t('table.place', { n: ordinal(lugarNaMesa.get(seat.id)) })
              : t('table.eliminated'),
          }),
        );
      }
    }

    mesa.wrap.classList.toggle('is-paused', mesa.state.paused);
    mesa.pauseView.root.classList.toggle('is-open', mesa.state.paused);
    if (mesa.state.paused) mesa.startPauseClock(); else mesa.stopPauseClock();

    mesa.syncManaBtn();

    mesa.hub.turn.textContent = String(mesa.state.turn);
    const active = mesa.state.players[mesa.state.activeSeatId];
    mesa.hub.ring.style.setProperty(
      '--accent',
      active ? accentOf(active.commanders[0] ? active.commanders[0].colors : []) : 'var(--text-dim)',
    );
    mesa.hub.undoBtn.disabled = !canUndo(mesa.match) && !mesa.pending.size;

    // O cartaz de vitoria aparece uma vez por desfecho. Se um "desfazer" trouxer
    // alguem de volta a vida, ele fica armado outra vez.
    if (!mesa.state.finished) mesa.victoryShown = false;
    else if (!mesa.victoryShown) {
      mesa.victoryShown = true;
      setTimeout(mesa.showVictory, 420);
    }
  }

  function buildTile(seat, spec) {
    const commander = seat.commanders[0];
    const colors = commander ? commander.colors : [];
    const accent = accentOf(colors);

    const life = el('div', { class: 'tile-life' });
    const delta = el('div', { class: 'tile-delta' });
    const badges = el('div', { class: 'tile-badges' });
    const status = el('div', { class: 'tile-status' });

    // As faixas so marcam territorio: quem escuta o ponteiro e o painel
    // inteiro, em bindTile. Por isso sao divs e nao botoes.
    const minus = el('div', { class: 'tap tap-minus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('minus')]),
    ]);
    const plus = el('div', { class: 'tap tap-plus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('plus')]),
    ]);

    const header = el('div', { class: 'tile-head' }, [
      el('span', { class: 'tile-player', text: seat.name }),
      el('span', { class: 'tile-deck', text: deckNameOf(seat.commanders) }),
    ]);

    const band = el('div', { class: 'tile-drag' });

    // Nome proprio: `root` no escopo de cima e a raiz da TELA. A chave
    // devolvida segue sendo `root`, entao quem usa tile.root nao muda.
    const painel = el('div', {
      class: 'tile',
      dataset: { seat: seat.id },
      style: {
        gridRow: spec.cs ? String(spec.r) : String(spec.r),
        gridColumn: spec.cs ? spec.c + ' / span ' + spec.cs : String(spec.c),
        // Mesma regra do teclado de dano: no computador ninguem senta do
        // outro lado do monitor, e o giro deixava metade dos nomes, vidas e
        // comandantes de cabeca para baixo.
        transform: 'rotate(' + grausNaMesa(spec.rot, apontadorPreciso()) + ')',
        '--accent': accent,
        '--tint': identityGradient(colors, 0.16),
        '--glow': withAlpha(accent, 0.34),
      },
    }, [
      commander && commander.art
        ? el('div', { class: 'tile-art', style: { backgroundImage: 'url(' + commander.art + ')' } })
        : null,
      el('div', { class: 'tile-tint' }),
      minus,
      plus,
      band,
      el('div', { class: 'tile-face' }, [header, life, badges, status]),
      delta,
    ]);

    mesa.bindTile(painel, seat);
    return { root: painel, life, delta, badges, status };
  }

  /** Uma dica, uma vez na vida: o arraste precisa ser descoberto. */
  function hintOnce() {
    if (store.getDB().settings.dragHintSeen) return;
    store.setSetting('dragHintSeen', true);
    setTimeout(() => toast(t('table.dragHint')), 1000);
  }

  return { sync, buildTile, hintOnce };
}
