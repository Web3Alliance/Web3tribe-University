import { describe, it, expect, vi } from "vitest";
import { completeLessonForStudent } from "@/lib/lesson-completion";

/** Minimal stand-in for the service-role client: serves one row per table and records RPC calls. */
function makeAdmin(rows: { enrollments?: unknown; lessons?: unknown }, rpcResult: { error: { message: string } | null } = { error: null }) {
  const rpc = vi.fn(async () => ({ data: null, error: rpcResult.error }));
  const from = vi.fn((table: "enrollments" | "lessons") => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: rows[table] ?? null, error: null })),
    };
    return chain;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { admin: { from, rpc } as any, rpc };
}

const ME = "student-me";
const enrollment = { id: "enr-1", student_id: ME, course_id: "course-free" };
const lessonInCourse = { id: "les-1", course_id: "course-free" };
const lessonElsewhere = { id: "les-paid", course_id: "course-paid" };

describe("completeLessonForStudent — the gate in front of the server-only reward function", () => {
  it("pays out when the enrolment is mine and the lesson belongs to its course", async () => {
    const { admin, rpc } = makeAdmin({ enrollments: enrollment, lessons: lessonInCourse });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "enr-1", lessonId: "les-1" }, { admin });

    expect(res).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("complete_lesson", { p_enrollment_id: "enr-1", p_lesson_id: "les-1" });
  });

  it("REFUSES someone else's enrolment (403) and never reaches the database function", async () => {
    const { admin, rpc } = makeAdmin({ enrollments: { ...enrollment, student_id: "someone-else" }, lessons: lessonInCourse });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "enr-1", lessonId: "les-1" }, { admin });

    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("REFUSES a lesson from a different (e.g. paid) course (400) and never pays out", async () => {
    const { admin, rpc } = makeAdmin({ enrollments: enrollment, lessons: lessonElsewhere });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "enr-1", lessonId: "les-paid" }, { admin });

    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 404 for an enrolment that doesn't exist", async () => {
    const { admin, rpc } = makeAdmin({ enrollments: null, lessons: lessonInCourse });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "nope", lessonId: "les-1" }, { admin });

    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a lesson id that doesn't exist (400)", async () => {
    const { admin, rpc } = makeAdmin({ enrollments: enrollment, lessons: null });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "enr-1", lessonId: "ghost" }, { admin });

    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces a database-function failure as a 500 with its message", async () => {
    const { admin } = makeAdmin({ enrollments: enrollment, lessons: lessonInCourse }, { error: { message: "boom" } });
    const res = await completeLessonForStudent({ studentId: ME, enrollmentId: "enr-1", lessonId: "les-1" }, { admin });

    expect(res).toMatchObject({ ok: false, status: 500, error: expect.stringContaining("boom") });
  });
});
