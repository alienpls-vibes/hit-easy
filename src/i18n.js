/**
 * Idiomas - a porta do subsistema.
 *
 * As pecas vivem em src/i18n/: uma lingua por arquivo, o registro de quais
 * linguas existem, a mecanica do `t()` e a regra de ordinal. Este arquivo
 * existe para que quem traduz uma tela importe UM caminho e nao precise saber
 * de nada disso - e para que dividir as pecas de outro jeito amanha nao mexa
 * em nenhum dos oito modulos que dependem daqui.
 *
 * As chaves seguem a tela: setup.*, table.*, vote.*, stats.*, common.*.
 */

export { LANGS, DICTS } from './i18n/dicionarios.js';
export {
  setLang, currentLang, locale, t, tn, detectLang,
} from './i18n/traduzir.js';
export { ordinal } from './i18n/ordinal.js';
