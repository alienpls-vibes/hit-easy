/**
 * A mesa sendo montada, antes de virar partida.
 *
 * Um rascunho so, vivo enquanto a home esta aberta: vida inicial, os assentos
 * na ordem em que sentam - que e a ordem dos turnos - e a disposicao escolhida.
 * Toda tela da home recebe esse rascunho por parametro; ninguem alcanca o
 * `draft` daqui de fora, e e o que mantem "quem esta na mesa" com uma unica
 * fonte de verdade.
 */

import * as store from '../../store.js';
import { uid, pessoaRepetida } from '../../engine.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { cloudEnabled } from '../../config.js';

export const LIFE_PRESETS = [20, 30, 40, 60];

export const MIN_SEATS = 2;

export const MAX_SEATS = 6;

let draft = null;

export function freshSeat(index) {
  // Chave propria, e nao o titulo da secao: 'Players' + numero dava
  // "Players 1" em ingles. Interpolar tambem deixa a ordem livre em
  // linguas onde o numero nao vem depois.
  return { id: uid('seat'), name: t('setup.playerN', { n: index + 1 }), commanders: [] };
}

export function ensureDraft() {
  if (draft) return draft;
  const settings = store.getDB().settings;
  draft = {
    startingLife: settings.startingLife || 40,
    seats: [freshSeat(0), freshSeat(1), freshSeat(2), freshSeat(3)],
    layoutId: null,
    firstSeatId: null,
  };
  return draft;
}

/** Reaproveita a mesa anterior mantendo jogadores, decks e disposicao. */
export function seedDraftFrom(match) {
  draft = {
    startingLife: match.startingLife,
    seats: match.seats.map((s) => ({
      id: uid('seat'),
      name: s.name,
      commanders: s.commanders.map((c) => ({ ...c })),
    })),
    layoutId: match.layoutId || null,
    firstSeatId: null, // quem comeca se decide de novo a cada partida
  };
}

/** Atalhos sobre o rascunho; a regra em si mora no motor. */
export function nomeNaMesa(seat, nome) {
  return pessoaRepetida(ensureDraft().seats, seat, { name: nome }) === 'nome';
}

export function contaNaMesa(seat, handle) {
  return pessoaRepetida(ensureDraft().seats, seat, { handle }) === 'conta';
}

/** So faz sentido oferecer vinculo para quem esta numa conta. */
export function podeVincular() {
  return cloudEnabled() && cloud.state() !== 'deslogado';
}
