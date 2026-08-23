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

## 2. Login com Google e Apple

**Authentication → Providers**, no painel do Supabase.

- **Google**: crie credenciais OAuth em <https://console.cloud.google.com>
  (tipo *Web application*). Em *Authorized redirect URIs*, cole a URL de callback
  que o próprio Supabase mostra na tela do provider.
- **Apple**: exige conta de desenvolvedor paga (US$ 99/ano). Se não valer agora,
  deixe só Google — o link mágico por e-mail cobre todo o resto, inclusive iPhone.

Em **Authentication → URL Configuration**, adicione a URL publicada
(`https://alienlopes.github.io/hit-easy/`) em *Redirect URLs*. Sem isso o login
volta para lugar nenhum.

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
| Tela de conta e de assinatura | a fazer |
| Fila de envio para partidas terminadas offline | a fazer |
| Edge Function do webhook do Stripe | a fazer |

O que já está escrito foi testado sem servidor: estados de conta, tolerância de
assinatura vencida, sessão expirada, ida e volta da partida pelo banco e o
cálculo do que falta subir. O que fala com a rede **ainda não foi exercitado
contra um Supabase de verdade** — só depois do passo 1.
