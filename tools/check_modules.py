"""
Verificacao estatica dos modulos ES, sem Node instalado.

Nao substitui rodar o app, mas pega a classe de erro mais provavel num projeto
de modulos nativos: caminho de import que nao existe, nome importado que o
outro arquivo nao exporta, export declarado e nunca usado, e delimitador
desbalanceado.

Uso:  python tools/check_modules.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

IMPORT_RE = re.compile(
    r"import\s+(?:\{(?P<named>[^}]*)\}|(?P<ns>\*\s+as\s+\w+))\s+from\s+['\"](?P<path>[^'\"]+)['\"]",
    re.S,
)
EXPORT_RE = re.compile(
    r"^export\s+(?:async\s+)?(?:function|const|let|class)\s+(?P<name>\w+)", re.M
)

# `export { a, b as c } from './x.js'` - o barril de uma pasta.
#
# Sem isto, um index.js que so reexporta nao tem export NENHUM aos olhos deste
# script, e todo importador dele viraria erro "nao exporta esse nome". O barril
# e o que deixa a pasta ter uma porta de entrada so, entao a ferramenta precisa
# enxerga-lo.
REEXPORT_RE = re.compile(
    r"export\s+\{(?P<named>[^}]*)\}\s+from\s+['\"](?P<path>[^'\"]+)['\"]", re.S
)
# `export * from './x.js'`: a porta fica aberta para tudo que o outro exporta.
EXPORT_STAR_RE = re.compile(r"export\s+\*\s+from\s+['\"](?P<path>[^'\"]+)['\"]")
# `export { a, b }` sem `from`: reexporta o que foi importado acima.
EXPORT_LIST_RE = re.compile(r"^export\s+\{(?P<named>[^}]*)\}\s*;?\s*$", re.M)


def nomes(lista):
    """Separa 'a, b as c' em pares (original, nome_exportado)."""
    for parte in lista.split(","):
        parte = parte.strip()
        if not parte:
            continue
        if " as " in parte:
            origem, alias = parte.split(" as ", 1)
            yield origem.strip(), alias.strip()
        else:
            yield parte, parte


# @import do CSS: e por ele que a folha de entrada diz a ordem da cascata.
IMPORT_CSS_RE = re.compile(r"@import\s+(?:url\()?['\"](?P<path>[^'\"]+)['\"]\)?\s*;")


def mostrar(caminho):
    """
    Caminho relativo a raiz, e nao so o nome do arquivo.

    Com uma pasta por tela, `index.js` aparece meia duzia de vezes e o nome
    solto deixa de identificar qualquer coisa.
    """
    try:
        return Path(caminho).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return Path(caminho).name


def scan(text):
    """
    Varre o arquivo uma vez separando codigo de comentario e de string.

    Precisa ser um scanner com estado, e nao regex solta: ' // ' (em deckNameOf)
    e 'http://www.w3.org/2000/svg' (em icon) sao STRINGS, nao comentarios, e um
    stripper ingenuo cortaria a linha no meio, desbalanceando o arquivo.

    Devolve (com_strings, sem_strings): o primeiro so sem comentarios, para ler
    os imports; o segundo tambem sem literais, para contar delimitadores.
    """
    with_str, no_str = [], []
    i, n = 0, len(text)
    quote = None

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if quote:
            with_str.append(ch)
            no_str.append("\n" if ch == "\n" else " ")
            if ch == "\\":
                if i + 1 < n:
                    with_str.append(nxt)
                    no_str.append("\n" if nxt == "\n" else " ")
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue

        if ch == "/" and nxt == "*":
            i += 2
            while i < n and not (text[i] == "*" and i + 1 < n and text[i + 1] == "/"):
                if text[i] == "\n":
                    with_str.append("\n")
                    no_str.append("\n")
                i += 1
            i += 2
            continue

        if ch in "'\"`":
            quote = ch
            with_str.append(ch)
            no_str.append(" ")
            i += 1
            continue

        with_str.append(ch)
        no_str.append(ch)
        i += 1

    return "".join(with_str), "".join(no_str)


def balance(text, path, problems):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    line = 1
    for ch in text:
        if ch == "\n":
            line += 1
        elif ch in "([{":
            stack.append((ch, line))
        elif ch in ")]}":
            if not stack or stack[-1][0] != pairs[ch]:
                problems.append(f"{mostrar(path)}:{line}: '{ch}' sem par correspondente")
                return
            stack.pop()
    for ch, ln in stack:
        problems.append(f"{mostrar(path)}:{ln}: '{ch}' aberto e nunca fechado")


def folhas(problems):
    """
    As folhas de estilo na ordem em que o navegador as aplica.

    Segue os @import de src/styles.css em vez de guardar uma lista fixa: a
    ordem do arquivo E a regra de desempate da cascata, entao ler a ordem real
    e a unica forma de o aviso de colisao dizer a verdade sobre quem vence.

    Um @import apontando para arquivo que nao existe e ERRO, e nao aviso: o
    navegador ignora em silencio e a area inteira daquela folha fica sem
    estilo nenhum, sem nada acusar no console.
    """
    entrada = SRC / "styles.css"
    if not entrada.exists():
        problems.append("src/styles.css: a folha de entrada nao existe")
        return []

    texto = entrada.read_text(encoding="utf-8")
    sem_comentario = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)

    encontradas = []
    for m in IMPORT_CSS_RE.finditer(sem_comentario):
        caminho = (entrada.parent / m.group("path")).resolve()
        if not caminho.exists():
            problems.append(
                f"src/styles.css: @import de '{m.group('path')}' nao existe"
            )
            continue
        encontradas.append((caminho, caminho.read_text(encoding="utf-8")))

    # O que sobra na entrada depois dos @import entra por ULTIMO na cascata,
    # que e exatamente onde o navegador o aplica.
    resto = IMPORT_CSS_RE.sub("", texto)
    if "{" in re.sub(r"/\*.*?\*/", "", resto, flags=re.S):
        encontradas.append((entrada, resto))

    # Nenhum @import: a folha unica e ela mesma.
    if not encontradas:
        encontradas.append((entrada, texto))

    return encontradas


def check_css(folhas_css, problems):
    """
    Balanceamento de chaves e comentarios do CSS, folha por folha.

    Existe porque a folha vem crescendo por script: uma chave a mais engole a
    regra seguinte, e um /* sem fechar apaga o resto do arquivo - as duas
    coisas em silencio, sem erro nenhum no navegador.

    Confere cada arquivo separado, e nao a concatenacao: um bloco sem fechar
    numa folha se cancelaria contra um '}' a mais em outra, e as duas passariam
    com o numero de linha apontando para o arquivo errado.
    """
    regras = 0
    for caminho, texto in folhas_css:
        nome = mostrar(caminho)
        limpo = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
        if "/*" in limpo:
            linha = texto[: texto.rindex("/*")].count("\n") + 1
            problems.append(f"{nome}:{linha}: comentario /* sem fechar")
            continue

        nivel = 0
        linha = 1
        ruim = False
        for ch in limpo:
            if ch == "\n":
                linha += 1
            elif ch == "{":
                nivel += 1
            elif ch == "}":
                nivel -= 1
                if nivel < 0:
                    problems.append(f"{nome}:{linha}: '}}' a mais")
                    ruim = True
                    break
        if ruim:
            continue
        if nivel:
            problems.append(f"{nome}: {nivel} bloco(s) sem fechar")
            continue
        regras += limpo.count("{")
    return regras


def regras_por_classe(css):
    """
    Propriedades que cada classe define em regra de UMA classe so, no nivel de
    topo (fora de media query). So esse recorte importa aqui: e onde duas
    classes com a mesma especificidade brigam e a ordem do arquivo decide.
    """
    limpo = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    props = {}
    ordem = {}
    nivel = 0
    i = 0
    n = len(limpo)
    inicio_seletor = 0

    while i < n:
        ch = limpo[i]
        if ch == "{":
            if nivel == 0:
                seletor = limpo[inicio_seletor:i].strip()
                fim = limpo.find("}", i)
                corpo = limpo[i + 1:fim] if fim > 0 else ""
                m = re.fullmatch(r"\.([\w-]+)", seletor)
                if m and "@" not in seletor:
                    nome = m.group(1)
                    props.setdefault(nome, set())
                    ordem.setdefault(nome, i)
                    for decl in corpo.split(";"):
                        if ":" in decl:
                            props[nome].add(decl.split(":", 1)[0].strip())
            nivel += 1
        elif ch == "}":
            nivel -= 1
            if nivel == 0:
                inicio_seletor = i + 1
        i += 1
    return props, ordem


def classes_combinadas(arquivos):
    """Conjuntos de classes que aparecem juntas no mesmo elemento, vindas do JS."""
    combos = set()
    for f in arquivos:
        texto = f.read_text(encoding="utf-8")
        for m in re.finditer(r"class:\s*'([a-z][\w-]*(?:\s+[a-z][\w-]+)+)'", texto):
            combos.add(tuple(sorted(m.group(1).split())))
    return combos


def check_cascata(folhas_css, problems):
    """
    Duas classes no mesmo elemento definindo a MESMA propriedade e um empate
    resolvido pela ordem do arquivo - fragil e invisivel.

    Foi assim que a home quebrou: `class: 'seat-spot layout-mini'`, as duas
    definindo `width`, e a que estava 950 linhas abaixo venceu. Nada acusava.

    Nem todo aviso e defeito: modificador definido DEPOIS da base e o padrao
    certo (.chips-fill sobre .chips, .vote-number sobre .search-input). O que
    denuncia problema e a BASE generica vencendo a classe especifica - foi
    exatamente o caso do .layout-mini sobre o .seat-spot.
    """
    if not folhas_css:
        return
    # Concatena na ordem de carga: o desempate que se quer medir e justamente
    # a posicao final, e uma classe pode perder para outra de OUTRO arquivo.
    props, ordem = regras_por_classe("\n".join(t for _, t in folhas_css))
    combos = classes_combinadas(sorted(SRC.rglob("*.js")))

    for combo in sorted(combos):
        presentes = [c for c in combo if c in props]
        for i, a in enumerate(presentes):
            for b in presentes[i + 1:]:
                comuns = props[a] & props[b]
                # `class` e `style` inline nao entram; so propriedades de layout.
                comuns.discard("")
                if not comuns:
                    continue
                vencedora = a if ordem[a] > ordem[b] else b
                print(
                    "  aviso  css: .%s e .%s juntas definem %s - vence .%s por ordem"
                    % (a, b, ", ".join(sorted(comuns)), vencedora)
                )


def achar_ciclos(grafo):
    """
    Ciclos no grafo de import.

    Modulo ES aguenta ciclo em alguns casos - declaracao de funcao e elevada,
    entao A e B podem se chamar. Mas se um dos dois LE um valor do outro
    enquanto ainda esta sendo avaliado, o resultado e `undefined` ou
    ReferenceError de TDZ, dependendo de ser `var` ou `const`. E depende da
    ORDEM em que o navegador avaliou, o que muda com quem importou primeiro.

    Com pastas em camadas e um barril por subsistema isso passa a importar:
    uma peca que importe a propria porta da pasta fecha um ciclo sem que nada
    no arquivo pareca errado. Por isso aqui e aviso barulhento - nem todo ciclo
    quebra, mas todo ciclo e um lugar onde a ordem de avaliacao passou a
    importar, e ninguem quer descobrir isso pela tela preta.
    """
    ciclos = []
    estado = {}   # 0 = nao visitado, 1 = na pilha, 2 = fechado
    pilha = []

    def visitar(no):
        estado[no] = 1
        pilha.append(no)
        for vizinho in sorted(grafo.get(no, ())):
            if estado.get(vizinho, 0) == 0:
                visitar(vizinho)
            elif estado.get(vizinho) == 1:
                # Fechou: recorta o trecho da pilha que forma o ciclo.
                corte = pilha[pilha.index(vizinho):]
                ciclos.append(corte + [vizinho])
        pilha.pop()
        estado[no] = 2

    for no in sorted(grafo):
        if estado.get(no, 0) == 0:
            visitar(no)
    return ciclos


def main():
    files = sorted(SRC.rglob("*.js"))
    if not files:
        print("nenhum modulo encontrado em src/")
        return 1

    code = {}      # sem comentarios, com strings: para ler imports/exports
    skeleton = {}  # sem comentarios e sem strings: para contar delimitadores
    exports = {}
    reexports = {}  # arquivo -> [(destino, original, nome_exportado)]
    estrelas = {}   # arquivo -> [destino] de `export * from`

    problems = []

    for f in files:
        with_str, no_str = scan(f.read_text(encoding="utf-8"))
        code[f] = with_str
        skeleton[f] = no_str
        alvo = f.resolve()
        exports[alvo] = set(EXPORT_RE.findall(with_str))

        reexports[alvo] = []
        for m in REEXPORT_RE.finditer(with_str):
            destino = (f.parent / m.group("path")).resolve()
            for origem, nome in nomes(m.group("named")):
                exports[alvo].add(nome)
                reexports[alvo].append((destino, origem, nome))

        # `export { a, b }` sem `from` reexporta o que foi importado acima; o
        # nome ja esta no corpo, entao basta contar como export deste arquivo.
        for m in EXPORT_LIST_RE.finditer(with_str):
            for _, nome in nomes(m.group("named")):
                exports[alvo].add(nome)

        estrelas[alvo] = [
            (f.parent / m.group("path")).resolve()
            for m in EXPORT_STAR_RE.finditer(with_str)
        ]

    # `export *` e transitivo: um barril pode reexportar outro barril. Roda ate
    # nada mudar, em vez de um nivel so, senao a cadeia quebra no segundo salto.
    mudou = True
    while mudou:
        mudou = False
        for alvo, destinos in estrelas.items():
            for destino in destinos:
                if destino not in exports:
                    continue
                novos = exports[destino] - exports[alvo]
                if novos:
                    exports[alvo] |= novos
                    mudou = True

    used = {f.resolve(): set() for f in files}

    # Reexportar E usar: sem isto todo modulo atras de um barril apareceria
    # como "export sem uso", e o aviso perderia o sentido justo onde importa.
    for alvo, lista in reexports.items():
        for destino, origem, _ in lista:
            if destino in used:
                used[destino].add(origem)
                if origem not in exports.get(destino, set()):
                    problems.append(
                        f"{mostrar(alvo)}: reexporta '{origem}' de "
                        f"{mostrar(destino)}, que nao exporta esse nome"
                    )
    for alvo, destinos in estrelas.items():
        for destino in destinos:
            if destino in used:
                used[destino] |= exports.get(destino, set())

    grafo = {}
    for f in files:
        clean = code[f]
        balance(skeleton[f], f, problems)
        grafo.setdefault(mostrar(f), set())

        for m in IMPORT_RE.finditer(clean):
            rel = m.group("path")
            if not rel.startswith("."):
                continue
            target = (f.parent / rel).resolve()
            if not target.exists():
                problems.append(f"{mostrar(f)}: import de '{rel}' nao existe")
                continue
            grafo[mostrar(f)].add(mostrar(target))
            if m.group("ns"):
                used[target] |= exports[target]  # 'import * as x' usa tudo
                continue
            for name in m.group("named").split(","):
                name = name.strip().split(" as ")[0].strip()
                if not name:
                    continue
                if name not in exports[target]:
                    problems.append(
                        f"{mostrar(f)}: importa '{name}' de {mostrar(target)}, "
                        f"que nao exporta esse nome"
                    )
                else:
                    used[target].add(name)

    # Reexport tambem e aresta: o barril depende das pecas.
    for alvo, lista in reexports.items():
        origem = mostrar(alvo)
        grafo.setdefault(origem, set())
        for destino, _, _ in lista:
            grafo[origem].add(mostrar(destino))
    for alvo, destinos in estrelas.items():
        origem = mostrar(alvo)
        grafo.setdefault(origem, set())
        for destino in destinos:
            grafo[origem].add(mostrar(destino))

    ciclos = achar_ciclos(grafo)

    folhas_css = folhas(problems)
    regras = check_css(folhas_css, problems)
    check_cascata(folhas_css, problems)
    print(
        f"{len(files)} modulos e {regras} regras em "
        f"{len(folhas_css)} folha(s) de CSS verificados\n"
    )

    for f in files:
        unused = exports[f.resolve()] - used[f.resolve()]
        if unused:
            print(f"  aviso  {mostrar(f)}: export sem uso -> {', '.join(sorted(unused))}")

    # Import declarado mas nunca referenciado no corpo do arquivo.
    for f in files:
        clean = code[f]
        body = IMPORT_RE.sub("", clean)
        for m in IMPORT_RE.finditer(clean):
            if not m.group("named"):
                continue
            for name in m.group("named").split(","):
                name = name.strip().split(" as ")[-1].strip()
                if name and not re.search(rf"\b{re.escape(name)}\b", body):
                    print(f"  aviso  {mostrar(f)}: importa '{name}' e nao usa")

    for ciclo in ciclos:
        print("  aviso  ciclo de import: " + " -> ".join(ciclo))

    print()
    if problems:
        print(f"{len(problems)} PROBLEMA(S):")
        for p in problems:
            print("  ERRO   " + p)
        return 1

    print("OK: imports, exports e delimitadores consistentes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
