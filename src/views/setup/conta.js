/**
 * Conta e assinatura nas configuracoes: entrar, criar, sair, trocar senha.
 *
 * Redesenha sozinho quando o estado muda - entrar, sair, assinatura carregada -
 * porque o login por link magico volta de FORA do app: a pessoa sai para o
 * e-mail e retorna pela URL, e a tela precisa refletir isso sem recarregar.
 */

import { el, clear, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { CHECKOUT_URL } from '../../config.js';
import { formatDate } from '../../stats.js';
import { invitesBlock } from './convites.js';
import { handleBlock } from './handle.js';
import { syncBlock } from './sincronizacao.js';

/**
 * Conta e assinatura.
 *
 * Redesenha sozinho quando o estado muda - entrar, sair, assinatura carregada -
 * porque o login por link magico volta de FORA do app: a pessoa sai para o
 * e-mail e retorna pela URL, e a tela precisa refletir isso sem recarregar.
 */
export function accountBlock(onRefresh) {
  const caixa = el('div', { class: 'account' });

  const pintar = () => {
    clear(caixa);
    const estado = cloud.state();

    if (estado === 'deslogado') {
      caixa.append(loginBlock(pintar, onRefresh));
      return;
    }

    const usuario = cloud.currentUser();
    caixa.append(el('div', { class: 'account-row' }, [
      el('span', {
        class: 'account-email',
        text: t('account.signedInAs', { email: (usuario && usuario.email) || '' }),
      }),
      el('button', {
        class: 'account-out',
        onClick: async () => { await cloud.sair(); pintar(); if (onRefresh) onRefresh(); },
      }, [t('account.signOut')]),
    ]));

    caixa.append(senhaBlock());
    caixa.append(syncBlock());
    caixa.append(handleBlock());
    caixa.append(invitesBlock());

    const assinatura = cloud.subscription();
    if (estado === 'assinante') {
      caixa.append(el('div', { class: 'account-sub is-on' }, [
        el('span', { class: 'menu-label', text: t('account.subActive') }),
        assinatura && assinatura.current_period_end
          ? el('span', {
            class: 'menu-sub',
            text: t('account.subUntil', { date: formatDate(assinatura.current_period_end) }),
          })
          : null,
      ]));
    } else {
      caixa.append(el('div', { class: 'account-sub' }, [
        el('span', { class: 'menu-label', text: t('account.subInactive') }),
        el('span', { class: 'menu-sub', text: t('paywall.body') }),
      ]));
      caixa.append(el('button', {
        class: 'btn primary block',
        onClick: () => {
          if (!CHECKOUT_URL) { toast(t('account.subSoon')); return; }
          location.assign(CHECKOUT_URL);
        },
      }, [t('account.subscribe')]));
    }
  };

  pintar();
  cloud.onAccountChange(pintar);
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
  const caixa = el('div', { class: 'account-senha' });
  caixa.append(el('p', { class: 'sheet-legend', text: t('account.password') }));

  // Ja tem senha: trocar passa pelo e-mail.
  //
  // Definir a PRIMEIRA senha estando logado e seguro - quem esta dentro ja
  // provou ser o dono. Trocar e outra coisa: um contador de vida de mesa vive
  // emprestado, e quem pegasse o aparelho destravado poderia trocar a senha e
  // tomar a conta. O e-mail e o que prova que o pedido e do dono.
  if (cloud.temSenha()) {
    const usuario = cloud.currentUser();
    const email = (usuario && usuario.email) || '';
    const trocar = el('button', { class: 'btn ghost block' }, [t('account.changePassword')]);

    trocar.addEventListener('click', async () => {
      trocar.disabled = true;
      trocar.textContent = t('account.sending');
      try {
        await cloud.pedirTrocaDeSenha(email);
        clear(caixa);
        caixa.append(
          el('p', { class: 'sheet-legend', text: t('account.password') }),
          el('p', { class: 'account-sent', text: t('account.recoverSent', { email }) }),
          el('p', { class: 'account-note', text: t('account.linkSentHint') }),
        );
      } catch {
        trocar.disabled = false;
        trocar.textContent = t('account.changePassword');
        toast(t('account.failed'));
      }
    });

    caixa.append(trocar);
    caixa.append(el('p', { class: 'account-note', text: t('account.changePasswordHint') }));
    return caixa;
  }

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
      // A secao inteira muda de forma: daqui em diante so existe trocar.
      const nova = senhaBlock();
      if (caixa.parentElement) caixa.parentElement.replaceChild(nova, caixa);
    } catch {
      toast(t('account.failed'));
    } finally {
      salvar.disabled = false;
    }
  });

  caixa.append(el('div', { class: 'name-row' }, [campo, salvar]));
  caixa.append(el('p', { class: 'account-note', text: t('account.setPasswordHint') }));
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
