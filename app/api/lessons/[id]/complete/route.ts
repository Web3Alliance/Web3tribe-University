import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/rbac";
import { completeLessonForStudent } from "@/lib/lesson-completion";

interface CompleteLessonBody {
  enrollmentId: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as CompleteLessonBody;
  if (!body.enrollmentId) return NextResponse.json({ data: null, error: "enrollmentId is required." }, { status: 400 });

  // Ownership + lesson/course membership are verified inside completeLessonForStudent.
  const result = await completeLessonForStudent({ studentId: profile.id, enrollmentId: body.enrollmentId, lessonId });
  if (!result.ok) return NextResponse.json({ data: null, error: result.error }, { status: result.status });

  return NextResponse.json({ data: { success: true }, error: null });
}
