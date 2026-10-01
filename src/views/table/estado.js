/**
 * Quem muda o estado da partida.
 *
 * Todo evento entra por `apply()`: ele grava no log, roda `replay()` de novo e
 * repinta. Nada aqui mexe no placar na mao - o placar E o replay do log, e essa
 * e a garantia de que ele nunca diverge do historico.
 *
 * Toques rapidos seguidos se juntam num evento so depois de ~0,9s: sete toques
 * viram uma linha no historico, nao sete. E o que `commit()` faz.
 */

import { buzz, toast } from '../../ui.js';
import { replay, push, undo, redo, canUndo, canRedo } from '../../engine.js';
import { formatDuration } from '../../stats.js';
import { t } from '../../i18n.js';
import { COMMIT_MS } from './constantes.js';

export function criarEstado(mesa) {
  // ---------- estado ----------

  function commit(seatId) {
    const p = mesa.pending.get(seatId);
    if (!p) return;
    clearTimeout(p.timer);
    mesa.pending.delete(seatId);
    if (!p.delta) { mesa.sync(); return; }

    // Borda do painel mexe na vida sem origem: e o proprio jogador pagando.
    // Dano com autor sai do arraste, nunca daqui.
    push(mesa.match, { type: 'life', targetId: seatId, delta: p.delta, sourceId: null });
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    // Saindo da mesa: grava, mas nao avisa mais nada.
    if (mesa.destroyed) return;
    mesa.sync();

    const who = mesa.match.seats.find((s) => s.id === seatId);
    toast(
      who.name + ' ' + (p.delta > 0 ? '+' : '') + p.delta,
      { label: t('common.undo'), onClick: () => doUndo() },
    );
  }

  function commitAll() {
    [...mesa.pending.keys()].forEach(commit);
  }

  function nudge(seatId, step) {
    if (mesa.state.finished || mesa.state.paused) return;
    const p = mesa.pending.get(seatId) || { delta: 0, timer: null };
    p.delta += step;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => commit(seatId), COMMIT_MS);
    mesa.pending.set(seatId, p);
    buzz(6);
    mesa.sync();
  }

  function doUndo() {
    // Cancelar o que ainda nao virou evento vem primeiro.
    if (mesa.pending.size) {
      mesa.pending.forEach((p) => clearTimeout(p.timer));
      mesa.pending.clear();
      mesa.sync();
      return;
    }
    if (!canUndo(mesa.match)) { toast(t('common.nothingToUndo')); return; }
    undo(mesa.match);
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    mesa.sync();
    buzz(10);
  }

  function doRedo() {
    if (!canRedo(mesa.match)) { toast(t('common.nothingToRedo')); return; }
    redo(mesa.match);
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    mesa.sync();
  }

  function passTurn() {
    if (mesa.state.finished || mesa.state.paused) return;
    commitAll();
    mesa.limparMana(); // a mana flutuante nao atravessa a vez
    push(mesa.match, { type: 'turn' });
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    mesa.sync();
    buzz(14);
    const next = mesa.match.seats.find((s) => s.id === mesa.state.activeSeatId);
    if (next) {
      toast(t('table.turnToast', { n: mesa.state.turn, name: next.name }));
    }
  }

  function apply(partial) {
    if (mesa.state.paused && partial.type !== 'resume') return;
    push(mesa.match, partial);
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    mesa.sync();
    buzz(8);
  }

  /**
   * Pausa o relogio da mesa.
   *
   * Nao e so cosmetico: enquanto esta pausada, o tempo nao entra na duracao da
   * partida nem no tempo de turno de ninguem. Uma ida ao banheiro nao deve
   * virar "o turno mais longo da noite" na estatistica.
   */
  function togglePause() {
    commitAll();
    push(mesa.match, { type: mesa.state.paused ? 'resume' : 'pause' });
    mesa.ctx.onChange();
    mesa.state = replay(mesa.match);
    mesa.sync();
    buzz(14);
  }

  function startPauseClock() {
    if (mesa.pauseTimer) return;
    const tick = () => {
      mesa.pauseView.clock.textContent = formatDuration(Date.now() - (mesa.state.pausedSince || Date.now()));
    };
    tick();
    mesa.pauseTimer = setInterval(tick, 1000);
  }

  function stopPauseClock() {
    clearInterval(mesa.pauseTimer);
    mesa.pauseTimer = null;
  }

  return {
    commit, commitAll, nudge, doUndo, doRedo, passTurn, apply, togglePause,
    startPauseClock, stopPauseClock,
  };
}
