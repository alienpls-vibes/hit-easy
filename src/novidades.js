/**
 * O que mudou em cada versão.
 *
 * Fonte única: isto é ao mesmo tempo o changelog do repositório e a tela de
 * novidades do aplicativo. Um arquivo de texto separado se desencontraria do
 * que o app mostra na primeira vez que alguém tivesse pressa - e notas de
 * versão erradas são piores que nenhuma.
 *
 * `tipo` é um de: 'novo', 'corrigido', 'mudou'. A separação importa porque as
 * três dizem coisas diferentes para quem usa: uma pede para experimentar, outra
 * pede desculpa, e a terceira avisa que algo que funcionava funciona diferente.
 *
 * O texto fica em português. Traduzir nota de versão a cada publicação é
 * trabalho recorrente que ninguém sustenta, e nota desatualizada em três
 * idiomas engana mais do que informa. Quem quiser traduzir uma entrada pode
 * trocar a string por um objeto: { pt: '...', en: '...' }.
 *
 * A versão mais recente vem primeiro. check-syntax.js exige que a versão atual
 * do app tenha entrada aqui - publicar sem escrever as notas quebra o build.
 */

export const NOVIDADES = [
  {
    versao: '1.1.1',
    data: '2026-08-28',
    titulo: 'Colocação no idioma certo',
    itens: [
      {
        tipo: 'corrigido',
        texto: 'A colocação aparecia com a marca do português em qualquer '
          + 'idioma — "1º" também para quem usa o app em inglês ou alemão. '
          + 'Agora sai 1st, 2nd, 3rd em inglês e 1., 2., 3. em alemão.',
      },
      {
        tipo: 'corrigido',
        texto: 'Em inglês o texto era pior que a marca: a tradução produzia '
          + '"1th place" e "2th place".',
      },
      {
        tipo: 'mudou',
        texto: 'A colocação média deixou de levar marca de ordinal. Uma média '
          + 'de 2,3 não é uma colocação, e o rótulo ao lado já diz o que é.',
      },
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-08-28',
    titulo: 'Conta, nuvem e estatísticas por pessoa',
    itens: [
      {
        tipo: 'mudou',
        texto: 'As estatísticas passaram a exigir assinatura. Jogar, registrar '
          + 'partidas e usar a mesa continuam livres — só a leitura do '
          + 'histórico é paga. Suas partidas antigas continuam guardadas.',
      },
      {
        tipo: 'novo',
        texto: 'Conta com e-mail e senha. O histórico acompanha você entre '
          + 'aparelhos, e a sessão se renova sozinha em vez de expirar em uma '
          + 'hora. Criar conta é opcional: sem ela, nada sai do seu aparelho.',
      },
      {
        tipo: 'novo',
        texto: 'Cada pessoa pode escolher um @. Quem organiza a mesa marca as '
          + 'cadeiras, e a partida chega para cada um como convite — que só '
          + 'entra no histórico de quem aceitar. Ninguém escreve no histórico '
          + 'alheio.',
      },
      {
        tipo: 'corrigido',
        texto: 'A estatística confundia a mesma pessoa cadastrada com nomes '
          + 'diferentes. "Alex" numa noite e "Alexandre" na outra viravam duas '
          + 'pessoas, com duas histórias e duas rivalidades pela metade. Agora '
          + 'quem tem conta é reconhecido pela conta.',
      },
      {
        tipo: 'mudou',
        texto: 'Mesas de 2, 3 e 5 jogadores agora perguntam como o aparelho '
          + 'fica na mesa — em pé ou deitado — em vez de descrever o arranjo. '
          + 'Era essa a decisão de verdade o tempo todo.',
      },
      {
        tipo: 'corrigido',
        texto: 'No computador, os painéis dos jogadores de cima apareciam de '
          + 'cabeça para baixo. Deitado na mesa o giro é o certo; num monitor '
          + 'de pé não há ninguém do outro lado.',
      },
      {
        tipo: 'corrigido',
        texto: 'Quem morre no mesmo turno agora divide a colocação. Se alguém '
          + 'estoura a mesa inteira de uma vez, os três ficam em último — '
          + 'porque nenhum deles sobreviveu ao outro.',
      },
      {
        tipo: 'corrigido',
        texto: 'O título de uma votação grudava ao trocar de modelo. Quem '
          + 'tocasse em "Prisoner\\u2019s Dilemma" e depois escolhesse outro tipo '
          + 'registrava um dilema que nunca aconteceu.',
      },
      {
        tipo: 'mudou',
        texto: 'As estatísticas de votação agrupam pelo TIPO da votação, e não '
          + 'pela pergunta escrita. A pergunta muda toda noite; o que interessa '
          + 'é se aquela pessoa costuma delatar.',
      },
      {
        tipo: 'novo',
        texto: 'A aba de rivalidades passou a comparar um par por vez, '
          + 'escolhido em dois campos. Cinco jogadores davam dez cartões, e a '
          + 'comparação que interessava ficava perdida no meio.',
      },
      {
        tipo: 'corrigido',
        texto: 'Não é mais possível colocar a mesma pessoa em duas cadeiras. '
          + 'Havia meia trava: a lista de salvos barrava, digitar o nome na mão '
          + 'não.',
      },
      {
        tipo: 'corrigido',
        texto: 'O botão de instalar aparecia só às vezes, sem padrão. Era uma '
          + 'corrida com o navegador, e agora o convite é capturado antes de o '
          + 'aplicativo carregar.',
      },
      {
        tipo: 'novo',
        texto: 'Quem tem o app instalado ganhou um botão de atualizar, e a '
          + 'versão aparece no rodapé das configurações.',
      },
      {
        tipo: 'novo',
        texto: 'Política de privacidade, com o que é guardado, onde, e como '
          + 'apagar. Apagar nunca depende de assinatura.',
      },
    ],
  },
];

/** Só o que a pessoa ainda não viu. Versão desconhecida devolve tudo. */
export function novidadesDesde(vistaAntes) {
  if (!vistaAntes) return NOVIDADES;
  const onde = NOVIDADES.findIndex((n) => n.versao === vistaAntes);
  return onde < 0 ? NOVIDADES : NOVIDADES.slice(0, onde);
}

/** As notas desta versão, se houver. */
export function novidadesDe(versao) {
  return NOVIDADES.find((n) => n.versao === versao) || null;
}
