/**
 * O proprio @: como amigos marcam voce na mesa deles.
 *
 * Quem nao escolher um @ continua usando o app inteiro normalmente - so nao
 * pode ser convidado. E opcional de proposito.
 */

import { el, clear, openFlow, closeSheet, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { handleValido, exibirHandle, normalizarHandle } from '../../cloud.js';

/**
 * O proprio @: como amigos marcam voce na mesa deles.
 *
 * Quem nao escolher um @ continua usando o app inteiro normalmente - so nao
 * pode ser convidado. E opcional de proposito.
 */
export function handleBlock() {
  const caixa = el('div', { class: 'account-handle' });
  const perfil = cloud.meuPerfil();

  caixa.append(el('p', { class: 'sheet-legend', text: t('account.yourHandle') }));

  if (perfil && perfil.handle) {
    // Ja criado: nao e um campo de texto.
    //
    // O @ e por onde os amigos marcam a pessoa na mesa deles. Deixar isso como
    // um input com botao de salvar convida a trocar sem querer - e trocar de @
    // quebra a marcacao que os outros ja tinham guardado. Trocar continua
    // possivel, mas por uma porta separada, que confere se o nome esta livre
    // antes de deixar salvar.
    caixa.append(el('div', { class: 'account-row' }, [
      el('span', { class: 'account-handle-fixo', text: exibirHandle(perfil.handle) }),
      el('button', {
        class: 'account-out',
        onClick: () => openFlow(trocarHandleStep()),
      }, [t('account.handleChange')]),
    ]));
    caixa.append(el('p', { class: 'account-note', text: t('account.handleLocked') }));
    return caixa;
  }

  caixa.append(el('button', {
    class: 'btn primary block',
    onClick: () => openFlow(trocarHandleStep()),
  }, [t('account.handleCreate')]));
  caixa.append(el('p', { class: 'account-note', text: t('account.handleHint') }));
  return caixa;
}

/**
 * Escolher ou trocar o proprio @, conferindo antes se esta livre.
 *
 * A conferencia e uma consulta, nao uma reserva: entre a resposta e o
 * salvamento alguem pode pegar o mesmo nome. Quem decide de verdade e o indice
 * unico do banco. O valor disto e nao deixar a pessoa digitar, confirmar e so
 * entao descobrir que o nome era de outro.
 */
function trocarHandleStep() {
  const perfil = cloud.meuPerfil();
  return {
    title: perfil && perfil.handle ? t('handle.changeTitle') : t('handle.chooseTitle'),
    subtitle: t('account.handleHint'),
    build: (pane) => {
      const recado = el('div', { class: 'handle-result' });
      let livre = null;   // o @ conferido e aprovado, se houver

      const usar = el('button', { class: 'btn primary block' }, [t('handle.useThis')]);
      usar.disabled = true;

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        'aria-label': t('account.yourHandle'),
      });

      // Qualquer letra nova invalida a conferencia anterior: sem isto daria
      // para conferir um nome livre, digitar outro e salvar o segundo sem
      // nunca ter perguntado nada sobre ele.
      input.addEventListener('input', () => {
        livre = null;
        usar.disabled = true;
        clear(recado);
      });

      const conferir = async () => {
        clear(recado);
        livre = null;
        usar.disabled = true;
        const bruto = normalizarHandle(input.value);
        if (!handleValido(bruto)) {
          recado.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        recado.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const ok = await cloud.handleDisponivel(bruto);
          clear(recado);
          recado.append(el('p', {
            class: ok ? 'account-sent' : 'account-note',
            text: ok
              ? t('handle.free', { handle: exibirHandle(bruto) })
              : t('handle.taken', { handle: exibirHandle(bruto) }),
          }));
          if (ok) { livre = bruto; usar.disabled = false; }
        } catch {
          clear(recado);
          recado.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      usar.addEventListener('click', async () => {
        if (!livre) return;
        usar.disabled = true;
        try {
          const novo = await cloud.salvarHandle(livre, null);
          toast(t('account.handleSaved', { handle: exibirHandle(novo.handle) }));
          closeSheet();
        } catch (err) {
          usar.disabled = false;
          // O 409 do banco e a unica resposta confiavel: alguem pode ter pegado
          // o nome entre a conferencia e o salvamento.
          toast(String(err && err.message) === 'handle ocupado'
            ? t('account.handleTaken')
            : t('account.failed'));
        }
      });

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') conferir(); });

      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: conferir }, [t('handle.check')]),
      ]));
      pane.append(recado);
      pane.append(usar);
      pane.append(el('p', { class: 'account-note', text: t('account.handleWarn') }));
    },
  };
}
