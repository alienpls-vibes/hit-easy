/**
 * The settings pieces: groups of rows, in the style of the phone's own
 * settings.
 *
 * Each block used to have its own format - a card here, a loose button there,
 * a paragraph explaining underneath almost everything - and the subtitles
 * inside the account had the same weight as the section titles. The screen
 * did not say what was part of what. Now there is a single form: a short
 * title, and a card with rows separated by a hairline. Every row has the same
 * minimum touch size.
 *
 * Its own file because account, install and sync draw with the same pieces,
 * and importing them from settings.js would create a cycle.
 */

import { el, clear, icon, buzz } from '../../ui.js';

/**
 * A group: optional title and the card with the rows.
 * A `null` row is ignored, so whoever builds can write `cond ? row : null`.
 */
export function group(title, rows) {
  return el('section', { class: 'set-section' }, [
    title ? el('p', { class: 'sheet-legend', text: title }) : null,
    el('div', { class: 'set-group' }, rows.filter(Boolean)),
  ]);
}

/**
 * A row. With `onTap` it is a button; with `href` it is a link; with neither
 * it is just text.
 *
 * `value` is what goes on the right - the version, the language name,
 * "Change". The label, subtitle and value nodes hang on the row (`_label`,
 * `_sub`, `_value`) for whoever needs to change the text without rebuilding -
 * the update button swaps the label for the spinner while it waits.
 */
export function row({
  label, sub, value, onTap, href, arrow, danger, className, extra,
}) {
  const labelEl = el('span', { class: 'set-label', text: label });
  const subEl = el('span', { class: 'set-sub', text: sub || '' });
  subEl.hidden = !sub;
  const valueEl = value !== undefined && value !== null
    ? el('span', { class: 'set-value', text: value })
    : null;

  const children = [
    el('span', { class: 'set-text' }, [labelEl, subEl]),
    valueEl,
    extra || null,
    arrow ? el('span', { class: 'set-chevron' }, [icon('arrow')]) : null,
  ];

  const classes = 'set-row'
    + (onTap || href ? ' is-tap' : '')
    + (danger ? ' is-danger' : '')
    + (className ? ' ' + className : '');

  let node;
  if (href) {
    node = el('a', { class: classes, href, target: '_blank', rel: 'noopener' }, children);
  } else if (onTap) {
    node = el('button', { class: classes, onClick: onTap }, children);
  } else {
    node = el('div', { class: classes }, children);
  }
  node._label = labelEl;
  node._sub = subEl;
  node._value = valueEl;
  return node;
}

/** A row with a switch. The state lives in the button itself. */
export function toggleRow(label, sub, initial, onChange) {
  let on = initial !== false;
  const knob = el('span', { class: 'switch' + (on ? ' is-on' : '') });

  const node = row({
    label,
    sub,
    extra: knob,
    className: 'is-toggle',
    onTap: (e) => {
      on = !on;
      knob.classList.toggle('is-on', on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      onChange(on);
      buzz();
    },
  });
  node.setAttribute('aria-pressed', String(on));
  return node;
}

/**
 * A row with the native picker on the right.
 *
 * For four long text options (the languages), chips side by side do not fit
 * on a phone. The <select> solves the space and gives the picker the device
 * already uses everywhere.
 */
export function selectRow(label, value, options, onChange) {
  const field = el('select', { class: 'select-input set-select', 'aria-label': label },
    options.map(([v, text]) => el('option', { value: v, text })));
  field.value = value;
  field.addEventListener('change', () => onChange(field.value));

  return row({
    label,
    className: 'is-select',
    extra: el('span', { class: 'set-select-box' }, [
      field,
      el('span', { class: 'select-caret' }, [icon('arrow')]),
    ]),
  });
}

/** A row choosing among a few short options (the theme), as segments. */
export function segmentRow(label, options, current, onPick) {
  const box = el('span', { class: 'set-segments', role: 'group', 'aria-label': label });
  let chosen = current;

  const paint = () => {
    clear(box);
    options.forEach(([id, text]) => {
      box.append(el('button', {
        class: 'set-segment' + (chosen === id ? ' is-on' : ''),
        'aria-pressed': String(chosen === id),
        onClick: () => {
          chosen = id;
          paint();
          buzz();
          onPick(id);
        },
      }, [text]));
    });
  };
  paint();

  return row({ label, className: 'is-segments', extra: box });
}
