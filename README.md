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

## O número da versão

**Ele só anda quando sai publicação em produção.** Uma ida ao beta não gasta um
número: `main` e `beta` ficam no mesmo número até a promoção, e o que se acumula
no beta entra numa entrada só de `src/novidades.js`.

Isto não é cosmético. Um número por ida ao beta produz um histórico de versões
que ninguém usou, e as notas ficam picadas em entradas de um item — quem abre a
tela de novidades depois de atualizar lê cinco cabeçalhos para entender uma
mudança.

**O que o bump fazia tecnicamente**, e por que não é necessário: `VERSION`
compõe o nome do cache do service worker (`hiteasy-beta-shell-<versão>`), então
trocá-lo força um cache novo e vazio. Mas o `fetch` é *stale-while-revalidate* —
responde do cache e revalida por trás, gravando o que vier. O beta chega aos
testadores na segunda abertura sem bump nenhum; o bump só antecipava isso em uma
abertura.

**O que se perderia sem compensar:** saber qual código está no aparelho. Com a
versão parada, a tela de configurações diria a mesma coisa antes e depois da
publicação. Por isso o CI escreve `build.json` em `/beta/` com o SHA curto do
commit, e a linha de versão mostra `1.7.0 · beta · 3a6915f`. O service worker
deixa esse arquivo passar direto para a rede: servi-lo do cache responderia com
o build anterior, que é a única resposta inútil.

Em produção não há carimbo, e é de propósito: lá o número já responde, porque é
exatamente onde ele muda.

### Na hora de promover

1. O número sobe uma vez, em `src/version.js` **e** em `sw.js` — `npm test`
   recusa se divergirem.
2. A entrada correspondente existe em `src/novidades.js` — `npm test` também
   recusa sem ela.
3. Qual dígito: `novo` ou `mudou` nas notas sobe o do meio; só `corrigido` sobe
   o último.

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
| **duplo toque no centro** | ação em área: dano em todos os jogadores, só nos oponentes, ou dreno |
| **segurar no centro, ou arrastar** | arma o ataque — a única saída é causar dano |

Nas bordas, segurar repete — mesma gramática do marcador de mana, onde segurar
também repete. Começa depois de 380 ms, em passos de 110 ms, e acelera para
55 ms depois de oito passos: quem vai de 40 a 12 não devia precisar de vinte e
oito toques. Abaixo desses 380 ms nada mudou — um toque lento continua valendo
exatamente 1.

Por isso **segurar parado na borda não arma mais o ataque**. Arrastar da borda
arma, desde que o dedo saia andando antes de a repetição começar — aí nenhum
ponto de vida se mexe no caminho; depois que a repetição aplicou um passo, o
gesto já é ajuste de vida e não vira mais ataque. (A direção do gesto é a
declaração de autoria, e ela continua ali.) E
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

Duplo toque no centro do painel de quem vai agir (ou o botão *Dano em área ·
Dreno*, dentro do painel dele). Três modos, porque as cartas falam de três
jeitos:

- **Todos** — cada jogador vivo perde N, **inclusive quem lançou** (Terremoto,
  Pestilência). Morrer do próprio dano não credita a eliminação a ninguém, e o
  dano que a pessoa leva de si mesma conta como dano levado, não causado.
- **Oponentes** — cada oponente vivo perde N. É o padrão.
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

**O jogador 1 senta no alto à esquerda**, com o aparelho deitado — é onde se
começa a ler, e é onde quem montou a mesa procura o primeiro da lista. Com 2, 3
e 5 jogadores a mesa deitada é o padrão. Até a 1.8 a volta começava embaixo à
esquerda; partida aberta antes da troca não tem a marca `assentos: 'topo'` e
continua desenhada na ordem antiga (`ASSENTOS_ANTIGOS` em `seating.js`), senão
atualizar o app no meio de um jogo trocaria todo mundo de lugar.

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

**Configurações** (engrenagem na home), em grupos no desenho dos ajustes do
celular — um título curto e um cartão de linhas:

- **Conta** — uma linha só (o `@`, a assinatura, convites esperando), que abre
  a própria tela com @, sincronização, senha, assinatura e sair. Antes vinha
  inteira no topo e empurrava idioma e tema para o fim da rolagem;
- **Aparência** — idioma e tema;
- **Na mesa** — vibração, tela acesa e travar na horizontal (este some no
  iPhone, onde o Safari não trava nada);
