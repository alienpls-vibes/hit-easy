/**
 * Conta e assinatura nas configuracoes: entrar, criar, sair, trocar senha.
 *
 * Na tela principal das configuracoes a conta e UMA linha (contaResumo), que
 * abre esta tela propria. Antes ela vinha inteira no topo - login, senha,
 * sincronizacao, @, convites e assinatura, cada um com sua nota -, e empurrava
 * idioma e tema para o fim de uma rolagem longa.
 *
 * Redesenha sozinho quando o estado muda - entrar, sair, assinatura carregada -
 * porque o login por link magico volta de FORA do app: a pessoa sai para o
 * e-mail e retorna pela URL, e a tela precisa refletir isso sem recarregar.
 */

import { el, clear, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { exibirHandle } from '../../cloud.js';
import { CHECKOUT_URL } from '../../config.js';
import { formatDate } from '../../stats.js';
import { invitesBlock } from './convites.js';
import { handleBlock } from './handle.js';
import { syncBlock } from './sincronizacao.js';
import { grupo, linha } from './linhas.js';

/**
 * A linha da conta na tela principal: quem e, e o que a espera.
 *
 * Deslogado, o convite para entrar. Logado, o @ (ou o e-mail, sem @), com a
 * assinatura ao lado - e o numero de convites esperando, que e a unica coisa
 * da conta que pede uma acao.
 */
export function contaResumo(api, onRefresh) {
  const caixa = el('div', { class: 'set-slot' });

  const pintar = () => {
    clear(caixa);
    const estado = cloud.state();
    const abrir = () => api.next(passoDaConta(onRefresh));

    if (estado === 'deslogado') {
      caixa.append(linha({
        rotulo: t('account.rowOut'),
        sub: t('account.rowOutSub'),
        seta: true,
        classe: 'set-conta',
        aoTocar: abrir,
      }));
      return;
    }

    const usuario = cloud.currentUser();
    const email = (usuario && usuario.email) || '';
    const perfil = cloud.meuPerfil();
    const handle = perfil && perfil.handle ? exibirHandle(perfil.handle) : null;
    const convites = cloud.convitesAbertos().length;

    caixa.append(linha({
      rotulo: handle || email,
      sub: [handle ? email : null, estado === 'assinante' ? t('account.subActive') : null]
        .filter(Boolean).join(' \u00b7 ') || t('account.title'),
      seta: true,
      classe: 'set-conta',
      extra: convites ? el('span', { class: 'set-badge', text: String(convites) }) : null,
      aoTocar: abrir,
    }));
  };

  pintar();
  cloud.ouvirContaEnquanto(caixa, pintar);
  return caixa;
}

/** A tela da conta, empilhada sobre as configuracoes (tem voltar). */
export function passoDaConta(onRefresh) {
  return {
    title: t('account.title'),
    build: (pane, api) => pane.append(accountBlock(onRefresh, api)),
  };
}

/**
 * Conta e assinatura.
 *
 * Redesenha sozinho quando o estado muda - entrar, sair, assinatura carregada -
 * porque o login por link magico volta de FORA do app: a pessoa sai para o
 * e-mail e retorna pela URL, e a tela precisa refletir isso sem recarregar.
 */
export function accountBlock(onRefresh, api) {
  const caixa = el('div', { class: 'account' });

  const pintar = () => {
    clear(caixa);
    const estado = cloud.state();

    if (estado === 'deslogado') {
      caixa.append(loginBlock(pintar, onRefresh));
      return;
    }

    const usuario = cloud.currentUser();
    const assinatura = cloud.subscription();

    // Quem esta dentro, e a assinatura: o que a pessoa confere primeiro.
    caixa.append(grupo(null, [
      linha({
        rotulo: (usuario && usuario.email) || '',
        sub: t('account.connected'),
        classe: 'set-email',
      }),
      estado === 'assinante'
        ? linha({
          rotulo: t('account.subActive'),
          sub: assinatura && assinatura.current_period_end
            ? t('account.subUntil', { date: formatDate(assinatura.current_period_end) })
            : null,
          classe: 'is-good',
        })
        : linha({
          rotulo: t('account.subInactive'),
          sub: t('account.subPitch'),
          valor: t('account.subscribe'),
          aoTocar: () => {
            if (!CHECKOUT_URL) { toast(t('account.subSoon')); return; }
            location.assign(CHECKOUT_URL);
          },
        }),
    ]));

    caixa.append(grupo(t('account.yourHandle'), [handleBlock(api, pintar)]));
    caixa.append(grupo(t('sync.title'), [syncBlock()]));
    caixa.append(grupo(t('account.password'), [senhaBlock()]));
    caixa.append(invitesBlock());

    caixa.append(grupo(null, [linha({
      rotulo: t('account.signOut'),
      perigo: true,
      aoTocar: async () => {
        await cloud.sair();
        pintar();
        if (onRefresh) onRefresh();
      },
    })]));
  };

  pintar();
  cloud.ouvirContaEnquanto(caixa, pintar);
  return caixa;
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

/**
 * Entrar com e-mail e senha.
 *
 * O link por e-mail continua ali embaixo, e continua sendo importante: e o
 * caminho de quem esqueceu a senha e o unico que nao exige lembrar de nada. So
 * deixou de ser o caminho de todo dia - abrir a caixa de entrada para entrar no
 * proprio aparelho e atrito demais, e num aparelho emprestado, pior ainda.
 */
function loginBlock(repintar, onRefresh) {
  const caixa = el('div', { class: 'account-login' });

  const email = el('input', {
    class: 'search-input',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    placeholder: t('account.emailLabel'),
    'aria-label': t('account.emailLabel'),
  });
  const senha = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: t('account.password'),
    'aria-label': t('account.password'),
  });

  // O erro de login precisa ser visto.
  //
  // Antes era um parágrafo cinza depois dos dois botões: quem errava a senha
  // apertava "Entrar", nada visível acontecia, e a explicação ficava fora do
  // campo de visão. `role="alert"` faz o leitor de tela anunciar, e o lugar
  // dele agora é logo abaixo dos campos que precisam ser corrigidos.
  const recado = el('p', { class: 'account-erro', role: 'alert' });
  const limparRecado = () => { recado.textContent = ''; recado.classList.remove('is-on'); };
  const erro = (texto) => {
    recado.textContent = texto;
    recado.classList.add('is-on');
    toast(texto);
  };
  const entrar = el('button', { class: 'btn primary block' }, [t('account.signIn')]);
  const criar = el('button', { class: 'btn ghost block' }, [t('account.createAccount')]);

  const ocupado = (ligado, botao, rotulo) => {
    entrar.disabled = ligado;
    criar.disabled = ligado;
    botao.textContent = ligado ? t('account.sending') : rotulo;
  };

  const pronto = () => {
    if (onRefresh) onRefresh();
    repintar();
  };

  entrar.addEventListener('click', async () => {
    limparRecado();
    if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
    ocupado(true, entrar, t('account.signIn'));
    try {
      await cloud.entrarComSenha(email.value, senha.value);
      buzz(12);
      pronto();
    } catch (err) {
      ocupado(false, entrar, t('account.signIn'));
      erro(motivoDoErro(err));
    }
  });

  criar.addEventListener('click', async () => {
    limparRecado();
    if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
    if (!cloud.senhaValida(senha.value)) {
      erro(t('account.passwordShort'));
      return;
    }
    ocupado(true, criar, t('account.createAccount'));
    try {
      const r = await cloud.criarConta(email.value, senha.value);
      // Com confirmacao de e-mail ligada o servidor nao devolve sessao. Dizer
      // "entrou" ali seria mentira, e a pessoa ficaria esperando algo acontecer.
      if (r.entrou) { buzz(12); pronto(); return; }
      clear(caixa);
      caixa.append(
        el('p', { class: 'account-sent', text: t('account.confirmEmail', { email: email.value.trim() }) }),
        el('p', { class: 'account-note', text: t('account.linkSentHint') }),
      );
    } catch (err) {
      ocupado(false, criar, t('account.createAccount'));
      erro(motivoDoErro(err));
    }
  });

  // Mexer num campo apaga o erro: ele fala do que estava ali antes.
  email.addEventListener('input', limparRecado);
  senha.addEventListener('input', limparRecado);

  caixa.append(email, senha, recado, entrar, criar);

  if (cloud.provedores().includes('google')) {
    caixa.append(el('button', {
      class: 'btn ghost block',
      onClick: () => cloud.entrarCom('google'),
    }, [t('account.withGoogle')]));
  }

  // O link por e-mail: discreto, sempre disponivel, sem exigir senha nenhuma.
  caixa.append(el('button', {
    class: 'account-link',
    onClick: async () => {
      if (!emailValido(email.value)) { erro(t('account.invalidEmail')); return; }
      limparRecado();
      try {
        await cloud.enviarLink(email.value);
        clear(caixa);
        caixa.append(
          el('p', { class: 'account-sent', text: t('account.linkSent', { email: email.value.trim() }) }),
          el('p', { class: 'account-note', text: t('account.linkSentHint') }),
        );
      } catch {
        erro(t('account.failed'));
      }
    },
  }, [t('account.orMagicLink')]));

  caixa.append(el('p', { class: 'account-note', text: t('account.why') }));
  return caixa;
}

