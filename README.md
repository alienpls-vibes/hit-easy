# Hit Easy

**commander made simple**

Contador de vida para mesas de Commander, com estatísticas amarradas ao deck.
PWA instalável, funciona offline, sem build e sem dependências — só módulos ES
nativos.

## Rodar

```bash
python servir.py
```

Abre em `http://localhost:8000/`. Módulos ES não carregam por duplo clique
(`file://` é bloqueado por CORS), então o servidor é necessário mesmo local.

O servidor é de **pilha dupla (IPv6 + IPv4)** e com uma thread por conexão, e
isso não é detalhe. No Windows `localhost` resolve para `::1` antes de
`127.0.0.1`; escutando só em IPv4, o navegador tenta IPv6, espera ~2 s o timeout
e só então cai no IPv4 — **a cada arquivo**. Com ~20 módulos, meio minuto por
recarga. Medido: 38,5 s para carregar tudo antes, 0,22 s depois.

Se a porta já estiver ocupada, o script **recusa subir** e diz como resolver.
Isso é de propósito: no Windows, `SO_REUSEADDR` não significa "reaproveite a
porta em TIME_WAIT" como no Linux — ele deixa **dois** processos escutarem a
mesma porta, e o sistema entrega a conexão a qualquer um dos dois. Com um
servidor antigo travado, o novo sobe "com sucesso", o navegador cai no morto e a
página nunca carrega.

O IP da rede **muda** quando a máquina troca de Wi-Fi ou renova o DHCP. Se o
celular parou de abrir, rode `python servir.py` de novo e use o IP que ele
imprime.

O script também imprime o IP da máquina na rede, para abrir do celular.
Pelo IP o app funciona, mas **não instala como PWA**: navegador só registra
service worker em `https://` ou `localhost`. Para instalar de verdade no
celular, publique a pasta em qualquer host estático (GitHub Pages, Netlify,
Vercel) — não há passo de build, é subir os arquivos.

## Publicar

O app é estático — sem build, sem servidor, sem banco. Publicar é copiar a pasta
para qualquer hospedagem de arquivos. **Todos os caminhos são relativos**, então
ele funciona tanto na raiz de um domínio quanto numa subpasta
(`usuario.github.io/hit-easy/`), que é como as hospedagens gratuitas servem.

**HTTPS não é opcional:** service worker e instalação como app só funcionam em
`https://` ou `localhost`. Toda opção abaixo já dá HTTPS.

### GitHub Pages (recomendado)

```bash
git init -b main
git add .
git commit -m "Hit Easy"
git remote add origin https://github.com/SEU-USUARIO/hit-easy.git
git push -u origin main
```

Depois, no repositório: **Settings → Pages → Source: Deploy from a branch →
`main` / `(root)`**. Em cerca de um minuto o app está em
`https://SEU-USUARIO.github.io/hit-easy/`.

Publicar de novo depois de mudar algo é `git add . && git commit -m "..." &&
git push` — o Pages atualiza sozinho.

### Alternativa sem git

Netlify, Cloudflare Pages e Vercel aceitam arrastar a pasta pelo site e
devolvem uma URL HTTPS na hora. Bom para testar rápido; para manter, o git
compensa por causa do histórico.

### O que os dados NÃO fazem

Cada aparelho guarda o histórico no próprio navegador (`localStorage`). Publicar
deixa o **app** disponível em todo lugar, mas **as partidas não se sincronizam**
entre celular, tablet e computador — cada um tem as suas.

Para levar dados de um para o outro, use **Estatísticas → menu → Exportar JSON**
e **Importar JSON** no destino (a importação junta com o histórico existente, sem
duplicar). Sincronização de verdade exigiria um servidor com contas e banco, o
que muda a natureza do projeto e deixa de ser gratuito.

## Como se usa

**Montar a mesa.** Vida inicial, de 2 a 6 jogadores, e um comandante por
assento.

Tocar no nome abre um fluxo de duas telas que desliza de lado: primeiro **quem
joga** — a lista de quem já jogou neste aparelho, ou um nome novo — e, escolhido
o jogador, direto para **o deck dele**. Quem já está sentado vai para o fim da
lista, sob o rótulo *Já estão na mesa*: a lista existe para achar quem ainda
**não** sentou, e nomes inclicáveis no meio do caminho atrapalham a mira. Ali o seletor mostra primeiro os decks
que aquela pessoa já levou, depois os demais usados no aparelho, e só então a
busca na Scryfall. Na prática a galera repete deck, então quase sempre a escolha
está na primeira linha, e isso funciona sem internet. A seta no topo (ou
arrastar a tela para a direita) volta um passo.

Arrastar pela alça reordena os jogadores, e **a ordem da lista é a ordem dos
turnos** — o número no canto de cada cartão mostra a posição.

Quem tem parceiro adiciona o segundo. A partida só começa com todo assento
preenchido, porque é o comandante que amarra a estatística ao deck.

**Antes de começar.** O botão abre uma última tela com duas escolhas:

- **quem abre a partida** — qualquer jogador, ou *Sortear*, que é o padrão
  porque é assim que a mesa decide de verdade (o sorteio roda no Começar, então
  dá resultado novo a cada vez);
