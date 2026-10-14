/**
 * Site settings: links and switches, no copy.
 *
 * The texts live in content.js; the order of the sections in pages.js. This
 * file is only for where things point to and what is turned on.
 */

export const SITE = {
  name: 'Hit Easy',
  tagline: 'commander made simple',

  /**
   * Where the app lives, relative to this folder. The site is published at
   * /hit-easy/site/ and the app at /hit-easy/, hence '../'. If the site moves
   * to its own domain, put the full app address here
   * ('https://alienpls-vibes.github.io/hit-easy/') - and the paths in
   * lib/app.js.
   */
  appUrl: '../',
  privacyUrl: '../privacidade.html',

  /** Logo shown in the header and footer. */
  logo: '../icons/icon-192.png',

  /** Public address of the site, used in the share button. Empty = current page. */
  publicUrl: 'https://alienpls-vibes.github.io/hit-easy/site/',

  /** Contact e-mail in the footer. Empty hides the line. */
  contactEmail: '',

  /**
   * Social links in the footer: [{ label: 'Instagram', href: 'https://...' }].
   * Empty hides the block.
   */
  social: [],

  /** Shows "Entrar com Google" when the provider is turned on in Supabase. */
  socialLogin: true,
};
