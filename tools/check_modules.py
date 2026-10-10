"""
Static check of the ES modules, without Node installed.

It does not replace running the app, but it catches the most likely class of
error in a project of native modules: an import path that does not exist, an
imported name the other file does not export, an export declared and never
used, and unbalanced delimiters.

Usage:  python tools/check_modules.py
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

# `export { a, b as c } from './x.js'` - a folder's barrel.
#
# Without this, an index.js that only re-exports has NO export at all in the
# eyes of this script, and every importer of it would become a "does not
# export that name" error. The barrel is what gives the folder a single entry
# point, so the tool has to see it.
REEXPORT_RE = re.compile(
    r"export\s+\{(?P<named>[^}]*)\}\s+from\s+['\"](?P<path>[^'\"]+)['\"]", re.S
)
# `export * from './x.js'`: the door stays open to everything the other exports.
EXPORT_STAR_RE = re.compile(r"export\s+\*\s+from\s+['\"](?P<path>[^'\"]+)['\"]")
# `export { a, b }` without `from`: re-exports what was imported above.
EXPORT_LIST_RE = re.compile(r"^export\s+\{(?P<named>[^}]*)\}\s*;?\s*$", re.M)


def names(listing):
    """Splits 'a, b as c' into pairs (original, exported_name)."""
    for part in listing.split(","):
        part = part.strip()
        if not part:
            continue
        if " as " in part:
            origin, alias = part.split(" as ", 1)
            yield origin.strip(), alias.strip()
        else:
            yield part, part


# CSS @import: it is how the entry sheet states the cascade order.
IMPORT_CSS_RE = re.compile(r"@import\s+(?:url\()?['\"](?P<path>[^'\"]+)['\"]\)?\s*;")


def show(path):
    """
    The path relative to the root, not just the file name.

    With one folder per screen, `index.js` shows up half a dozen times and the
    bare name stops identifying anything.
    """
    try:
        return Path(path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return Path(path).name


def scan(text):
    """
    Walks the file once separating code from comments and from strings.

    It has to be a stateful scanner, not a loose regex: ' // ' (in deckNameOf)
    and 'http://www.w3.org/2000/svg' (in icon) are STRINGS, not comments, and a
    naive stripper would cut the line in half, unbalancing the file.

    Returns (with_strings, no_strings): the first only without comments, to
    read the imports; the second also without literals, to count delimiters.
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
                problems.append(f"{show(path)}:{line}: '{ch}' without a matching pair")
                return
            stack.pop()
    for ch, ln in stack:
        problems.append(f"{show(path)}:{ln}: '{ch}' opened and never closed")


def sheets(problems):
    """
    The stylesheets in the order the browser applies them.

    It follows the @imports of src/styles.css instead of keeping a fixed list:
    the order of the file IS the cascade tiebreak rule, so reading the real
    order is the only way the collision warning tells the truth about who wins.

    An @import pointing to a file that does not exist is an ERROR, not a
    warning: the browser ignores it silently and the whole area of that sheet
    gets no style at all, with nothing reported in the console.
    """
    entry = SRC / "styles.css"
    if not entry.exists():
        problems.append("src/styles.css: the entry sheet does not exist")
        return []

    text = entry.read_text(encoding="utf-8")
    without_comments = re.sub(r"/\*.*?\*/", "", text, flags=re.S)

    found = []
    for m in IMPORT_CSS_RE.finditer(without_comments):
        path = (entry.parent / m.group("path")).resolve()
        if not path.exists():
            problems.append(
                f"src/styles.css: @import of '{m.group('path')}' does not exist"
            )
            continue
        found.append((path, path.read_text(encoding="utf-8")))

    # Whatever is left in the entry after the @imports comes LAST in the
    # cascade, which is exactly where the browser applies it.
    rest = IMPORT_CSS_RE.sub("", text)
    if "{" in re.sub(r"/\*.*?\*/", "", rest, flags=re.S):
        found.append((entry, rest))

    # No @import: the single sheet is itself.
    if not found:
        found.append((entry, text))

    return found


def check_css(css_sheets, problems):
    """
    Balance of the CSS braces and comments, sheet by sheet.

    It exists because the sheet has been growing through scripts: one extra
    brace swallows the next rule, and an unclosed /* erases the rest of the
    file - both silently, with no error at all in the browser.

    It checks each file separately, not the concatenation: an unclosed block
    in one sheet would cancel out against an extra '}' in another, and both
    would pass with the line number pointing to the wrong file.
    """
    rules = 0
    for path, text in css_sheets:
        name = show(path)
        clean = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        if "/*" in clean:
            line = text[: text.rindex("/*")].count("\n") + 1
            problems.append(f"{name}:{line}: unclosed /* comment")
            continue

        level = 0
        line = 1
        bad = False
        for ch in clean:
            if ch == "\n":
                line += 1
            elif ch == "{":
                level += 1
            elif ch == "}":
                level -= 1
                if level < 0:
                    problems.append(f"{name}:{line}: extra '}}'")
                    bad = True
                    break
        if bad:
            continue
        if level:
            problems.append(f"{name}: {level} unclosed block(s)")
            continue
        rules += clean.count("{")
    return rules


