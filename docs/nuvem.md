# Ligando a nuvem

Passo a passo do que precisa ser feito nas contas — só você pode, porque envolve
cadastro, cobrança e chaves.

Enquanto `src/config.js` estiver vazio, o app roda como sempre rodou: local, sem
conta, sem paywall. Nada aqui quebra o que já funciona.

---

## 1. Supabase (banco + contas)

1. Crie um projeto em <https://supabase.com> — plano gratuito serve.
   Guarde a região mais próxima (São Paulo, se houver).
2. **SQL Editor** → cole `sql/schema.sql` inteiro → **Run**.
   Cria tabelas, índices e as políticas de acesso. É idempotente: rodar de novo
   não quebra nada.
3. **Settings → API**: copie `Project URL` e a chave `anon public`.
4. Cole os dois em `src/config.js`.

A `anon key` é pública de propósito — ela nasce para viver no navegador. Quem
protege os dados é o RLS do banco, não o sigilo dela. A chave `service_role`,
essa sim secreta, **nunca** entra no cliente; ela só é usada no passo 3.

### Confira que o portão fechou

No SQL Editor, depois de criar sua conta pelo app:

```sql
-- Deve devolver 0 linhas: você ainda não assina.
select count(*) from public.matches;
```

Se devolver suas partidas sem assinatura ativa, alguma política não foi aplicada
— confira em **Authentication → Policies** se o RLS está ligado em `matches`.

---

## 2. Como se entra

**E-mail e senha** é o caminho normal, e funciona em qualquer aparelho sem
depender da caixa de entrada. Quem chegou por link mágico define uma senha uma
vez nas configurações e nunca mais precisa de e-mail.

O **link por e-mail** continua ali, discreto: é o caminho de quem esqueceu a
senha, e o único que não exige lembrar de nada.

A sessão **se renova sozinha** pelo `refresh_token`. Antes disso ela era
descartada ao vencer — o login durava uma hora e depois exigia um e-mail novo,
para sempre. Se o servidor recusar o token no meio de uma sincronização, o app
tenta renovar e refaz o pedido uma vez antes de desistir.

O mínimo de senha aqui é 8 caracteres; o do Supabase é 6. Ser mais exigente que
o servidor é seguro — o contrário produziria um 400 que o app não previu.

## 2b. Login com Google e Apple

**Authentication → Providers**, no painel do Supabase.

- **Google**: crie credenciais OAuth em <https://console.cloud.google.com>
  (tipo *Web application*). Em *Authorized redirect URIs*, cole a URL de callback
  que o próprio Supabase mostra na tela do provider.
- **Apple**: exige conta de desenvolvedor paga (US$ 99/ano). Se não valer agora,
  deixe só Google — o link mágico por e-mail cobre todo o resto, inclusive iPhone.

### URL Configuration — os dois campos

Em **Authentication → URL Configuration** há dois campos, e eles fazem coisas
diferentes. Preencher só um foi o que fez o primeiro login real cair em
`localhost:3000`.

| campo | o que é | valor |
|---|---|---|
| **Site URL** | destino padrão, usado quando o pedido não manda nenhum | `https://alienpls-vibes.github.io/hit-easy/` |
| **Redirect URLs** | lista do que é *permitido* — não escolhe nada sozinha | `https://alienpls-vibes.github.io/hit-easy/**` |

O Site URL nasce como `http://localhost:3000`. Enquanto ficar assim, todo link
que chegar sem destino explícito aponta para uma porta que não existe no celular
de ninguém. Troque-o.

Vale como rede de segurança mesmo com o app pedindo o destino certo: se um dia o
`redirect_to` sumir do pedido, o pior caso passa a ser voltar para a home em vez
de morrer no localhost.

---

## 3. Stripe (assinatura)

1. Conta em <https://stripe.com>, modo teste primeiro.
2. **Products** → crie "Hit Easy" com preço recorrente (mensal e/ou anual).
3. **Payment Links** → gere um link para esse preço → cole em `CHECKOUT_URL`
   dentro de `src/config.js`.
4. O webhook precisa de código no servidor, porque só ele pode escrever na
   tabela `subscriptions` (o app não tem permissão, e é assim que deve ser).
   Vai como **Supabase Edge Function** — ainda a escrever.

O que o webhook faz: ouve `checkout.session.completed`,
`customer.subscription.updated` e `.deleted`, e grava `status` e
`current_period_end` na linha do usuário. É o único lugar do sistema que decide
quem assina.

**Antes de cobrar de verdade:** política de privacidade (você passa a guardar
nomes de terceiros — LGPD), e alguma forma de emitir nota. Um MEI resolve.

---

## Estado do trabalho

| parte | situação |
|---|---|
| Esquema do banco e políticas de acesso | pronto (`sql/schema.sql`) |
| Cliente de conta e partidas | pronto (`src/cloud.js`) |
| Testes da lógica de conta e sincronização | prontos, 5 casos |
| Provisionar Supabase e colar as chaves | **com você** |
| Histórico sair do aparelho e ir para a nuvem | a fazer |
| Tela de conta e login por link mágico | pronto, testado com e-mail real |
| Portão do RLS contra o Supabase de verdade | conferido: grava, lê vazio sem assinatura, apaga |
| Tela de assinatura | a fazer |
| Fila de envio para partidas terminadas offline | a fazer |
| Edge Function do webhook do Stripe | a fazer |

O que fala com a rede já foi exercitado contra o Supabase de verdade, com uma
sessão autenticada na mão: gravar partida devolveu `201`, ler de volta sem
assinatura devolveu `[]` (o portão fechado, exatamente como projetado), e apagar
devolveu `204` mesmo sem assinar — o direito de tirar o próprio dado não pode
depender de pagamento.

---

## 4. Participantes de uma partida (v1)

Rode `sql/002-participantes.sql` no SQL Editor, depois de `schema.sql`.

O problema: a partida tem **um** aparelho que a registrou e **vários** jogadores.
Quem jogou no celular do amigo não tinha aquela partida.

A solução **não** é o anfitrião marcar `@fulano` e pronto — isso deixaria outra
pessoa escrever no seu histórico. O anfitrião **convida**; a partida só entra no
histórico de alguém quando essa pessoa aceita. Quem confia no anfitrião marca
"aceitar sempre" e nunca mais pensa nisso.

| peça | onde |
|---|---|
| `@` público, busca só por igualdade exata | `profiles` + `buscar_handle()` |
| quem sentou em cada cadeira | `match_players` |
| aceitar sozinho de quem você confia | `trusted_hosts` + gatilho |
| quem te convidou, sem entregar a partida | `anfitriao_do_convite()` |

Dois pontos que valem saber:

**O convite aparece sem assinatura, de propósito.** Quem não assina precisa ver
que há partidas esperando, senão nunca aceita e nunca soube que existiam. Ler o
*conteúdo* é que é pago — e "3 partidas esperando por você" é o melhor argumento
de conversão que o app tem.

**Apagar não reescreve o passado alheio.** Se o anfitrião apagar uma mesa que
outra pessoa já aceitou, a linha perde o dono em vez de morrer. Para o anfitrião
o efeito é o mesmo (some da conta dele); para o convidado, o histórico continua
de pé. Sem isso, apagar viraria um jeito de editar a estatística dos outros.
