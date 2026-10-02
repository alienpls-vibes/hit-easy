/**
 * Passa `node --check` em todo modulo do projeto.
 *
 * Os casos em tests/ so exercitam engine, stats e seating - o resto depende de
 * DOM e nao roda no Node. Esta checagem alcanca o resto: nao prova que a
 * interface funciona, mas garante que ela ao menos PARSEIA, que e o erro mais
 * bobo e mais facil de deixar passar num projeto sem build.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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

/** O mesmo, para as folhas de estilo. */
function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css')) out.push(full);
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
  // Procura em todo src/ em vez de abrir um caminho fixo: a regra e "o formato
  // do @ vive em algum modulo do cliente", nao "vive neste arquivo". Mover a
  // constante de pasta e refatoracao legitima e nao pode derrubar o build.
  let noCliente = null;
  let ondeCliente = null;
  for (const file of walk(join(ROOT, 'src'))) {
    const achado = readFileSync(file, 'utf8').match(/HANDLE_RE\s*=\s*\/\^(.+?)\$\//);
    if (achado) {
      noCliente = achado;
      ondeCliente = relative(ROOT, file).split(sep).join('/');
      break;
    }
  }
  const sql = readFileSync(join(ROOT, 'sql/002-participantes.sql'), 'utf8');
  const noBanco = sql.match(/handle\s*~\s*'\^(.+?)\$'/);

  if (!noCliente) return 'HANDLE_RE sumiu de src/: nenhum modulo define o formato do @';
  if (!noBanco) return 'a constraint handle_formato sumiu do SQL';
  if (noCliente[1] !== noBanco[1]) {
    return 'o formato do @ diverge:\n'
      + '    cliente: ^' + noCliente[1] + '$   (' + ondeCliente + ')\n'
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
 * Codigo depois de um `return`, no mesmo bloco, nunca roda.
 *
 * Isto nasceu de um defeito real e caro: a divisao do table.js deixou um
 * `return` vazado dentro de `criarVitoria`, o `return` que instalava as
 * funcoes ficou inalcancavel, e `mesa.showVictory` e `mesa.pickWinner` nunca
 * foram pendurados no contexto. Na mesa, a partida nao encerrava sozinha com um
 * jogador vivo e o botao de declarar vencedor nao fazia nada.
 *
 * Nada acusou: `node --check` passa, porque codigo inalcancavel e sintaxe
 * valida; a checagem de imports passa; a de referencias passa, porque todas
 * existem. E a suite tinha 150 casos verdes.
 *
 * A heuristica e a indentacao, que neste projeto e consistente: achado um
 * `return` com N espacos, a proxima linha com EXATAMENTE N espacos tem de
 * fechar o bloco. Qualquer outra coisa ali e inalcancavel.
 */
/**
 * A linha sem o comentario de fim, e sem o que esta dentro de texto.
 *
 * `return null; // porque` nao terminava em ponto e virgula para o teste
 * abaixo, entao a busca pelo fim da instrucao seguia adiante e ia parar dentro
 * da funcao SEGUINTE - acusando codigo que roda. Guarda que mente e pior que
 * guarda nenhuma: ensina a ignorar o alarme.
 *
 * Pular o conteudo das aspas serve ao mesmo fim por outro caminho: uma chave
 * ou um `//` dentro de um texto nao sao codigo, e contavam como se fossem.
 */
function semComentario(linha) {
  let aspas = null;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (aspas) {
      if (c === '\\') i += 1;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { aspas = c; continue; }
    if (c === '/' && linha[i + 1] === '/') return linha.slice(0, i).trimEnd();
  }
  return linha;
}

function conferirInalcancavel() {
  const problemas = [];

  for (const file of walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tools')))) {
    const linhas = readFileSync(file, 'utf8').split('\n');

    for (let i = 0; i < linhas.length; i += 1) {
      const m = linhas[i].match(/^(\s+)return\b/);
      if (!m) continue;
      const recuo = m[1].length;

      // Um `return` pode abrir objeto ou lista e fechar linhas depois. Anda
      // ate o fim da propria instrucao antes de olhar o que vem a seguir.
      //
      // Contando PROFUNDIDADE, e nao "a primeira linha que termina em ponto e
      // virgula": num `return { destroy: () => { ...; } };` aquela regra para
      // dentro da arrow, e a checagem passa a olhar o lugar errado - foi assim
      // que a primeira versao disto nao disparou no defeito que a motivou.
      let j = i;
      let fundo = 0;
      for (; j < linhas.length; j += 1) {
        const codigo = semComentario(linhas[j]);
        for (const ch of codigo) {
          if (ch === '{' || ch === '(' || ch === '[') fundo += 1;
          else if (ch === '}' || ch === ')' || ch === ']') fundo -= 1;
        }
        if (fundo <= 0 && /;\s*$/.test(codigo)) break;
      }

      // A proxima linha que importa: ignora vazia e comentario.
      for (let k = j + 1; k < linhas.length; k += 1) {
        const linha = linhas[k];
        if (!linha.trim()) continue;
        if (/^\s*(\/\/|\/\*|\*)/.test(linha)) continue;

        const dela = linha.match(/^(\s*)/)[1].length;
        // Recuo menor: o bloco acabou, nada a dizer.
        if (dela < recuo) break;
        // Mesmo recuo e nao fecha o bloco: inalcancavel.
        if (dela === recuo && !/^\s*[}\)\]]/.test(linha)) {
          problemas.push(
            relative(ROOT, file).split(sep).join('/') + ':' + (k + 1)
            + ': codigo depois de `return` (linha ' + (i + 1) + ') nunca roda.'
            + '\n    ' + linha.trim().slice(0, 70),
          );
        }
        break;
      }
    }
  }

  return problemas;
}

