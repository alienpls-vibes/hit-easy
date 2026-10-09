/**
 * Passar a mesa para outro aparelho, e receber uma.
 *
 * O caso de uso e um so e e concreto: a bateria do celular que conta a vida
 * esta acabando no meio da partida, e alguem da mesa tem um aparelho com
 * carga. A partida precisa trocar de maos sem acabar.
 *
 * Por CODIGO, quando ha nuvem: a mesa sobe e aparece um codigo de seis letras,
 * que quem vai continuar digita (ou recebe num link). Ninguem precisa de conta.
 * Antes era so por arquivo, e o .json mandado pelo WhatsApp nao abria no
 * celular de quem recebia - a passagem falhava no meio do jogo.
 *
 * O arquivo continua como saida sem internet: mesa na casa de amigo costuma
 * ter wi-fi ruim, e e ai que a passagem por codigo oferece o arquivo no lugar.
 *
 * O que viaja e UMA mesa. O exportador de backup manda o banco inteiro, e
 * usa-lo aqui entregaria ao amigo todo o historico de partidas de quem passou.
 */

import {
  el, clear, icon, openSheet, toast, confirmAction, buzz,
} from '../../ui.js';
import { t } from '../../i18n.js';
import * as store from '../../store.js';
import { mesaPassada } from '../../engine.js';
import { cloudEnabled } from '../../config.js';
import {
  enviarMesa, verMesa, pegarMesa, situacaoDaMesa, cancelarMesa,
  codigoNoTexto, formatarCodigo,
} from '../../cloud.js';

/** De quanto em quanto tempo o codigo aberto pergunta se a mesa chegou. */
export const ESPERA_DA_SITUACAO = 3000;

/**
 * O nome do arquivo, com o id da partida.
 *
 * Nome fixo fazia duas mesas na pasta de downloads virarem
 * `mesa-hit-easy (1).json`, e aí ninguém sabe qual é qual - nem quem envia,
 * nem quem recebe. O id é o que identifica a partida em todo o resto do app.
 *
 * Filtrado para o que todo sistema de arquivos aceita: o id é gerado pelo app
 * e hoje só tem letras, números e `_`, mas um arquivo com barra no nome não se
 * salva, e descobrir isso no celular de outra pessoa seria tarde.
 */
export function nomeDoArquivo(partida) {
  const id = String((partida && partida.id) || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
  return 'mesa-hit-easy' + (id ? '-' + id : '') + '.json';
}

/**
 * Entrega o arquivo ao sistema.
 *
 * Tenta o compartilhar nativo primeiro, que e o caminho curto: o arquivo vai
 * direto para o WhatsApp, o AirDrop ou o que a pessoa usa, sem passar pela
 * pasta de downloads. Nem todo navegador aceita compartilhar ARQUIVO - alguns
 * aceitam so texto -, e por isso `canShare` e consultado com o arquivo na mao
 * em vez de so perguntar se `share` existe.
 *
 * O download e a saida de sempre: baixa, e a pessoa manda como mandaria
 * qualquer arquivo.
 */
async function entregar(texto, nome) {
  const blob = new Blob([texto], { type: 'application/json' });

  try {
    const arquivo = new File([blob], nome, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: t('pass.shareTitle') });
      return 'compartilhado';
    }
  } catch (e) {
    // Cancelar o compartilhar cai aqui, e nao e erro: a mesa continua
    // passada, e a pessoa pode usar o botao de novo.
    if (e && e.name === 'AbortError') return 'cancelado';
  }

  const a = el('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  return 'baixado';
}

/**
 * Passa a mesa: confirma, sobe, mostra o codigo.
 *
 * A confirmacao diz o que acontece com ESTE aparelho, e nao o que acontece com
 * a mesa. "Vai gerar um codigo" nao e a informacao que importa; "voce para de
 * jogar aqui" e.
 *
 * A mesa so sai daqui DEPOIS de subir. Se a rede falhar, ela continua aberta
 * neste aparelho, e a tela oferece o arquivo, que nao depende de rede.
 *
 * `aoPassar` roda assim que a mesa sai daqui - e quem chama troca de tela.
 * O codigo aparece depois disso, por cima da tela nova: trocar de tela fecha
 * qualquer painel aberto, e o codigo nao pode sumir antes de ser lido.
 */
