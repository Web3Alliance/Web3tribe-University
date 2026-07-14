"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactionButtons } from "@/components/discussion/reaction-buttons";
import {
  createThreadAction,
  createReplyAction,
  deleteThreadAction,
  deleteReplyAction,
} from "@/lib/actions/discussions";
import { initials, formatRelativeTime } from "@/lib/utils";
import type { DiscussionThread, DiscussionReply } from "@/lib/types";

type ThreadWithReplies = DiscussionThread & { replies: DiscussionReply[] };

export function DiscussionBoard({
  courseId,
  courseSlug,
  currentProfileId,
  canModerate,
  initialThreads,
}: {
  courseId: string;
  courseSlug: string;
  currentProfileId: string;
  canModerate: boolean;
  initialThreads: ThreadWithReplies[];
}) {
  const router = useRouter();

  // Realtime: any insert/update/delete on this course's threads, or on any reply,
  // triggers a refetch of the server-rendered page. This keeps the "chat" feeling
  // live across everyone viewing the same course discussion, without the fragility
  // of manually reconstructing joined author/reaction data from raw Realtime
  // payloads. A short debounce avoids refetching too often if several changes
  // land in quick succession.
  React.useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`discussion:${courseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discussion_threads", filter: `course_id=eq.${courseId}` },
        scheduleRefresh
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "discussion_replies" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [courseId, router]);

  return (
    <div className="space-y-6">
      <NewThreadForm courseId={courseId} courseSlug={courseSlug} />

      {initialThreads.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-8 w-8" />
            No questions yet. Be the first to ask!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {initialThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              courseSlug={courseSlug}
              courseId={courseId}
              currentProfileId={currentProfileId}
              canModerate={canModerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewThreadForm({ courseId, courseSlug }: { courseId: string; courseSlug: string }) {
  const [isPending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");

  function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in both fields.");
      return;
    }
    startTransition(async () => {
      const res = await createThreadAction(courseId, courseSlug, title, body);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Question posted.");
        setTitle("");
        setBody("");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Input placeholder="Question title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Ask your instructor or fellow students a question…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isPending}>
            <Send className="h-4 w-4" /> {isPending ? "Posting…" : "Post question"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreadCard({
  thread,
  courseSlug,
  courseId,
  currentProfileId,
  canModerate,
}: {
  thread: ThreadWithReplies;
  courseSlug: string;
  courseId: string;
  currentProfileId: string;
  canModerate: boolean;
}) {
  const [expanded, setExpanded] = React.useState(thread.replies.length > 0);
  const [isPending, startTransition] = React.useTransition();
  const canDelete = thread.author_id === currentProfileId || canModerate;

  function handleDelete() {
    if (!confirm("Delete this question and all its replies?")) return;
    startTransition(async () => {
      const res = await deleteThreadAction(thread.id, courseSlug);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={thread.author?.avatar_url ?? undefined} />
            <AvatarFallback>{initials(thread.author?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{thread.author?.full_name}</p>
              {thread.author?.role === "instructor" && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Instructor
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{formatRelativeTime(thread.created_at)}</span>
            </div>
            <h3 className="mt-1 font-semibold">{thread.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{thread.body}</p>

            <div className="mt-3 flex items-center gap-4">
              <ReactionButtons
                threadId={thread.id}
                likeCount={thread.like_count}
                dislikeCount={thread.dislike_count}
                myReaction={thread.my_reaction ?? null}
              />
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="ml-11 space-y-3 border-l border-border pl-4">
            {thread.replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                courseSlug={courseSlug}
                currentProfileId={currentProfileId}
                canModerate={canModerate}
              />
            ))}
            <ReplyForm threadId={thread.id} courseId={courseId} courseSlug={courseSlug} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReplyCard({
  reply,
  courseSlug,
  currentProfileId,
  canModerate,
}: {
  reply: DiscussionReply;
  courseSlug: string;
  currentProfileId: string;
  canModerate: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const canDelete = reply.author_id === currentProfileId || canModerate;

  function handleDelete() {
    if (!confirm("Delete this reply?")) return;
    startTransition(async () => {
      const res = await deleteReplyAction(reply.id, courseSlug);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={reply.author?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">{initials(reply.author?.full_name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">{reply.author?.full_name}</p>
          {reply.is_instructor_reply && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <ShieldCheck className="h-2.5 w-2.5" /> Instructor
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(reply.created_at)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm">{reply.body}</p>
        <div className="mt-1 flex items-center gap-3">
          <ReactionButtons
            replyId={reply.id}
            likeCount={reply.like_count}
            dislikeCount={reply.dislike_count}
            myReaction={reply.my_reaction ?? null}
          />
          {canDelete && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyForm({ threadId, courseId, courseSlug }: { threadId: string; courseId: string; courseSlug: string }) {
  const [isPending, startTransition] = React.useTransition();
  const [body, setBody] = React.useState("");

  function handleSubmit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createReplyAction(threadId, courseId, courseSlug, body);
      if (res.error) toast.error(res.error);
      else setBody("");
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Write a reply…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Button size="sm" onClick={handleSubmit} disabled={isPending}>
        <Send className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
