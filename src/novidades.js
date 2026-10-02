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
    versao: '1.7.0',
    data: '2026-10-02',
    titulo: 'Cara nova, e listas que se ordenam',
    itens: [
      {
        tipo: 'mudou',
        texto: 'O ícone do app mudou: gradiente de cor com a mesa ao centro, '
          + 'e a marca no alto da tela inicial passou a ser a mesma mesa. '
          + 'Se o atalho no seu celular continuar com o desenho antigo por '
          + 'alguns dias, é o sistema demorando para reler — reinstalar '
          + 'resolve na hora.',
      },
      {
        tipo: 'novo',
        texto: 'As abas de Decks e de Jogadores ganharam um seletor de ordem: '
          + 'partidas, vitórias, taxa de vitória, dano causado, '
          + 'eliminações e melhor colocação.',
      },
      {
        tipo: 'mudou',
        texto: 'Esta tela passa a mostrar só o que entrou desde a versão '
          + 'em que o app estava. O histórico inteiro continua a um toque, '
          + 'no fim da lista.',
      },
      {
        tipo: 'mudou',
        texto: 'O botão de atualizar o app mostra um girador enquanto busca '
          + 'a versão nova. Antes ele só escurecia, e a espera de até dez '
          + 'segundos parecia um botão que não funcionou.',
      },
    ],
  },
  {
    versao: '1.6.0',
    data: '2026-10-02',
    titulo: 'Seus decks seguem a sua conta',
    itens: [
      {
        tipo: 'novo',
        texto: 'Os decks de quem está logado passam a acompanhar a conta. '
          + 'Num aparelho novo eles já aparecem na escolha do deck, em vez de '
          + 'obrigar a buscar na Scryfall o comandante que o app já conhece.',
      },
      {
        tipo: 'mudou',
        texto: 'São só os seus, e são privados: o app deixa cada pessoa '
          + 'escrever apenas no próprio perfil, e a busca por @ não revela o '
          + 'que alguém joga.',
      },
    ],
  },
  {
    versao: '1.5.0',
    data: '2026-10-02',
    titulo: 'Filtrar os decks por jogador',
    itens: [
      {
        tipo: 'novo',
        texto: 'A aba de Decks ganhou um filtro por jogador. "Todos" é o '
          + 'padrão e mostra o que sempre mostrou: todos os decks jogados '
          + 'neste aparelho. Escolhendo alguém, a lista fica só com os decks '
          + 'que aquela pessoa levou.',
      },
      {
        tipo: 'mudou',
        texto: 'O filtro só aparece quando há mais de uma pessoa no '
          + 'histórico: filtrar entre um não filtra nada.',
      },
    ],
  },
  {
    versao: '1.4.1',
    data: '2026-10-02',
    titulo: 'O voltar do aparelho não fecha mais o app',
    itens: [
      {
        tipo: 'corrigido',
        texto: 'Nas estatísticas, o botão de voltar do aparelho fechava o '
          + 'app em vez de voltar uma tela. Agora leva para onde a flecha da '
          + 'tela leva — a tela inicial, no caminho normal.',
      },
      {
        tipo: 'mudou',
        texto: 'Com um painel aberto, o voltar fecha o painel em vez de '
          + 'navegar. Antes de existir esse voltar, o gesto saía do app com a '
          + 'folha de pé.',
      },
    ],
  },
  {
    versao: '1.4.0',
    data: '2026-10-02',
    titulo: 'O relógio para quando você sai da mesa',
    itens: [
      {
        tipo: 'corrigido',
        texto: 'A duração da partida contava tempo de parede: sair para as '
          + 'estatísticas, bloquear o celular ou fechar o app somava tudo '
          + 'aquilo à partida — e, ao passar a vez, ao turno de quem estava '
          + 'jogando. Fechar o app à noite e voltar no dia seguinte produzia '
          + 'uma partida de catorze horas.',
      },
      {
        tipo: 'novo',
        texto: 'Agora o relógio para sozinho quando ninguém está na mesa, e '
          + 'volta a andar quando você volta. Sem pedir nada e sem a cobertura '
          + 'da pausa manual: pausa que você não pediu não deve exigir que '
          + 'você a desfaça.',
      },
      {
        tipo: 'mudou',
        texto: 'Fechar o app é melhor esforço. Um encerramento forçado pelo '
          + 'sistema pode não avisar o app, e aí aquele tempo conta — não há '
          + 'aviso que o navegador garanta. Pausar antes continua sendo o '
          + 'jeito certo para uma parada longa.',
      },
    ],
  },
  {
    versao: '1.3.0',
    data: '2026-10-02',
    titulo: 'A vida conta na sua frente',
    itens: [
      {
        tipo: 'novo',
        texto: 'Quando o dano vem de um painel, a vida do alvo conta até o '
          + 'novo valor em vez de pular. Vale para dano por arraste, dano em '
          + 'todos, dreno (os oponentes descem e quem drenou sobe) e cura. '
          + 'Antes o número trocava de uma vez e nada dizia que algo tinha '
          + 'acontecido — e é justamente quando o dano foi grande que isso '
          + 'importa.',
      },
      {
        tipo: 'mudou',
        texto: 'A cor marca a direção enquanto o número anda: de longe, no '
          + 'meio da mesa, ele sozinho não diz se subiu ou caiu antes de '
          + 'parar.',
      },
      {
        tipo: 'mudou',
        texto: 'A borda do painel e os botões −/+ continuam respondendo na '
          + 'hora, sem contar: ali o número já anda a cada toque. E quem pede '
          + 'menos movimento no sistema recebe o número de uma vez.',
      },
    ],
  },
  {
    versao: '1.2.3',
    data: '2026-10-02',
    titulo: 'A partida volta a encerrar',
    itens: [
      {
        tipo: 'corrigido',
        texto: 'A partida não encerrava sozinha quando sobrava um jogador '
          + 'vivo: o cartaz de vitória simplesmente não aparecia. E declarar '
          + 'o vencedor pelo menu não fazia nada — o item existia, estava '
          + 'habilitado, e tocar nele não produzia efeito.',
      },
      {
        tipo: 'corrigido',
        texto: 'Eram o mesmo defeito, vindo da reorganização interna da '
          + 'versão 1.2.0: um trecho de código ficou no lugar errado e deixou '
          + 'inalcançável a parte que liga o cartaz de vitória e a escolha de '
          + 'vencedor à mesa.',
      },
    ],
  },
  {
    versao: '1.2.2',
    data: '2026-10-01',
    titulo: 'A rolagem das estatísticas de volta',
    itens: [
      {
        tipo: 'corrigido',
        texto: 'A lista de estatísticas e de partidas rolava e voltava '
          + 'instantaneamente para o topo. A causa era um ajuste de viewport '
          + 'que entrou na versão anterior para resolver o teclado: ele mudava '
          + 'o layout da página durante a rolagem. O conserto do teclado '
          + 'continua, por outro caminho que não encosta no layout.',
      },
      {
        tipo: 'corrigido',
        texto: 'Os painéis subiam um pedaço sem motivo quando a barra de '
          + 'endereço do navegador estava visível — ela era confundida com o '
          + 'teclado.',
      },
    ],
  },
  {
    versao: '1.2.1',
    data: '2026-10-01',
    titulo: 'Segurar também nos botões do painel',
    itens: [
      {
        tipo: 'novo',
        texto: 'Segurar −1 ou +1 no painel do jogador agora repete, '
          + 'acelerando — é onde se corrige dano e cura próprios. A versão '
          + 'anterior trouxe isso só para as bordas do painel na mesa; '
          + 'dentro do painel continuava pedindo um toque por ponto.',
      },
      {
        tipo: 'mudou',
        texto: 'O ajuste de vida pelo painel passou a entrar como um evento '
          + 'só, igual ao da borda. Antes era um evento por toque, então '
          + 'desfazer voltava ponto por ponto.',
      },
      {
        tipo: 'mudou',
        texto: 'Os passos de 5 continuam só no toque. Segurar na cadência '
          + 'acelerada seriam noventa pontos por segundo, e o alvo passaria '
          + 'sempre.',
      },
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-10-01',
    titulo: 'A mesma pessoa, um histórico só',
    itens: [
      {
        tipo: 'mudou',
        texto: 'Quem tem conta passou a aparecer pelo @ em toda tela — nas '
          + 'estatísticas, nas rivalidades e na escolha do jogador. O nome '
          + 'digitado continua guardado e aparece no detalhe da partida, como '
          + '"registrado como". O @ é o único nome que significa a mesma '
          + 'coisa em todo aparelho.',
      },
      {
        tipo: 'mudou',
        texto: 'A lista de jogadores passou a ser de pessoas, e não dos nomes '
          + 'digitados. Quem foi cadastrado como "Alex" numa quinta e '
          + '"Alexandre" na outra aparecia duas vezes, cada linha com metade '
          + 'dos decks.',
      },
      {
        tipo: 'novo',
        texto: 'Ligar alguém a uma conta agora junta o histórico INTEIRO dela, '
          + 'e não só a partida que você estava olhando. Dá para fazer isso '
          + 'direto na aba de Jogadores, que é onde o problema aparece: duas '
          + 'linhas que são a mesma pessoa.',
      },
      {
        tipo: 'novo',
        texto: 'Quando um aparelho marca a conta de alguém, o outro aprende '
          + 'sozinho ao sincronizar — e as partidas dele com aquela pessoa '
          + 'convergem sem ninguém marcar de novo. Só de partida sua ou de '
          + 'anfitrião que você confiou.',
      },
      {
        tipo: 'novo',
        texto: 'Segurar na borda do painel agora tira ou põe vida '
          + 'repetidamente, acelerando: 40 a 0 em cerca de três segundos, em '
          + 'vez de quarenta toques. Toda a seguradinha entra como um evento '
          + 'só, então desfazer volta tudo num toque. Segurar parado na borda '
          + 'deixou de armar ataque — arrastar dela e segurar no centro '
          + 'continuam armando.',
      },
      {
        tipo: 'corrigido',
        texto: 'O painel ficava atrás do teclado do celular ao procurar um @: '
          + 'dava para digitar sem ver o que se digitava.',
      },
      {
        tipo: 'corrigido',
        texto: 'Ocultar um jogador se desfazia sozinho quando a pessoa ganhava '
          + 'conta — a linha oculta reaparecia na abertura seguinte.',
      },
      {
        tipo: 'mudou',
        texto: 'Nada visível por fora, mas por dentro o app foi reorganizado: '
          + 'de 23 arquivos para 104, uma pasta por assunto. Serve para o que '
          + 'vem depois sair mais rápido e quebrar menos.',
      },
    ],
  },
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
          + 'tocasse em "Prisoner\’s Dilemma" e depois escolhesse outro tipo '
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
