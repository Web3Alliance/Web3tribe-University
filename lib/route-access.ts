import type { UserRole } from "@/lib/types";

/**
 * Which roles may open which areas of the app. This is the single source of truth used by
 * the proxy (middleware), so a request from the wrong role is turned away at the HTTP layer
 * BEFORE any page code runs or loads any data.
 *
 * Why this exists: the role checks used to live only in each area's layout. In the Next.js
 * App Router a layout and its page render in parallel, and a layout `redirect()` does not
 * stop the page from fetching and streaming its data — so a student could still receive the
 * admin pages' data. Layouts keep their own checks (defence in depth), but they are not the
 * security boundary any more.
 *
 * Rules mirror the existing layouts exactly. `/student/*` is open to every signed-in role.
 */
export interface RouteRule {
  prefix: string;
  roles: readonly UserRole[];
  /** Where a signed-in user with the wrong role is sent. */
  fallback: string;
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: "/super-admin", roles: ["super_admin"], fallback: "/admin/dashboard" },
  { prefix: "/admin", roles: ["moderator", "admin", "super_admin"], fallback: "/student/dashboard" },
  { prefix: "/instructor", roles: ["instructor", "admin", "super_admin"], fallback: "/student/dashboard" },
  { prefix: "/organization", roles: ["organization", "admin", "super_admin"], fallback: "/student/dashboard" },
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** The rule that applies to this path, if it is a role-restricted area. */
export function ruleForPath(pathname: string): RouteRule | null {
  return ROUTE_RULES.find((r) => underPrefix(pathname, r.prefix)) ?? null;
}

export type RouteAccess = { allowed: true } | { allowed: false; redirectTo: string };

/** Decide whether `role` may open `pathname`. Unknown/missing role is treated as no access. */
export function resolveRouteAccess(pathname: string, role: UserRole | null | undefined): RouteAccess {
  const rule = ruleForPath(pathname);
  if (!rule) return { allowed: true };
  if (role && rule.roles.includes(role)) return { allowed: true };
  return { allowed: false, redirectTo: rule.fallback };
}