export async function passarMesa(aoPassar) {
  if (!store.getCurrent()) { toast(t('pass.nothing')); return false; }

  const ok = await confirmAction({
    title: t('pass.confirmTitle'),
    message: t(cloudEnabled() ? 'pass.confirmMsgCode' : 'pass.confirmMsg'),
    confirmLabel: t('pass.confirm'),
  });
  if (!ok) return false;

  if (cloudEnabled()) {
    const envelope = store.mesaParaEnviar();
    if (!envelope) { toast(t('pass.nothing')); return false; }
    toast(t('pass.uploading'));
    try {
      const codigo = await enviarMesa(envelope);
      store.soltarMesa(codigo);
      if (aoPassar) aoPassar();
      mostrarCodigo(codigo);
      return true;
    } catch {
      // Sem rede, ou o banco ainda sem a migracao 007: o arquivo resolve.
      const porArquivo = await confirmAction({
        title: t('pass.offlineTitle'),
        message: t('pass.offlineMsg'),
        confirmLabel: t('pass.sendFile'),
        danger: false,
      });
      if (!porArquivo) return false;
    }
  }

  return passarPorArquivo(aoPassar);
}

/** O caminho de sempre: carimba e entrega o arquivo. */
async function passarPorArquivo(aoPassar) {
  // O nome sai da mesa ANTES de empacotar: empacotar carimba e, depois disso,
  // `getCurrent()` ja devolve null - a mesa passada deixa de ser a de agora.
  const nome = nomeDoArquivo(store.getCurrent());

  const texto = store.empacotarMesa();
  if (!texto) { toast(t('pass.nothing')); return false; }

  await entregar(texto, nome);
  if (aoPassar) aoPassar();
  toast(t('pass.done'));
  return true;
}

/** O link que abre o app ja no receber, com o codigo preenchido. */
export function linkDaMesa(codigo, onde = typeof location === 'undefined' ? null : location) {
  const base = onde ? onde.origin + onde.pathname.replace(/index\.html$/, '') : '';
  return base + '?mesa=' + codigo;
}

/**
 * Manda o codigo pela conversa.
 *
 * Texto, e nao arquivo: texto o WhatsApp de qualquer celular abre. Vai o
 * codigo E o link - o link abre o app ja no receber, e o codigo serve a quem
 * usa o app instalado no iPhone, que nao abre links (ele abre o Safari, que
 * guarda dados separado do app).
 */