def rules_per_class(css):
    """
    The properties each class defines in a rule with a SINGLE class, at the top
    level (outside media queries). Only that slice matters here: it is where two
    classes with the same specificity fight and the file order decides.
    """
    clean = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    props = {}
    order = {}
    level = 0
    i = 0
    n = len(clean)
    selector_start = 0

    while i < n:
        ch = clean[i]
        if ch == "{":
            if level == 0:
                selector = clean[selector_start:i].strip()
                end = clean.find("}", i)
                body = clean[i + 1:end] if end > 0 else ""
                m = re.fullmatch(r"\.([\w-]+)", selector)
                if m and "@" not in selector:
                    name = m.group(1)
                    props.setdefault(name, set())
                    order.setdefault(name, i)
                    for decl in body.split(";"):
                        if ":" in decl:
                            props[name].add(decl.split(":", 1)[0].strip())
            level += 1
        elif ch == "}":
            level -= 1
            if level == 0:
                selector_start = i + 1
        i += 1
    return props, order


def combined_classes(files):
    """Sets of classes that show up together on the same element, from the JS."""
    combos = set()
    for f in files:
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r"class:\s*'([a-z][\w-]*(?:\s+[a-z][\w-]+)+)'", text):
            combos.add(tuple(sorted(m.group(1).split())))
    return combos


def check_cascade(css_sheets, problems):
    """
    Two classes on the same element defining the SAME property is a tie
    resolved by the file order - fragile and invisible.

    That is how the home screen broke: `class: 'seat-spot layout-mini'`, both
    defining `width`, and the one 950 lines below won. Nothing reported it.

    Not every warning is a defect: a modifier defined AFTER the base is the
    right pattern (.chips-fill over .chips, .vote-number over .search-input).
    What signals a problem is the generic BASE beating the specific class -
    which was exactly the case of .layout-mini over .seat-spot.
    """
    if not css_sheets:
        return
    # Concatenated in load order: the tiebreak we want to measure is precisely
    # the final position, and a class can lose to another from ANOTHER file.
    props, order = rules_per_class("\n".join(t for _, t in css_sheets))
    combos = combined_classes(sorted(SRC.rglob("*.js")))

    for combo in sorted(combos):
        present = [c for c in combo if c in props]
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                common = props[a] & props[b]
                # Inline `class` and `style` do not count; only layout properties.
                common.discard("")
                if not common:
                    continue
                winner = a if order[a] > order[b] else b
                print(
                    "  warning  css: .%s and .%s together define %s - .%s wins by order"
                    % (a, b, ", ".join(sorted(common)), winner)
                )


def find_cycles(graph):
    """
    Cycles in the import graph.

    ES modules cope with a cycle in some cases - function declarations are
    hoisted, so A and B can call each other. But if one of the two READS a
    value from the other while it is still being evaluated, the result is
    `undefined` or a TDZ ReferenceError, depending on `var` or `const`. And it
    depends on the ORDER in which the browser evaluated, which changes with who
    imported first.

    With layered folders and one barrel per subsystem this starts to matter: a
    piece that imports its own folder's door closes a cycle without anything
    in the file looking wrong. That is why this is a loud warning here - not
    every cycle breaks, but every cycle is a place where evaluation order
    started to matter, and nobody wants to find out through the black screen.
    """
    cycles = []
    state = {}   # 0 = not visited, 1 = on the stack, 2 = closed
    stack = []

    def visit(node):
        state[node] = 1
        stack.append(node)
        for neighbor in sorted(graph.get(node, ())):
            if state.get(neighbor, 0) == 0:
                visit(neighbor)
            elif state.get(neighbor) == 1:
                # Closed: cuts the slice of the stack that forms the cycle.
                cut = stack[stack.index(neighbor):]
                cycles.append(cut + [neighbor])
        stack.pop()
        state[node] = 2

    for node in sorted(graph):
        if state.get(node, 0) == 0:
            visit(node)
    return cycles


