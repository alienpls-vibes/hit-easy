/**
 * O portao: o que se ve sem assinatura.
 *
 * Convite aparece mesmo sem assinar, de proposito. Quem nao assina precisa
 * poder ver que ha partidas esperando, senao nunca soube que existiam.
 */

import { el, clear, icon, toast } from '../../ui.js';
import * as store from '../../store.js';
import * as cloud from '../../cloud.js';
import { cloudEnabled } from '../../config.js';
import { t } from '../../i18n.js';

/**
 * A tela de quem ainda nao tem acesso.
 *
 * Ela conta quantas partidas ja estao guardadas de proposito. Nao e enfeite: e
 * a diferenca entre "pague para usar" e "o que e seu esta aqui, esperando".
 * Continuar jogando e continuar gravando nunca foi bloqueado - so a leitura do
 * historico e.
 *
 * O botao de conferir de novo existe porque a liberacao acontece FORA do app,
 * na mao. Sem ele, a pessoa liberada teria de fechar e abrir o aplicativo para
 * a assinatura ser relida, sem nenhuma pista de que era isso que faltava.
 */
export function renderPaywall(root, { onBack, onUnlock, verificando = false }) {
  clear(root);
  const quantas = (store.getDB().history || []).length;
  const repintar = () => (onUnlock ? onUnlock() : null);
  const estado = cloud.state();

  const conferir = el('button', { class: 'btn ghost block' }, [t('paywall.recheck')]);
  conferir.addEventListener('click', async () => {
    conferir.disabled = true;
    conferir.textContent = t('paywall.checking');
    try {
      await cloud.carregarAssinatura();
    } catch {
      /* sem rede: o estado continua o que era */
    }
    if (cloud.podeVerEstatisticas(cloudEnabled(), cloud.state())) { repintar(); return; }
    conferir.disabled = false;
    conferir.textContent = t('paywall.recheck');
    toast(t('paywall.stillLocked'));
  });

  // Ainda perguntando ao servidor: nao da para NEGAR o que ainda nao se sabe.
  // Antes o app tratava "nao perguntei" como "nao tem", e a tela de bloqueio
  // piscava na cara de quem assina toda vez que o app subia.
  if (verificando) {
    root.append(el('div', { class: 'stats' }, [
      el('header', { class: 'stats-head' }, [
        el('button', {
          class: 'icon-btn',
          'aria-label': t('common.back'),
          onClick: () => onBack && onBack(),
        }, [icon('arrow')]),
        el('h1', { class: 'stats-title', text: t('stats.title') }),
      ]),
      el('div', { class: 'paywall' }, [
        el('p', { class: 'paywall-body', text: t('paywall.checking') }),
      ]),
    ]));
    return;
  }

  const corpo = el('div', { class: 'paywall' }, [
    el('h2', { class: 'paywall-title', text: t('paywall.title') }),
    el('p', { class: 'paywall-body', text: t('paywall.body') }),
    quantas
      ? el('p', {
        class: 'paywall-count',
        text: quantas === 1 ? t('paywall.savedOne') : t('paywall.savedCount', { n: quantas }),
      })
      : null,
    estado === 'deslogado'
      ? el('button', {
        class: 'btn primary block',
        onClick: () => { toast(t('paywall.signInHint')); if (onBack) onBack(); },
      }, [t('paywall.signInFirst')])
      : conferir,
    el('p', { class: 'account-note', text: t('paywall.earlyAccess') }),
  ]);

  root.append(el('div', { class: 'stats' }, [
    el('header', { class: 'stats-head' }, [
      el('button', {
        class: 'icon-btn',
        'aria-label': t('common.back'),
        onClick: () => onBack && onBack(),
      }, [icon('arrow')]),
      el('h1', { class: 'stats-title', text: t('stats.title') }),
    ]),
    corpo,
  ]));
}