async function compartilharCodigo(codigo) {
  const texto = t('pass.shareText', { codigo: formatarCodigo(codigo), link: linkDaMesa(codigo) });
  try {
    if (navigator.share) {
      await navigator.share({ title: t('pass.shareTitle'), text: texto });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  copiar(texto);
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast(t('pass.copied'));
  } catch {
    toast(texto);
  }
}

/**
 * O codigo, grande, e se o outro aparelho ja pegou.
 *
 * Pergunta ao banco enquanto o painel esta aberto: "chegou" e a unica coisa
 * que quem passou quer saber, e sem isto ela ficava olhando para o codigo sem
 * saber se ja podia guardar o celular.
 */
export function mostrarCodigo(codigo) {
  let relogio = null;
  const parar = () => { clearInterval(relogio); relogio = null; };

  openSheet({
    title: t('pass.codeTitle'),
    subtitle: t('pass.codeSub'),
    onClose: parar,
    build: (pane, close) => {
      const situacao = el('p', { class: 'mesa-codigo-situacao', text: t('pass.waiting') });

      const perguntar = async () => {
        let r;
        try { r = await situacaoDaMesa(codigo); } catch { return; }
        if (r !== 'recebida' || !relogio) return;
        parar();
        situacao.textContent = t('pass.arrived');
        situacao.classList.add('is-done');
        buzz(20);
      };
      relogio = setInterval(perguntar, ESPERA_DA_SITUACAO);

      pane.append(
        el('div', { class: 'mesa-codigo', 'aria-label': codigo, text: formatarCodigo(codigo) }),
        situacao,
        el('div', { class: 'sheet-actions' }, [
          el('button', { class: 'btn ghost', onClick: () => copiar(codigo) }, [t('pass.copyCode')]),
          el('button', { class: 'btn primary', onClick: () => compartilharCodigo(codigo) }, [
            icon('share'), t('pass.shareCode'),
          ]),
        ]),
        el('button', { class: 'btn ghost block mesa-codigo-pronto', onClick: close }, [t('common.done')]),
      );
    },
  });
}

/** O que dizer de cada arquivo que nao serve. */
function motivo(erro) {
  const chave = {
    ilegivel: 'pass.errUnreadable',
    'nao-e-mesa': 'pass.errNotTable',
    'versao-nova': 'pass.errNewer',
    'mesa-invalida': 'pass.errBroken',
  }[erro && erro.message];
  return t(chave || 'pass.errUnreadable');
}

/**
 * Pergunta se pode receber, mostrando o tamanho da mesa.
 *
 * Substituir a partida aberta aqui e irreversivel, e ninguem confirma o que
 * nao consegue conferir. Vale para o arquivo e para o codigo.
 */
function confirmarRecebimento(partida) {
  const quantos = (partida.seats || []).length;
  const aberta = store.getCurrent();
  return confirmAction({
    title: t('pass.receiveTitle'),
    message: aberta && !mesaPassada(aberta)
      ? t('pass.receiveReplace', { n: quantos })
      : t('pass.receiveMsg', { n: quantos }),
    confirmLabel: t('pass.receive'),
    danger: Boolean(aberta && !mesaPassada(aberta)),
  });
}

/** O que dizer quando a nuvem falhou. */
function motivoDaRede(erro) {
  return t(erro && erro.message === 'sem-rede' ? 'pass.codeOffline' : 'pass.codeServer');
}

/**
 * Recebe uma mesa por codigo.
 *
 * Em dois tempos, como o banco: primeiro VE a mesa (sem consumir o codigo),
 * confirma com a pessoa, e so entao PEGA. Pegar antes de confirmar queimaria o
 * codigo de quem desistisse no meio - e a mesa ficaria sem dono.
 *
 * Sem nuvem configurada, vai direto para o arquivo.
 */
export function abrirReceberMesa(aoReceber, codigoInicial = '') {
  if (!cloudEnabled()) { receberMesa(aoReceber); return; }

  openSheet({
    title: t('pass.receiveCodeTitle'),
    subtitle: t('pass.receiveCodeSub'),
    build: (pane, close) => {
      const campo = el('input', {
        class: 'mesa-codigo-campo',
        placeholder: 'K7M 2QX',
        autocapitalize: 'characters',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'go',
        'aria-label': t('pass.receiveCodeTitle'),
      });
      if (codigoInicial) campo.value = formatarCodigo(codigoInicial);
      const erro = el('p', { class: 'mesa-codigo-erro' });
      const avisar = (texto) => { erro.textContent = texto || ''; };

      const receber = el('button', { class: 'btn primary' }, [t('pass.receive')]);
      let ocupado = false;

      const destravar = () => {
        ocupado = false;
        receber.disabled = false;
        receber.textContent = t('pass.receive');
      };

      const tentar = async () => {
        if (ocupado) return;
        const codigo = codigoNoTexto(campo.value);
        if (!codigo) { avisar(t('pass.codeInvalid')); return; }
        avisar('');
        ocupado = true;
        receber.disabled = true;
        receber.textContent = t('pass.searching');

        let visto;
        try {
          visto = await verMesa(codigo);
        } catch (e) {
          destravar();
          avisar(motivoDaRede(e));
          return;
        }
        if (!visto) { destravar(); avisar(t('pass.codeNotFound')); return; }

        let dado;
        try {
          dado = store.lerMesaRecebida(visto);
        } catch (e) {
          destravar();
          avisar(motivo(e));
          return;
        }

        close();
        if (!await confirmarRecebimento(dado.partida)) return;

        let pego;
        try {
          pego = await pegarMesa(codigo);
        } catch (e) {
          toast(motivoDaRede(e));
          return;
        }
        if (!pego) { toast(t('pass.codeTaken')); return; }

        // Instala o que foi PEGO, nao o que foi visto: e o pego que o banco
        // garante ser desta pessoa e de mais ninguem.
        try {
          store.instalarMesa(store.lerMesaRecebida(pego));
        } catch (e) {
          toast(motivo(e));
          return;
        }
        if (aoReceber) aoReceber();
      };

      receber.addEventListener('click', tentar);
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentar(); });
      // Colar a mensagem inteira da conversa: o campo acha o codigo la dentro.
      campo.addEventListener('input', () => {
        const achado = codigoNoTexto(campo.value);
        if (achado && campo.value.length > 7) campo.value = formatarCodigo(achado);
        avisar('');
      });

      pane.append(
        campo,
        erro,
        el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn ghost',
            onClick: () => { close(); receberMesa(aoReceber); },
          }, [t('pass.haveFile')]),
          receber,
        ]),
      );
      if (!codigoInicial) setTimeout(() => { try { campo.focus(); } catch { /* sem foco */ } }, 250);
    },
  });
}

