/**
 * DOM simulado minimo, so o bastante para exercitar a maquina de estados dos
 * paineis (`openFlow`) fora do navegador.
 *
 * Por que existe: um painel cuja primeira tela nascia com a classe `is-next`
 * (opacity:0, pointer-events:none) e nunca a perdia deixou TODO painel do app
 * invisivel e inclicavel. Sintaxe valida, imports corretos, 28 testes verdes -
 * e o app quebrado. Nenhuma checagem alcancava aquilo.
 *
 * O que isto verifica: quais classes cada tela carrega depois de entrar, sair
 * e voltar. O que NAO verifica: pintura, layout, gesto. Para isso ainda e o
 * dedo no aparelho - este arquivo so impede que a lampada volte a queimar do
 * mesmo jeito.
 *
 * Instala-se apenas quando nao ha DOM de verdade, entao no navegador
 * (`tests.html`) ele nao encosta em nada e os casos que dependem dele sao
 * pulados.
 */

export const simulated = typeof globalThis.document === 'undefined';

const frames = [];

/** Executa os callbacks de requestAnimationFrame pendentes, em ordem. */
export function flushFrames() {
  let guard = 0;
  while (frames.length && guard < 100) {
    frames.shift()();
    guard += 1;
  }
}

class ClassList {
  constructor() { this.set = new Set(); }
  add(...names) { names.forEach((n) => n && this.set.add(n)); }
  remove(...names) { names.forEach((n) => this.set.delete(n)); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : Boolean(force);
    if (on) this.set.add(name); else this.set.delete(name);
    return on;
  }
  toString() { return [...this.set].join(' '); }
}

/**
 * `style` que imita o navegador no ponto que importa: custom property (--algo)
 * SO existe se passar por setProperty. Atribuir por indice nao registra nada -
 * e foi assim que a identidade de cor dos decks ficou invisivel por muito
 * tempo sem ninguem notar.
 */
function makeStyle() {
  const custom = new Map();
  const style = {};
  const oculto = (nome, fn) => Object.defineProperty(style, nome, {
    value: fn, enumerable: false,
  });

  oculto('setProperty', (k, v) => {
    if (String(k).startsWith('--')) custom.set(k, String(v));
    else style[k] = v;
  });
  oculto('removeProperty', (k) => {
    custom.delete(k);
    delete style[k];
  });
  oculto('getPropertyValue', (k) => {
    if (String(k).startsWith('--')) return custom.get(k) || '';
    return style[k] === undefined ? '' : String(style[k]);
  });
  return style;
}

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.parentNode = null;
    this.style = makeStyle();
    this.dataset = {};
    this.attributes = {};
    this.events = {};
    this.textContent = '';
    this.hidden = false;
    this.classList = new ClassList();
  }

  set className(v) {
    this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get className() { return this.classList.toString(); }

  /** Qualquer valor nao-zero serve: so precisamos que a medicao aconteca. */
  get scrollHeight() { return 40 + this.childNodes.length * 20; }

  append(...kids) {
    for (const kid of kids) {
      if (kid === null || kid === undefined) continue;
      kid.parentNode = this;
      this.childNodes.push(kid);
    }
  }
  removeChild(kid) {
    const i = this.childNodes.indexOf(kid);
    if (i >= 0) this.childNodes.splice(i, 1);
    kid.parentNode = null;
    return kid;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  get firstChild() { return this.childNodes[0] || null; }
  get parentElement() { return this.parentNode; }
  // <select> guarda o valor escolhido numa propriedade, nao num atributo.
  get value() { return this._value === undefined ? '' : this._value; }
  set value(v) { this._value = String(v); }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    // No DOM de verdade, setAttribute('class') alimenta o classList - e e
    // assim que os SVGs definem a classe deles.
    if (k === 'class') this.className = v;
  }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  addEventListener(type, fn) { (this.events[type] = this.events[type] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }

  /**
   * Seletores simples: `.classe` e nomes de tag, separados por virgula.
   *
   * Devolver null sempre, como antes, escondia comportamento: `zoneOf` no
   * painel usa closest('.tap-minus') para saber ONDE o dedo encostou, entao
   * todo toque de borda era lido como toque no centro dentro dos testes.
   */
  matches(sel) {
    return String(sel).split(',').some((parte) => {
      const alvo = parte.trim();
      if (!alvo) return false;
      if (alvo.startsWith('.')) return this.classList.contains(alvo.slice(1));
      return this.tagName === alvo.toUpperCase();
    });
  }
  closest(sel) {
    let n = this;
    while (n) {
      if (typeof n.matches === 'function' && n.matches(sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  /** Medidas fixas: as views so precisam que a chamada exista e devolva numeros. */
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
  blur() {}
  scrollIntoView() {}
  get offsetHeight() { return 60; }
  get offsetTop() { return 0; }
}

/**
 * Dispara um evento no nó. Cobre addEventListener E a propriedade `on<tipo>`,
 * porque o DOM de verdade aceita as duas formas.
 */
export function fire(node, type, event = {}) {
  let parado = false;
  const ev = {
    target: node,
    currentTarget: node,
    preventDefault() {},
    stopPropagation() { parado = true; },
    ...event,
  };

  // Sobe pela arvore, como o DOM de verdade. Sem isso, um toque numa faixa do
  // painel nunca chegava ao handler - que fica no painel inteiro, nao na faixa
  // -, e os testes de gesto mediam algo que nao acontecia.
  let alvo = node;
  while (alvo && !parado) {
    ev.currentTarget = alvo;
    for (const fn of (alvo.events && alvo.events[type]) || []) {
      fn(ev);
      if (parado) break;
    }
    const prop = alvo['on' + type];
    if (!parado && typeof prop === 'function') prop(ev);
    alvo = alvo.parentNode;
  }
}

/** Todo o texto de uma subárvore, para achar botões pelo rótulo. */
export function textOf(node) {
  let s = node.textContent || '';
  for (const k of node.childNodes || []) s += textOf(k);
  return s;
}

/** Percorre a arvore e devolve todo nó que carrega a classe pedida. */
export function findAll(node, className, out = []) {
  if (node.classList && node.classList.contains(className)) out.push(node);
  for (const kid of node.childNodes || []) findAll(kid, className, out);
  return out;
}

if (simulated) {
  const doc = new Node('document');
  doc.body = new Node('body');
  // O app procura #app na carga; sem ele nao ha onde desenhar.
  doc.byId = new Map();
  const appRoot = new Node('main');
  doc.byId.set('app', appRoot);
  doc.body.append(appRoot);
  doc.documentElement = new Node('html');
  doc.createElement = (tag) => new Node(tag);
  doc.createElementNS = (_ns, tag) => new Node(tag);
  doc.getElementById = (id) => doc.byId.get(id) || null;
  doc.createTextNode = (text) => {
    const n = new Node('#text');
    n.nodeType = 3;
    n.textContent = text;
    return n;
  };

  globalThis.document = doc;

  // O bastante para as views subirem: store le localStorage ao carregar, e
  // theme consulta matchMedia.
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.window = globalThis;
  globalThis.isSecureContext = true;
  globalThis.addEventListener = () => {};
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
}
