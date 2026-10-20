/**
 * Connection to the cloud.
 *
 * While these are empty, the app runs exactly as it always did: everything
 * local, no account, no paywall. Filling them in turns cloud mode on.
 *
 * The key below is PUBLIC on purpose - `sb_publishable_` is meant to live in
 * the browser, and Supabase exposes it precisely for that. What protects the
 * data is the database RLS (see sql/schema.sql), not keeping this secret. The
 * secret key (`sb_secret_`) never goes into this file or anywhere in the
 * client.
 */

export const SUPABASE_URL = 'https://yhfaljorodjnofvkhtul.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_GCoTZWFswigZtaaX3yTVtA_aRMdvrxq';

/**
 * Public half of the VAPID key pair the daily notice is pushed with
 * (supabase/functions/daily-push). Public on purpose, like the key above:
 * the browser needs it to subscribe. The private half lives only in the
 * function's secrets. Empty turns the server notice off, and the challenge
 * falls back to Periodic Background Sync.
 */
export const VAPID_PUBLIC_KEY = 'BJhCUvymZ5OL8_JDYMU1C185Lnf2bBOpGVRcKZ9qrsNhkGMOjwZiDz1GeyWZVXg1BxTT48ITGKgfatRpRkBmo3o';

/** Stripe link to subscribe. Fill in after creating the product. */
export const CHECKOUT_URL = '';

/** Is a cloud configured? Without it the app stays in its usual local mode. */
export function cloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
