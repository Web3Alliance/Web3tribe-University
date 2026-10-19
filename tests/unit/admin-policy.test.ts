import { describe, it, expect } from "vitest";
import { canAssignRole, canBanUser, isUserRole } from "@/lib/admin-policy";
import type { UserRole } from "@/lib/types";

const base = { actorId: "actor", targetId: "target" };
const assign = (actorRole: UserRole, targetRole: UserRole, newRole: string, ids = base) =>
  canAssignRole({ ...ids, actorRole, targetRole, newRole });

describe("canAssignRole", () => {
  it("rejects values that aren't real roles (the old code accepted any string)", () => {
    expect(assign("super_admin", "student", "god")).toEqual({ ok: false, error: "That isn't a valid role." });
    expect(assign("super_admin", "student", "")).toMatchObject({ ok: false });
  });

  it("an ordinary admin can NOT make anyone super_admin or admin", () => {
    expect(assign("admin", "student", "super_admin")).toMatchObject({ ok: false });
    expect(assign("admin", "student", "admin")).toMatchObject({ ok: false });
  });

  it("an ordinary admin can NOT demote an admin or super_admin either", () => {
    expect(assign("admin", "super_admin", "student")).toMatchObject({ ok: false });
    expect(assign("admin", "admin", "student")).toMatchObject({ ok: false });
  });

  it("an admin can still manage the non-admin roles", () => {
    for (const r of ["student", "instructor", "organization", "moderator"] as UserRole[]) {
      expect(assign("admin", "student", r)).toEqual({ ok: true });
    }
    expect(assign("admin", "instructor", "student")).toEqual({ ok: true });
  });

  it("a super_admin can grant and revoke admin-tier roles", () => {
    expect(assign("super_admin", "student", "admin")).toEqual({ ok: true });
    expect(assign("super_admin", "admin", "student")).toEqual({ ok: true });
    expect(assign("super_admin", "student", "super_admin")).toEqual({ ok: true });
  });

  it("nobody can change their OWN role (no self-promotion, no accidental lock-out)", () => {
    const self = { actorId: "same", targetId: "same" };
    expect(assign("admin", "admin", "student", self)).toMatchObject({ ok: false });
    expect(assign("super_admin", "super_admin", "student", self)).toMatchObject({ ok: false });
    expect(assign("admin", "admin", "super_admin", self)).toMatchObject({ ok: false });
  });

  it("non-admin actors are refused outright", () => {
    for (const r of ["student", "instructor", "organization", "moderator"] as UserRole[]) {
      expect(assign(r, "student", "instructor")).toMatchObject({ ok: false });
    }
  });
});

describe("canBanUser", () => {
  const ban = (actorRole: UserRole, targetRole: UserRole, ids = base) => canBanUser({ ...ids, actorRole, targetRole });

  it("an admin can ban ordinary users", () => {
    for (const r of ["student", "instructor", "organization", "moderator"] as UserRole[]) {
      expect(ban("admin", r)).toEqual({ ok: true });
    }
  });
  it("an ordinary admin can NOT ban or unban an admin or super_admin", () => {
    expect(ban("admin", "super_admin")).toMatchObject({ ok: false });
    expect(ban("admin", "admin")).toMatchObject({ ok: false });
  });
  it("a super_admin can ban an admin", () => {
    expect(ban("super_admin", "admin")).toEqual({ ok: true });
  });
  it("nobody can ban themselves", () => {
    expect(ban("super_admin", "super_admin", { actorId: "x", targetId: "x" })).toMatchObject({ ok: false });
  });
  it("non-admins can't ban anyone", () => {
    expect(ban("moderator", "student")).toMatchObject({ ok: false });
    expect(ban("student", "student")).toMatchObject({ ok: false });
  });
});

describe("isUserRole", () => {
  it("accepts exactly the six roles", () => {
    for (const r of ["student", "instructor", "organization", "moderator", "admin", "super_admin"]) expect(isUserRole(r)).toBe(true);
    for (const r of ["", "root", "ADMIN", "super-admin", "owner"]) expect(isUserRole(r)).toBe(false);
  });
});