- **o layout da mesa**, quando há mais de um arranjo possível — só em mesas de
  3 e de 5, onde não existe disposição óbvia. A miniatura mostra o arranjo com a
  ordem dos turnos numerada.

Cada cartão traz uma **miniatura da mesa com a cadeira daquele jogador acesa**.
A ordem da lista já diz a ordem dos turnos; a miniatura diz o *lugar* — que é o
que falta quando são 5 ou 6 pessoas em volta.

Quem abre não precisa ser o primeiro da lista: a mesa física é uma coisa, quem
ganhou o dado é outra. A volta da mesa fecha ao voltar em quem começou — e
continua fechando certo mesmo depois que essa pessoa é eliminada.

**Jogar.** O painel inteiro é área de gesto, e a **duração** do toque decide o
que ele é:

| gesto | o que faz |
|---|---|
| toque rápido na borda esquerda | tira 1 de vida, sem autor |
| toque rápido na borda direita | põe 1 de vida |
| **segurar na borda** | tira ou põe repetidamente, acelerando |
| toque rápido no centro | abre o painel do jogador |
| **duplo toque no centro** | ação em área: dano em todos, ou dreno |
| **segurar no centro, ou arrastar** | arma o ataque — a única saída é causar dano |

Nas bordas, segurar repete — mesma gramática do marcador de mana, onde segurar
também repete. Começa depois de 380 ms, em passos de 110 ms, e acelera para
55 ms depois de oito passos: quem vai de 40 a 12 não devia precisar de vinte e
oito toques. Abaixo desses 380 ms nada mudou — um toque lento continua valendo
exatamente 1.

Por isso **segurar parado na borda não arma mais o ataque**. Arrastar da borda
arma (a direção do gesto é a declaração de autoria, e ela continua ali), e
segurar no centro arma — nenhum ataque ficou inalcançável, só mudou de onde se
começa segurando parado.

Segurar aplica enquanto o dedo está em cima, e isso reabre uma porta que o
desenho anterior tinha fechado: antes nada era aplicado ao encostar — a vida só
mudava quando o dedo **soltava** —, e o dedo que demora na borda não tirava
vida junto. O que mantém o erro barato é a coalescência que já existia: a
seguradinha inteira entra como **um** evento, então um toque em *desfazer* volta
os vinte e oito pontos de uma vez, e não um por um. O número no painel mostra o
resultado antes de o evento existir, senão segurar pareceria travado.

Toques rápidos seguidos se juntam num evento só depois de ~0,9s — sete toques
viram uma linha no histórico, não sete. O círculo central mostra o turno e passa
a vez; ao lado ficam desfazer e menu. Ele é grande de propósito: passar o turno
é a ação mais repetida da partida, muitas vezes com a mão ocupada.

**Pausar.** No menu da partida. Enquanto pausada, a mesa fica coberta e não
aceita toque — uma pausa que deixa mexer no placar com o relógio parado não é
pausa. O tempo parado **não entra em lugar nenhum**: sai da duração da partida e
do tempo de turno de quem estava jogando. Ida ao banheiro não vira "o turno mais
longo da noite" na estatística.

**E o relógio para sozinho quando ninguém está na mesa.** Sair para as
estatísticas ou para a home, trocar de app, bloquear o celular, fechar o app —
tudo isso para a contagem, e voltar retoma. Sem pedir, e sem a cobertura da
pausa manual: pausa que ninguém pediu não deve exigir que alguém a desfaça.

Antes a duração era tempo de **parede** (`agora − startedAt − pausas`), então
fechar o app por oito horas somava oito horas à partida — e, ao passar a vez,
ao turno de quem estava jogando.

O período fora da mesa é guardado **ao lado** do log, não dentro dele, como o
mana já faz. Dois motivos, e os dois são sobre não estragar o que funciona:
`undo` tira o último evento qualquer que seja, então uma pausa automática
viraria o alvo do "desfazer" ao voltar; e `timeline()` desenha `pause` e
`resume`, então cada olhada nas estatísticas acrescentaria duas linhas ao
histórico daquela partida.

A concessão é que `replay` passa a ler um campo que não é evento — o log
sozinho deixa de determinar o tempo de turno. O **placar** continua saindo só
do log: nenhuma vida, contador ou colocação depende disso.

Fechar o app é melhor esforço: usa `pagehide`, e um encerramento forçado pelo
sistema pode não disparar nada. Nesse caso aquele tempo conta — não há evento
que o navegador garanta. Mas o período fica gravado **aberto**, então se o
`pagehide` rodar, o arranque seguinte fecha a conta e desconta tudo.

## Marcador de mana

No menu da partida. Uma peça por cor (WUBRG + incolor), e cada uma é um painel
de vida em miniatura: metade esquerda tira, metade direita põe, segurar repete.
Mesma gramática da mesa, nada novo para aprender.

A mesa também segura para repetir, nas bordas do painel, então a gramática é
a mesma nos dois sentidos.

**Zera ao passar a vez** — é mana flutuante, não recurso permanente. Enquanto
houver mana marcada, aparece um **atalho no núcleo central**, ao lado do menu,
mostrando o total. Ele faz dois trabalhos: lembra que sobrou mana antes de
passar a vez, e leva direto ao contador — que é o caminho de ida e volta o tempo
todo quando se gasta parte da mana, resolve a magia e volta para acertar o
resto. Some sozinho quando o pote esvazia.

