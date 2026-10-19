import type { UserRole } from "@/lib/types";

/**
 * Who may change whose role / ban state. Pure functions (no I/O) so the rules are easy to
 * read and unit-test. The database enforces the same hierarchy in the
 * `protect_profile_columns` trigger (migration 0022) as a backstop — this layer exists so the
 * admin UI can show a clear message instead of a raw database error.
 */

export const ALL_ROLES: readonly UserRole[] = [
  "student",
  "instructor",
  "organization",
  "moderator",
  "admin",
  "super_admin",
];

const ADMIN_TIER: readonly UserRole[] = ["admin", "super_admin"];

export function isUserRole(value: string): value is UserRole {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export type PolicyResult = { ok: true } | { ok: false; error: string };

/** Can `actor` change `target`'s role to `newRole`? */
export function canAssignRole(args: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetRole: UserRole;
  newRole: string;
}): PolicyResult {
  const { actorId, actorRole, targetId, targetRole, newRole } = args;

  if (!isUserRole(newRole)) return { ok: false, error: "That isn't a valid role." };
  if (!ADMIN_TIER.includes(actorRole)) return { ok: false, error: "Not authorized." };
  if (actorId === targetId) return { ok: false, error: "You can't change your own role." };
  if (newRole === targetRole) return { ok: true };

  // Only a super admin may grant or revoke admin-tier roles.
  if (actorRole !== "super_admin" && (ADMIN_TIER.includes(newRole) || ADMIN_TIER.includes(targetRole))) {
    return { ok: false, error: "Only a super admin can grant or revoke admin roles." };
  }
  return { ok: true };
}

/** Can `actor` ban or unban `target`? */
export function canBanUser(args: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetRole: UserRole;
}): PolicyResult {
  const { actorId, actorRole, targetId, targetRole } = args;

  if (!ADMIN_TIER.includes(actorRole)) return { ok: false, error: "Not authorized." };
  if (actorId === targetId) return { ok: false, error: "You can't ban yourself." };
  if (ADMIN_TIER.includes(targetRole) && actorRole !== "super_admin") {
    return { ok: false, error: "Only a super admin can ban or unban an admin." };
  }
  return { ok: true };
}
