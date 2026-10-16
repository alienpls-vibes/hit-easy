/**
 * The phone's back gesture while the challenge is open.
 *
 * Back with the challenge's settings panel open must close the PANEL only.
 * app.js already does that for every panel - its popstate listener closes the
 * sheet and pushes a fresh history entry - but it closes the sheet before
 * anyone else hears the event, so a listener added by the challenge screen
 * would find no sheet and close the whole challenge too.
 *
 * This listener is registered while the app boots (entry.js imports this
 * file, and app.js imports entry.js before its own code runs), so it hears
 * popstate FIRST and can pass along whether a panel was open at that moment.
 */

import { isSheetOpen } from '../ui.js';

let handler = null;

/** Who receives the back gesture: the open challenge screen. Returns the undo. */
export function onBack(fn) {
  handler = fn;
  return () => { if (handler === fn) handler = null; };
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('popstate', () => {
    if (handler) handler({ panelWasOpen: isSheetOpen() });
  });
}
