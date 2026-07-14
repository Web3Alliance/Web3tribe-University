import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * PRIVILEGED client using the service_role key. This bypasses Row Level Security
 * entirely, so it must NEVER be imported into any "use client" file or exposed to
 * the browser bundle. Use only inside Route Handlers / Server Actions for genuinely
 * admin-only operations (e.g. deleting a user, forcing a KYC-style verification,
 * broad analytics queries across all users' data).
 *
 * Every route that uses this client MUST perform its own explicit role check
 * (see lib/rbac.ts) before doing anything privileged — this client does not
 * know or care who is calling it.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This is required for admin-only server operations."
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