- **Aplicativo** — instalar ou atualizar (uma linha que muda conforme o
  aparelho), novidades, rever a dica de dano e privacidade.

Texto só onde ele muda a decisão: "vibração" não precisa de legenda; travar na
horizontal precisa avisar que entra em tela cheia. As peças vivem em
`src/views/setup/linhas.js`. Vida inicial e disposição da mesa ficam de fora
daqui de propósito — mudam a cada jogo, então vivem na home e na tela de antes
de começar.

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

## O @ é de quem pegou; o nome é livre

Duas coisas diferentes, que antes se confundiam:

- **O `@`** é a identidade — por onde os amigos acham e marcam a pessoa. Só
  minúsculas, letras, números e `_`, para `@Alex` e `@alex` nunca serem duas
  pessoas.
- **O nome nas partidas** (`profiles.display_name`) é como a pessoa aparece na
  cadeira quando alguém a marca. Livre na forma — "Alê", "Dr. Strange",
  "MARIA", emoji —, preso só no tamanho (18, o que cabe no painel da mesa).
  Sem nome, a mesa usa o `@`. Fica em Configurações → Conta.

**Todo `@` que uma conta já usou continua dela, para sempre.** O índice único de
`profiles.handle` só protegia o `@` em uso *agora*: trocar soltava o antigo, e
outra conta podia pegá-lo — e com ele os convites de quem ainda marcava o `@`
velho, justamente quem confiava naquele nome. Agora `handles_usados` guarda
cada `@` com o dono, e o gatilho `guardar_handle` recusa (com 23505, que o
PostgREST devolve como 409 e o app já entende como "ocupado") qualquer `@` que
já foi de outra conta. A pessoa pode trocar e voltar a um antigo; ninguém mais
pega nenhum deles. Apagar a conta solta os `@` dela.

E o `@` antigo continua achando a pessoa: `buscar_handle` e o gatilho de
convites resolvem por `dono_do_handle`, que olha o atual e depois os antigos, e
a busca devolve o `@` atual — a cadeira passa a ser marcada com ele.

Conferir o próprio `@` agora diz "já é o seu @" em vez de "está livre", sem
botão de salvar (`situacaoDoHandle` em `regras.js`: `atual`, `livre` ou
`ocupado`). E trocar o `@` parou de apagar o nome: o upsert mandava
`display_name: null` junto.

**E só troca a cada 15 dias** (`sql/009`). Com todo `@` reservado para sempre,
trocar sem limite viraria um jeito de acumular nomes — dez trocas numa tarde
reservariam dez `@` —, e um `@` que muda toda semana não serve para os amigos
acharem ninguém. O relógio começa na **escolha**, não só na troca: escolher e
trocar no dia seguinte é exatamente o caso que a regra impede, e a tela avisa
antes de salvar. Quem já tinha `@` antes da regra não tem data e pode trocar.

A data (`profiles.handle_trocado_em`) é do servidor: a policy deixa a pessoa
editar a própria linha inteira, então o gatilho reescreve essa coluna em
**toda** gravação do perfil, e não só quando o `@` muda — senão bastaria um
PATCH com uma data antiga antes de trocar. A recusa sai com o código próprio
`HE015` e a data liberada no `details`; a linha do `@` já mostra "próxima troca
em …" e não abre a tela de trocar dentro do prazo.

> **Precisa de migração.** Rode `sql/008-handle-reservado-e-nome.sql` e depois
> `sql/009-handle-a-cada-15-dias.sql` no Supabase. Sem ela o nome não grava (a coluna existe, mas a regra de tamanho
> não) e o `@` antigo continua podendo ser pego por outra conta.

## Os decks seguem a conta

A lista de decks de alguém é **derivada** do histórico local — nada é guardado
à parte, e é o que evita uma segunda verdade sobre o que a pessoa joga. Mas num
aparelho novo esse histórico está vazio: quem acabou de entrar na conta não
achava o próprio deck e tinha de buscar na Scryfall o comandante que o app já
conhece.

Agora os decks de **quem está logado** vão para o perfil dele no servidor, e
voltam no próximo aparelho. No seletor eles se juntam aos do histórico local,
sem repetir, do mais recente para o mais antigo.

**Só os seus.** A policy do banco deixa cada um escrever apenas a própria linha
de perfil, então o anfitrião registra os decks dos amigos no aparelho dele mas
não pode gravá-los no perfil deles. É a mesma regra que impede alguém de ser
autor do registro alheio — ver `sql/002-participantes.sql`.