/**
 * Definir senha depois de ja estar dentro.
 *
 * E o passo que fecha o problema para quem entrou por link magico: uma senha,
 * uma vez, e nunca mais e-mail em aparelho nenhum.
 */
function senhaBlock() {
  // Ja tem senha: trocar passa pelo e-mail.
  //
  // Definir a PRIMEIRA senha estando logado e seguro - quem esta dentro ja
  // provou ser o dono. Trocar e outra coisa: um contador de vida de mesa vive
  // emprestado, e quem pegasse o aparelho destravado poderia trocar a senha e
  // tomar a conta. O e-mail e o que prova que o pedido e do dono.
  if (cloud.temSenha()) {
    const usuario = cloud.currentUser();
    const email = (usuario && usuario.email) || '';
    let enviado = false;

    const trocar = linha({
      rotulo: t('account.changePassword'),
      sub: t('account.changePasswordSub'),
      seta: true,
      aoTocar: async () => {
        if (enviado || trocar.disabled) return;
        trocar.disabled = true;
        trocar._sub.textContent = t('account.sending');
        try {
          await cloud.pedirTrocaDeSenha(email);
          enviado = true;
          trocar._sub.textContent = t('account.recoverSent', { email });
          trocar.classList.add('is-good');
        } catch {
          trocar.disabled = false;
          trocar._sub.textContent = t('account.changePasswordSub');
          toast(t('account.failed'));
        }
      },
    });
    return trocar;
  }

  const caixa = el('div', { class: 'set-row is-form' });
  const campo = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'new-password',
    placeholder: t('account.newPassword'),
    'aria-label': t('account.newPassword'),
  });
  const salvar = el('button', { class: 'btn primary' }, [t('account.setPassword')]);

  salvar.addEventListener('click', async () => {
    if (!cloud.senhaValida(campo.value)) { toast(t('account.passwordShort')); return; }
    salvar.disabled = true;
    try {
      await cloud.definirSenha(campo.value);
      campo.value = '';
      toast(t('account.passwordSaved'));
      // A linha inteira muda de forma: daqui em diante so existe trocar.
      const nova = senhaBlock();
      if (caixa.parentElement) caixa.parentElement.replaceChild(nova, caixa);
    } catch {
      toast(t('account.failed'));
    } finally {
      salvar.disabled = false;
    }
  });

  caixa.append(
    el('div', { class: 'name-row' }, [campo, salvar]),
    el('span', { class: 'set-sub', text: t('account.setPasswordSub') }),
  );
  return caixa;
}

/**
 * Traduz o que o servidor reclamou.
 *
 * "servidor respondeu 400" nao ajuda ninguem a entrar. Os codigos que importam
 * sao poucos e cada um tem uma saida diferente: senha errada se corrige
 * digitando de novo, conta existente se corrige entrando em vez de criar.
 */
function motivoDoErro(err) {
  const c = String((err && err.codigo) || '');
  const m = String((err && err.message) || '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return t('account.wrongCredentials');
  if (c === 'user_already_exists' || m.includes('already registered')) return t('account.accountExists');
  if (c === 'weak_password' || m.includes('password')) return t('account.passwordShort');
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return t('account.notConfirmed');
  return t('account.failed');
}
