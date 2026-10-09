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

/**
 * Em que navegador do iPhone a pagina esta aberta.
 *
 * Importa porque o caminho muda: no Safari e Compartilhar > Adicionar a Tela
 * de Inicio; no Chrome e no Edge do iOS 16.4 em diante tambem existe, pelo
 * compartilhar da barra de endereco; e dentro de outro app (Instagram,
 * Facebook, o navegador do app do Google) nao existe de jeito nenhum - a
 * pessoa precisa sair para um navegador de verdade, e a tela tem de dizer isso
 * em vez de mandar procurar um botao que nao esta la.
 *
 * Devolve 'safari' | 'outro' | 'embutido'. Recebe o user agent para o teste.
 */
export function navegadorDoIOS(ua) {
  const agente = ua !== undefined ? ua
    : (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|TikTok|musical_ly|Snapchat|GSA\/|Twitter/i.test(agente)) {
    return 'embutido';
  }
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser/i.test(agente)) return 'outro';
  return 'safari';
}

/** E iPhone ou iPad? Exportado para as telas esconderem o que la nao existe. */
export function ehIOS() {
  return isIOS();
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

/**
 * Qual build do beta esta rodando.
 *
 * O arquivo e escrito pelo CI na publicacao, e so existe em /beta/. Em
 * producao devolve null: la o numero da versao ja responde a pergunta, porque
 * so muda quando ha publicacao.
 *
 * `no-store` e o service worker deixando passar: servir isto do cache
 * responderia com o build anterior, que e a unica resposta inutil.
 */
export async function buildDoBeta() {
  try {
    const res = await fetch('./build.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const dado = await res.json();
    return dado && dado.build ? dado : null;
  } catch {
    return null; // sem rede, ou producao, que nao tem o arquivo
  }
}

/**
 * Buscar uma versao nova do aplicativo instalado.
 *
 * O service worker ja se troca sozinho (skipWaiting no install), mas a PAGINA
 * aberta continua rodando o codigo antigo ate ser recarregada - e um app
 * instalado costuma ficar dias sem nunca ser fechado. Sem este botao, a pessoa
 * relata um defeito ja corrigido e nao ha como pedir que ela "atualize".
 *
 * O detalhe que faz isto funcionar ou nao: `reg.update()` resolve quando a
 * CHECAGEM termina, nao quando a instalacao acaba. Recarregar ali recarrega com
 * o worker velho ainda no comando, que serve o shell antigo do cache - o app
 * volta identico e parece que o botao nao fez nada. Por isso esperamos o
 * `controllerchange`, que so dispara quando o worker novo assume de verdade.
 *
 * Devolve 'atualizando' quando ha versao nova, 'atual' quando nao ha.
 */
export async function atualizarApp(esperaMax = 10000) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    if (typeof location !== 'undefined') location.reload();
    return 'atualizando';
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return 'atualizando'; }

    await reg.update();

    // Nem instalando nem esperando: nao veio codigo novo.
    if (!reg.installing && !reg.waiting) return 'atual';

    await new Promise((resolve) => {
      let feito = false;
      const terminar = () => {
        if (feito) return;
        feito = true;
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', terminar, { once: true });

      // Worker parado em "waiting" de uma tentativa anterior nao sai de la
      // sozinho: um empurrao resolve. O install ja chama skipWaiting, entao
      // isto so importa para o caso preso.
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Rede ruim nao pode deixar a pessoa presa numa tela travada: passado o
      // limite, recarrega assim mesmo. No pior caso ela toca de novo.
      setTimeout(terminar, esperaMax);
    });

    location.reload();
    return 'atualizando';
  } catch {
    return 'atual';
  }
}

/**
 * Que versao o service worker diz que e.
 *
 * A tela mostra APP_VERSION, que vem do modulo - e o modulo vem do cache. Se o
 * cache estiver velho, a tela mente com toda a confianca do mundo. O worker e
 * a unica parte que o navegador atualiza por fora, entao perguntar a ele revela
 * a divergencia.
 *
 * Devolve null quando nao ha worker ou ele nao responde a tempo.
 */
export function versaoDoWorker(esperaMax = 1500) {
  if (typeof navigator === 'undefined'
    || !navigator.serviceWorker
    || !navigator.serviceWorker.controller) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let feito = false;
    const responder = (v) => { if (!feito) { feito = true; resolve(v); } };
    try {
      const canal = new MessageChannel();
      canal.port1.onmessage = (e) => responder(e.data || null);
      navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [canal.port2]);
      setTimeout(() => responder(null), esperaMax);
    } catch {
      responder(null);
    }
  });
}