**E são privados.** A busca por `@` seleciona explicitamente id, handle e
display_name: acrescentar `decks` ali transformaria a confirmação de um `@` numa
devassa do que a pessoa joga.

Sobe só quando o **conjunto** muda. `lastUsed` muda a cada partida, então
comparar as listas inteiras faria toda sincronização escrever no perfil para
dizer a mesma coisa.

> **Precisa de migração.** Rode `sql/004-decks-da-conta.sql` no Supabase. Sem
> ela o servidor recusa a escrita, o app trata como "fica para a próxima" e
> segue funcionando com os decks do histórico local — como era antes. Nada
> quebra, mas o recurso fica dormente.

## Ordenar as listas

Decks e Jogadores saíam sempre na mesma ordem: taxa de vitória, partidas no
empate. É uma ordem boa, e não responde "quem joga mais" nem "quem bate mais".

Agora as duas abas têm um seletor. As opções saem de `src/stats/ordenar.js`,
onde cada regra carrega o campo, a direção e a chave de tradução juntos — os
três no mesmo lugar é o que impede a tela dizer "melhor colocação" e ordenar do
pior para o melhor, porque colocação é a única que sobe: primeiro lugar é 1,
então o melhor é o **menor**.

O desempate é sempre a relevância, e não a ordem em que a agregação devolveu.
Com `partidas`, metade do grupo empata em duas; sem desempate explícito a lista
saía na ordem de inserção do `Map`, que muda quando se apaga uma partida antiga
— e a pessoa veria a lista se reorganizar sozinha sem aquele número ter mudado.

**Taxa de vitória tem a armadilha de sempre.** Um deck de uma partida ganha
aparece na frente de um de dez com oito vitórias. Não há mínimo de partidas: é
o que a pessoa pediu ao escolher taxa, e a contagem de partidas está no cartão
ao lado do número. O teste registra essa ordem como proposital, para ninguém a
"corrigir" depois achando que é defeito.

Ordena **depois** de filtrar. Ordenar antes gastaria a comparação em linhas que
a tela não vai mostrar, e o topo da lista seria o topo do grupo inteiro em vez
do topo do que está na tela.

## As notas mostram o que entrou

A tela de novidades abria o histórico inteiro. As três linhas novas ficavam
embaixo de nove versões já lidas, e o que se aprende com isso é a fechar a tela
sem ler.

Agora o recorte padrão é a diferença desde a versão em que o app estava. Isso
exigiu guardar de onde a pessoa veio: `versaoVista` é sobrescrita no arranque,
antes de qualquer tela abrir, então a única referência já tinha sido apagada
quando o menu precisava dela. `versaoAnterior` só é gravada quando a versão
mudou — reabrir o app na mesma versão não pode zerar o recorte.

Três situações, nessa ordem: veio de uma versão anterior, mostra a diferença;
instalou agora, mostra só as notas desta versão; esta versão não tem notas, cai
no histórico (é rede de segurança, porque `npm test` não deixa publicar sem).

O histórico continua a um toque, no fim da lista. Esconder não é o mesmo que
apagar, e quem foi procurar a mudança de três versões atrás precisa achá-la.

`anunciarVersao()` tem nome e é exportada porque era um IIFE que rodava no
import: acontecia uma vez, antes de qualquer teste, e apagar a linha da versão
anterior passava pela suite inteira sem uma falha. O teste de mutação foi quem
contou.

## O botão de atualizar mostra que está atualizando

`atualizarApp()` consulta a rede e depois espera o worker novo assumir de
verdade — até dez segundos. O botão só ficava desabilitado, e um botão que
escurece e fica parado é indistinguível de um botão que não funcionou. Foi
exatamente a dúvida que surgiu em uso: "o botão fez algo?".

Agora o rótulo troca por um girador e "Atualizando…", e volta se não houver
versão nova. O girador entra **antes** da espera, não depois: o retorno tem de
ser imediato, senão não responde a pergunta que ele existe para responder.

Quem pede menos movimento recebe um pulso em vez de um giro. Zerar a animação
deixaria um anel parado, que é indistinguível de um botão travado — o oposto do
que isto existe para dizer.

Uma falha na atualização devolve o botão ao estado normal. Sem isso o girador
giraria para sempre, e a pessoa ficaria olhando uma espera que já acabou.

## Passar a mesa para outro aparelho

