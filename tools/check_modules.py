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
                problems.append(f"{path.name}:{line}: '{ch}' sem par correspondente")
                return
            stack.pop()
    for ch, ln in stack:
        problems.append(f"{path.name}:{ln}: '{ch}' aberto e nunca fechado")


def check_css(problems):
    """
    Balanceamento de chaves e comentarios do CSS.

    Existe porque a folha vem crescendo por script: uma chave a mais engole a
    regra seguinte, e um /* sem fechar apaga o resto do arquivo - as duas
    coisas em silencio, sem erro nenhum no navegador.
    """
    caminho = SRC / "styles.css"
    if not caminho.exists():
        return 0

    texto = caminho.read_text(encoding="utf-8")
    limpo = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    if "/*" in limpo:
        linha = texto[: texto.rindex("/*")].count("\n") + 1
        problems.append(f"styles.css:{linha}: comentario /* sem fechar")
        return 0

    nivel = 0
    linha = 1
    for ch in limpo:
        if ch == "\n":
            linha += 1
        elif ch == "{":
            nivel += 1
        elif ch == "}":
            nivel -= 1
            if nivel < 0:
                problems.append(f"styles.css:{linha}: '}}' a mais")
                return 0
    if nivel:
        problems.append(f"styles.css: {nivel} bloco(s) sem fechar")
    return limpo.count("{")



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


def check_cascata(problems):
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
    css_path = SRC / "styles.css"
    if not css_path.exists():
        return
    props, ordem = regras_por_classe(css_path.read_text(encoding="utf-8"))
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


def main():
    files = sorted(SRC.rglob("*.js"))
    if not files:
        print("nenhum modulo encontrado em src/")
        return 1

    code = {}      # sem comentarios, com strings: para ler imports/exports
    skeleton = {}  # sem comentarios e sem strings: para contar delimitadores
    exports = {}
    for f in files:
        with_str, no_str = scan(f.read_text(encoding="utf-8"))
        code[f] = with_str
        skeleton[f] = no_str
        exports[f.resolve()] = set(EXPORT_RE.findall(with_str))

    problems = []
    used = {f.resolve(): set() for f in files}

    for f in files:
        clean = code[f]
        balance(skeleton[f], f, problems)

        for m in IMPORT_RE.finditer(clean):
            rel = m.group("path")
            if not rel.startswith("."):
                continue
            target = (f.parent / rel).resolve()
            if not target.exists():
                problems.append(f"{f.name}: import de '{rel}' nao existe")
                continue
            if m.group("ns"):
                used[target] |= exports[target]  # 'import * as x' usa tudo
                continue
            for name in m.group("named").split(","):
                name = name.strip().split(" as ")[0].strip()
                if not name:
                    continue
                if name not in exports[target]:
                    problems.append(
                        f"{f.name}: importa '{name}' de {target.name}, "
                        f"que nao exporta esse nome"
                    )
                else:
                    used[target].add(name)

    regras = check_css(problems)
    check_cascata(problems)
    print(f"{len(files)} modulos e {regras} regras de CSS verificados\n")

    for f in files:
        unused = exports[f.resolve()] - used[f.resolve()]
        if unused:
            print(f"  aviso  {f.name}: export sem uso -> {', '.join(sorted(unused))}")

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
                    print(f"  aviso  {f.name}: importa '{name}' e nao usa")

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
