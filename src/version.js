/**
 * A versao do aplicativo.
 *
 * Serve para duas coisas: aparecer nas configuracoes (para quem relata um
 * problema conseguir dizer QUAL app quebrou) e nomear os caches do service
 * worker - subir a versao invalida o cache antigo, que e exatamente o que se
 * quer quando ha codigo novo.
 *
 * sw.js repete este numero na mao, porque worker nao importa modulo. Ha uma
 * verificacao automatica cruzando os dois em tools/check-syntax.js.
 */
export const APP_VERSION = '1.1.3';