O caso é concreto: a bateria do celular que conta a vida está acabando no meio
da partida, e alguém da mesa tem um aparelho com carga. A partida troca de mãos
sem acabar.

**Por arquivo, e não pela nuvem.** Não exige conta de ninguém, não exige
assinatura e funciona sem rede — que importa, porque mesa na casa de amigo tem
wi-fi ruim e o celular que está morrendo não é hora de depender de upload. A
partida vira um arquivo, vai por WhatsApp ou AirDrop, e o outro aparelho recebe.

O event sourcing faz a transferência ser quase nada: a partida **é** a lista de
eventos dela, então mandar a lista é mandar o jogo. Não há estado parcial.

### O bastão

O trabalho de verdade não é transportar. É que depois da passagem existem duas
cópias com o mesmo id, e o envio usa `ignore-duplicates`: a primeira que subir
vence e a outra some calada. Se o aparelho antigo voltasse a jogar e subisse a
metade abandonada, seria ela que ficaria.

Por isso a mesa não é copiada, é passada. `empacotarMesa()` carimba e empacota
no mesmo ato — empacotar sem soltar deixaria as duas vivas.

**E o carimbo não é cobrado por um `if`.** A primeira versão tinha a guarda no
roteador, e o teste de mutação apagou aquela linha com a suíte inteira passando
— a mesma classe de defeito que já mordeu este projeto, a função certa
existindo e ninguém consultando. Agora a invariante está no acesso:
`getCurrent()` devolve `null` para mesa passada. Todo caminho que já tratava
"não há mesa aberta" trata este caso de graça, sem nenhum deles conhecer o
conceito. Quem precisa da mesa passada — a home, para avisar — pede
`mesaGuardada()`.

Retomar existe para quando a passagem não deu certo, e é uma ação com
confirmação: duas cópias vivas é justamente o que a passagem evita.

### O relógio

Os eventos carregam o `ts` do aparelho que os gravou. Se o relógio de quem
recebe estiver atrasado, o próximo evento nasce **antes** do anterior — e
`elapsedOf` e `advanceTurn` subtraem instantes, então tempo andando para trás
vira duração negativa em cima da mesa.

`receberAMesa()` mede o atraso e guarda o desvio na própria partida; `push()`
passa a usar `agoraDaMesa()`. O acerto só olha para frente: relógio adiantado
não ganha correção, porque empurrá-lo inflaria a duração. O minuto de folga
impede que dois relógios quase iguais empatem no mesmo milissegundo.

### Três defeitos que só o uso encontrou

**Receber só valia depois de recarregar a página.** A mesa era instalada e a
tela continuava na home: `onRefresh` redesenha a rota atual, e a rota inicial é
a única que olha para `getCurrent()` sozinha. Ação que muda qual é a partida de
agora tem de levar a tela junto.

**Retomar deixava a pessoa presa.** A mesa voltava a valer e não havia como
entrar nela — o menu da mesa, onde mora passar, ficava inalcançável. A home
ganhou `continuarMesaBanner`: se existe partida aberta, dá para entrar. Ele
normalmente não aparece, porque o app abre direto na mesa quando há partida;
existe para que qualquer caminho futuro que crie esse estado não prenda ninguém.

**O arquivo tinha nome fixo**, então duas mesas na pasta de downloads viravam
`mesa-hit-easy (1).json` e ninguém sabia qual era qual. Agora leva o id da
partida, filtrado para o que todo sistema de arquivos aceita.

### Por que a suíte não pegou

Os dois primeiros escaparam a onze mutações, e não por falta de teste: por
**impossibilidade** de teste. Os dois caminhos passam por `await confirmAction`,
e o runner era síncrono — nada depois de um `await` podia ser observado, então
aquelas linhas eram inalcançáveis.

`runAll()` agora devolve promessa e espera cada caso, um por vez (os casos
compartilham `document` e `store`; dois em paralelo se pisariam). Casos
síncronos seguem síncronos. O stub ganhou `click()`, que faltava e fazia
`campo.click()` — código que roda em produção — explodir no teste.

Com isso as duas mutações passaram a ser pegas, e o caminho de receber tem teste
de ponta a ponta: toque, arquivo, confirmação, mesa instalada e aberta.

### O arquivo leva uma mesa

O exportador de backup manda o banco inteiro. Usá-lo aqui entregaria ao amigo
todo o histórico de partidas de quem passou, os `@` que o aparelho conhece e as
preferências. É o erro mais fácil de cometer e o mais caro, e há um teste que
falha se o histórico vazar para dentro do arquivo.

