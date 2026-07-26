import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_RANK: Record<UserRole, number> = {
  student: 0,
  instructor: 1,
  organization: 1,
  moderator: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Fetches the current authenticated user's profile (including role) on the
 * server. Returns null if not authenticated. This is the single source of
 * truth for "who is calling this route and what is their role" across all
 * API routes — and it's called from nearly every layout AND every page
 * beneath it (33 call sites), which meant a single page load was paying
 * for this function's getUser() network round-trip PLUS its profiles query
 * two, three, sometimes four times over, fully serialized, before any
 * actual page content could even start rendering. Wrapping it in React's
 * cache() deduplicates identical calls within a single request/render
 * pass — the real work now happens exactly once per request no matter how
 * many places call it, with zero changes needed at any call site.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

/** Throws-free check: does this profile meet or exceed the given minimum role? */
export function hasRoleAtLeast(profile: Profile | null, minRole: UserRole): boolean {
  if (!profile) return false;
  return ROLE_RANK[profile.role] >= ROLE_RANK[minRole];
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "super_admin";
}

export function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.role === "super_admin";
}

export function isModeratorOrAbove(profile: Profile | null): boolean {
  return hasRoleAtLeast(profile, "moderator");
}

export function isInstructor(profile: Profile | null): boolean {
  return profile?.role === "instructor";
}

/**
 * Convenience guard for API routes: returns the profile if it meets the role
 * requirement, otherwise returns null. Route handlers should respond 401/403
 * accordingly. Example:
 *
 *   const profile = await requireRole("admin");
 *   if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 */
export async function requireRole(minRole: UserRole): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!hasRoleAtLeast(profile, minRole)) return null;
  return profile;
}
