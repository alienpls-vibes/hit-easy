/**
 * Passa `node --check` em todo modulo do projeto.
 *
 * Os casos em tests/ so exercitam engine, stats e seating - o resto depende de
 * DOM e nao roda no Node. Esta checagem alcanca o resto: nao prova que a
 * interface funciona, mas garante que ela ao menos PARSEIA, que e o erro mais
 * bobo e mais facil de deixar passar num projeto sem build.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
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

/*
 * O formato do @ vive em dois lugares que nao se enxergam: o regex do cliente
 * (src/cloud.js) e a constraint do Postgres (sql/002-participantes.sql). Nada na
 * linguagem obriga os dois a concordarem, e quando divergem o sintoma e pessimo:
 * o app aceita o que a pessoa digitou, manda para o banco, e o banco devolve um
 * 400 sem explicacao. Aqui os dois textos sao comparados de verdade.
 */
function conferirHandle() {
  const cliente = readFileSync(join(ROOT, 'src/cloud.js'), 'utf8');
  const sql = readFileSync(join(ROOT, 'sql/002-participantes.sql'), 'utf8');

  const noCliente = cliente.match(/HANDLE_RE\s*=\s*\/\^(.+?)\$\//);
  const noBanco = sql.match(/handle\s*~\s*'\^(.+?)\$'/);

  if (!noCliente) return 'HANDLE_RE sumiu de src/cloud.js';
  if (!noBanco) return 'a constraint handle_formato sumiu do SQL';
  if (noCliente[1] !== noBanco[1]) {
    return 'o formato do @ diverge:\n'
      + '    cliente: ^' + noCliente[1] + '$   (src/cloud.js)\n'
      + '    banco:   ^' + noBanco[1] + '$   (sql/002-participantes.sql)\n'
      + '    Divergir aqui faz o app aceitar um @ que o banco recusa com 400.';
  }
  return null;
}

const handleRuim = conferirHandle();
if (handleRuim) {
  console.error('\n\x1b[31m Formato do @:\x1b[0m\n  ' + handleRuim + '\n');
  process.exit(1);
}

/*
 * Uma policy de RLS nao pode consultar OUTRA tabela protegida diretamente.
 *
 * Quando a policy de A consulta B e a de B consulta A, o Postgres avalia uma
 * dentro da outra sem fim e derruba as duas com 42P17, "infinite recursion
 * detected in policy". O sintoma e brutal: some ate a leitura que ja
 * funcionava antes, porque o erro e da AVALIACAO da policy, nao da consulta.
 *
 * Aconteceu aqui entre matches e match_players. A saida e uma funcao
 * `security definer`, que roda como dona da tabela e por isso nao dispara RLS
 * de novo. Como nada na linguagem obriga isso, a regra fica escrita aqui.
 */
function conferirPolicies() {
  const arquivos = readdirSync(join(ROOT, 'sql'))
    .filter((n) => n.endsWith('.sql'))
    .map((n) => join(ROOT, 'sql', n));

  const problemas = [];
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, 'utf8');
    // Cada "create policy" ate o ponto-e-virgula que fecha o comando.
    const partes = texto.split(/create policy/i).slice(1);
    for (const bruto of partes) {
      const corpo = bruto.split(/;\s*(?:\n|$)/)[0];
      const alvo = corpo.match(/\bon\s+public\.(\w+)/i);
      if (!alvo) continue;
      const tabela = alvo[1];

      // Tudo depois do "on public.X for ..." e a condicao da policy.
      const condicao = corpo.slice(alvo.index + alvo[0].length);
      const refs = [...condicao.matchAll(/\b(?:from|join)\s+public\.(\w+)/gi)]
        .map((m) => m[1])
        .filter((t) => t !== tabela);

      for (const outra of new Set(refs)) {
        problemas.push(
          relative(ROOT, arquivo) + ': policy em public.' + tabela
          + ' consulta public.' + outra + ' direto.\n'
          + '    Se public.' + outra + ' tiver policy citando public.' + tabela
          + ', o Postgres derruba as duas com 42P17.\n'
          + '    Passe por uma funcao `security definer`.',
        );
      }
    }
  }
  return problemas;
}

const policiesRuins = conferirPolicies();
if (policiesRuins.length) {
  console.error('\n\x1b[31m Recursao possivel em RLS:\x1b[0m');
  for (const x of policiesRuins) console.error('  ' + x + '\n');
  process.exit(1);
}

/*
 * O convite de instalacao tem de ser capturado ANTES dos modulos.
 *
 * O Chrome dispara `beforeinstallprompt` assim que decide que a pagina e
 * instalavel, e isso pode acontecer antes de src/install.js ser avaliado.
 * Quando acontecia, o evento se perdia e o botao de instalar aparecia so as
 * vezes - o mesmo app, a mesma pagina, resultado diferente a cada abertura.
 *
 * A ordem no HTML e o conserto inteiro, e nada no codigo a defende: um dia
 * alguem move o bloco "solto" para junto do resto e o defeito volta, sem que
 * teste nenhum reclame.
 */
function conferirInstall() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const captura = html.indexOf('beforeinstallprompt');
  const modulo = html.indexOf('type="module"');
  const install = readFileSync(join(ROOT, 'src/install.js'), 'utf8');

  if (captura === -1) {
    return 'index.html nao captura beforeinstallprompt: o botao de instalar fica intermitente';
  }
  if (modulo === -1) return 'index.html nao carrega o modulo do app';
  if (captura > modulo) {
    return 'a captura de beforeinstallprompt vem DEPOIS do modulo em index.html. '
      + 'Nessa ordem o evento se perde quando o Chrome o dispara cedo.';
  }
  if (!install.includes('__hitEasyInstall')) {
    return 'src/install.js nao le a gaveta window.__hitEasyInstall que index.html preenche';
  }
  return null;
}

const installRuim = conferirInstall();
if (installRuim) {
  console.error('\n\x1b[31m Convite de instalacao:\x1b[0m\n  ' + installRuim + '\n');
  process.exit(1);
}

/*
 * A versao vive em dois lugares que nao se enxergam: src/version.js e sw.js.
 *
 * Worker nao importa modulo, entao a string e repetida na mao. Divergirem tem
 * consequencia real: o nome do cache sai da versao do WORKER, e a tela mostra a
 * do modulo. Alguem relataria "estou na 1.2.0" enquanto roda o cache da 1.1.0,
 * e a investigacao comecaria pelo lugar errado.
 */
function conferirVersao() {
  const mod = readFileSync(join(ROOT, 'src/version.js'), 'utf8');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

  const noModulo = mod.match(/APP_VERSION\s*=\s*'([^']+)'/);
  const noWorker = sw.match(/const VERSION\s*=\s*'([^']+)'/);

  if (!noModulo) return 'APP_VERSION sumiu de src/version.js';
  if (!noWorker) return 'VERSION sumiu de sw.js';
  if (noModulo[1] !== noWorker[1]) {
    return 'a versao diverge: src/version.js diz ' + noModulo[1]
      + ' e sw.js diz ' + noWorker[1]
      + '. O cache sai do worker e a tela sai do modulo.';
  }
  return null;
}

const versaoRuim = conferirVersao();
if (versaoRuim) {
  console.error('\n\x1b[31m Versao do app:\x1b[0m\n  ' + versaoRuim + '\n');
  process.exit(1);
}

console.log(` \x1b[2m${files.length} módulos com sintaxe válida\x1b[0m`);