Não entra no log de eventos, e isso é decisão e não esquecimento: mana é
efêmera e não diz nada sobre a partida depois. Cada toque viraria uma linha no
histórico e sujaria as estatísticas para sempre. Fica guardada junto da partida,
fora dos eventos, então sobrevive a recarregar o navegador no meio do turno —
mas `replay` a ignora por completo, e o placar continua saindo só do log.

## Ações em área

Duplo toque no centro do painel de quem vai agir (ou o botão *Dano em todos ·
Dreno*, dentro do painel dele). Dois modos:

- **Dano em todos** — cada oponente vivo perde N.
- **Dreno** — cada oponente perde N e quem drenou ganha vida. As cartas usam
  duas leituras diferentes, então as duas estão ali: ganhar **o total** tirado
  (o caso Gray Merchant) ou ganhar **o mesmo tanto** que cada um perdeu.

**Orientação da votação.** No celular ela pede a tela **em pé** — o aparelho sai
do meio da mesa e vai para a mão de cada um. Em tablet e computador o pedido é
ignorado de propósito (girar um tablet apoiado seria pior) e o painel aparece
**centralizado**, em vez de colado na borda de baixo. Ao fechar, a mesa volta a
pedir paisagem.

Girar a tela remonta a mesa, e remontar fecharia o painel aberto — então, com
uma votação em curso, o redesenho **espera** ela terminar.

Vira **um** evento `sweep`, não um por alvo. Assim desfazer volta o dreno
inteiro num toque, e a linha do tempo conta a jogada como ela aconteceu — uma
coisa só — em vez de três linhas soltas. O evento guarda a lista de quem foi
atingido, então as estatísticas não precisam reconstruir quem estava vivo
naquele instante, e o histórico continua legível anos depois.

**A volta da mesa é horária**, vista de cima — que é o mesmo que passar a vez
para o vizinho da esquerda, já que todo mundo olha para o centro. Isso é dado
puro em `src/seating.js` e tem teste: o ângulo de cada assento em relação ao
centro precisa sempre crescer, e a volta fechar em exatamente 360°.

Eliminação é automática — vida ≤ 0, 21 de dano de um mesmo comandante ou 10 de
veneno. Sobrando um vivo, aparece o cartaz de vitória.

**Ver os dados.** Winrate por deck e por jogador, dano causado e recebido, cura,
eliminações, turnos, colocação média, tempo por turno. Quem já passou por uma
votação secreta ganha também um bloco **Escolhas em votações** — quantas vezes
escolheu Silence e quantas escolheu Snitch, por exemplo. Ele só aparece para
quem participou: um bloco vazio em todo cartão seria ruído, e a maioria dos
decks nunca encostou numa carta dessas. As escolhas ficam agrupadas por
pergunta, então "Silence" do Prisoner's Dilemma não se mistura com "Sim" de um
voto qualquer. Cada partida guarda a
linha do tempo completa. Exporta e importa JSON.

**Configurações** (engrenagem na home): tema, vibração, manter a tela acesa,
tela cheia na partida, reexibir a dica do arraste e **instalar o app**. Vida inicial e disposição da
mesa ficam de fora daqui de propósito — mudam a cada jogo, então vivem na home
e na tela de antes de começar.

## Motivo da vitória

Ao declarar um vencedor na mão (menu da partida), o app pergunta **como** ele
venceu: combate, comandante, combo, veneno, deck vazio, vitória alternativa,
concessão da mesa ou outro. O motivo é opcional — a mesa nem sempre concorda no
rótulo, e uma tela que não deixa sair seria pior que um dado faltando.

Vitória por último vivo **não** passa por aí e não inventa causa nenhuma, então
o bloco *Como venceu* só aparece para quem tem motivo registrado.

## Quem é quem

O nome é como a mesa chama alguém **naquele dia**. Não é quem a pessoa é. Quem
tem conta é identificado pelo **@**, que é o único rótulo que significa a mesma
coisa em todo aparelho — e é ele que aparece nas estatísticas, na seleção de
jogador e em toda tela. O nome digitado fica guardado na cadeira e reaparece no
detalhe da partida, como *registrado como Alexandre*.

**A lista de seleção é de pessoas, não de nomes.** Com os nomes crus, quem foi
cadastrado como "Alex" numa quinta e "Alexandre" na outra aparecia duas vezes,
cada linha com metade dos decks — e escolher uma ou outra decidia, sem avisar,
em qual metade a partida de hoje ia cair.

### O caso de dois aparelhos

O cenário que o desenho existe para resolver: dois aparelhos registraram a mesma
pessoa **sem** conta, cada um digitando um nome, e a associação vem depois.

Associar reescreve o **histórico inteiro**, não a cadeira que você estava
olhando: o `@` é gravado em toda partida local onde aquela pessoa aparece, e as
que já estavam na nuvem são reenviadas. A associação passa a estar no **dado**,
e não num mapa que só existe naquele aparelho — é isso que a faz viajar.

Do outro lado, ao baixar uma partida cuja cadeira tem nome **e** `@`, o aparelho
aprende sozinho que aquele nome é aquela conta, e as partidas **próprias** dele
convergem sem ninguém marcar nada de novo. Não há tabela nova para isso: o dado
já viajava, só não estava sendo lido.

