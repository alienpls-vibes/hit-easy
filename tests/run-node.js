/** Roda os casos do motor no terminal: `npm test`. */

import { runAll } from './cases.js';

const results = runAll();
const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);

const dim = (s) => '\x1b[2m' + s + '\x1b[0m';
const green = (s) => '\x1b[32m' + s + '\x1b[0m';
const red = (s) => '\x1b[31m' + s + '\x1b[0m';

console.log();
for (const r of results) {
  const mark = r.skipped ? dim('–') : r.ok ? green('✓') : red('✕');
  console.log(' ' + mark + ' ' + r.name + (r.skipped ? dim(' (só no DOM simulado)') : ''));
  if (!r.ok) console.log('   ' + red(r.why));
}
console.log();
console.log(
  failed.length
    ? red(` ${failed.length} de ${results.length} falharam`)
    : green(` ${results.length - skipped.length} testes, todos passaram`)
      + dim(skipped.length ? `  (${skipped.length} pulado(s))` : '  (motor, estatísticas e painéis)'),
);
console.log();

process.exit(failed.length ? 1 : 0);