/**
 * Recebe uma mesa de um arquivo.
 *
 * Le antes de instalar, e mostra de quem e e em que turno esta: substituir a
 * partida aberta aqui e irreversivel, e ninguem confirma o que nao consegue
 * conferir.
 */
export function receberMesa(aoReceber) {
  const campo = el('input', { type: 'file', accept: '.json,application/json' });
  campo.style.display = 'none';

  campo.addEventListener('change', async () => {
    const arquivo = campo.files && campo.files[0];
    if (!arquivo) return;

    let dado;
    try {
      dado = store.lerMesa(await arquivo.text());
    } catch (e) {
      toast(motivo(e));
      campo.remove();
      return;
    }

    const ok = await confirmarRecebimento(dado.partida);
    campo.remove();
    if (!ok) return;

    store.instalarMesa(dado);
    // Quem chama leva para a mesa. Sem isto a partida era instalada e a tela
    // continuava na home - so recarregar a pagina a encontrava, porque a rota
    // inicial e a unica que olha para `getCurrent()` sozinha.
    if (aoReceber) aoReceber();
  });

  document.body.append(campo);
  campo.click();
}

/**
 * O aviso de que a mesa saiu deste aparelho.
 *
 * Fica na home porque e la que a pessoa volta a olhar, e some sozinho quando
 * nao ha mesa passada - aviso permanente vira cenario.
 *
 * Retomar existe para quando a passagem nao deu certo: o arquivo nao chegou, o
 * amigo desistiu. E deliberadamente uma acao com confirmacao, porque duas
 * copias vivas da mesma partida e exatamente o que a passagem evita.
 */
