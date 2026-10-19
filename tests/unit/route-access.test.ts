import { describe, it, expect } from "vitest";
import { resolveRouteAccess, ruleForPath, ROUTE_RULES } from "@/lib/route-access";
import type { UserRole } from "@/lib/types";

const ALL: UserRole[] = ["student", "instructor", "organization", "moderator", "admin", "super_admin"];

function allowedRoles(path: string): UserRole[] {
  return ALL.filter((r) => resolveRouteAccess(path, r).allowed);
}

describe("resolveRouteAccess — who may open which area", () => {
  it("/admin: moderator, admin and super_admin only", () => {
    expect(allowedRoles("/admin/users")).toEqual(["moderator", "admin", "super_admin"]);
    expect(allowedRoles("/admin")).toEqual(["moderator", "admin", "super_admin"]);
  });

  it("/super-admin: super_admin only", () => {
    expect(allowedRoles("/super-admin/system")).toEqual(["super_admin"]);
  });

  it("/instructor: instructor, admin, super_admin", () => {
    expect(allowedRoles("/instructor/courses")).toEqual(["instructor", "admin", "super_admin"]);
  });

  it("/organization: organization, admin, super_admin", () => {
    expect(allowedRoles("/organization/learners")).toEqual(["organization", "admin", "super_admin"]);
  });

  it("/student/*: every signed-in role may enter (as before)", () => {
    expect(allowedRoles("/student/dashboard")).toEqual(ALL);
  });

  it("a student hitting an admin page is redirected away, not shown the page", () => {
    expect(resolveRouteAccess("/admin/users", "student")).toEqual({ allowed: false, redirectTo: "/student/dashboard" });
    expect(resolveRouteAccess("/admin/users?q=a", "student").allowed).toBe(false);
  });

  it("an admin hitting /super-admin is sent to the admin dashboard (matches the old layout)", () => {
    expect(resolveRouteAccess("/super-admin/system", "admin")).toEqual({ allowed: false, redirectTo: "/admin/dashboard" });
  });

  it("a missing / unknown role is treated as NO access to restricted areas", () => {
    expect(resolveRouteAccess("/admin/users", null).allowed).toBe(false);
    expect(resolveRouteAccess("/admin/users", undefined).allowed).toBe(false);
    expect(resolveRouteAccess("/admin/users", "root" as UserRole).allowed).toBe(false);
  });

  it("matches on a path boundary: /administrator or /adminx are NOT the /admin area", () => {
    expect(ruleForPath("/administrator")).toBeNull();
    expect(ruleForPath("/adminx/stuff")).toBeNull();
    expect(ruleForPath("/admin")?.prefix).toBe("/admin");
    expect(ruleForPath("/admin/")?.prefix).toBe("/admin");
  });

  it("/super-admin is not accidentally swallowed by the shorter /admin rule", () => {
    expect(ruleForPath("/super-admin/dashboard")?.prefix).toBe("/super-admin");
  });

  it("public pages are never restricted", () => {
    for (const path of ["/", "/login", "/register", "/verify/ABC123", "/impact", "/privacy", "/student/courses"]) {
      expect(ruleForPath(path)).toBeNull();
    }
  });

  it("every rule's fallback lands somewhere that role can actually go (no redirect loops)", () => {
    for (const rule of ROUTE_RULES) {
      // a student can always reach /student/*; an admin can always reach /admin/*
      const dest = rule.fallback;
      const roleAtDest = dest.startsWith("/admin") ? "admin" : "student";
      expect(resolveRouteAccess(dest, roleAtDest as UserRole).allowed).toBe(true);
    }
  });
});
