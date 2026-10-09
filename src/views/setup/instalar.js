/**
 * O bloco de instalacao das configuracoes.
 *
 * Cada situacao ganha uma resposta util - esconder a opcao quando ela nao esta
 * disponivel so deixaria a pessoa procurando. No iPhone o Safari nao deixa o
 * app pedir instalacao sozinho, e a tela diz exatamente o que fazer no lugar.
 */

import { el, clear, toast, openSheet } from '../../ui.js';
import { t } from '../../i18n.js';
import {
  state as installState, promptInstall, onInstallChange, atualizarApp,
  navegadorDoIOS,
} from '../../install.js';
import { linha } from './linhas.js';

/**
 * O passo a passo da instalacao no iPhone e no iPad.
 *
 * A Apple nao deixa uma pagina pedir para ser instalada: nao ha convite, nao
 * ha evento, nao ha botao que o app possa apertar pela pessoa. O maximo que da
 * para fazer e dizer exatamente onde tocar - e isso precisava estar a um toque
 * da home, e nao numa frase dentro das configuracoes, que era onde ninguem
 * achava. O relato foi "no iPhone nao da para baixar o app".
 */
export function abrirInstalarNoIOS() {
  const onde = navegadorDoIOS();
  const passos = [
    onde === 'embutido' ? t('install.iosStep1Embedded')
      : onde === 'outro' ? t('install.iosStep1Other')
        : t('install.iosStep1'),
    t('install.iosStep2'),
    t('install.iosStep3'),
    t('install.iosStep4'),
  ];

  openSheet({
    title: t('install.iosTitle'),
    subtitle: t('install.iosSub'),
    build: (pane, close) => {
      pane.append(el('ol', { class: 'install-steps' }, passos.map((texto, i) => el('li', {
        class: 'install-step' + (i === 0 && onde !== 'safari' ? ' is-alert' : ''),
      }, [
        el('span', { class: 'install-step-n', text: String(i + 1) }),
        el('span', { class: 'install-step-text', text: texto }),
      ]))));

      const acoes = [el('button', { class: 'btn primary', onClick: close }, [t('common.done')])];
      // Fora do Safari o passo 1 e levar o endereco para la. Copiar poupa a
      // pessoa de digitar uma URL comprida no teclado do celular.
      if (onde !== 'safari') {
        acoes.unshift(el('button', {
          class: 'btn ghost',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(location.href.split('#')[0]);
              toast(t('install.copied'));
            } catch {
              toast(location.href.split('#')[0]);
            }
          },
        }, [t('install.copyLink')]));
      }
      pane.append(el('div', { class: 'sheet-actions' }, acoes));
    },
  });
}

/**
 * A linha de instalar, nas configuracoes. Uma linha so, que muda conforme o
 * aparelho - esconder a opcao quando ela nao esta disponivel deixaria a pessoa
 * procurando, mas tambem nao precisa de um paragrafo para cada caso:
 *
 *   instalado   Atualizar o app (o caso de todo dia de quem ja instalou)
 *   pronto      Instalar, com o convite do proprio navegador
 *   ios         Instalar no iPhone, que abre o passo a passo
 *   o resto     a linha diz onde da, sem acao
 *
 * Fica dentro de um envoltorio que se repinta sozinho: o convite do navegador
 * pode chegar depois de a tela abrir.
 */
export function installBlock(onRefresh) {
  const box = el('div', { class: 'set-slot' });

  const paint = () => {
    clear(box);
    const { mode } = installState();

    if (mode === 'instalado') {
      // Instalado, o app costuma ficar dias sem nunca ser fechado - e a pagina
      // aberta continua rodando o codigo antigo mesmo depois de o service
      // worker se trocar. Sem este botao, quem relata um defeito ja corrigido
      // nao tem como ser atendido com "atualize".
      // O rotulo troca durante a espera porque ela e longa e silenciosa:
      // `atualizarApp` consulta a rede e depois aguarda o worker novo assumir,
      // ate dez segundos. Com o botao so desabilitado, nada se move - e um
      // botao que escurece e fica parado parece um botao que nao funcionou.
      const atualizar = linha({
        rotulo: t('settings.update'),
        sub: t('settings.updateSub'),
        classe: 'is-update',
        aoTocar: () => {},
      });
      const rotulo = atualizar._rotulo;
      const sub = atualizar._sub;

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
          pintarRotulo(t('settings.update'));
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
      box.append(linha({
        rotulo: t('settings.installNow'),
        sub: t('settings.installNowSub'),
        seta: true,
        aoTocar: async () => {
          const r = await promptInstall();
          if (r === 'accepted') toast(t('settings.installDone'));
          paint();
          if (onRefresh) onRefresh();
        },
      }));
      return;
    }

    if (mode === 'ios') {
      box.append(linha({
        rotulo: t('settings.installIOS'),
        sub: t('settings.installIOSSub'),
        seta: true,
        aoTocar: abrirInstalarNoIOS,
      }));
      return;
    }

    box.append(linha({
      rotulo: t('settings.installNo'),
      sub: mode === 'inseguro' ? t('settings.installInsecure') : t('settings.installUnsupported'),
      classe: 'is-muted',
    }));
  };

  paint();
  onInstallChange(paint); // o convite pode chegar depois da tela já aberta
  return box;
}
