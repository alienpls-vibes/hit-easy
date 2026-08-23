/**
 * Ligacao com a nuvem.
 *
 * Enquanto estiver vazio, o app roda exatamente como sempre rodou: tudo local,
 * sem conta, sem paywall. Preencher aqui liga o modo de nuvem.
 *
 * Estas duas chaves sao PUBLICAS de proposito - a `anon key` do Supabase e
 * feita para viver no navegador. Quem protege os dados e o RLS do banco (ver
 * sql/schema.sql), nao o segredo da chave. A chave de servico, essa sim
 * secreta, nunca entra neste arquivo nem em lugar nenhum do cliente.
 */

export const SUPABASE_URL = 'https://yhfaljorodjnofvkhtul.supabase.co';
// FALTA: Supabase -> Settings -> API -> chave `anon public`.
// Enquanto vazia, cloudEnabled() e false e o app roda 100% local.
export const SUPABASE_ANON_KEY = '';

/** Link do Stripe para assinar. Preencher depois de criar o produto. */
export const CHECKOUT_URL = '';

/** Ha nuvem configurada? Sem isso o app fica no modo local de sempre. */
export function cloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
