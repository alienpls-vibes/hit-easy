/**
 * A assinatura: se vale, e quando.
 *
 * `assinaturaLida` e diferente de `assinatura: null`, e a distincao importa
 * na tela: "nao assina" e uma resposta, "ainda nao perguntei" e um spinner.
 */

import { cloudEnabled } from '../config.js';
import { avisar, conta } from './estado.js';
import { pedir } from './http.js';

/**
 * Ja se sabe se esta pessoa assina?
 *
 * Sem isto o app tratava "ainda nao perguntei" como "nao tem" - e a tela de
 * bloqueio piscava por alguns segundos na cara de quem ASSINA, toda vez que o
 * app subia. Para quem paga, ser informado de que nao pagou e o pior defeito
 * possivel.
 *
 * Sem sessao a resposta e imediata e definitiva: nao ha assinatura para
 * ninguem. So havendo sessao e que existe uma pergunta em aberto.
 */
export function assinaturaConhecida() {
  if (!cloudEnabled()) return true;
  if (!conta.sessao) return true;
  return conta.assinaturaLida;
}

export async function carregarAssinatura() {
  if (!conta.sessao) {
    conta.assinatura = null;
    conta.assinaturaLida = true;
    return null;
  }
  try {
    const linhas = await pedir('/rest/v1/subscriptions?select=*&limit=1');
    conta.assinatura = Array.isArray(linhas) && linhas.length
      ? linhas[0]
      : null;
    return conta.assinatura;
  } finally {
    // Mesmo falhando, a pergunta deixa de estar em aberto: insistir em
    // "verificando" para sempre seria pior que dizer que nao ha acesso.
    conta.assinaturaLida = true;
    avisar();
  }
}
