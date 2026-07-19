import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * PRIVILEGED client for BizDoc's SEPARATE Supabase project — not the same
 * database as Web3tribe University. This exists solely because BizDoc's
 * Paystack subscription-activation webhook shares the same Paystack account
 * as Web3tribe University (Paystack only allows one webhook URL per account),
 * so the consolidated webhook in app/api/payments/webhook/route.ts needs to
 * be able to write to BizDoc's database when a webhook call turns out to be
 * a BizDoc subscription payment rather than a Web3tribe donation or W3TR
 * purchase.
 *
 * Requires BIZDOC_SUPABASE_URL and BIZDOC_SUPABASE_SERVICE_ROLE_KEY to be set
 * as environment variables in this project's deployment — set directly in
 * Netlify, never committed to the repo or shared outside of it.
 */
export function createBizdocAdminClient() {
  const url = process.env.BIZDOC_SUPABASE_URL;
  const serviceRoleKey = process.env.BIZDOC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "BIZDOC_SUPABASE_URL and BIZDOC_SUPABASE_SERVICE_ROLE_KEY must both be set to process BizDoc subscription webhooks."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}