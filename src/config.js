/**
 * Ligacao com a nuvem.
 *
 * Enquanto estiver vazio, o app roda exatamente como sempre rodou: tudo local,
 * sem conta, sem paywall. Preencher aqui liga o modo de nuvem.
 *
 * A chave abaixo e PUBLICA de proposito - `sb_publishable_` nasce para viver no
 * navegador, e o Supabase a expoe justamente para isso. Quem protege os dados e
 * o RLS do banco (ver sql/schema.sql), nao o sigilo dela. A chave secreta
 * (`sb_secret_`) nunca entra neste arquivo nem em lugar nenhum do cliente.
 */

export const SUPABASE_URL = 'https://yhfaljorodjnofvkhtul.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_GCoTZWFswigZtaaX3yTVtA_aRMdvrxq';

/** Link do Stripe para assinar. Preencher depois de criar o produto. */
export const CHECKOUT_URL = '';

/** Ha nuvem configurada? Sem isso o app fica no modo local de sempre. */
export function cloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
