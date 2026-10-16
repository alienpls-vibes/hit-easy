/**
 * An in-memory Supabase, just as wide as the app uses it.
 *
 * It answers the GoTrue and PostgREST calls in src/cloud/ with the same
 * shapes, and keeps the rules the journeys depend on: a match row belongs to
 * its owner and its channel (`canal`), downloads need an active subscription
 * (RLS returns an empty list otherwise), inserting the same id twice is a
 * no-op (`resolution=ignore-duplicates`).
 *
 * Anything the app calls that is not implemented here is recorded in
 * `unknown`, and run.js fails the journey on it. That keeps this fake honest:
 * the day the app starts using a new endpoint, the journeys say so instead of
 * quietly answering 404.
 *
 * `down(true)` makes every call answer 503 - the cloud being unreachable,
 * which is when a match must stay safe on the device.
 */

let seq = 0;
const token = (kind) => kind + '-' + (++seq) + '-' + Math.random().toString(36).slice(2);

export function fakeCloud({ users = [] } = {}) {
  const db = {
    users: new Map(),          // email -> { id, email, password, user_metadata }
    sessions: new Map(),       // access token -> user id
    refresh: new Map(),        // refresh token -> user id
    profiles: new Map(),       // user id -> profile row
    subscriptions: new Map(),  // user id -> subscription row
    matches: new Map(),        // id -> { id, owner, started_at, canal, payload }
    matchPlayers: [],
  };
  const unknown = [];
  let isDown = false;

  for (const u of users) {
    const id = 'user-' + (db.users.size + 1);
    db.users.set(u.email.toLowerCase(), { id, email: u.email, password: u.password, user_metadata: { has_password: true } });
    db.profiles.set(id, {
      id, handle: u.handle || null, display_name: u.name || null,
      decks: [], decks_beta: [], handle_trocado_em: null,
    });
    if (u.subscribed) db.subscriptions.set(id, { user_id: id, status: 'active', current_period_end: null });
  }

  const userPublic = (u) => ({ id: u.id, email: u.email, user_metadata: u.user_metadata, identities: [{ id: u.id }] });

  function sessionFor(u) {
    const access = token('access');
    const refresh = token('refresh');
    db.sessions.set(access, u.id);
    db.refresh.set(refresh, u.id);
    return {
      access_token: access, refresh_token: refresh, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: userPublic(u),
    };
  }

  const who = (headers) => {
    const auth = headers.Authorization || headers.authorization || '';
    return db.sessions.get(auth.replace(/^Bearer\s+/i, '')) || null;
  };
  const userById = (id) => [...db.users.values()].find((u) => u.id === id);
  const eq = (url, col) => {
    const v = url.searchParams.get(col);
    return v && v.startsWith('eq.') ? decodeURIComponent(v.slice(3)) : null;
  };
  const ok = (body, status = 200) => ({ status, body });

  async function handle(method, url, body, headers) {
    if (isDown) return ok({ message: 'service unavailable' }, 503);
    const p = url.pathname;
    const uid = who(headers);

    // ---- GoTrue -------------------------------------------------------
    if (p === '/auth/v1/settings') return ok({ external: { email: true, google: false } });
    if (p === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = db.users.get(String(body && body.email).toLowerCase());
        if (!u || u.password !== body.password) return ok({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
        return ok(sessionFor(u));
      }
      if (grant === 'refresh_token') {
        const id = db.refresh.get(body && body.refresh_token);
        if (!id) return ok({ error: 'invalid_grant' }, 400);
        return ok(sessionFor(userById(id)));
      }
    }
    if (p === '/auth/v1/user') {
      if (!uid) return ok({ message: 'not signed in' }, 401);
      const u = userById(uid);
      if (method === 'PUT' && body && body.data) u.user_metadata = { ...u.user_metadata, ...body.data };
      return ok(userPublic(u));
    }
    if (p === '/auth/v1/logout') {
      const auth = (headers.Authorization || headers.authorization || '').replace(/^Bearer\s+/i, '');
      db.sessions.delete(auth);
      return ok(null, 204);
    }

    // ---- PostgREST: everything below needs a signed-in user ------------
    if (p.startsWith('/rest/v1/') && !uid) return ok({ message: 'JWT required' }, 401);

    if (p === '/rest/v1/profiles') {
      const row = db.profiles.get(uid);
      if (method === 'GET') return ok(row ? [row] : []);
      if (method === 'PATCH' && eq(url, 'id') === uid) { Object.assign(row, body); return ok(null, 204); }
      if (method === 'POST') { db.profiles.set(uid, { ...row, ...body, id: uid }); return ok(null, 201); }
    }
    if (p === '/rest/v1/subscriptions' && method === 'GET') {
      const s = db.subscriptions.get(uid);
      return ok(s ? [s] : []);
    }
    if (p === '/rest/v1/matches') {
      const canal = eq(url, 'canal');
      const mine = () => [...db.matches.values()].filter((m) => (m.owner === uid
        || db.matchPlayers.some((mp) => mp.match_id === m.id && mp.user_id === uid && mp.status === 'aceito'))
        && (!canal || m.canal === canal));
      if (method === 'GET') {
        // RLS: without a subscription the rows simply are not there.
        if (!db.subscriptions.has(uid)) return ok([]);
        const rows = mine().sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
        if (url.searchParams.get('select') === 'id') return ok(rows.map((r) => ({ id: r.id })));
        return ok(rows);
      }
      if (method === 'POST') {
        for (const row of [].concat(body)) {
          if (row.owner !== uid) return ok({ message: 'row-level security' }, 403);
          if (!db.matches.has(row.id)) db.matches.set(row.id, { ...row, canal: row.canal || 'producao' });
        }
        return ok(null, 201);
      }
      if (method === 'DELETE') {
        const id = eq(url, 'id');
        const row = db.matches.get(id);
        if (row && row.owner === uid) db.matches.delete(id);
        return ok(null, 204);
      }
    }
    if (p === '/rest/v1/match_players') {
      if (method === 'GET') return ok(db.matchPlayers.filter((mp) => mp.user_id === uid));
      if (method === 'POST') { db.matchPlayers.push(...[].concat(body)); return ok(null, 201); }
      if (method === 'PATCH') return ok(null, 204);
    }
    if (p === '/rest/v1/trusted_hosts') {
      if (method === 'GET') return ok([]);
      return ok(null, 201);
    }
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn === 'perfis_por_handle' || fn === 'handles_atuais' || fn === 'buscar_handle') return ok([]);
      if (fn === 'anfitriao_do_convite') return ok(null);
    }

    unknown.push(method + ' ' + p + url.search);
    return ok({ message: 'not implemented in the fake cloud' }, 404);
  }

  return {
    handle,
    unknown,
    db,
    down(on) { isDown = Boolean(on); },
    matchIds: () => [...db.matches.keys()],
  };
}
