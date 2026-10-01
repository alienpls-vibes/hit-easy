/**
 * Escolhas em votacao secreta, agrupadas por PERGUNTA.
 *
 * Agrupar por pergunta e o que impede "Silence" do Prisoner's Dilemma de se
 * misturar com "Sim" de um voto qualquer.
 */

import { t } from '../i18n.js';

/**
 * Como chamar uma votacao que ninguem nomeou.
 *
 * "Votacao sem titulo" nao diz nada e enche a estatistica de linhas iguais. As
 * proprias opcoes ja identificam a carta melhor que qualquer rotulo generico:
 * "Silence ou Snitch" e reconhecivel na hora.
 */
/**
 * A chave que agrupa uma votacao no historico.
 *
 * NAO pode ser texto traduzido. Antes o agrupamento usava o rotulo da tela, e
 * "Numero secreto" em portugues e "Secret number" em ingles viravam duas
 * perguntas diferentes: trocar o idioma do app partia o historico de votacoes
 * da pessoa em dois montes, sem que nada tivesse mudado na mesa.
 *
 * As chaves internas comecam com `#` para nunca colidirem com uma pergunta que
 * alguem tenha digitado.
 */
export function chaveDaVotacao(ev) {
  const dado = ((ev && ev.question) || '').trim();
  if (dado) return dado;
  if (ev && ev.kind === 'numero') return '#numero';
  const opcoes = ((ev && ev.options) || []).filter(Boolean);
  return opcoes.length ? opcoes.join(' / ') : '#semtitulo';
}

/**
 * A CATEGORIA de uma votacao: o modelo usado, nao a pergunta escrita.
 *
 * Agrupar por pergunta livre espalhava a mesma coisa por varias linhas - cada
 * jeito de escrever "quem entrega quem?" virava uma categoria propria - e ao
 * mesmo tempo juntava coisas diferentes que por acaso tinham o mesmo titulo.
 * A categoria e o que responde "essa pessoa costuma delatar?".
 *
 * Votacoes gravadas antes deste campo existir nao tem o modelo registrado. Da
 * para recuperar o essencial pelo `kind`, e o resto vira uma categoria generica
 * - inventar qual modelo foi usado seria pior que admitir que nao se sabe.
 */
export function categoriaDaVotacao(ev) {
  if (ev && ev.preset) return ev.preset;
  if (ev && ev.kind === 'numero') return 'numero';
  return 'opcoes';
}

/** O nome da categoria, na lingua de agora. */
export function rotuloDaCategoria(chave) {
  if (chave === 'dilema') return "Prisoner's Dilemma"; // nome de carta, nao se traduz
  if (chave === 'duas') return t('vote.preset.two');
  if (chave === 'numero') return t('vote.preset.number');
  if (chave === 'jogador') return t('vote.preset.player');
  return t('vote.preset.other');
}

/** O texto de uma chave, na lingua de agora. */
export function rotuloDaVotacao(chave) {
  if (chave === '#numero') return t('vote.preset.number');
  if (chave === '#semtitulo') return t('vote.untitled');
  return chave;
}

/** Como uma votacao aparece na linha do tempo. */
export function tituloDaVotacao(ev) {
  return rotuloDaVotacao(chaveDaVotacao(ev));
}
