# Turning the cloud on

Step by step of what needs to be done in the accounts — only you can do it,
because it involves sign-ups, billing and keys.

While `src/config.js` is empty, the app runs as it always did: local, no
account, no paywall. Nothing here breaks what already works.

---

## 1. Supabase (database + accounts)

1. Create a project at <https://supabase.com> — the free plan is enough.
   Pick the closest region (São Paulo, if available).
2. **SQL Editor** → paste the whole `sql/schema.sql` → **Run**.
   It creates tables, indexes and the access policies. It is idempotent:
   running it again breaks nothing.
3. **Settings → API**: copy the `Project URL` and the `anon public` key.
4. Paste both into `src/config.js`.

The `anon key` is public on purpose — it is meant to live in the browser. What
protects the data is the database's RLS, not the key's secrecy. The
`service_role` key, which IS secret, **never** goes into the client; it is only
used in step 3.

### Check that the gate closed

In the SQL Editor, after creating your account through the app:

```sql
-- Should return 0 rows: you do not subscribe yet.
select count(*) from public.matches;
```

If it returns your matches without an active subscription, some policy was not
applied — check in **Authentication → Policies** that RLS is on for `matches`.

---

## 2. How people sign in

**E-mail and password** is the normal path, and it works on any device without
depending on the inbox. Whoever arrived through a magic link sets a password
once in the settings and never needs an e-mail again.

The **e-mail link** is still there, low-key: it is the path for whoever forgot
the password, and the only one that requires remembering nothing.

The session **renews itself** through the `refresh_token`. Before that it was
discarded on expiry — sign-in lasted one hour and then required a new e-mail,
forever. If the server refuses the token in the middle of a sync, the app tries
to renew and retries the request once before giving up.

The password minimum here is 8 characters; Supabase's is 6. Being stricter than
the server is safe — the opposite would produce a 400 the app did not expect.

## 2b. Sign in with Google and Apple

**Authentication → Providers**, in the Supabase dashboard.

- **Google**: create OAuth credentials at <https://console.cloud.google.com>
  (type *Web application*). In *Authorized redirect URIs*, paste the callback
  URL that Supabase itself shows on the provider screen.
- **Apple**: requires a paid developer account (US$ 99/year). If it is not worth
  it now, keep only Google — the e-mail magic link covers everything else,
  iPhone included.

### URL Configuration — the two fields

In **Authentication → URL Configuration** there are two fields, and they do
different things. Filling in only one is what made the first real sign-in land
on `localhost:3000`.

| field | what it is | value |
|---|---|---|
| **Site URL** | default destination, used when the request sends none | `https://alienpls-vibes.github.io/hit-easy/` |
| **Redirect URLs** | list of what is *allowed* — chooses nothing by itself | `https://alienpls-vibes.github.io/hit-easy/**` |

The Site URL is born as `http://localhost:3000`. While it stays like that,
every link that arrives without an explicit destination points to a port that
does not exist on anyone's phone. Change it.

It is worth it as a safety net even with the app asking for the right
destination: if one day `redirect_to` disappears from the request, the worst
case becomes going back to the home page instead of dying on localhost.

---

## 3. Stripe (subscription)

1. Account at <https://stripe.com>, test mode first.
2. **Products** → create "Hit Easy" with a recurring price (monthly and/or yearly).
3. **Payment Links** → generate a link for that price → paste it into
   `CHECKOUT_URL` inside `src/config.js`.
4. The webhook needs server code, because only the server can write to the
   `subscriptions` table (the app has no permission, and that is how it should
   be). It goes as a **Supabase Edge Function** — still to be written.

What the webhook does: listens to `checkout.session.completed`,
`customer.subscription.updated` and `.deleted`, and writes `status` and
`current_period_end` on the user's row. It is the only place in the system that
decides who subscribes.

**Before charging for real:** a privacy policy (you start storing third
parties' names — LGPD), and some way to issue invoices. An MEI solves it.

---

## Work status

| part | status |
|---|---|
| Database schema and access policies | done (`sql/schema.sql`) |
| Account and match client | done (`src/cloud.js`, pieces in `src/cloud/`) |
| Tests for the account and sync logic | done, 5 cases |
| Provision Supabase and paste the keys | **with you** |
| History leaving the device and going to the cloud | to do |
| Account screen and magic-link sign-in | done, tested with a real e-mail |
| RLS gate against the real Supabase | checked: writes, reads empty without a subscription, deletes |
| Subscription screen | to do |
| Upload queue for matches finished offline | to do |
| Stripe webhook Edge Function | to do |

What talks to the network was already exercised against the real Supabase,
with a hand-made authenticated session: writing a match returned `201`, reading
it back without a subscription returned `[]` (the gate closed, exactly as
designed), and deleting returned `204` even without subscribing — the right to
remove your own data cannot depend on payment.

---

## 4. Participants of a match (v1)

Run `sql/002-participants.sql` in the SQL Editor, after `schema.sql`.

The problem: a match has **one** device that recorded it and **several**
players. Whoever played on a friend's phone did not have that match.

The solution is **not** the host tagging `@someone` and that is it — that would
let someone else write into your history. The host **invites**; the match only
goes into someone's history when that person accepts. Whoever trusts the host
ticks "always accept" and never thinks about it again.

| piece | where |
|---|---|
| public `@`, searched by exact equality only | `profiles` + `buscar_handle()` |
| who sat in each seat | `match_players` |
| auto-accept from whoever you trust | `trusted_hosts` + trigger |
| who invited you, without handing over the match | `anfitriao_do_convite()` |

Two points worth knowing:

**The invite shows up without a subscription, on purpose.** A non-subscriber
needs to see that there are matches waiting, otherwise they never accept and
never knew they existed. Reading the *content* is what is paid — and "3 matches
waiting for you" is the best conversion argument the app has.

**Deleting does not rewrite someone else's past.** If the host deletes a table
that another person already accepted, the row loses its owner instead of dying.
For the host the effect is the same (it vanishes from their account); for the
invitee, the history stays standing. Without this, deleting would become a way
to edit other people's statistics.

---

## 5. Granting premium by hand (while there is no billing)

The statistics are already behind the paywall. Whoever has no active
subscription sees the lock screen instead of the history — and keeps playing and
recording normally, because only *reading* is paid.

To grant someone access, use the blocks in `sql/manual-access.sql` in the SQL
Editor. Each one is meant to be copied on its own, with the e-mail replaced.

**The person needs to have signed into the app at least once** before they can
be granted access — with no account created there is nobody to give access to,
and the command returns `INSERT 0 0`.

After granting, the app does not find out by itself: on their device, the lock
screen has **"Já tenho acesso, conferir"** ("I already have access, check"),
which rereads the subscription. Without that button the person would have to
close and reopen the app with no hint that this was what was missing.

### Why there is no admin button in the app

The gate is RLS. The `subscriptions` table has no `insert` or `update` policy,
on purpose: the app **cannot** write to it. Only the SQL Editor and, in the
future, the Stripe webhook.

And there is no `liberar_premium(email)` function in the database because
Supabase grants `execute` to `anon` and `authenticated` by default privilege.
That already bit this project once — `buscar_handle` was left open to people
with no account at all, and it only showed up when testing against the server.
A function that grants premium with the same oversight would let anyone signed
in grant it to themselves.
