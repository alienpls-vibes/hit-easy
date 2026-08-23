/**
 * Passa `node --check` em todo modulo do projeto.
 *
 * Os casos em tests/ so exercitam engine, stats e seating - o resto depende de
 * DOM e nao roda no Node. Esta checagem alcanca o resto: nao prova que a
 * interface funciona, mas garante que ela ao menos PARSEIA, que e o erro mais
 * bobo e mais facil de deixar passar num projeto sem build.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'tests')),
  ...walk(join(ROOT, 'tools')),
  join(ROOT, 'sw.js'),
].sort();

const falhas = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    falhas.push({ file, why: String(err.stderr || err.message).trim() });
  }
}

if (falhas.length) {
  console.error('\n\x1b[31m Erro de sintaxe:\x1b[0m');
  for (const f of falhas) console.error('  ' + relative(ROOT, f.file) + '\n' + f.why + '\n');
  process.exit(1);
}

console.log(` \x1b[2m${files.length} módulos com sintaxe válida\x1b[0m`);
