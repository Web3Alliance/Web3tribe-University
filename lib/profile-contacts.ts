import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Private profile details (email, phone, location) are no longer readable straight from the
 * profiles table by signed-in users (migration 0025). The database hands them out only through
 * the profile_contacts() function, and only for people the caller has a real relationship with:
 * their own learners/cohort students, their organization's members and applicants, or - for
 * staff - anyone. Anyone else simply is not returned.
 */
export interface ProfileContact {
  id: string;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  country: string | null;
  state_region: string | null;
  lga: string | null;
}

export async function fetchContacts(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, ProfileContact>> {
  const unique = Array.from(new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0)));
  const map = new Map<string, ProfileContact>();
  if (unique.length === 0) return map;
  const { data } = await supabase.rpc("profile_contacts", { p_ids: unique });
  for (const row of (data ?? []) as ProfileContact[]) map.set(row.id, row);
  return map;
}

/**
 * Convenience for pages that embed a public profile in each row and also need the private
 * contact fields: returns the rows with the allowed contact details merged into row[key].
 * People the caller may not see simply keep only their public fields.
 */
export async function withContacts<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  rows: T[] | null | undefined,
  key: string,
  idOf: (row: T) => string | null | undefined
  // Pages read arbitrary embedded fields off the merged row, so the merged value is deliberately loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<T & Record<string, any>>> {
  const list = rows ?? [];
  const contacts = await fetchContacts(supabase, list.map(idOf));
  return list.map((row) => {
    const id = idOf(row);
    const extra = id ? contacts.get(id) : undefined;
    const base = (row[key] as Record<string, unknown> | null) ?? {};
    return { ...row, [key]: extra ? { ...base, ...extra } : { ...base } };
  });
}