Duas regras protegem esse aprendizado:

- **Só de partida sua, ou de anfitrião que você confiou.** Aprender de qualquer
  partida deixaria um anfitrião qualquer batizar gente no seu aparelho: bastaria
  sentar uma cadeira chamada "Alexandre" com o `@` dele para o seu histórico do
  Alexandre passar a somar na conta errada. É a mesma lista de confiança que já
  decide o aceite automático de convite.
- **O que chega nunca sobrescreve o que você decidiu.** Duas pessoas diferentes
  podem ter o mesmo nome em mesas diferentes. Divergência não se resolve
  adivinhando: fica como está, e você marca na mão se quiser.

Quando os aparelhos digitaram nomes **diferentes**, ainda é preciso dizer uma
vez por nome — o app não adivinha que "Alex" é "Alexandre" por semelhança de
texto, porque isso erraria com dois irmãos na mesma mesa. O conserto é feito
onde o problema aparece: na aba de **Jogadores** você vê duas linhas que são a
mesma pessoa e usa *Ligar a uma conta* ali. A partir do segundo nome, o app já
junta os dois — e alcança até as partidas que chegarem do outro aparelho
**depois** disso.

### O que ele se recusa a fazer

Três recusas, e cada uma evita um estrago diferente:

| situação | o que faz |
|---|---|
| a cadeira já tem outro `@` | não sobrescreve — decisão anterior manda |
| esse `@` já está em outra cadeira daquela mesa | não grava: poria a mesma pessoa duas vezes na mesma partida, e a estatística somaria o dano dela contra si |
| dois nomes do conjunto sentados na **mesma** mesa | não escolhe no chute; deixa a partida de fora e reporta |

Atribuir não é o mesmo que **convidar**. Gravar o `@` numa cadeira é uma
reivindicação do anfitrião; a partida só entra no histórico daquela pessoa
quando ela aceita. Ninguém pode ser autor do registro alheio — ver
`sql/002-participantes.sql`.

## Duas famílias de cor

O app usa cor em dois eixos diferentes, e misturá-los confundia:

- **identidade do comandante (WUBRG)** — identifica o *deck*. Vale na mesa e na
  aba de Decks.
- **cor por jogador** — identifica a *pessoa*. Vale nas abas de Jogadores e
  Rivalidades, onde o que se quer rastrear é quem, não com quê. O mesmo jogador
  troca de comandante e continua sendo ele — e, com conta vinculada, troca de
  nome e continua sendo ele também (ver *Quem é quem*).

A aba de **Partidas** fica sem cor nenhuma: a lista de colocações e a data já
dizem o que ela precisa dizer, e cor em cima disso virava enfeite.

A cor de cada pessoa vem da posição dela numa fila ordenada por **primeira
aparição no histórico**, espalhada pelo círculo cromático com o ângulo áureo
(137,5°) — assim cada nova cor cai no maior vão que sobrou e nunca se agrupam.
A ordem é por primeira aparição, e não alfabética, porque cadastrar uma "Ana"
mudaria a cor de todo mundo depois dela, e o ponto da cor é justamente
reconhecer a mesma pessoa entre partidas.

## O voltar do aparelho

Nas estatísticas, o voltar do sistema volta **dentro** do app. Antes fechava:
o app não tinha histórico de navegação nenhum — nenhum `pushState`, nenhum
`popstate` —, então o gesto não encontrava entrada para consumir, e PWA em tela
cheia sai. Justamente na tela onde o gesto é o mais natural.

Uma entrada é empilhada ao entrar nas estatísticas e consumida ao sair, **pela
flecha ou pelo gesto**. Os dois levam ao mesmo lugar, de propósito: duas coisas
na mesma tela que se chamam "voltar" não podem discordar. Na prática isso é a
home, que é de onde se abre as estatísticas; vindo da mesa, volta para a mesa.

**Painel aberto tem prioridade:** o voltar fecha o painel e devolve a entrada,
em vez de navegar por trás dele. Era o pior efeito possível do recurso — sair da
tela deixando a folha de pé sobre a tela nova.

A home continua sendo a base: dali o voltar sai do app, que é o que se espera.
E a mesa segue como era — não há entrada empilhada nela, e trocar isso mereceria
decisão própria, porque "voltar" numa partida em andamento não tem destino óbvio.

## Rivalidades

Aba própria nas estatísticas. Cada linha é um **par de jogadores**, com o dano
que cada um causou ao outro, eliminações, dano de comandante e veneno — e uma
barra mostrando o desequilíbrio, que responde "quem persegue quem" de relance.

Nada disso precisou ser gravado: desde que o dano virou direcional, cada evento
já carrega quem causou e quem levou. A agregação só lê o mesmo log de outro
ângulo — por par, em vez de por pessoa. Dano **sem autor** (vida paga) não cria
rivalidade com ninguém, e ação em área conta para todos os alvos.

## Ocultar decks e jogadores

Botão no canto de cada cartão de deck ou jogador. Ele tira a **linha** das
listas — não os dados: as partidas continuam inteiras, a linha do tempo segue
contando tudo, e o dano que essa pessoa causou continua somando para quem levou.
Dá para trazer de volta em *Estatísticas → menu → Ocultos*.

