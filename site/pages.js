/**
 * Which sections each page shows, top to bottom.
 *
 * Each name is a file in sections/ (and, by convention, a stylesheet in
 * styles/sections/ imported by styles/site.css). To reorder the page, reorder
 * the list; to hide a section, remove its name; to create one, add the file
 * and put its name here. Each HTML page says which list it uses in
 * <body data-page="...">.
 */

export const PAGES = {
  home: ['nav', 'hero', 'features', 'how', 'stats-teaser', 'install', 'faq', 'cta', 'footer'],
  download: ['nav', 'install', 'faq', 'footer'],
  account: ['nav', 'account', 'footer'],
  stats: ['nav', 'stats', 'footer'],
};
