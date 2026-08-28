/**
 * Instalar o app a partir do navegador.
 *
 * O Chrome (Android e desktop) dispara `beforeinstallprompt` quando a pagina e
 * instalavel; guardamos o evento e o disparamos de volta quando o usuario
 * pedir. So ha um convite por visita, e ele so aparece se:
 *
 *   - a pagina esta em https:// ou localhost (pelo IP da rede, nao aparece);
 *   - ha manifest valido e service worker registrado;
 *   - o app ainda nao esta instalado.
 *
 * O Safari do iPhone nao implementa nada disso: la e Compartilhar > Adicionar a
 * Tela de Inicio, na mao. Por isso `state()` devolve o motivo, e nao so um
 * booleano - a tela precisa dizer o que fazer em cada caso, em vez de esconder
 * a opcao e deixar a pessoa sem saida.
 */

/**
 * O evento pode ter chegado antes deste modulo existir.
 *
 * index.html guarda `beforeinstallprompt` numa gaveta desde o primeiro
 * instante da pagina, justamente porque o Chrome costuma dispara-lo antes de os
 * modulos terminarem de carregar. Ler a gaveta aqui e o que transforma o botao
 * de instalar de intermitente em confiavel.
 */
let deferred = (typeof window !== 'undefined' && window.__hitEasyInstall) || null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // o convite e nosso, na hora que a pessoa pedir
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.__hitEasyInstall = null;
    notify();
  });
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Os testes montam as views sem navegador: nenhuma destas checagens pode
// explodir onde `window` ou `navigator` nao existem.
function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad moderno se anuncia como Mac; o toque e o que o denuncia.
  return /iphone|ipad|ipod/i.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && navigator.standalone === true);
}

function isSecure() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * Situacao atual da instalacao.
 * `mode` e um de: 'instalado' | 'pronto' | 'ios' | 'inseguro' | 'indisponivel'.
 */
export function state() {
  if (isInstalled()) return { mode: 'instalado' };
  if (deferred) return { mode: 'pronto' };
  if (isIOS()) return { mode: 'ios' };
  if (!isSecure()) return { mode: 'inseguro' };
  return { mode: 'indisponivel' };
}

/** Devolve 'accepted', 'dismissed' ou 'indisponivel'. */
export async function promptInstall() {
  if (!deferred) return 'indisponivel';
  const evento = deferred;
  deferred = null; // so vale uma vez, mesmo que a pessoa recuse
  // A gaveta tambem: senao um recarregamento de tela leria de novo um evento
  // ja gasto e ofereceria um botao que nao faz nada.
  if (typeof window !== 'undefined') window.__hitEasyInstall = null;
  notify();
  try {
    evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome;
  } catch {
    return 'dismissed';
  }
}
