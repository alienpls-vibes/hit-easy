/**
 * A subida da nuvem, em ordem.
 *
 * A ordem nao e arbitraria: captura o retorno do link ANTES de olhar a sessao
 * guardada, senao quem acabou de clicar no e-mail entraria como deslogado.
 */

import { cloudEnabled } from '../config.js';
import { carregarAssinatura } from './assinatura.js';
import { capturarRetorno, carregarConfig, carregarUsuario } from './auth.js';
import { convitesPendentes } from './convites.js';
import { avisar, conta, state } from './estado.js';
import { renovarSessao } from './http.js';
import { carregarPerfil } from './perfil.js';
import { precisaRenovar } from './regras.js';

/**
 * Arranque da conta, chamado uma vez pelo app.
 *
 * Ordem importa: primeiro captura o token que veio na URL (senao ele fica no
 * historico do navegador), depois carrega quem e a pessoa e se ela assina.
 */
export async function iniciar() {
  if (!cloudEnabled()) return state();
  const voltou = capturarRetorno();
  carregarConfig();

  if (conta.sessao) {
    try {
      // Sessao guardada de ontem chega vencida; renovar aqui e o que faz o app
      // abrir ja logado em vez de pedir e-mail de novo.
      if (precisaRenovar(conta.sessao)) await renovarSessao();
      await carregarUsuario();
      await carregarPerfil();
      await carregarAssinatura();
      // Convites tambem: sem isto a home nao teria como saber que ha algo
      // esperando, e o recurso so existiria para quem fosse procurar.
      await convitesPendentes();
    } catch {
      /* sessao invalida ja foi limpa por pedir() */
    }
  }
  if (voltou) avisar();
  return state();
}
