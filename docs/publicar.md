# Dois canais: teste e produção

```
main  →  https://alienpls-vibes.github.io/hit-easy/        produção — a mesa usa
beta  →  https://alienpls-vibes.github.io/hit-easy/beta/   teste — você aprova
```

Como funciona no dia a dia:

1. Eu trabalho na branch `beta` e abro um Pull Request para `main`.
2. Em ~1 min o `/beta/` no ar já tem a mudança. Você testa no celular de verdade.
3. Aprovou? **Merge** no PR — um botão, funciona do celular. Produção sai sozinha.
4. Não aprovou? Comenta, eu conserto, o `/beta/` se atualiza. Produção nem soube.

Teste que falha não publica. Como produção já está no ar, um deploy bloqueado
nunca derruba a mesa: no pior caso ela continua com a versão anterior.

## Ligar (uma vez só)

São **dois** ajustes, e o segundo não é óbvio:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   Enquanto estiver em *Deploy from a branch*, o workflow roda os testes e falha
   no último passo.

2. **Settings → Environments → `github-pages` → Deployment branches and tags:
   adicione `beta`.**
   O ambiente nasce permitindo só a branch padrão. Sem isso o deploy da `beta` é
   recusado com *"Branch beta is not allowed to deploy to github-pages due to
   environment protection rules"* — os testes passam, o site não sai, e o canal
   de teste só subiria de carona num push para `main`, que é justamente o que
   ele existe para evitar.

## Por que os canais são separados no navegador

Os dois moram na mesma origem — muda só o caminho. Só que `localStorage` e o
Cache Storage são **por origem, não por caminho**. Sem separar na mão, o beta
escreveria no mesmo `mtglc.db.v1` do app de verdade, e uma versão com defeito
levaria junto o histórico de quem confiou nela.

`src/canal.js` resolve isso: toda chave de disco passa por `chave()` antes de
tocar o disco, e o beta ganha o sufixo `.beta`. **Produção mantém a chave exata
de sempre** — qualquer sufixo lá zeraria o histórico de todo mundo. Há teste
prendendo isso.

O service worker tinha o mesmo problema, pior: no `activate` ele apagava todo
cache que não fosse o seu. Com dois canais, quem ativasse por último derrubava o
modo offline do outro. Agora cada canal só apaga o que é seu.

Consequência prática: **o beta começa vazio.** Ele não vê suas partidas nem sua
sessão. É proposital — para testar login e primeiro uso é o que se quer, e é o
que impede um bug de teste de chegar no seu histórico real.

## O que os dois canais ainda dividem

O mesmo projeto Supabase. Partida gravada em teste vira linha de verdade no
banco. Dá para apagar (a política de DELETE nunca exige assinatura), então o
estrago é reversível — mas **antes de cobrar de verdade**, o beta merece projeto
Supabase próprio, para que teste nenhum encoste em dado de cliente pagante.

A lista de Redirect URLs já cobre o beta: `.../hit-easy/**` casa com `/beta/`.
