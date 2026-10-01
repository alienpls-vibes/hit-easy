/**
 * O bloco de sincronizacao das configuracoes: o que subiu, o que falta subir.
 */

import { el, clear, toast } from '../../ui.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import * as sync from '../../sync.js';

/**
 * Levar o historico para a nuvem, e ver quanto falta.
 *
 * A sincronizacao acontece sozinha ao abrir o app e ao terminar uma partida.
 * Este bloco existe para os dois casos em que isso nao basta: a migracao
 * inicial, quando ha um historico inteiro esperando, e a rede que caiu - sem um
 * numero visivel, "ja subiu?" nao tem resposta.
 */
export function syncBlock() {
  const caixa = el('div', { class: 'account-sync' });

  const pintar = () => {
    clear(caixa);
    const historico = store.getDB().history || [];
    const enviadas = new Set(store.enviadas());
    const faltam = historico.filter((m) => m && m.id && !enviadas.has(m.id)).length;

    caixa.append(el('p', { class: 'sheet-legend', text: t('sync.title') }));
    caixa.append(el('p', {
      class: faltam ? 'account-note' : 'account-sent',
      text: faltam
        ? (faltam === 1 ? t('sync.pendingOne') : t('sync.pendingMany', { n: faltam }))
        : t('sync.allUp', { n: historico.length }),
    }));

    const botao = el('button', {
      class: faltam ? 'btn primary block' : 'btn ghost block',
    }, [faltam ? t('sync.now') : t('sync.check')]);

    botao.addEventListener('click', async () => {
      botao.disabled = true;
      botao.textContent = t('sync.working');
      const r = await sync.sincronizar({
        aoProgresso: (p) => {
          botao.textContent = t('sync.progress', { n: p.subiu });
        },
      });
      pintar();
      if (r.falhou) toast(t('sync.partial', { n: r.falhou }));
      else if (r.subiu || r.baixou) toast(t('sync.done', { subiu: r.subiu, baixou: r.baixou }));
      else toast(t('sync.nothing'));
    });

    caixa.append(botao);
    caixa.append(el('p', { class: 'account-note', text: t('sync.hint') }));
  };

  pintar();
  return caixa;
}