É por isso que ocultar e apagar são coisas separadas: apagar uma partida
(também disponível, no detalhe dela) muda o histórico de verdade.

## Instalar

Configurações → *Instalar*. Quando o navegador oferece instalação, um botão de
download também aparece no topo da home.

A instalação só é oferecida em `https://` ou `localhost`, com manifest e service
worker — **pelo IP da rede não aparece**, e é por isso que a tela explica o
motivo em vez de esconder a opção. No iPhone e iPad o Safari não deixa o app
pedir isso sozinho: lá é *Compartilhar → Adicionar à Tela de Início*, e a tela
diz exatamente isso.

## Idiomas

Português, inglês, espanhol e alemão, num campo de seleção em Configurações —
quatro nomes de idioma não cabem lado a lado no celular, e o `<select>` nativo
ainda abre o seletor que o aparelho já usa em todo lugar. Trocar redesenha a
home **e reabre o painel** no idioma novo; sem isso ele ficaria em português até
ser fechado na mão. Datas e horas seguem o
locale do idioma escolhido; o padrão vem do navegador.

Os textos vivem num dicionário plano, uma língua por arquivo em `src/i18n/`
(`pt.js`, `en.js`, `es.js`, `de.js`), e três testes o protegem:
as quatro línguas têm **exatamente** as mesmas chaves, nenhuma tradução perde
uma variável de interpolação (`{name} venceu` sem o `{name}` viraria uma frase
sem sujeito) e nenhum texto está vazio. Um quarto teste desenha a home e a mesa
nos quatro idiomas, porque o dicionário estar completo não impede um `t()`
escrito errado dentro de uma tela.

Chave faltando cai no português em vez de mostrar a chave crua ao usuário.

## Orientação e tema

A home é feita para o aparelho **em pé**: é onde se configura a partida, numa
lista vertical de jogadores. A mesa é feita para **deitado**, que é como ela
fica no meio do grupo — com 5 ou 6 jogadores a grade 2×3 do retrato vira 3×2 na
paisagem, senão os painéis ficam altos e estreitos e o número de vida não cabe.
Cada disposição carrega as duas formas, e as duas são testadas.

O cartaz de vitória também troca de forma: empilhado (arte em cima) em pé, e
**deitado** (arte à esquerda, conteúdo à direita) em tela baixa — com o celular
deitado sobram ~390px de altura e a versão empilhada não cabia. Se ainda assim
não couber, ele rola inteiro em vez de cortar o topo.

Campos de texto em painel sobem junto com o **teclado do celular**: o painel é
fixo na borda de baixo, que é justamente onde o teclado aparece. Vale para
todos — busca de comandante, nome de jogador, busca de `@` e o número da
votação secreta.

`visualViewport` diz quanto o teclado tomou, a cobertura encolhe na mesma
medida e o painel sobe. A conta é `layout − visível − deslocamento`, porque um
elemento fixo com `bottom: B` tem a base em `layout − B`.

**Sem tocar no layout da página, e isso é requisito.** `interactive-widget=`
`resizes-content` no meta viewport resolveria o Android sem JS, e chegou a
entrar — mas ele faz o viewport de **layout** mudar, e as telas deste app são
`height: 100%` em cadeia (`html`, `#app`, `.stats`). Mudar o layout durante a
rolagem re-layouta a cadeia e mexe na âncora de scroll: a lista de
estatísticas rolava e voltava ao topo. Saiu, e a conta de `--kb` já resolvia os
dois sistemas sozinha — o meta era cinto e suspensório.

**`--kb` só vale com campo de texto focado**, porque teclado só existe aí. Sem
essa condição a conta acusava teclado onde não havia: a barra de URL do celular
também encolhe o viewport visível, e a diferença saía como uns 60px de
"teclado" empurrando todo painel para cima.

O `layout` dessa conta tem de ser `documentElement.clientHeight` — a mesma
referência contra a qual `position: fixed` e `100%` resolvem. Com
`window.innerHeight` ela **quebrava**, e de um jeito que não dava erro: em
navegador onde `innerHeight` acompanha o viewport visual, a conta virava
`visível − visível − 0`, ou seja zero. Cobertura do tamanho inteiro, painel
colado na borda de baixo, atrás do teclado — quem procurava um `@` digitava sem
ver. Há teste para exatamente esse navegador (`simularTeclado` em
`tests/dom-stub.js`), porque a aritmética estava certa e o defeito era a
referência: um teste da função pura passaria sem provar nada.

Rolar **não** conserta isso, e vale saber por quê: o painel é `position: fixed`
e não tem ancestral rolável, então `scrollIntoView` não tem o que mover quando
o painel inteiro está atrás do teclado. Ele continua existindo, para o caso
diferente do painel alto cujo campo fica no fim — e roda quando o viewport
muda, não num temporizador após o foco, senão mediria a tela antes de o painel
ter subido.

Nenhuma das telas *quebra* na orientação errada: a home vira duas colunas
quando deitada, com a lista de jogadores rolando sozinha, e a mesa encolhe
rótulos e o hub quando está em pé. Bloquear seria pior — o navegador só permite
travar a orientação em tela cheia, e o Safari do iPhone **nem isso**. Por isso a
opção "tela cheia e girar" tenta, falha em silêncio onde não dá, e uma dica
discreta sugere virar o aparelho.

