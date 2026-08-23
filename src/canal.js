/**
 * Em que canal este app esta rodando.
 *
 * Producao e teste moram na MESMA origem, so mudando o caminho:
 *
 *   https://alienpls-vibes.github.io/hit-easy/        producao
 *   https://alienpls-vibes.github.io/hit-easy/beta/   teste
 *
 * Isso e comodo para publicar, mas o navegador nao ajuda em nada: localStorage
 * e Cache Storage sao por ORIGEM, nao por caminho. Sem separar na mao, o beta
 * escreveria no mesmo `mtglc.db.v1` do app de verdade - e uma versao com defeito
 * levaria junto o historico de partidas de quem confiou nele.
 *
 * Por isso todo dado guardado passa por chave() antes de tocar o disco.
 */

/** Canal de um caminho. Exportado separado do location para poder ser testado. */
export function canalDe(caminho) {
  return /(^|\/)beta(\/|$)/.test(String(caminho || '')) ? 'beta' : 'producao';
}

export function canal() {
  return canalDe(typeof location === 'undefined' ? '' : location.pathname);
}

export function ehTeste() {
  return canal() === 'beta';
}

/**
 * O nome com que um dado vai para o disco.
 *
 * Producao mantem a chave EXATA de sempre - de proposito. Qualquer sufixo aqui
 * apagaria o historico de todo mundo que ja usa o app, e um canal de testes que
 * comeca destruindo dados de producao nao serve para nada.
 */
export function chave(base) {
  return canal() === 'beta' ? base + '.beta' : base;
}

/**
 * A que canal pertence um cache do service worker.
 *
 * `null` para nome que nao e nosso: o worker nao deve apagar cache de ninguem,
 * e antes disto ele apagava tudo que encontrasse pela frente.
 *
 * Esta regra existe tambem dentro de sw.js, escrita igual. Worker nao importa
 * modulo, e ligar `{type:'module'}` no registro custaria compatibilidade num app
 * que precisa abrir offline. Sao quatro linhas; se mudar aqui, mude la.
 */
export function canalDoCache(nome) {
  const n = String(nome || '');
  if (n.startsWith('hiteasy-beta-')) return 'beta';
  if (n.startsWith('hiteasy-')) return 'producao';
  return null;
}
