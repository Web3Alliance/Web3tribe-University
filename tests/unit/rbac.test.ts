import { describe, it, expect } from "vitest";
import { hasRoleAtLeast, isAdmin, isSuperAdmin, isModeratorOrAbove, isInstructor } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

function makeProfile(role: Profile["role"]): Profile {
  return {
    id: "test-id",
    email: "test@example.com",
    full_name: "Test User",
    username: null,
    avatar_url: null,
    bio: null,
    role,
    phone: null,
    phone_verified: false,
    country: null,
    state_region: null,
    timezone: "Africa/Lagos",
    is_instructor_verified: false,
    is_active: true,
    is_banned: false,
    ban_reason: null,
    two_factor_enabled: false,
    onboarding_completed: true,
    theme_preference: "system",
    last_seen_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("hasRoleAtLeast", () => {
  it("returns false for a null profile", () => {
    expect(hasRoleAtLeast(null, "student")).toBe(false);
  });

  it("allows a higher-ranked role to satisfy a lower minimum", () => {
    expect(hasRoleAtLeast(makeProfile("admin"), "student")).toBe(true);
    expect(hasRoleAtLeast(makeProfile("super_admin"), "moderator")).toBe(true);
  });

  it("denies a lower-ranked role from satisfying a higher minimum", () => {
    expect(hasRoleAtLeast(makeProfile("student"), "admin")).toBe(false);
    expect(hasRoleAtLeast(makeProfile("moderator"), "super_admin")).toBe(false);
  });

  it("allows a role to satisfy its own exact minimum", () => {
    expect(hasRoleAtLeast(makeProfile("moderator"), "moderator")).toBe(true);
  });

  it("treats instructor and organization as the same rank tier", () => {
    expect(hasRoleAtLeast(makeProfile("instructor"), "organization")).toBe(true);
    expect(hasRoleAtLeast(makeProfile("organization"), "instructor")).toBe(true);
  });
});

describe("isAdmin", () => {
  it("is true for admin and super_admin only", () => {
    expect(isAdmin(makeProfile("admin"))).toBe(true);
    expect(isAdmin(makeProfile("super_admin"))).toBe(true);
    expect(isAdmin(makeProfile("moderator"))).toBe(false);
    expect(isAdmin(makeProfile("student"))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("is true only for super_admin", () => {
    expect(isSuperAdmin(makeProfile("super_admin"))).toBe(true);
    expect(isSuperAdmin(makeProfile("admin"))).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe("isModeratorOrAbove", () => {
  it("is true for moderator, admin, and super_admin", () => {
    expect(isModeratorOrAbove(makeProfile("moderator"))).toBe(true);
    expect(isModeratorOrAbove(makeProfile("admin"))).toBe(true);
    expect(isModeratorOrAbove(makeProfile("super_admin"))).toBe(true);
  });

  it("is false for student, instructor, and organization", () => {
    expect(isModeratorOrAbove(makeProfile("student"))).toBe(false);
    expect(isModeratorOrAbove(makeProfile("instructor"))).toBe(false);
    expect(isModeratorOrAbove(makeProfile("organization"))).toBe(false);
  });
});

describe("isInstructor", () => {
  it("is true only for the instructor role specifically", () => {
    expect(isInstructor(makeProfile("instructor"))).toBe(true);
    expect(isInstructor(makeProfile("admin"))).toBe(false);
    expect(isInstructor(makeProfile("organization"))).toBe(false);
  });
});