O tema tem três modos: sistema (padrão), claro e escuro. Toda cor da interface
sai de tokens em `:root` — nenhum componente sabe em que tema está. A paleta
WUBRG também troca: no claro os tons **escurecem**, porque um branco cremoso
sobre fundo claro simplesmente some, e o acento é o único sinal da identidade do
deck. Um script inline no `index.html` aplica o tema antes da primeira pintura,
para não haver lampejo da cor errada.

## Dano é direcional

Arrastar do painel de quem bate até o painel de quem apanha. A direção do gesto
**é** a declaração de autoria — nada é inferido. Enquanto o dedo está na mesa,
uma seta na cor do deck do atacante liga os dois painéis e o alvo acende.

Ao soltar, abre o teclado do dano: quanto foi. Os atalhos (1, 2, 3, 5, 7)
confirmam no mesmo toque, então o caso comum fecha em dois gestos. O teclado
gira junto com o assento de quem atacou, porque é ele que está mexendo.

**A vida do alvo conta até o novo valor** quando a tela fecha, em vez de pular.
Vale para os quatro casos que vêm de um painel: dano por arraste, dano em
todos, dreno (que faz os oponentes descerem e quem drenou subir) e cura. Sem
isso o número trocava de uma vez e nada dizia que algo tinha acontecido — e é
justamente quando o dano foi grande que isso importa.

Passo a passo pelos inteiros, porque vida *é* inteira: não há meia vida para
interpolar. A duração total é fixa, então tirar 28 conta rápido e tirar 2 conta
devagar; o passo tem um mínimo para que a mudança pequena ainda seja vista, em
vez de piscar. A cor marca a direção enquanto anda, porque de longe, no meio da
mesa, o número sozinho não diz se subiu ou caiu antes de parar.

**A borda do painel e os botões −/+ não contam**, de propósito: ali o número já
anda a cada toque, e contar por cima brigaria com o "segurar repete". Quem pede
a contagem é o painel, uma vez — não o redesenho, sempre.

Quem pediu `prefers-reduced-motion` recebe o número de uma vez. A regra de CSS
global zera transição e animação, mas não alcança uma contagem feita em
JavaScript: ela se recusa sozinha, e há teste para isso.

Três modos, todos direcionais pelo mesmo gesto:

- **Dano** — tira vida, creditado ao atacante;
- **Comandante** — também tira vida, e ainda soma no contador de 21 daquele
  comandante específico (se o atacante tem parceiro, você escolhe qual);
- **Veneno** — soma contadores rumo aos 10.

**As bordas do painel não são dano.** Elas mexem na vida sem autor, que é
exatamente o caso de quem paga a própria vida: fetchland, Necropotence, custo de
habilidade. Por isso as estatísticas separam **dano levado** (tem autor) de
**vida paga** (não tem) — somar os dois num número só esconderia a diferença
entre um deck que apanha e um deck que se queima sozinho.

Correções continuam no painel do jogador (toque no centro): ajuste fino de vida,
contadores de comandante por adversário, veneno e desistir.

## Como está organizado

Event sourcing: a partida **é** a lista de eventos, e o estado visível é sempre
`replay(match)`. Daí saem de graça o desfazer, as estatísticas exatas e a
garantia de que o placar nunca diverge do histórico.

**Uma pasta por subsistema, com um arquivo de porta.** Quando um assunto passa
de umas poucas centenas de linhas, ele vira pasta — e o arquivo com o nome dele
continua existindo, agora só reexportando o que é público. Assim `src/cloud.js`
segue sendo o que os outros módulos importam, enquanto por dentro são nove
arquivos; dividir as peças de outro jeito amanhã não toca em quem depende
delas. A porta também **documenta a fronteira**: `src/views/setup.js` tem três
linhas de `export`, e são exatamente os três nomes que a tela inteira expõe.

Depois da divisão, o maior módulo de comportamento em `src/` tem 449 linhas
(`ui.js`), e o maior de uma tela tem 386 (`views/table/votacao.js`). Os quatro
dicionários de idioma ficaram em ~470 cada, e ficam: são ~460 chaves por língua,
e quebrar um dicionário por assunto espalharia a mesma tradução por seis
arquivos. **Não há ciclo de import** em lugar nenhum — `npm run check` avisa se
um aparecer.

