"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";

async function assertOwnsCourseOrAdmin(courseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false, supabase: null };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).single();
  const ok = !!course && (course.instructor_id === profile.id || isAdmin(profile));
  return { profile, ok, supabase };
}

export async function addCourseResourceAction(
  courseId: string,
  data: { title: string; description?: string; fileUrl: string; fileType?: string }
) {
  const { ok, supabase, profile } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  if (!data.title || !data.fileUrl) return { error: "Title and file are required." };

  const { count } = await supabase
    .from("course_resources")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { error } = await supabase.from("course_resources").insert({
    course_id: courseId,
    title: data.title,
    description: data.description || null,
    file_url: data.fileUrl,
    file_type: data.fileType || null,
    uploaded_by: profile!.id,
    display_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/student/courses`);
  return { error: null };
}

export async function deleteCourseResourceAction(courseId: string, resourceId: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("course_resources").delete().eq("id", resourceId);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}
