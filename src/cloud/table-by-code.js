/**
 * Passing the table by code: the match goes up, a short code comes down.
 *
 * By file, the table went over WhatsApp and the receiving phone could not open
 * the .json - the handoff failed in the middle of the game. A six-letter code
 * crosses any conversation, whether said out loud or typed.
 *
 * No account, on purpose: the battery dies on the phone of whoever is at the
 * table, signed in or not. That is why the requests go with the ANONYMOUS
 * headers - what protects this is the database (sql/007-table-by-code.sql):
 * the table has no policy, only the functions answer, and only to whoever has
 * the code. Going through `request()` would not work either: a 401 there
 * takes down the person's session, and nothing here depends on a session.
 *
 * Bound to the channel, like the matches: a code generated in beta does not
 * open in production.
 *
 * The RPC names, their parameters and the statuses they return are
 * Portuguese in the database and are used here as they are.
 */

import { anonymousHeaders, url } from './http.js';
import { channel } from '../channel.js';

/** The database alphabet: no 0/O and 1/I/L, which get confused. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/**
 * What the person typed, the way the database stores it.
 *
 * Accepts the code as it shows on screen (`K7M 2QX`), with a dash or in
 * lowercase. It does not try to guess a letter outside the alphabet (an O, a
 * 1): they do not exist in any code, and isCodeValid() refuses them.
 */
export function normalizeCode(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isCodeValid(code) {
  const c = normalizeCode(code);
  return c.length === CODE_LENGTH
    && [...c].every((letter) => CODE_ALPHABET.includes(letter));
}

/** `K7M2QX` -> `K7M 2QX`: two blocks of three read and dictate better. */
export function formatCode(code) {
  const c = normalizeCode(code);
  return c.length === CODE_LENGTH ? c.slice(0, 3) + ' ' + c.slice(3) : c;
}

/**
 * Finds the code inside pasted text or a link.
 *
 * Whoever receives it in a chat usually copies the whole message; the field
 * has to find the code in there instead of refusing. The link's `?mesa=` comes
 * first, because that is what the app wrote. (`mesa` is the parameter name in
 * links already shared - it stays.)
 */
export function codeInText(text) {
  const s = String(text || '');
  const fromLink = s.match(/[?&]mesa=([A-Za-z0-9]{6})\b/);
  if (fromLink && isCodeValid(fromLink[1])) return normalizeCode(fromLink[1]);
  const direct = normalizeCode(s);
  if (isCodeValid(direct)) return direct;
  // Six characters of the alphabet, alone or in two blocks of three.
  const loose = s.toUpperCase().match(/\b([A-Z0-9]{3})[\s-]?([A-Z0-9]{3})\b/g) || [];
  for (const piece of loose) {
    if (isCodeValid(piece)) return normalizeCode(piece);
  }
  return null;
}

async function rpc(name, body) {
  let res;
  try {
    res = await fetch(url('/rest/v1/rpc/' + name), {
      method: 'POST',
      headers: anonymousHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('offline');
  }
  if (!res.ok) throw new Error('server');
  return res.status === 204 ? null : res.json();
}

/** Uploads the table (the same envelope as the file) and returns the code. */
export async function sendTable(envelope) {
  const code = await rpc('enviar_mesa', { mesa: envelope, c: channel() });
  if (!isCodeValid(code)) throw new Error('server');
  return normalizeCode(code);
}

/** The envelope behind the code, without consuming it. null if there is none. */
export async function peekTable(code) {
  const data = await rpc('ver_mesa', { cod: normalizeCode(code), c: channel() });
  return data && typeof data === 'object' ? data : null;
}

/** Consumes the code and returns the envelope. null if someone took it first. */
export async function takeTable(code) {
  const data = await rpc('pegar_mesa', { cod: normalizeCode(code), c: channel() });
  return data && typeof data === 'object' ? data : null;
}

/** 'esperando' (waiting) | 'recebida' (received) | 'inexistente' (unknown). */
export async function tableStatus(code) {
  return rpc('situacao_mesa', { cod: normalizeCode(code), c: channel() });
}

/** 'cancelada' (cancelled) | 'recebida' (received) | 'inexistente' (unknown). */
export async function cancelTable(code) {
  return rpc('cancelar_mesa', { cod: normalizeCode(code), c: channel() });
}
