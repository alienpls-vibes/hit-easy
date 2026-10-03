/**
 * Passar a mesa para outro aparelho, e receber uma.
 *
 * O caso de uso e um so e e concreto: a bateria do celular que conta a vida
 * esta acabando no meio da partida, e alguem da mesa tem um aparelho com
 * carga. A partida precisa trocar de maos sem acabar.
 *
 * Por arquivo, e nao pela nuvem: nao exige conta de ninguem, nao exige
 * assinatura e funciona sem rede - que importa, porque mesa na casa de amigo
 * costuma ter wi-fi ruim e o celular que esta morrendo nao e hora de depender
 * de upload.
 *
 * O que viaja e UMA mesa. O exportador de backup manda o banco inteiro, e
 * usa-lo aqui entregaria ao amigo todo o historico de partidas de quem passou.
 */

import { el, clear, icon, openSheet, toast, confirmAction } from '../../ui.js';
import { t } from '../../i18n.js';
import * as store from '../../store.js';
import { mesaPassada } from '../../engine.js';

const NOME = 'mesa-hit-easy.json';

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
async function entregar(texto) {
  const blob = new Blob([texto], { type: 'application/json' });

  try {
    const arquivo = new File([blob], NOME, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: t('pass.shareTitle') });
      return 'compartilhado';
    }
  } catch (e) {
    // Cancelar o compartilhar cai aqui, e nao e erro: a mesa continua
    // passada, e a pessoa pode usar o botao de novo.
    if (e && e.name === 'AbortError') return 'cancelado';
  }

  const a = el('a', { href: URL.createObjectURL(blob), download: NOME });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  return 'baixado';
}

/**
 * Passa a mesa: confirma, carimba, entrega.
 *
 * A confirmacao diz o que acontece com ESTE aparelho, e nao o que acontece com
 * o arquivo. "Vai gerar um arquivo" nao e a informacao que importa; "voce para
 * de jogar aqui" e.
 */
export async function passarMesa(aoPassar) {
  const ok = await confirmAction({
    title: t('pass.confirmTitle'),
    message: t('pass.confirmMsg'),
    confirmLabel: t('pass.confirm'),
  });
  if (!ok) return false;

  const texto = store.empacotarMesa();
  if (!texto) { toast(t('pass.nothing')); return false; }

  await entregar(texto);
  if (aoPassar) aoPassar();
  return true;
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

    const partida = dado.partida;
    const quantos = (partida.seats || []).length;
    const aberta = store.getCurrent();

    const ok = await confirmAction({
      title: t('pass.receiveTitle'),
      message: aberta && !mesaPassada(aberta)
        ? t('pass.receiveReplace', { n: quantos })
        : t('pass.receiveMsg', { n: quantos }),
      confirmLabel: t('pass.receive'),
      danger: Boolean(aberta && !mesaPassada(aberta)),
    });
    campo.remove();
    if (!ok) return;

    store.instalarMesa(dado);
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
export function mesaPassadaBanner(onRefresh) {
  // `mesaGuardada` e nao `getCurrent`: para o resto do app a mesa passada nao
  // existe, e e esta tela que precisa enxerga-la para avisar e oferecer o
  // retomar.
  const mesa = store.mesaGuardada();
  if (!mesaPassada(mesa)) return null;

  const caixa = el('div', { class: 'passada' });

  const pintar = () => {
    clear(caixa);
    caixa.append(el('div', { class: 'passada-txt' }, [
      el('span', { class: 'menu-label', text: t('pass.goneTitle') }),
      el('span', { class: 'menu-sub', text: t('pass.goneSub') }),
    ]));
    caixa.append(el('div', { class: 'passada-acts' }, [
      el('button', {
        class: 'btn ghost',
        onClick: async () => {
          const ok = await confirmAction({
            title: t('pass.takeBackTitle'),
            message: t('pass.takeBackMsg'),
            confirmLabel: t('pass.takeBack'),
          });
          if (!ok) return;
          store.retomarMesa();
          if (onRefresh) onRefresh();
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
  return caixa;
}

/** A entrada para receber, no pe da home. */
export function receberMesaBotao(onRefresh) {
  return el('button', {
    class: 'receber-mesa',
    onClick: () => receberMesa(onRefresh),
  }, [icon('download'), t('pass.receiveCta')]);
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
