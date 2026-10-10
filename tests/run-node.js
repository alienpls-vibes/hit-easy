/** Runs the engine cases in the terminal: `npm test`. */

import { runAll } from './cases.js';

const results = await runAll();
const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);

const dim = (s) => '\x1b[2m' + s + '\x1b[0m';
const green = (s) => '\x1b[32m' + s + '\x1b[0m';
const red = (s) => '\x1b[31m' + s + '\x1b[0m';

console.log();
for (const r of results) {
  const mark = r.skipped ? dim('–') : r.ok ? green('✓') : red('✕');
  console.log(' ' + mark + ' ' + r.name + (r.skipped ? dim(' (simulated DOM only)') : ''));
  if (!r.ok) console.log('   ' + red(r.why));
}
console.log();
// What failed, repeated at the end.
//
// The full list is long and the reason for each failure gets buried among
// dozens of green lines. In CI it is even worse: when only the end of the
// output can be read, a summary down here is the difference between knowing
// what broke and staring at "exit code 1".
if (failed.length) {
  console.log(red(' Failed:'));
  for (const r of failed) {
    console.log('   ' + red('✕') + ' ' + r.name);
    console.log('     ' + r.why);
  }
  console.log();
}

console.log(
  failed.length
    ? red(` ${failed.length} of ${results.length} failed`)
    : green(` ${results.length - skipped.length} tests, all passed`)
      + dim(skipped.length ? `  (${skipped.length} skipped)` : '  (engine, statistics and panels)'),
);
console.log();

process.exit(failed.length ? 1 : 0);