```
index.html            página
tests.html            autoteste no navegador
servir.py             servidor local
sw.js                 cache offline — lista explícita, conferida por npm test
package.json          só para o Node rodar os testes — zero dependências
src/
  app.js              rota e gravação
  engine.js           eventos, replay, eliminação, colocação   ← núcleo
  stats.js            porta — 21 nomes
  stats/
    agregar.js        o histórico virando número por deck e por jogador
    partida.js        uma partida só: resumo, linha do tempo, dano total
    rivalidades.js    o mesmo log lido por par de jogadores
    votacoes.js       escolhas em votação, agrupadas por pergunta
    cores.js          a cor de cada pessoa (ângulo áureo, por 1ª aparição)
    formatar.js       número e data como cada idioma escreve
  store.js            localStorage, histórico, backup
  scryfall.js         busca de comandantes + cache
  colors.js           paleta de identidade WUBRG (clara e escura)
  seating.js          disposição dos assentos, em pé e deitada — dado puro
  theme.js            claro/escuro/sistema
  ui.js               helpers de DOM, sheet, toast
  vote.js             votação secreta
  install.js          instalação como PWA
  orientation.js      em pé / deitado
  sync.js             fila de subida para a nuvem
  canal.js            produção ou beta
  novidades.js        notas de versão (dado)

  i18n.js             porta — 9 nomes
  i18n/
    pt.js en.js es.js de.js    uma língua por arquivo (~460 chaves cada)
    dicionarios.js             quais línguas existem, e onde moram
    traduzir.js                a mecânica do t() e a interpolação
    ordinal.js                 1º, 1st, 1. — uma regra por língua

  cloud.js            porta — 59 nomes
  cloud/              camadas que só olham para baixo
    regras.js         função pura — a parte que os testes alcançam sem rede
    estado.js         o que se lembra de quem entrou
    http.js           um pedido, com renovação de token em volta
    auth.js           entrar e sair
    assinatura.js     se a assinatura vale
    partidas.js       subir, baixar e apagar partida
    perfil.js         o nome e o @
    convites.js       partida em que alguém diz que você estava
    iniciar.js        a subida, em ordem

  views/
    setup.js          porta — 3 nomes
    setup/            um arquivo por elemento da home
      rascunho.js            a mesa sendo montada
      home.js                a tela em si
      cartao-jogador.js      o cartão de um assento, e o arraste
      escolher-jogador.js    quem senta aqui
      escolher-deck.js       qual deck ele leva
      antes-de-comecar.js    quem abre, e o layout da mesa
      configuracoes.js       as preferências do app
      instalar.js            o bloco de instalação
      conta.js               entrar, criar conta, assinatura
      handle.js              o próprio @
      convites.js            partidas esperando por você
      sincronizacao.js       o que subiu e o que falta
      notas-de-versao.js     o que mudou nesta versão

    table.js          porta — 1 nome
    table/
      contexto.js     o que todas as peças compartilham
      mesa.js         monta a tela e liga as peças
      constantes.js   as medidas do gesto, e as cores de mana
      pecas.js        rótulo/número, a linha com − e +, o "segurar repete"
      estado.js       quem muda a partida: apply, desfazer, vez, pausa
      pintar.js       desenhar a mesa a partir do estado
      gestos.js       a duração do toque decide o que ele é
      dano.js         a seta direcional e o teclado do dano
      area.js         dano em todos, e dreno
      mana.js         o marcador de mana
      votacao.js      votação secreta, de mão em mão
      jogador.js      o painel de um jogador
      hub.js          o núcleo central, e a cobertura da pausa
      menu.js         o menu da partida
      vitoria.js      quem ganhou, como ganhou, e o cartaz

    stats.js          porta — 2 nomes
    stats/
      tela.js         as abas, e qual está aberta
      pecas.js        as peças pequenas que várias abas reúsam
      deck.js         o cartão de um deck (cor pela identidade WUBRG)
      jogador.js      o cartão de um jogador (cor pela pessoa)
      rivalidades.js  o par de jogadores, e quem persegue quem
      partida.js      o cartão de uma partida e a linha do tempo
      vitoria.js      como as vitórias foram ganhas
      votacoes.js     escolhas em votações secretas
      backup.js       exportar e importar JSON
      marcar-conta.js ligar alguém a uma conta (e juntar o histórico)
      paywall.js      o que se vê sem assinatura

  styles.css          entrada — só @import, e **essa ordem é a cascata**
  estilos/            20 folhas, uma por área (tokens, home, mesa, dano,
                      núcleo, painel, stats, mana, votação, conta...)
tests/
  cases.js            casos do motor, sem DOM — fonte única
  dom-stub.js         DOM mínimo para testar os painéis fora do navegador
  run-node.js         runner de terminal
tools/
  make_icons.py       gera os ícones do PWA
  check-syntax.js     node --check, versão, @, RLS, instalação e cache do SW
  check_modules.py    imports, exports, reexports, delimitadores e cascata CSS
```

`engine.js` e todo o `stats/` não tocam no DOM. Se um dia isso virar React ou
React Native, eles vão junto sem alteração — e é também por isso que são a parte
que os testes alcançam inteira.

### A ordem dos @import é a cascata

`src/styles.css` não tem regra nenhuma: são vinte `@import`, e cada um é uma
faixa **contígua** da folha antiga, na mesma sequência em que estava. Trocar
duas de lugar muda quem vence um empate de especificidade, e o sintoma é visual
e silencioso. As últimas folhas são ajustes que nasceram depois e sobrepõem as
de cima de propósito — subi-las na lista as faria perder para o que vinham
corrigir.

`npm run check` segue esses `@import` e confere a cascata **entre** folhas, não
só dentro de cada uma.

### A mesa: de closure a contexto

`src/views/table.js` era o caso difícil, e vale saber por quê. As outras
divisões foram mudança de endereço: pegar uma declaração de topo e mover de
arquivo. Aqui não havia declarações de topo — `renderTable()` era **uma função**
de ~1500 linhas, com 39 funções aninhadas que compartilhavam um closure de 22
valores (`state`, `tiles`, `fx`, `hub`, `gesture`, `pauseTimer`…).

