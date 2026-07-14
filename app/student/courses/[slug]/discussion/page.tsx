import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModeratorOrAbove } from "@/lib/rbac";
import { DiscussionBoard } from "@/components/discussion/discussion-board";
import type { DiscussionThread, DiscussionReply } from "@/lib/types";

export const metadata = { title: "Discussion" };

export default async function CourseDiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=/student/courses/${slug}/discussion`);

  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, instructor_id")
    .eq("slug", slug)
    .single();
  if (!course) notFound();

  const isInstructor = course.instructor_id === profile.id;
  const canModerate = isModeratorOrAbove(profile);

  if (!isInstructor && !canModerate) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course.id)
      .eq("student_id", profile.id)
      .maybeSingle();
    if (!enrollment) redirect(`/student/courses/${slug}`);
  }

  const [{ data: threadsRaw }, { data: repliesRaw }, { data: myReactions }] = await Promise.all([
    supabase
      .from("discussion_threads")
      .select("*, author:profiles(full_name,avatar_url,role)")
      .eq("course_id", course.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("discussion_replies")
      .select("*, author:profiles(full_name,avatar_url,role), thread:discussion_threads!inner(course_id)")
      .eq("thread.course_id", course.id)
      .order("created_at", { ascending: true }),
    supabase.from("discussion_reactions").select("thread_id,reply_id,reaction").eq("profile_id", profile.id),
  ]);

  const myReactionByThread = new Map<string, "like" | "dislike">();
  const myReactionByReply = new Map<string, "like" | "dislike">();
  for (const r of myReactions ?? []) {
    if (r.thread_id) myReactionByThread.set(r.thread_id, r.reaction);
    if (r.reply_id) myReactionByReply.set(r.reply_id, r.reaction);
  }

  const repliesByThread = new Map<string, DiscussionReply[]>();
  for (const rep of (repliesRaw as unknown as (DiscussionReply & { thread_id: string })[]) ?? []) {
    const list = repliesByThread.get(rep.thread_id) ?? [];
    list.push({ ...rep, my_reaction: myReactionByReply.get(rep.id) ?? null });
    repliesByThread.set(rep.thread_id, list);
  }

  const threads: (DiscussionThread & { replies: DiscussionReply[] })[] = ((threadsRaw as unknown as DiscussionThread[]) ?? []).map(
    (t) => ({
      ...t,
      my_reaction: myReactionByThread.get(t.id) ?? null,
      replies: repliesByThread.get(t.id) ?? [],
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/student/courses/${slug}`} className="mb-2 inline-block text-sm text-primary hover:underline">
          ← Back to {course.title}
        </Link>
        <h1 className="text-2xl font-bold">Discussion</h1>
        <p className="text-muted-foreground">
          Ask questions, get answers from your instructor, and connect with other learners in this course.
        </p>
      </div>

      <DiscussionBoard
        courseId={course.id}
        courseSlug={slug}
        currentProfileId={profile.id}
        canModerate={canModerate}
        initialThreads={threads}
      />
    </div>
  );
}