O arquivo é recusado com motivo — ilegível, não é uma mesa, veio de versão mais
nova, mesa incompleta — porque são quatro erros diferentes e merecem quatro
respostas diferentes.

### Por código, desde a 1.9

O arquivo falhou no primeiro teste de verdade: mandado pelo WhatsApp, o
celular de quem recebia não conseguia abrir o `.json`. Agora, com a nuvem
configurada, passar a mesa **sobe a partida e mostra um código** de seis
caracteres (`K7M 2QX`). Quem vai continuar toca em *Receber uma mesa* e digita
o código — ou toca no link que vai junto na mensagem, que abre o app com o
código já preenchido. Ninguém precisa de conta.

- **Vale 24 horas e uma vez só.** Pegar marca a mesa como recebida; o segundo
  aparelho que tentar o mesmo código não leva nada. É o mesmo bastão do
  arquivo: a mesa não é copiada, é passada.
- **A mesa só sai daqui depois de subir.** Sem rede, ela continua aberta neste
  aparelho e a tela oferece o arquivo, que funciona offline. O arquivo também
  continua em *Receber → Tenho um arquivo*.
- **Ver, confirmar, pegar.** Quem recebe primeiro *vê* a mesa (sem consumir o
  código), confirma que pode substituir a partida aberta, e só então *pega*.
  Pegar antes queimaria o código de quem desistisse no meio.
- **Quem passou vê que chegou.** O painel do código pergunta ao banco a cada
  3 s e diz "recebida no outro aparelho". O aviso da home mostra o código
  enquanto ninguém pegou, e retomar **cancela o código** antes; se o outro
  aparelho já pegou, retomar avisa que vão existir duas cópias vivas.
- **Preso ao canal**: código do beta não abre em produção.
- O link abre o app no **navegador**. No iPhone, quem usa o app instalado deve
  digitar o código dentro dele — o Safari guarda dados separado do app
  instalado, e a mesa iria parar no lugar errado. Por isso a mensagem leva os
  dois.

Segurança, já que as funções valem para `anon`: a tabela `mesas_em_transito`
não tem policy nenhuma, então ninguém a lê pela API — só as funções
`security definer` respondem, e só a quem tem o código. O código sai de
`gen_random_uuid()` num alfabeto de 31 caracteres sem os que se confundem
(0/O, 1/I/L): perto de 900 milhões de combinações para algumas dezenas vivas.
Mesa acima de 1 MB e mais de 2000 mesas vivas são recusadas, para a chave
pública não virar depósito.

> **Precisa de migração.** Rode `sql/007-mesa-por-codigo.sql` no Supabase. Sem
> ela, passar a mesa falha ao subir e cai no arquivo, como antes.

## Quem já jogou com você não pede de novo

Confiar deixou de ser um passo. Se duas contas já jogaram uma partida juntas e
aquela foi aceita, as próximas entram sozinhas — em qualquer direção, porque
jogar junto é simétrico e quem registra a mesa muda de semana para semana.

A decisão é do servidor, no gatilho `preparar_participante`, e não do app: o
cliente de quem recebe pode estar fechado por dias. Decidir no servidor faz o
convite nascer aceito; decidir no cliente faria a pessoa ver "1 convite
esperando" que some sozinho quando ela abrir o app.

**Aceita só conta como prova.** Uma cadeira marcada com o meu `@` que eu nunca
aceitei não diz que jogamos: diz que alguém digitou o meu `@`. Aceitar é o
único ato que veio de mim.

Preso ao canal: uma mesa de teste não cria confiança que vale na vida real.

### Poder dizer não

Esta é a parte que não dá para esquecer. Com o aceite derivado do histórico,
jogar uma única vez com um estranho num torneio passaria a valer para sempre, e
apagar a linha de confiança não desfaria nada — a regra se refaz a partir das
partidas.

Por isso `trusted_hosts.confia` em vez de só presença: a linha com `false` é o
"não aceite mais nada desta pessoa", e vence qualquer histórico. `deixarDeConfiar`
grava essa recusa em vez de apagar a linha, e o convite ganhou "nunca aceitar
desta pessoa" como ação discreta ao lado de recusar.

> **Precisa de migração.** Rode `sql/006-ja-jogamos-juntos.sql` no Supabase. Sem
> ela nada quebra — o aceite automático continua só para quem foi confiado na
> mão, como antes —, mas o recurso fica dormente.

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