def main():
    files = sorted(SRC.rglob("*.js"))
    if not files:
        print("no module found in src/")
        return 1

    code = {}      # without comments, with strings: to read imports/exports
    skeleton = {}  # without comments and without strings: to count delimiters
    exports = {}
    reexports = {}  # file -> [(target, original, exported_name)]
    stars = {}      # file -> [target] of `export * from`

    problems = []

    for f in files:
        with_str, no_str = scan(f.read_text(encoding="utf-8"))
        code[f] = with_str
        skeleton[f] = no_str
        target = f.resolve()
        exports[target] = set(EXPORT_RE.findall(with_str))

        reexports[target] = []
        for m in REEXPORT_RE.finditer(with_str):
            dest = (f.parent / m.group("path")).resolve()
            for origin, name in names(m.group("named")):
                exports[target].add(name)
                reexports[target].append((dest, origin, name))

        # `export { a, b }` without `from` re-exports what was imported above;
        # the name is already in the body, so it is enough to count it as an
        # export of this file.
        for m in EXPORT_LIST_RE.finditer(with_str):
            for _, name in names(m.group("named")):
                exports[target].add(name)

        stars[target] = [
            (f.parent / m.group("path")).resolve()
            for m in EXPORT_STAR_RE.finditer(with_str)
        ]

    # `export *` is transitive: a barrel can re-export another barrel. It runs
    # until nothing changes, instead of a single level, otherwise the chain
    # breaks on the second hop.
    changed = True
    while changed:
        changed = False
        for target, dests in stars.items():
            for dest in dests:
                if dest not in exports:
                    continue
                fresh = exports[dest] - exports[target]
                if fresh:
                    exports[target] |= fresh
                    changed = True

    used = {f.resolve(): set() for f in files}

    # Re-exporting IS using: without this every module behind a barrel would
    # show up as an "unused export", and the warning would lose its meaning
    # exactly where it matters.
    for target, listing in reexports.items():
        for dest, origin, _ in listing:
            if dest in used:
                used[dest].add(origin)
                if origin not in exports.get(dest, set()):
                    problems.append(
                        f"{show(target)}: re-exports '{origin}' from "
                        f"{show(dest)}, which does not export that name"
                    )
    for target, dests in stars.items():
        for dest in dests:
            if dest in used:
                used[dest] |= exports.get(dest, set())

    graph = {}
    for f in files:
        clean = code[f]
        balance(skeleton[f], f, problems)
        graph.setdefault(show(f), set())

        for m in IMPORT_RE.finditer(clean):
            rel = m.group("path")
            if not rel.startswith("."):
                continue
            target = (f.parent / rel).resolve()
            if not target.exists():
                problems.append(f"{show(f)}: import of '{rel}' does not exist")
                continue
            graph[show(f)].add(show(target))
            if m.group("ns"):
                used[target] |= exports[target]  # 'import * as x' uses everything
                continue
            for name in m.group("named").split(","):
                name = name.strip().split(" as ")[0].strip()
                if not name:
                    continue
                if name not in exports[target]:
                    problems.append(
                        f"{show(f)}: imports '{name}' from {show(target)}, "
                        f"which does not export that name"
                    )
                else:
                    used[target].add(name)

    # A re-export is an edge too: the barrel depends on the pieces.
    for target, listing in reexports.items():
        origin = show(target)
        graph.setdefault(origin, set())
        for dest, _, _ in listing:
            graph[origin].add(show(dest))
    for target, dests in stars.items():
        origin = show(target)
        graph.setdefault(origin, set())
        for dest in dests:
            graph[origin].add(show(dest))

    cycles = find_cycles(graph)

    css_sheets = sheets(problems)
    rules = check_css(css_sheets, problems)
    check_cascade(css_sheets, problems)
    print(
        f"{len(files)} modules and {rules} rules in "
        f"{len(css_sheets)} CSS sheet(s) checked\n"
    )

    for f in files:
        unused = exports[f.resolve()] - used[f.resolve()]
        if unused:
            print(f"  warning  {show(f)}: unused export -> {', '.join(sorted(unused))}")

    # An import declared but never referenced in the file body.
    for f in files:
        clean = code[f]
        body = IMPORT_RE.sub("", clean)
        for m in IMPORT_RE.finditer(clean):
            if not m.group("named"):
                continue
            for name in m.group("named").split(","):
                name = name.strip().split(" as ")[-1].strip()
                if name and not re.search(rf"\b{re.escape(name)}\b", body):
                    print(f"  warning  {show(f)}: imports '{name}' and does not use it")

    for cycle in cycles:
        print("  warning  import cycle: " + " -> ".join(cycle))

    print()
    if problems:
        print(f"{len(problems)} PROBLEM(S):")
        for p in problems:
            print("  ERROR    " + p)
        return 1

    print("OK: imports, exports and delimiters are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
