/**
 * Numero e data como cada idioma escreve.
 *
 * Segue o locale do idioma escolhido em Configuracoes, e nao o do sistema: quem
 * poe o app em ingles espera data em ingles.
 */

import { locale } from '../i18n.js';

export function formatDuration(ms) {
  if (!ms || ms < 0) return '--';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm';
  if (m) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(locale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function pct(v) {
  return Math.round((v || 0) * 100) + '%';
}

export function num(v, digits = 1) {
  if (!isFinite(v)) return '--';
  const rounded = Number(v).toFixed(digits);
  return rounded.replace(/\.0$/, '').replace('.', ',');
}
