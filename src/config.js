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

/** Stripe link to subscribe. Fill in after creating the product. */
export const CHECKOUT_URL = '';

/** Is a cloud configured? Without it the app stays in its usual local mode. */
export function cloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
