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
      // O rotulo troca durante a espera porque ela e longa e silenciosa:
      // `atualizarApp` consulta a rede e depois aguarda o worker novo assumir,
      // ate dez segundos. Com o botao so desabilitado, nada se move - e um
      // botao que escurece e fica parado parece um botao que nao funcionou.
      // Foi exatamente a duvida que surgiu em uso: "o botao fez algo?".
      const rotulo = el('span', { class: 'menu-label' }, [
        icon('download'), t('settings.update'),
      ]);
      const sub = el('span', { class: 'menu-sub', text: t('settings.updateSub') });
      const atualizar = el('button', { class: 'menu-item' }, [rotulo, sub]);

      /**
       * Troca o conteudo do rotulo, no lugar.
       *
       * Passa pelo mesmo caminho que `el` usa para filhos de texto. Appendar a
       * string direto funciona no navegador e NAO no DOM simulado, que nao
       * converte string em no - entao o teste do girador acusaria falha onde o
       * app funciona, e eu "consertaria" o app para calar o teste.
       */
      const pintarRotulo = (...filhos) => {
        clear(rotulo);
        for (const f of filhos) {
          rotulo.append(f && f.nodeType ? f : document.createTextNode(String(f)));
        }
      };

      atualizar.addEventListener('click', async () => {
        if (atualizar.disabled) return;
        atualizar.disabled = true;
        atualizar.classList.add('is-updating');
        pintarRotulo(el('span', { class: 'spinner' }), t('settings.updating'));
        sub.textContent = t('settings.updatingSub');

        let r;
        try {
          r = await atualizarApp();
        } catch {
          // Nao e so higiene: sem isto uma falha deixa o botao girando para
          // sempre, e a pessoa fica olhando uma espera que ja acabou.
          r = 'atual';
        }

        if (r === 'atual') {
          atualizar.disabled = false;
          atualizar.classList.remove('is-updating');
          pintarRotulo(icon('download'), t('settings.update'));
          sub.textContent = t('settings.updateSub');
          toast(t('settings.updateNone'));
        }
        // 'atualizando' recarrega a pagina sozinho: deixar girando ate la e o
        // certo, porque a espera continua de verdade.
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