const inalcancavel = conferirInalcancavel();
if (inalcancavel.length) {
  console.error('\n\x1b[31m Codigo inalcancavel:\x1b[0m');
  for (const x of inalcancavel) console.error('  ' + x);
  console.error('');
  process.exit(1);
}

/*
 * Todo modulo e toda folha de estilo precisam estar na lista do service worker.
 *
 * A lista em sw.js e explicita porque o worker tem de saber o que baixar ANTES
 * de faltar internet - nao da para descobrir import por import na hora. Sao
 * mais de oitenta arquivos, e nada na linguagem liga um ao outro: criar um
 * modulo novo e esquecer a linha no sw.js nao da erro, nao quebra teste e nao
 * aparece no navegador com rede. O app simplesmente para de abrir offline, e
 * isso se descobre na mesa, que e o unico lugar onde importa.
 *
 * Confere tambem o contrario - entrada na lista apontando para arquivo que nao
 * existe mais -, porque `cache.addAll()` rejeita TUDO se um unico pedido falhar:
 * um caminho morto na lista nao deixa nada ser cacheado.
 */
function conferirCache() {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const bloco = sw.match(/const ASSETS = \[([\s\S]*?)\n\];/);
  if (!bloco) return ['a lista ASSETS sumiu de sw.js'];

  const listados = new Set(
    [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  );

  const naDisco = walk(join(ROOT, 'src'))
    .concat(walkCss(join(ROOT, 'src')))
    .map((f) => './' + relative(ROOT, f).split(sep).join('/'));

  const problemas = [];
  for (const caminho of naDisco.sort()) {
    if (!listados.has(caminho)) {
      problemas.push(caminho + ' existe em src/ e NAO esta na lista ASSETS de '
        + 'sw.js: o app nao abriria offline.');
    }
  }
  for (const caminho of [...listados].sort()) {
    if (!caminho.startsWith('./src/')) continue;
    if (!existsSync(join(ROOT, caminho))) {
      problemas.push(caminho + ' esta na lista ASSETS de sw.js e nao existe '
        + 'mais: addAll() rejeita tudo se um pedido falhar.');
    }
  }
  return problemas;
}

/**
 * Todo icone referenciado existe no disco?
 *
 * Tres arquivos apontam para os icones - manifest.webmanifest, index.html e a
 * lista ASSETS de sw.js -, entao trocar a arte significa acertar os tres.
 * Errar um nao quebra teste nenhum, e cada um falha de um jeito diferente:
 *
 *   - manifest com caminho morto: so aparece na hora de instalar, no aparelho
 *     de outra pessoa, e o sistema cai para um icone generico sem avisar;
 *   - sw.js com caminho morto: `cache.addAll()` rejeita TUDO se um unico
 *     pedido falhar, entao o app inteiro deixa de funcionar offline;
 *   - index.html com caminho morto: a aba fica sem favicon.
 *
 * Confere tambem o contrario: PNG em icons/ que ninguem referencia. Arte
 * antiga esquecida ali continua sendo baixada por quem clonar o repositorio e
 * vira duvida sobre qual e a atual.
 */
function conferirIcones() {
  const problemas = [];
  const citados = new Set();

  const fontes = [
    ['manifest.webmanifest', /"src"\s*:\s*"\.\/(icons\/[^"]+)"/g],
    ['index.html', /href="\.\/(icons\/[^"]+)"/g],
    ['sw.js', /'\.\/(icons\/[^']+)'/g],
  ];

  for (const [arquivo, re] of fontes) {
    const texto = readFileSync(join(ROOT, arquivo), 'utf8');
    for (const m of texto.matchAll(re)) {
      citados.add(m[1]);
      if (!existsSync(join(ROOT, m[1]))) {
        problemas.push(arquivo + ' aponta para ' + m[1] + ', que nao existe.');
      }
    }
  }

  if (!citados.size) problemas.push('nenhum icone referenciado em lugar nenhum');

  for (const f of readdirSync(join(ROOT, 'icons'))) {
    if (!f.endsWith('.png')) continue;
    if (!citados.has('icons/' + f)) {
      problemas.push('icons/' + f + ' nao e referenciado por ninguem: '
        + 'arte antiga esquecida vira duvida sobre qual e a atual.');
    }
  }

  return problemas;
}

