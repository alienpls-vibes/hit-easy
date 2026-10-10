/**
 * What changed in each version.
 *
 * Single source: this is both the repository changelog and the app's "what's
 * new" screen. A separate text file would drift from what the app shows the
 * first time someone was in a hurry - and wrong release notes are worse than
 * none.
 *
 * `type` is one of: 'new', 'fixed', 'changed'. The split matters because the
 * three tell users different things: one asks them to try something, one
 * apologizes, and the third warns that something that used to work now works
 * differently.
 *
 * The note text stays in Portuguese, because it is what users read. Translating
 * release notes on every release is recurring work nobody keeps up, and stale
 * notes in three languages mislead more than they inform. To translate an
 * entry, replace the string with an object: { pt: '...', en: '...' }.
 *
 * The newest version comes first. check-syntax.js requires the current app
 * version to have an entry here - publishing without writing the notes breaks
 * the build.
 */

export const RELEASE_NOTES = [
  {
    version: '1.9.0',
    date: '2026-10-10',
    title: 'Mesa por código, seu nome nas partidas e lifelink',
    items: [
      {
        type: 'new',
        text: 'Passar a mesa agora gera um código de seis letras: quem vai '
          + 'continuar toca em "Receber uma mesa" e digita, ou toca no link '
          + 'que vai junto na mensagem. Acabou o arquivo que não abria no '
          + 'WhatsApp. Vale por 24 horas, uma vez só, e quem passou vê quando '
          + 'chegou. Sem internet, o arquivo continua funcionando.',
      },
      {
        type: 'new',
        text: 'O teclado de dano ganhou a marca Lifelink: ligada, quem causou '
          + 'o dano ganha a mesma vida. Desfazer volta as duas coisas juntas.',
      },
      {
        type: 'new',
        text: 'O duplo toque agora oferece três ações: dano em todos os '
          + 'jogadores (inclusive você), dano só nos oponentes, e dreno.',
      },
      {
        type: 'new',
        text: 'No iPhone e no iPad, o botão de instalar aparece na tela '
          + 'inicial e mostra onde tocar no Safari. Antes a explicação ficava '
          + 'escondida nas configurações.',
      },
      {
        type: 'new',
        text: 'Escolha como você aparece nas partidas: em Configurações → '
          + 'Conta, o nome nas partidas aceita maiúsculas, acentos e o que '
          + 'mais quiser. Ele aparece na mesa, no card de vitória, nas '
          + 'votações e nas estatísticas - o @ continua sendo como os amigos '
          + 'acham você.',
      },
      {
        type: 'changed',
        text: 'Na escolha de jogador, todo mundo aparece pelo nome; o @ fica só '
          + 'na busca por @, que agora lista quem já foi marcado neste '
          + 'aparelho - um toque, sem digitar o @ inteiro.',
      },
      {
        type: 'changed',
        text: 'Todo @ que você já usou continua seu: ao trocar, o antigo não '
          + 'fica livre para outra pessoa, e quem marcar ele ainda acha você. '
          + 'O @ pode mudar uma vez a cada 15 dias, e nas estatísticas as '
          + 'partidas com o @ antigo continuam contando para a mesma pessoa.',
      },
      {
        type: 'fixed',
        text: 'Conferir o próprio @ dizia que ele estava livre. Agora diz que '
          + 'já é seu.',
      },
      {
        type: 'changed',
        text: 'As configurações foram reorganizadas em grupos - Aparência, '
          + 'Na mesa e Aplicativo -, com menos texto. A conta virou uma linha '
          + 'que abre a própria tela.',
      },
      {
        type: 'changed',
        text: 'O jogador 1 senta no alto à esquerda, e a vez segue no '
          + 'sentido horário. Com 2, 3 e 5 jogadores a mesa deitada passou a '
          + 'ser o padrão. Partidas que já estavam abertas continuam como '
          + 'começaram.',
      },
      {
        type: 'changed',
        text: 'Os teclados de dano começam no 0.',
      },
      {
        type: 'fixed',
        text: 'Depois de entrar na conta, os botões podiam começar a piscar '
          + 'sob o mouse e parar de responder, e os filtros das estatísticas '
          + 'quebravam. A tela da conta se redesenhava sem parar, buscando '
          + 'os convites na internet a cada volta.',
      },
      {
        type: 'fixed',
        text: 'Sair do app e voltar no meio da partida deixava a tela em pé. '
          + 'Agora o primeiro toque devolve a mesa deitada.',
      },
      {
        type: 'fixed',
        text: 'Encostar no + ou no − e sair arrastando agora arma o ataque, '
          + 'sem tirar nem pôr vida no caminho.',
      },
      {
        type: 'fixed',
        text: 'No iPhone, segurar um botão para subir rápido selecionava o '
          + 'botão em vez de repetir.',
      },
      {
        type: 'fixed',
        text: 'No iPhone, a tela começava a apagar sozinha no meio da '
          + 'partida depois de bloquear o celular ou trocar de app. Agora o '
          + 'primeiro toque na mesa volta a mantê-la acesa.',
      },
      {
        type: 'new',
        text: 'Aberto no Safari do iPhone, a mesa avisa que tela cheia só '
          + 'existe com o app instalado, e leva ao passo a passo.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-02',
    title: 'Passar a mesa, e convite uma vez só',
    items: [
      {
        type: 'new',
        text: 'Acabando a bateria no meio do jogo? Dá para passar a mesa '
          + 'para o celular de alguém da partida: ela vira um arquivo, você '
          + 'envia, e o jogo continua de onde parou. Ninguém precisa de conta '
          + 'e não precisa de internet.',
      },
      {
        type: 'changed',
        text: 'Quem já jogou uma partida com você passa a entrar sozinho nas '
          + 'próximas: o convite não precisa mais ser aceito toda vez. Dá '
          + 'para desfazer em qualquer convite, com "nunca aceitar desta '
          + 'pessoa".',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-02',
    title: 'Ordenar as listas, e o teste fora do histórico real',
    items: [
      {
        type: 'new',
        text: 'As abas de Decks e de Jogadores ganharam um seletor de ordem: '
          + 'partidas, vitórias, taxa de vitória, dano causado, '
          + 'eliminações e melhor colocação.',
      },
      {
        type: 'fixed',
        text: 'As partidas jogadas na versão de teste subiam para a mesma '
          + 'base da versão de verdade e voltavam no histórico dela, contando '
          + 'nas estatísticas. Agora cada canal só vê o que foi jogado nele.',
      },
      {
        type: 'fixed',
        text: 'Uma cadeira marcada com o @ de alguém numa mesa de teste '
          + 'virava convite de verdade para aquela pessoa. Não vira mais.',
      },
      {
        type: 'changed',
        text: 'Esta tela passa a mostrar só o que entrou desde a versão '
          + 'em que o app estava. O histórico inteiro continua a um toque, '
          + 'no fim da lista.',
      },
      {
        type: 'changed',
        text: 'O botão de atualizar o app mostra um girador enquanto busca '
          + 'a versão nova. Antes ele só escurecia, e a espera de até dez '
          + 'segundos parecia um botão que não funcionou.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-02',
    title: 'Seus decks seguem a sua conta',
    items: [
      {
        type: 'new',
        text: 'Os decks de quem está logado passam a acompanhar a conta. '
          + 'Num aparelho novo eles já aparecem na escolha do deck, em vez de '
          + 'obrigar a buscar na Scryfall o comandante que o app já conhece.',
      },
      {
        type: 'changed',
        text: 'São só os seus, e são privados: o app deixa cada pessoa '
          + 'escrever apenas no próprio perfil, e a busca por @ não revela o '
          + 'que alguém joga.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-02',
    title: 'Filtrar os decks por jogador',
    items: [
      {
        type: 'new',
        text: 'A aba de Decks ganhou um filtro por jogador. "Todos" é o '
          + 'padrão e mostra o que sempre mostrou: todos os decks jogados '
          + 'neste aparelho. Escolhendo alguém, a lista fica só com os decks '
          + 'que aquela pessoa levou.',
      },
      {
        type: 'changed',
        text: 'O filtro só aparece quando há mais de uma pessoa no '
          + 'histórico: filtrar entre um não filtra nada.',
      },
    ],
  },
  {
    version: '1.4.1',
    date: '2026-10-02',
    title: 'O voltar do aparelho não fecha mais o app',
    items: [
      {
        type: 'fixed',
        text: 'Nas estatísticas, o botão de voltar do aparelho fechava o '
          + 'app em vez de voltar uma tela. Agora leva para onde a flecha da '
          + 'tela leva — a tela inicial, no caminho normal.',
      },
      {
        type: 'changed',
        text: 'Com um painel aberto, o voltar fecha o painel em vez de '
          + 'navegar. Antes de existir esse voltar, o gesto saía do app com a '
          + 'folha de pé.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-02',
    title: 'O relógio para quando você sai da mesa',
    items: [
      {
        type: 'fixed',
        text: 'A duração da partida contava tempo de parede: sair para as '
          + 'estatísticas, bloquear o celular ou fechar o app somava tudo '
          + 'aquilo à partida — e, ao passar a vez, ao turno de quem estava '
          + 'jogando. Fechar o app à noite e voltar no dia seguinte produzia '
          + 'uma partida de catorze horas.',
      },
      {
        type: 'new',
        text: 'Agora o relógio para sozinho quando ninguém está na mesa, e '
          + 'volta a andar quando você volta. Sem pedir nada e sem a cobertura '
          + 'da pausa manual: pausa que você não pediu não deve exigir que '
          + 'você a desfaça.',
      },
      {
        type: 'changed',
        text: 'Fechar o app é melhor esforço. Um encerramento forçado pelo '
          + 'sistema pode não avisar o app, e aí aquele tempo conta — não há '
          + 'aviso que o navegador garanta. Pausar antes continua sendo o '
          + 'jeito certo para uma parada longa.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-02',
    title: 'A vida conta na sua frente',
    items: [
      {
        type: 'new',
        text: 'Quando o dano vem de um painel, a vida do alvo conta até o '
          + 'novo valor em vez de pular. Vale para dano por arraste, dano em '
          + 'todos, dreno (os oponentes descem e quem drenou sobe) e cura. '
          + 'Antes o número trocava de uma vez e nada dizia que algo tinha '
          + 'acontecido — e é justamente quando o dano foi grande que isso '
          + 'importa.',
      },
      {
        type: 'changed',
        text: 'A cor marca a direção enquanto o número anda: de longe, no '
          + 'meio da mesa, ele sozinho não diz se subiu ou caiu antes de '
          + 'parar.',
      },
      {
        type: 'changed',
        text: 'A borda do painel e os botões −/+ continuam respondendo na '
          + 'hora, sem contar: ali o número já anda a cada toque. E quem pede '
          + 'menos movimento no sistema recebe o número de uma vez.',
      },
    ],
  },
  {
    version: '1.2.3',
    date: '2026-10-02',
    title: 'A partida volta a encerrar',
    items: [
      {
        type: 'fixed',
        text: 'A partida não encerrava sozinha quando sobrava um jogador '
          + 'vivo: o cartaz de vitória simplesmente não aparecia. E declarar '
          + 'o vencedor pelo menu não fazia nada — o item existia, estava '
          + 'habilitado, e tocar nele não produzia efeito.',
      },
      {
        type: 'fixed',
        text: 'Eram o mesmo defeito, vindo da reorganização interna da '
          + 'versão 1.2.0: um trecho de código ficou no lugar errado e deixou '
          + 'inalcançável a parte que liga o cartaz de vitória e a escolha de '
          + 'vencedor à mesa.',
      },
    ],
  },
  {
    version: '1.2.2',
    date: '2026-10-01',
    title: 'A rolagem das estatísticas de volta',
    items: [
      {
        type: 'fixed',
        text: 'A lista de estatísticas e de partidas rolava e voltava '
          + 'instantaneamente para o topo. A causa era um ajuste de viewport '
          + 'que entrou na versão anterior para resolver o teclado: ele mudava '
          + 'o layout da página durante a rolagem. O conserto do teclado '
          + 'continua, por outro caminho que não encosta no layout.',
      },
      {
        type: 'fixed',
        text: 'Os painéis subiam um pedaço sem motivo quando a barra de '
          + 'endereço do navegador estava visível — ela era confundida com o '
          + 'teclado.',
      },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-10-01',
    title: 'Segurar também nos botões do painel',
    items: [
      {
        type: 'new',
        text: 'Segurar −1 ou +1 no painel do jogador agora repete, '
          + 'acelerando — é onde se corrige dano e cura próprios. A versão '
          + 'anterior trouxe isso só para as bordas do painel na mesa; '
          + 'dentro do painel continuava pedindo um toque por ponto.',
      },
      {
        type: 'changed',
        text: 'O ajuste de vida pelo painel passou a entrar como um evento '
          + 'só, igual ao da borda. Antes era um evento por toque, então '
          + 'desfazer voltava ponto por ponto.',
      },
      {
        type: 'changed',
        text: 'Os passos de 5 continuam só no toque. Segurar na cadência '
          + 'acelerada seriam noventa pontos por segundo, e o alvo passaria '
          + 'sempre.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-01',
    title: 'A mesma pessoa, um histórico só',
    items: [
      {
        type: 'changed',
        text: 'Quem tem conta passou a aparecer pelo @ em toda tela — nas '
          + 'estatísticas, nas rivalidades e na escolha do jogador. O nome '
          + 'digitado continua guardado e aparece no detalhe da partida, como '
          + '"registrado como". O @ é o único nome que significa a mesma '
          + 'coisa em todo aparelho.',
      },
      {
        type: 'changed',
        text: 'A lista de jogadores passou a ser de pessoas, e não dos nomes '
          + 'digitados. Quem foi cadastrado como "Alex" numa quinta e '
          + '"Alexandre" na outra aparecia duas vezes, cada linha com metade '
          + 'dos decks.',
      },
      {
        type: 'new',
        text: 'Ligar alguém a uma conta agora junta o histórico INTEIRO dela, '
          + 'e não só a partida que você estava olhando. Dá para fazer isso '
          + 'direto na aba de Jogadores, que é onde o problema aparece: duas '
          + 'linhas que são a mesma pessoa.',
      },
      {
        type: 'new',
        text: 'Quando um aparelho marca a conta de alguém, o outro aprende '
          + 'sozinho ao sincronizar — e as partidas dele com aquela pessoa '
          + 'convergem sem ninguém marcar de novo. Só de partida sua ou de '
          + 'anfitrião que você confiou.',
      },
      {
        type: 'new',
        text: 'Segurar na borda do painel agora tira ou põe vida '
          + 'repetidamente, acelerando: 40 a 0 em cerca de três segundos, em '
          + 'vez de quarenta toques. Toda a seguradinha entra como um evento '
          + 'só, então desfazer volta tudo num toque. Segurar parado na borda '
          + 'deixou de armar ataque — arrastar dela e segurar no centro '
          + 'continuam armando.',
      },
      {
        type: 'fixed',
        text: 'O painel ficava atrás do teclado do celular ao procurar um @: '
          + 'dava para digitar sem ver o que se digitava.',
      },
      {
        type: 'fixed',
        text: 'Ocultar um jogador se desfazia sozinho quando a pessoa ganhava '
          + 'conta — a linha oculta reaparecia na abertura seguinte.',
      },
      {
        type: 'changed',
        text: 'Nada visível por fora, mas por dentro o app foi reorganizado: '
          + 'de 23 arquivos para 104, uma pasta por assunto. Serve para o que '
          + 'vem depois sair mais rápido e quebrar menos.',
      },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-28',
    title: 'Colocação no idioma certo',
    items: [
      {
        type: 'fixed',
        text: 'A colocação aparecia com a marca do português em qualquer '
          + 'idioma — "1º" também para quem usa o app em inglês ou alemão. '
          + 'Agora sai 1st, 2nd, 3rd em inglês e 1., 2., 3. em alemão.',
      },
      {
        type: 'fixed',
        text: 'Em inglês o texto era pior que a marca: a tradução produzia '
          + '"1th place" e "2th place".',
      },
      {
        type: 'changed',
        text: 'A colocação média deixou de levar marca de ordinal. Uma média '
          + 'de 2,3 não é uma colocação, e o rótulo ao lado já diz o que é.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-28',
    title: 'Conta, nuvem e estatísticas por pessoa',
    items: [
      {
        type: 'changed',
        text: 'As estatísticas passaram a exigir assinatura. Jogar, registrar '
          + 'partidas e usar a mesa continuam livres — só a leitura do '
          + 'histórico é paga. Suas partidas antigas continuam guardadas.',
      },
      {
        type: 'new',
        text: 'Conta com e-mail e senha. O histórico acompanha você entre '
          + 'aparelhos, e a sessão se renova sozinha em vez de expirar em uma '
          + 'hora. Criar conta é opcional: sem ela, nada sai do seu aparelho.',
      },
      {
        type: 'new',
        text: 'Cada pessoa pode escolher um @. Quem organiza a mesa marca as '
          + 'cadeiras, e a partida chega para cada um como convite — que só '
          + 'entra no histórico de quem aceitar. Ninguém escreve no histórico '
          + 'alheio.',
      },
      {
        type: 'fixed',
        text: 'A estatística confundia a mesma pessoa cadastrada com nomes '
          + 'diferentes. "Alex" numa noite e "Alexandre" na outra viravam duas '
          + 'pessoas, com duas histórias e duas rivalidades pela metade. Agora '
          + 'quem tem conta é reconhecido pela conta.',
      },
      {
        type: 'changed',
        text: 'Mesas de 2, 3 e 5 jogadores agora perguntam como o aparelho '
          + 'fica na mesa — em pé ou deitado — em vez de descrever o arranjo. '
          + 'Era essa a decisão de verdade o tempo todo.',
      },
      {
        type: 'fixed',
        text: 'No computador, os painéis dos jogadores de cima apareciam de '
          + 'cabeça para baixo. Deitado na mesa o giro é o certo; num monitor '
          + 'de pé não há ninguém do outro lado.',
      },
      {
        type: 'fixed',
        text: 'Quem morre no mesmo turno agora divide a colocação. Se alguém '
          + 'estoura a mesa inteira de uma vez, os três ficam em último — '
          + 'porque nenhum deles sobreviveu ao outro.',
      },
      {
        type: 'fixed',
        text: 'O título de uma votação grudava ao trocar de modelo. Quem '
          + 'tocasse em "Prisoner\’s Dilemma" e depois escolhesse outro tipo '
          + 'registrava um dilema que nunca aconteceu.',
      },
      {
        type: 'changed',
        text: 'As estatísticas de votação agrupam pelo TIPO da votação, e não '
          + 'pela pergunta escrita. A pergunta muda toda noite; o que interessa '
          + 'é se aquela pessoa costuma delatar.',
      },
      {
        type: 'new',
        text: 'A aba de rivalidades passou a comparar um par por vez, '
          + 'escolhido em dois campos. Cinco jogadores davam dez cartões, e a '
          + 'comparação que interessava ficava perdida no meio.',
      },
      {
        type: 'fixed',
        text: 'Não é mais possível colocar a mesma pessoa em duas cadeiras. '
          + 'Havia meia trava: a lista de salvos barrava, digitar o nome na mão '
          + 'não.',
      },
      {
        type: 'fixed',
        text: 'O botão de instalar aparecia só às vezes, sem padrão. Era uma '
          + 'corrida com o navegador, e agora o convite é capturado antes de o '
          + 'aplicativo carregar.',
      },
      {
        type: 'new',
        text: 'Quem tem o app instalado ganhou um botão de atualizar, e a '
          + 'versão aparece no rodapé das configurações.',
      },
      {
        type: 'new',
        text: 'Política de privacidade, com o que é guardado, onde, e como '
          + 'apagar. Apagar nunca depende de assinatura.',
      },
    ],
  },
];

/** Only what the user has not seen yet. An unknown version returns everything. */
export function releaseNotesSince(seenBefore) {
  if (!seenBefore) return RELEASE_NOTES;
  const at = RELEASE_NOTES.findIndex((n) => n.version === seenBefore);
  return at < 0 ? RELEASE_NOTES : RELEASE_NOTES.slice(0, at);
}

/** The notes for this version, if any. */
export function releaseNotesFor(version) {
  return RELEASE_NOTES.find((n) => n.version === version) || null;
}
