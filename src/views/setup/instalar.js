/**
 * O bloco de instalacao das configuracoes.
 *
 * Cada situacao ganha uma resposta util - esconder a opcao quando ela nao esta
 * disponivel so deixaria a pessoa procurando. No iPhone o Safari nao deixa o
 * app pedir instalacao sozinho, e a tela diz exatamente o que fazer no lugar.
 */

import { el, clear, icon, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import {
  state as installState, promptInstall, onInstallChange, atualizarApp,
} from '../../install.js';

/**
 * Bloco de instalacao. Cada situacao ganha uma resposta util - esconder a opcao
 * quando ela nao esta disponivel so deixaria a pessoa procurando.
 */
export function installBlock(onRefresh) {
  const box = el('div', { class: 'menu' });

  const paint = () => {
    clear(box);
    const { mode } = installState();

    if (mode === 'instalado') {
      box.append(el('div', { class: 'install-note is-done' }, [
        el('span', { class: 'menu-label', text: t('settings.installed') }),
        el('span', { class: 'menu-sub', text: t('settings.installedSub') }),
      ]));

      // Instalado, o app costuma ficar dias sem nunca ser fechado - e a pagina
      // aberta continua rodando o codigo antigo mesmo depois de o service
      // worker se trocar. Sem este botao, quem relata um defeito ja corrigido
      // nao tem como ser atendido com "atualize".
      const atualizar = el('button', { class: 'menu-item' }, [
        el('span', { class: 'menu-label' }, [icon('download'), t('settings.update')]),
        el('span', { class: 'menu-sub', text: t('settings.updateSub') }),
      ]);
      atualizar.addEventListener('click', async () => {
        atualizar.disabled = true;
        const r = await atualizarApp();
        if (r === 'atual') {
          atualizar.disabled = false;
          toast(t('settings.updateNone'));
        }
        // 'atualizando' recarrega a pagina sozinho: nao ha o que fazer aqui.
      });
      box.append(atualizar);
      return;
    }

    if (mode === 'pronto') {
      box.append(el('button', {
        class: 'menu-item install-cta',
        onClick: async () => {
          const r = await promptInstall();
          if (r === 'accepted') toast(t('settings.installDone'));
          paint();
          if (onRefresh) onRefresh();
        },
      }, [
        el('span', { class: 'menu-label' }, [icon('download'), t('settings.installNow')]),
        el('span', { class: 'menu-sub', text: t('settings.installNowSub') }),
      ]));
      return;
    }

    if (mode === 'ios') {
      box.append(el('div', { class: 'install-note' }, [
        el('span', { class: 'menu-label' }, [icon('share'), t('settings.installIOS')]),
        el('span', { class: 'menu-sub', text: t('settings.installIOSSub') }),
      ]));
      return;
    }

    box.append(el('div', { class: 'install-note' }, [
      el('span', { class: 'menu-label', text: t('settings.installNo') }),
      el('span', {
        class: 'menu-sub',
        text: mode === 'inseguro' ? t('settings.installInsecure') : t('settings.installUnsupported'),
      }),
    ]));
  };

  paint();
  onInstallChange(paint); // o convite pode chegar depois da tela já aberta
  return box;
}
