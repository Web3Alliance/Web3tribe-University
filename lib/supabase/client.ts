import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase client, safe to use in "use client" components.
 * Uses the anon key; all access control is enforced by Postgres RLS
 * (see supabase/migrations/0001_schema.sql).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