export function mesaPassadaBanner(onRefresh, aoRetomar) {
  // `mesaGuardada` e nao `getCurrent`: para o resto do app a mesa passada nao
  // existe, e e esta tela que precisa enxerga-la para avisar e oferecer o
  // retomar.
  const mesa = store.mesaGuardada();
  if (!mesaPassada(mesa)) return null;

  const caixa = el('div', { class: 'passada' });
  const codigo = mesa.passadaCodigo || null;
  let chegou = false;

  const pintar = () => {
    clear(caixa);
    const sub = !codigo ? t('pass.goneSub')
      : t(chegou ? 'pass.goneSubArrived' : 'pass.goneSubCode', { codigo: formatarCodigo(codigo) });
    caixa.append(el('div', { class: 'passada-txt' }, [
      el('span', { class: 'menu-label', text: t('pass.goneTitle') }),
      el('span', { class: 'menu-sub', text: sub }),
    ]));
    caixa.append(el('div', { class: 'passada-acts' }, [
      // Enquanto ninguem pegou, o codigo tem de estar a um toque: a pessoa
      // fechou o painel antes de mandar, ou o amigo pediu de novo.
      codigo && !chegou
        ? el('button', { class: 'btn ghost', onClick: () => mostrarCodigo(codigo) }, [t('pass.showCode')])
        : null,
      el('button', {
        class: 'btn ghost',
        onClick: async () => {
          const ok = await confirmAction({
            title: t('pass.takeBackTitle'),
            message: t('pass.takeBackMsg'),
            confirmLabel: t('pass.takeBack'),
          });
          if (!ok) return;
          // Passada por codigo: cancela na nuvem antes de retomar, para o
          // codigo nao continuar valendo com a mesa de volta aqui. Se o outro
          // aparelho ja pegou, retomar cria duas copias vivas - a pessoa
          // precisa saber disso antes, e nao depois.
          if (codigo) {
            let r = null;
            try { r = await cancelarMesa(codigo); } catch { /* sem rede: segue */ }
            if (r === 'recebida') {
              const mesmoAssim = await confirmAction({
                title: t('pass.takeBackReceivedTitle'),
                message: t('pass.takeBackReceivedMsg'),
                confirmLabel: t('pass.takeBackAnyway'),
              });
              if (!mesmoAssim) return;
            }
          }
          store.retomarMesa();
          // Para a mesa, e nao de volta para a home: retomar e dizer "o jogo
          // continua aqui", e quem retoma quer continuar jogando. Parado na
          // home a pessoa ficava sem caminho de volta para a partida.
          if (aoRetomar) aoRetomar();
          else if (onRefresh) onRefresh();
        },
      }, [t('pass.takeBack')]),
      el('button', {
        class: 'btn ghost',
        onClick: async () => {
          const ok = await confirmAction({
            title: t('pass.dropTitle'),
            message: t('pass.dropMsg'),
            confirmLabel: t('pass.drop'),
          });
          if (!ok) return;
          store.clearCurrent();
          if (onRefresh) onRefresh();
        },
      }, [t('pass.drop')]),
    ]));
  };

  pintar();

  // Uma pergunta so, ao desenhar: se o outro aparelho ja pegou, o aviso diz
  // isso e o botao de ver o codigo some. Falhar aqui so deixa o texto antigo.
  if (codigo && cloudEnabled()) {
    situacaoDaMesa(codigo).then((r) => {
      if (r !== 'recebida') return;
      chegou = true;
      pintar();
    }).catch(() => {});
  }

  return caixa;
}

/** A entrada para receber, no pe da home. */
export function receberMesaBotao(aoReceber) {
  return el('button', {
    class: 'receber-mesa',
    onClick: () => abrirReceberMesa(aoReceber),
  }, [icon('download'), t('pass.receiveCta')]);
}

/**
 * A saida para uma partida aberta, quando a home a encontra.
 *
 * Normalmente ninguem ve isto: o app abre direto na mesa quando ha partida, e
 * so volta para a home ao encerrar ou descartar. Mas retomar criou um estado
 * que nao existia antes - home com partida viva -, e ficar preso ali foi o
 * defeito relatado. Em vez de so consertar aquele caminho, a home passa a
 * saber oferecer a saida sempre que o estado aparecer, venha de onde vier.
 */
export function continuarMesaBanner(aoContinuar) {
  const mesa = store.getCurrent();
  if (!mesa) return null;

  return el('button', {
    class: 'invite-banner',
    onClick: aoContinuar,
  }, [
    el('span', { class: 'invite-banner-n' }, [icon('arrow')]),
    el('span', { class: 'invite-banner-txt' }, [
      el('span', { class: 'menu-label', text: t('pass.resumeTitle') }),
      el('span', { class: 'menu-sub', text: t('pass.resumeSub') }),
    ]),
  ]);
}

/** Explica o recurso, para quem tocar sem saber o que e. */
export function abrirSobrePassar() {
  openSheet({
    title: t('pass.aboutTitle'),
    subtitle: t('pass.aboutSub'),
    build: (pane) => {
      pane.append(el('p', { class: 'account-note', text: t('pass.about1') }));
      pane.append(el('p', { class: 'account-note', text: t('pass.about2') }));
    },
  });
}
