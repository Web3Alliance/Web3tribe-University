"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModeratorOrAbove } from "@/lib/rbac";

async function assertCanParticipate(courseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false, supabase: null };
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).single();
  if (!course) return { profile, ok: false, supabase };

  if (course.instructor_id === profile.id || isModeratorOrAbove(profile)) {
    return { profile, ok: true, supabase, isInstructor: course.instructor_id === profile.id };
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", profile.id)
    .maybeSingle();

  return { profile, ok: !!enrollment, supabase, isInstructor: false };
}

export async function createThreadAction(courseId: string, courseSlug: string, title: string, body: string) {
  const { ok, profile, supabase } = await assertCanParticipate(courseId);
  if (!ok || !supabase || !profile) return { error: "You must be enrolled in this course to post." };
  if (!title.trim() || !body.trim()) return { error: "Both a title and a question are required." };

  const { error } = await supabase.from("discussion_threads").insert({
    course_id: courseId,
    author_id: profile.id,
    title: title.trim(),
    body: body.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}/discussion`);
  return { error: null };
}

export async function createReplyAction(
  threadId: string,
  courseId: string,
  courseSlug: string,
  body: string
) {
  const { ok, profile, supabase, isInstructor } = await assertCanParticipate(courseId);
  if (!ok || !supabase || !profile) return { error: "You must be enrolled in this course to reply." };
  if (!body.trim()) return { error: "Reply cannot be empty." };

  const { error } = await supabase.from("discussion_replies").insert({
    thread_id: threadId,
    author_id: profile.id,
    body: body.trim(),
    is_instructor_reply: !!isInstructor,
  });
  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}/discussion`);
  return { error: null };
}

/**
 * Toggles a like/dislike on a thread or reply (exactly one of threadId/replyId
 * should be provided). Clicking the same reaction again removes it; clicking the
 * other reaction switches it. Auto-deletion at 5 dislikes is handled entirely by
 * the database trigger in migration 0004 — this action just records the vote.
 */
export async function reactAction(
  target: { threadId?: string; replyId?: string },
  reaction: "like" | "dislike"
) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to react." };

  const supabase = await createClient();
  const column = target.threadId ? "thread_id" : "reply_id";
  const value = target.threadId ?? target.replyId;

  const { data: existing } = await supabase
    .from("discussion_reactions")
    .select("id, reaction")
    .eq(column, value)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    const { error } = await supabase.from("discussion_reactions").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    return { error: null, action: "removed" as const };
  }

  if (existing) {
    const { error } = await supabase.from("discussion_reactions").update({ reaction }).eq("id", existing.id);
    if (error) return { error: error.message };
    return { error: null, action: "switched" as const };
  }

  const { error } = await supabase.from("discussion_reactions").insert({ [column]: value, profile_id: profile.id, reaction });
  if (error) return { error: error.message };
  return { error: null, action: "added" as const };
}

export async function deleteThreadAction(threadId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase.from("discussion_threads").delete().eq("id", threadId);
  if (error) return { error: error.message };
  revalidatePath(`/student/courses/${courseSlug}/discussion`);
  return { error: null };
}

export async function deleteReplyAction(replyId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase.from("discussion_replies").delete().eq("id", replyId);
  if (error) return { error: error.message };
  revalidatePath(`/student/courses/${courseSlug}/discussion`);
  return { error: null };
}
