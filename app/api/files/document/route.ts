import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/rbac";
import { courseDocumentPath } from "@/lib/document-links";
import { enforceRateLimit } from "@/lib/rate-limit";

const BUCKET = "course-documents";
const SIGNED_URL_SECONDS = 60;

/**
 * Hands out a short-lived signed link to a private course document, but only to people who may
 * have it: the course's instructor, staff, or a student enrolled (active/completed) in the course
 * the file belongs to. Anonymous visitors and non-enrolled students get 401/403.
 */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Please sign in." }, { status: 401 });

  const limited = await enforceRateLimit("document", profile.id, 120, 600);
  if (limited) return limited;

  const path = courseDocumentPath(
    // accept the bare object path, wrapped so the shared validator checks it
    `/storage/v1/object/public/${BUCKET}/${new URL(request.url).searchParams.get("path") ?? ""}`
  );
  if (!path) return NextResponse.json({ data: null, error: "Invalid file." }, { status: 400 });

  const admin = createAdminClient();
  const like = `%/${BUCKET}/${path}`;

  // Which course(s) does this file belong to? (course resources and lesson resources)
  const courseIds = new Set<string>();
  const [{ data: cr }, { data: lr }] = await Promise.all([
    admin.from("course_resources").select("course_id").like("file_url", like),
    admin.from("lesson_resources").select("lessons(course_id)").like("file_url", like),
  ]);
  for (const r of cr ?? []) courseIds.add(r.course_id as string);
  for (const r of lr ?? []) {
    const l = (r as unknown as { lessons: { course_id: string } | { course_id: string }[] | null }).lessons;
    const one = Array.isArray(l) ? l[0] : l;
    if (one?.course_id) courseIds.add(one.course_id);
  }

  let allowed = false;
  const isStaff = ["moderator", "admin", "super_admin"].includes(profile.role);
  if (isStaff) allowed = true;
  // the uploader's own folder (e.g. a file attached but not yet saved to a resource row)
  if (!allowed && path.split("/")[0] === profile.id) allowed = true;

  if (!allowed && courseIds.size > 0) {
    const ids = [...courseIds];
    const [{ data: owned }, { data: enrolled }] = await Promise.all([
      admin.from("courses").select("id").in("id", ids).eq("instructor_id", profile.id).limit(1),
      admin
        .from("enrollments")
        .select("id")
        .in("course_id", ids)
        .eq("student_id", profile.id)
        .in("status", ["active", "completed"])
        .limit(1),
    ]);
    allowed = (owned?.length ?? 0) > 0 || (enrolled?.length ?? 0) > 0;
  }

  if (!allowed) return NextResponse.json({ data: null, error: "You don't have access to this file." }, { status: 403 });

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return NextResponse.json({ data: null, error: "File not found." }, { status: 404 });

  return NextResponse.redirect(data.signedUrl, 302);
}
