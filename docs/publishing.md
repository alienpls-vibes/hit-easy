# Two channels: test and production

```
main  →  https://alienpls-vibes.github.io/hit-easy/        production — the table uses it
beta  →  https://alienpls-vibes.github.io/hit-easy/beta/   test — you approve
```

How it works day to day:

1. I work on the `beta` branch and open a Pull Request into `main`.
2. In ~1 min the live `/beta/` already has the change. You test it on a real phone.
3. Approved? **Merge** the PR — one button, works from the phone. Production ships by itself.
4. Not approved? Comment, I fix it, `/beta/` updates. Production never knew.

A failing test does not publish. Since production is already live, a blocked
deploy never takes the table down: at worst it keeps the previous version.

## Turning it on (only once)

There are **two** settings, and the second one is not obvious:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   While it is on *Deploy from a branch*, the workflow runs the tests and fails
   on the last step.

2. **Settings → Environments → `github-pages` → Deployment branches and tags:
   add `beta`.**
   The environment is born allowing only the default branch. Without this the
   `beta` deploy is refused with *"Branch beta is not allowed to deploy to
   github-pages due to environment protection rules"* — the tests pass, the site
   does not ship, and the test channel would only go out riding along a push to
   `main`, which is precisely what it exists to avoid.

## Why the channels are separated in the browser

Both live on the same origin — only the path changes. But `localStorage` and
Cache Storage are **per origin, not per path**. Without separating them by hand,
beta would write to the same `mtglc.db.v1` as the real app, and a defective
version would take down the history of whoever trusted it.

`src/channel.js` solves this: every storage key goes through `storageKey()`
before touching the disk, and beta gets the `.beta` suffix. **Production keeps
the exact same key as always** — any suffix there would wipe everyone's history.
There is a test pinning this.

The service worker had the same problem, worse: on `activate` it deleted every
cache that was not its own. With two channels, whoever activated last took down
the other's offline mode. Now each channel only deletes what is its own.

Practical consequence: **beta starts empty.** It does not see your matches nor
your session. That is on purpose — for testing sign-in and first use it is what
you want, and it is what keeps a test bug from reaching your real history.

## What the two channels still share

The same Supabase project. A match recorded in test becomes a real row in the
database (since `sql/005-channel.sql` it is tagged `canal = 'beta'`, so the app
never mixes it with production). It can be deleted (the DELETE policy never
requires a subscription), so the damage is reversible — but **before charging
for real**, beta deserves its own Supabase project, so that no test ever touches
a paying customer's data.

The Redirect URLs list already covers beta: `.../hit-easy/**` matches `/beta/`.