const iconesRuins = conferirIcones();
if (iconesRuins.length) {
  console.error('\n\x1b[31m Icones:\x1b[0m');
  for (const x of iconesRuins) console.error('  ' + x);
  console.error('');
  process.exit(1);
}

const cacheRuim = conferirCache();
if (cacheRuim.length) {
  console.error('\n\x1b[31m Cache do service worker:\x1b[0m');
  for (const x of cacheRuim) console.error('  ' + x);
  console.error('');
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

/*
 * A politica de privacidade tem campos que so o responsavel pode preencher:
 * nome do controlador, e-mail de contato, regiao dos servidores.
 *
 * Isto AVISA e nao derruba o build, de proposito. Derrubar impediria de
 * publicar no canal de teste, que e justamente onde o texto deve ser revisado
 * antes de ir para producao. Mas publicar uma politica com lacuna e pior que
 * nao ter politica, entao o aviso e barulhento.
 */
function conferirPrivacidade() {
  const html = readFileSync(join(ROOT, 'privacidade.html'), 'utf8');
  const lacunas = html.match(/class="falta"/g);
  return lacunas ? lacunas.length : 0;
}

const lacunas = conferirPrivacidade();
if (lacunas) {
  console.error('\n\x1b[33m Politica de privacidade:\x1b[0m '
    + lacunas + ' campo(s) por preencher (nome do controlador, contato, regiao).'
    + '\n  Nao publique em producao assim.\n');
}

/*
 * A versao atual precisa ter notas de versao.
 *
 * Notas escritas "depois" nao sao escritas: a memoria do que mudou dura horas,
 * nao dias, e quem le a nota nao tem como saber que ela esta incompleta. Ligar
 * isto ao build e o unico jeito de a nota acompanhar a publicacao em vez de
 * depender de disciplina.
 *
 * Derruba o build de proposito, ao contrario do aviso da politica de
 * privacidade: aquele campo precisa de decisao humana e travaria o canal de
 * teste, este e so escrever o que acabou de ser feito.
 */
function conferirNovidades() {
  const versao = readFileSync(join(ROOT, 'src/version.js'), 'utf8')
    .match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (!versao) return null; // o conferidor de versao ja reclama disto

  const notas = readFileSync(join(ROOT, 'src/novidades.js'), 'utf8');
  const temEntrada = new RegExp("versao:\\s*'" + versao[1].replace(/\./g, '\\.') + "'")
    .test(notas);

  if (!temEntrada) {
    return 'a versao ' + versao[1] + ' nao tem entrada em src/novidades.js. '
      + 'Escreva o que mudou antes de publicar.';
  }
  return null;
}

const notasRuins = conferirNovidades();
if (notasRuins) {
  console.error('\n\x1b[31m Notas de versao:\x1b[0m\n  ' + notasRuins + '\n');
  process.exit(1);
}

console.log(` \x1b[2m${files.length} módulos com sintaxe válida\x1b[0m`);