Closure é cômodo enquanto é um arquivo, e intratável depois: qualquer peça que
saia dele perde tudo de uma vez, e nada avisa — o código compila, os testes
passam, e um gesto para de responder sem erro no console.

Então o que era invisível passou a estar escrito. `contexto.js` devolve um
objeto `mesa`, cada peça o recebe, e as peças se penduram nele:

```js
const mesa = criarContexto(root, ctx);
Object.assign(mesa, criarEstado(mesa), criarGestos(mesa), criarDano(mesa), …);
```

Daí `gestos.js` chama `mesa.openDamagePad()`, que chama `mesa.apply()`, que
chama `mesa.sync()` — **sem que nenhum dos quatro arquivos importe outro**. Zero
ciclos de import, e cada peça abre sozinha.

Objeto, e não variáveis exportadas, porque `let` exportado é somente leitura de
fora: `mesa.state = …` precisa funcionar de sete arquivos diferentes, e
atribuir a uma *propriedade* é legal onde atribuir ao *binding* é `TypeError`.

Dois nomes locais tiveram de ser renomeados antes, porque repetiam nomes do
escopo de cima e a reescrita os atingiria: a grade das peças de mana virou
`gradeMana`, e a raiz do painel em `buildTile` virou `painel` (a chave devolvida
segue sendo `root`, então `tile.root` não mudou).

**O que os testes não alcançam continua não alcançando.** Toque curto contra
toque segurado, arraste, alvo, o deslize entre telas — isso só o dedo verifica.
Os testes de montagem cobrem a mesa subindo nos quatro idiomas e nas duas
orientações, e é o que existe. Antes de publicar, vale jogar uma partida.

## Quando algo quebra

Se o app não conseguir subir, aparece uma **tela de erro** com a mensagem e o
stack — não uma tela preta. Ela traz dois botões: recarregar, e limpar o cache
do service worker e recarregar (o histórico de partidas não é tocado). Existe
porque no celular não há console para abrir, e uma tela escura vazia não diz
nada a ninguém.

## Verificação

```bash
npm test         # node --check em todo módulo, depois os 84 casos
npm run check    # imports, exports, delimitadores, CSS e colisões de cascata
```

`npm test` roda `node --check` em cada módulo antes dos testes. Os casos só
exercitam engine, stats e seating — o resto depende de DOM —, mas a checagem de
sintaxe alcança a interface inteira, que é onde mora o erro mais bobo num
projeto sem build.

Os casos vivem em `tests/cases.js` e não tocam no DOM, então rodam nos dois
lugares a partir da mesma fonte: no terminal com `npm test`, e no navegador em
`http://localhost:8000/tests.html`. Um teste que só passa num dos dois não vale
muito.

Cobrem replay, desfazer, eliminação por veneno e por 21 de comandante (incluindo
o caso de dois comandantes diferentes que **não** somam), ordem de turno pulando
mortos, colocação final, atribuição de dano, a separação entre vida paga e dano
levado, agregação de um mesmo deck em várias partidas, determinismo do replay,
o sentido horário de **toda variante** de mesa em pé e deitada, a contagem de
voltas quando a partida abre por um jogador que não é o primeiro assento, as
ações em área (dano, dreno, crédito de eliminação, desfazer atômico) e a pausa
saindo da duração e do tempo de turno.

Quatro casos rodam sobre um DOM simulado mínimo (`tests/dom-stub.js`): a máquina
de estados dos painéis deslizantes e a **montagem** da mesa e da home. Os dois
grupos nasceram de regressões reais — um painel cuja primeira tela abria
invisível, e um `let` declarado depois do primeiro uso que derrubava a mesa
inteira e deixava a tela preta. Nos dois casos a sintaxe estava válida, os
imports certos e todos os outros testes verdes. No navegador esses quatro
aparecem como pulados.

Três casos cobrem o **segurar na borda**, com o relógio trocado por um
controlado (os casos rodam síncronos, então esperar de verdade não é opção): a
cadência e a aceleração, o soltar que não pode cobrar um passo por cima do que a
repetição já aplicou, e a seguradinha inteira virando um evento só. O último
importa mais do que parece — sem ele, *desfazer* voltaria ponto por ponto.

O que os testes **não** alcançam: o resto do gesto, e a aparência. Toque curto
contra toque segurado no centro, arraste, alvo, o deslize entre telas e como o
tema claro fica de fato — isso só o dedo e o olho verificam.

`npm run check` também avisa quando duas classes usadas **no mesmo elemento**
definem a mesma propriedade CSS — empate que só a ordem do arquivo resolve.
Nem todo aviso é defeito (modificador depois da base é o padrão certo), mas foi
assim que a home quebrou uma vez: `class: 'seat-spot layout-mini'`, as duas
definindo `width`, e a genérica estava 950 linhas abaixo.

**O `package.json` não traz dependência nenhuma** — ele existe só para o Node
tratar os `.js` como módulos ES ao rodar os testes. Não há `npm install`, não há
build: o app continua sendo arquivos estáticos servidos direto.

## Dados

Tudo fica em `localStorage`, neste aparelho. Não há servidor e nada é enviado
para lugar nenhum — a única chamada externa é a busca de cartas na Scryfall.
Limpar os dados do site apaga o histórico, então use o **Exportar JSON** em
Estatísticas → menu para guardar backup.