## O beta não escreve na base de verdade

Produção e beta moram na mesma origem, e isso já era resolvido para o DISCO:
`chave()`, em [src/canal.js](src/canal.js), põe sufixo `.beta` em tudo que vai
para o localStorage.

A nuvem não sabia o que era canal. Uma partida jogada no beta subia para a mesma
tabela `matches`, e o app de produção a baixava como real: partida de teste no
histórico, nas estatísticas, na média de dano, na taxa de vitória de um deck.

Pior que ruído. `aprenderQuemEQuem` aprende apelidos do que baixa, e uma cadeira
de teste marcada com o `@` de um amigo virava convite para a pessoa real — o
canal de teste escrevendo na vida de terceiros.

Agora toda escrita leva a coluna `canal` e toda leitura filtra por ela. São as
duas pontas da mesma regra, e falhar numa anula a outra: carimbar sem filtrar
deixa produção baixando o que o beta subiu; filtrar sem carimbar faz o beta
subir com o padrão `'producao'` e envenenar a base.

O mesmo vale para `profiles.decks`, que a 1.6.0 criou: beta escreve em
`decks_beta`. Sem isso, uma mesa de teste com comandantes inventados entraria no
seletor de deck do app de verdade, desfazendo o recurso que existe justamente
para o seletor conhecer os decks da pessoa.

**O canal não é fronteira de segurança, é separação de dados.** As policies
decidem por dono, e o canal não muda quem é dono de quê. Quem quiser ver as
próprias partidas de beta consultando o banco na mão consegue — são dela. O que
a coluna garante é que o app nunca mistura os dois sozinho.

Por uma coluna, e não por um projeto Supabase separado: a conta, a assinatura e
os `@` precisam ser os mesmos nos dois canais. Com dois projetos, testar o login
seria testar outro login, e a pessoa teria de criar conta de novo para
experimentar o beta. Ninguém testa assim.

> **Precisa de migração.** Rode `sql/005-canal.sql` no Supabase. Até lá o app
> novo pede `canal=eq.producao` a uma tabela sem essa coluna, e o PostgREST
> recusa com 400 — a sincronização falha inteira e o app fica só local. Nada se
> perde, mas nada sobe nem desce.

### O que as subidas carimbam

A cobertura dessa separação quase ficou pela metade: os testes verificavam
`toRow` e `colunaDeDecks`, que são puras e recebem o canal pronto, e nada
passava pelo ponto onde `canal()` é de fato chamado. Trocar essa chamada por
`'producao'` dentro de `enviarPartida` passava pela suíte inteira — a mutação
que significa, em uma linha, "o beta envenena a base de verdade". O teste de
mutação foi quem contou; o caso de ponta a ponta captura o `fetch` e lê o corpo
que sai.

## O ícone

Três arquivos em `icons/`, e a mesma arte nos três: os cinco pips WUBRG sobre
fundo quase preto. É a mesma marca que o cabeçalho da home desenha em
`brandMark()`, e as duas precisam continuar sendo a mesma coisa — são separadas
no código e uma só para quem olha.

O `icon-maskable.png` é um círculo com o conteúdo puxado para dentro. O Android
não mostra o PNG: recorta na forma que o lançador usa, círculo, squircle ou
quadrado arredondado, e o que estiver fora do círculo central de 80% pode ser
cortado.

**Ele tem um defeito conhecido:** é um círculo sobre transparência, com 94% dos
pixels de borda translúcidos. Em lançador de máscara circular ninguém vê; em
máscara quadrada os cantos ficam vazados mostrando o papel de parede. Consertar
isso é tornar a imagem opaca de borda a borda, sem mexer no desenho.

### A guarda

`conferirIcones()`, em [tools/check-syntax.js](tools/check-syntax.js), exige que
todo ícone referenciado exista e que todo PNG em `icons/` seja referenciado.

Três arquivos apontam para os ícones — `manifest.webmanifest`, `index.html` e a
lista `ASSETS` de `sw.js` — e errar um não quebrava teste nenhum. Cada um falha
de um jeito diferente: o manifest com caminho morto só aparece na hora de
instalar, no aparelho de outra pessoa; `cache.addAll()` rejeita **tudo** se um
único pedido falhar, então um caminho morto na lista derruba o app inteiro
offline; e no `index.html` a aba fica sem favicon.

