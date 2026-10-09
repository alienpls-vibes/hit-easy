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
  /** Como no navegador: na pagina e quem chega ao corpo por pais de verdade. */
  get isConnected() {
    let n = this;
    while (n.parentNode) {
      if (!n.parentNode.childNodes.includes(n)) return false;
      n = n.parentNode;
    }
    return n === globalThis.document.body || n === globalThis.document.documentElement;
  }
  get parentElement() { return this.parentNode; }
  // <select> guarda o valor escolhido numa propriedade, nao num atributo.
  get value() { return this._value === undefined ? '' : this._value; }
  set value(v) { this._value = String(v); }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    // No DOM de verdade, setAttribute('class') alimenta o classList - e e
    // assim que os SVGs definem a classe deles.
    if (k === 'class') this.className = v;
    // E o atributo `value` de um input define o valor INICIAL: `.value` o
    // reflete ate alguem digitar. Como el() monta tudo por setAttribute, sem
    // isto todo campo criado pelo app nascia vazio para o teste - e qualquer
    // caso que lesse `.value` estava lendo '' e passando sem provar nada.
    if (k === 'value' && this._value === undefined) this._value = String(v);
  }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  addEventListener(type, fn) { (this.events[type] = this.events[type] || []).push(fn); }
  removeEventListener() {}

  /**
   * `click()` de verdade, e nao so o evento disparado de fora.
   *
   * O app usa `campo.click()` para abrir o seletor de arquivo e para baixar
   * um blob - ambos sao codigo que roda em producao e que aqui explodia com
   * "click is not a function", entao o caminho inteiro ficava fora de
   * alcance. Nao borbulha: nenhum caso precisa disso, e borbulhar sem
   * `stopPropagation` seria inventar comportamento.
   */
  click() {
    for (const fn of (this.events.click || []).slice()) {
      fn({ type: 'click', target: this, currentTarget: this,
        preventDefault() {}, stopPropagation() {} });
    }
  }
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
const ouvintesViewport = {};
const ouvintesWindow = {};

/** Quantas entradas de historico foram empilhadas e devolvidas. */
export const historico = { empilhadas: 0, voltas: 0 };

/** Dispara um evento de `window` - popstate, pagehide, resize. */
export function fireWindow(tipo, evento = {}) {
  for (const fn of ouvintesWindow[tipo] || []) fn({ type: tipo, ...evento });
}

/**
 * Simula o teclado do celular subindo.
 *
 * Modela o navegador onde o defeito aparecia: `innerHeight` acompanha o
 * viewport VISUAL (encolhe com o teclado), enquanto
 * `documentElement.clientHeight` - a referencia contra a qual
 * `position: fixed` e `100%` resolvem - continua sendo o layout inteiro.
 *
 * E essa diferenca que o teste precisa: a conta antiga, lendo `innerHeight`,
 * dava zero justamente aqui.
 */
export function simularTeclado({
  layout, visivel, deslocamento = 0, comCampo = true,
}) {
  if (!globalThis.visualViewport) return;
  globalThis.document.documentElement.clientHeight = layout;
  globalThis.innerHeight = visivel;
  globalThis.visualViewport.height = visivel;
  globalThis.visualViewport.offsetTop = deslocamento;

  // Teclado so existe com campo de texto focado. `comCampo: false` modela o
  // outro jeito de o viewport visivel encolher: a barra de URL do celular, que
  // nao e teclado e nao pode empurrar painel nenhum.
  const doc = globalThis.document;
  doc.activeElement = comCampo ? doc.createElement('input') : doc.body;

  for (const fn of ouvintesViewport.resize || []) fn();
}

/**
 * Quem esta sob o dedo, para o arraste.
 *
 * O stub nao tem layout, entao nao da para calcular quem ocupa um ponto da
 * tela. O teste aponta: `apontarPara(node)` e o que `elementFromPoint`
 * devolve na proxima consulta. Sem isto, o gesto central da mesa - arrastar de
 * um painel ao outro - nao tem como ser exercitado.
 */
let sobODedo = null;

export function apontarPara(node) {
  sobODedo = node || null;
}

/** Quanto o app acha que o teclado tomou, em px. */
export function kbAtual() {
  return globalThis.document.documentElement.style.getPropertyValue('--kb');
}

export function fire(node, type, event = {}) {
  // Disparar num no que nao existe nao pode ser silencio: um seletor que
  // errou o alvo faria o teste 'passar' sem ter exercitado nada, e a
  // assercao seguinte falharia longe da causa.
  if (!node) throw new Error('fire(): nó inexistente — o seletor do teste não achou o alvo');
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

  // Ver apontarPara(): o teste diz quem esta sob o dedo.
  doc.elementFromPoint = () => sobODedo;

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

  /**
   * Navegador em INGLES, de proposito.
   *
   * O app detecta o idioma no arranque, e as telas desenhadas ali ficam na
   * lingua do sistema - o runAll so troca para portugues DEPOIS. O Node tem
   * `navigator.language` proprio, que reflete o locale da MAQUINA: portugues
   * no Windows de quem escreve, ingles no Ubuntu do CI. Um teste que comparasse
   * texto fixo passava aqui e quebrava la. Fixar ingles torna o arranque
   * deterministico, e igual ao do CI.
   */
  // Nao da para reatribuir `globalThis.navigator` no Node - e so leitura -,
  // entao a propriedade e redefinida no objeto que ja existe.
  try {
    Object.defineProperty(globalThis.navigator, 'languages', {
      value: ['en-US', 'en'], configurable: true,
    });
  } catch { /* navigator travado: o idioma do arranque volta a variar */ }

  /**
   * visualViewport: o bastante para conferir a conta do teclado.
   *
   * Existe porque "o painel fica atras do teclado" foi defeito real, e a causa
   * era qual altura se lia. Testar isso exige um viewport que o teste mexa.
   */
  globalThis.visualViewport = {
    height: 800,
    offsetTop: 0,
    addEventListener(tipo, fn) {
      (ouvintesViewport[tipo] = ouvintesViewport[tipo] || []).push(fn);
    },
    removeEventListener() {},
  };
  globalThis.window = globalThis;
  globalThis.isSecureContext = true;

  // Ouvintes de `window` valem de verdade.
  //
  // Eram um no-op, e com isso nada pendurado em window existia nos testes -
  // `popstate` e `pagehide` ficavam fora de alcance. Sao justamente eventos de
  // ciclo de vida, o tipo que ninguem percebe quebrado.
  globalThis.addEventListener = (tipo, fn) => {
    (ouvintesWindow[tipo] = ouvintesWindow[tipo] || []).push(fn);
  };
  globalThis.removeEventListener = (tipo, fn) => {
    ouvintesWindow[tipo] = (ouvintesWindow[tipo] || []).filter((x) => x !== fn);
  };

  globalThis.location = {
    href: 'http://localhost/', pathname: '/', search: '', hash: '',
    assign() {}, replace() {}, reload() {},
  };
  // `back()` conta as chamadas: e assim que se prova que sair pela flecha
  // DEVOLVE a entrada empilhada, em vez de acumular historico atras do app.
  globalThis.history = {
    replaceState() {},
    pushState() { historico.empilhadas += 1; },
    back() { historico.voltas += 1; },
  };

  // Rede sempre recusada nos testes. O modulo de nuvem trata falha em todo
  // caminho, entao isto exercita o comportamento offline - e garante que
  // rodar a suite nunca dispare uma chamada de verdade ao Supabase.
  globalThis.fetch = () => Promise.reject(new Error('sem rede nos testes'));
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
