// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Runs the REAL proxy code (lib/supabase/middleware.ts → updateSession) with only the Supabase
 * session stubbed, to prove that a request from the wrong role is turned away at the HTTP layer
 * — i.e. before any admin page or server action executes.
 */
const state: { user: { id: string } | null; role: string | null; profileLookups: number } = {
  user: null,
  role: null,
  profileLookups: 0,
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          state.profileLookups += 1;
          return { data: state.role ? { role: state.role } : null };
        },
      };
      return chain;
    },
  }),
}));

import { updateSession } from "@/lib/supabase/middleware";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

async function visit(path: string, as: string | null) {
  state.user = as === null ? null : { id: "u1" };
  state.role = as;
  state.profileLookups = 0;
  const res = await updateSession(new NextRequest(`https://app.test${path}`));
  const location = res.headers.get("location");
  return { redirected: res.status >= 300 && res.status < 400, path: location ? new URL(location).pathname : null, location };
}

beforeEach(() => {
  state.user = null;
  state.role = null;
  state.profileLookups = 0;
});

describe("proxy role gate — wrong role is redirected BEFORE the page runs", () => {
  it("logged-out visitor → /login (with the page they wanted preserved)", async () => {
    const r = await visit("/admin/users", null);
    expect(r.redirected).toBe(true);
    expect(r.path).toBe("/login");
    expect(r.location).toContain("redirectTo=%2Fadmin%2Fusers");
  });

  it("STUDENT opening an admin page → redirected to the student dashboard", async () => {
    const r = await visit("/admin/users", "student");
    expect(r.redirected).toBe(true);
    expect(r.path).toBe("/student/dashboard");
  });

  it("STUDENT opening ANY admin sub-page (the report's evidence set) → redirected", async () => {
    for (const p of ["/admin/dashboard", "/admin/users", "/admin/analytics", "/admin/audit-logs", "/admin/rewards", "/admin/donations", "/admin/courses", "/admin/settings"]) {
      const r = await visit(p, "student");
      expect(r.redirected, p).toBe(true);
      expect(r.path, p).toBe("/student/dashboard");
    }
  });

  it("STUDENT opening organization or instructor areas → redirected", async () => {
    expect((await visit("/organization/learners", "student")).path).toBe("/student/dashboard");
    expect((await visit("/instructor/courses", "student")).path).toBe("/student/dashboard");
  });

  it("instructor can't open the admin or organization areas", async () => {
    expect((await visit("/admin/users", "instructor")).redirected).toBe(true);
    expect((await visit("/organization/dashboard", "instructor")).redirected).toBe(true);
  });

  it("an ordinary admin can't open /super-admin (sent to the admin dashboard, as the layout did)", async () => {
    const r = await visit("/super-admin/system", "admin");
    expect(r.redirected).toBe(true);
    expect(r.path).toBe("/admin/dashboard");
  });

  it("a signed-in user whose profile row is missing is denied, not waved through", async () => {
    state.user = { id: "ghost" };
    state.role = null;
    const res = await updateSession(new NextRequest("https://app.test/admin/users"));
    expect(res.status).toBeGreaterThanOrEqual(300);
  });
});

describe("proxy role gate — legitimate access is untouched", () => {
  it("moderator, admin, super_admin may open /admin", async () => {
    for (const role of ["moderator", "admin", "super_admin"]) expect((await visit("/admin/users", role)).redirected, role).toBe(false);
  });
  it("only super_admin may open /super-admin", async () => {
    expect((await visit("/super-admin/dashboard", "super_admin")).redirected).toBe(false);
  });
  it("instructor → /instructor, organization → /organization", async () => {
    expect((await visit("/instructor/courses", "instructor")).redirected).toBe(false);
    expect((await visit("/organization/dashboard", "organization")).redirected).toBe(false);
  });
  it("admins can still open the instructor and organization areas (as the layouts allowed)", async () => {
    expect((await visit("/instructor/courses", "admin")).redirected).toBe(false);
    expect((await visit("/organization/dashboard", "admin")).redirected).toBe(false);
  });
  it("every signed-in role can open /student/* — and that path costs NO extra profile lookup", async () => {
    for (const role of ["student", "instructor", "organization", "moderator", "admin", "super_admin"]) {
      const r = await visit("/student/dashboard", role);
      expect(r.redirected, role).toBe(false);
      expect(state.profileLookups, role).toBe(0);
    }
  });
  it("the public course catalogue stays public for logged-out visitors (SEO exception preserved)", async () => {
    expect((await visit("/student/courses", null)).redirected).toBe(false);
    expect((await visit("/student/courses/some-course", null)).redirected).toBe(false);
  });
  it("public pages never trigger a session or profile lookup at all", async () => {
    const r = await visit("/", null);
    expect(r.redirected).toBe(false);
    expect(state.profileLookups).toBe(0);
  });
});