### O que já foi testado e desfeito

Uma identidade de gradiente com a silhueta de uma mesa chegou a ir para o beta e
voltou. Vale registrar o que a medição disse, para a tentativa não se repetir às
cegas:

- **Pesava 444 KB contra 19 KB.** Gradiente suave é o pior caso do PNG. Paleta
  de 256 cores cortaria 79% e bandeia visivelmente; recomprimir não ganha nada.
- **A silhueta não lia a 16 e 32px** — vira um borrão escuro no meio do
  colorido, e é aí que vive o favicon da aba.
- **Na marca do cabeçalho, o gradiente some.** Rasterizando a 14, 26 e 52px nos
  dois temas, abaixo de 26px ele vira mancha escura que desaparece no fundo.
  Este projeto já tinha passado por isso: a marca foi um quadradinho com
  degradê, borrava no pequeno, e virou cinco pips por causa disso.

Fica também o método, que serve para qualquer arte nova: medir a zona segura do
maskable, a opacidade das bordas, o peso e a legibilidade nos tamanhos reais —
e não só olhar o arquivo grande.

## Instalar

Configurações → *Instalar*. Quando o navegador oferece instalação, um botão de
download também aparece no topo da home.

No iPhone e no iPad o botão aparece **sempre** (enquanto o app não está
instalado) e abre um passo a passo: Safari → Compartilhar (no iOS mais novo,
dentro do botão •••) → *Adicionar à Tela de Início* → *Adicionar*. A Apple não
deixa página nenhuma pedir instalação, então isso é o máximo que o app pode
fazer — e antes a explicação ficava só dentro das configurações, onde ninguém
achava. A tela reconhece o navegador: no Chrome e no Edge do iPhone também dá,
pelo compartilhar da barra de endereço; dentro do Instagram, do Facebook e de
outros apps não dá de jeito nenhum, e a tela manda abrir no Safari, com um botão
de copiar o endereço.

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

**Tela acesa no Safari.** O Safari (iPhone e iPad) só concede a trava de tela
acesa logo depois de um toque da pessoa. Pedir ao voltar para o app, ou ao
reabrir direto na mesa, é recusado em silêncio — e a tela passava a apagar
sozinha no meio da partida. O pedido é refeito no primeiro `pointerup` na mesa
sem trava, o que também recupera a trava que o sistema solta ao bloquear o
celular. (No app instalado pela Tela de Início, a trava só funciona do iOS 18.4
em diante — antes disso era defeito do próprio iOS.)

**Tela cheia no iPhone só instalado.** O Safari do iPhone não tem tela cheia
para página, só para vídeo: numa aba, a barra de endereço fica e nenhum código
tira. Aberto pela Tela de Início, o app roda sem barra. Por isso a mesa, aberta
no Safari de um iPhone, mostra uma vez por sessão o aviso com o atalho para o
passo a passo de instalação.

**Sair do app derruba a trava.** O Android tira o app da tela cheia quando ele
vai para segundo plano, e a trava de paisagem cai junto: na volta, a mesa
aparecia em pé. O app guarda o último pedido de orientação e o refaz ao voltar
— e, como entrar em tela cheia exige um toque da pessoa, refaz de novo no
primeiro `pointerup` depois da volta. Onde a trava nunca funciona (iPhone, iPad,
computador) isso não faz nada: no computador o mouse desliga a tentativa, e no
iPad uma recusa com a tela cheia já ativa marca o aparelho como sem suporte.

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
gira junto com o assento de quem atacou, porque é ele que está mexendo. O dial
começa em **0** — quem usa o + conta a partir do zero de qualquer jeito —, e
confirmar no 0 só fecha, sem gravar nada.

**Lifelink** é uma marca no teclado: ligada, quem causou o dano ganha a mesma
vida. Vale para dano, dano de comandante e veneno (infect com lifelink também
cura). Entra como `gain` no **mesmo** evento de dano, e não como um `life` à
parte: desfazer volta as duas coisas juntas, e a cura aparece na estatística
como cura de quem atacou.

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
  stats.js            porta — 25 nomes
  stats/
    agregar.js        o histórico virando número por deck e por jogador
    partida.js        uma partida só: resumo, linha do tempo, dano total
    rivalidades.js    o mesmo log lido por par de jogadores
    votacoes.js       escolhas em votação, agrupadas por pergunta
    ordenar.js        por qual número a lista se ordena, e em que direção
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
