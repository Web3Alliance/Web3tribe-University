"use client";
import * as React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { reactAction } from "@/lib/actions/discussions";
import type { ReactionType } from "@/lib/types";

interface Counts {
  likeCount: number;
  dislikeCount: number;
  myReaction: ReactionType | null;
}

function computeNext(current: Counts, reaction: ReactionType): Counts {
  const next = { ...current };
  if (current.myReaction === reaction) {
    next.myReaction = null;
    if (reaction === "like") next.likeCount -= 1;
    else next.dislikeCount -= 1;
    return next;
  }
  if (current.myReaction === "like") next.likeCount -= 1;
  if (current.myReaction === "dislike") next.dislikeCount -= 1;
  next.myReaction = reaction;
  if (reaction === "like") next.likeCount += 1;
  else next.dislikeCount += 1;
  return next;
}

export function ReactionButtons({
  threadId,
  replyId,
  likeCount,
  dislikeCount,
  myReaction,
}: {
  threadId?: string;
  replyId?: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: ReactionType | null;
}) {
  const [isPending, startTransition] = React.useTransition();

  // Optimistic local override for instant button feedback, reconciled with fresh
  // server props whenever they change. This follows React's documented pattern
  // for "adjusting state when props change" (computed during render rather than
  // in an effect, which avoids the extra render pass / cascading-render lint
  // warning that comes from calling setState inside a useEffect body).
  const [prevProps, setPrevProps] = React.useState({ likeCount, dislikeCount, myReaction });
  const [optimistic, setOptimistic] = React.useState<Counts | null>(null);

  if (
    prevProps.likeCount !== likeCount ||
    prevProps.dislikeCount !== dislikeCount ||
    prevProps.myReaction !== myReaction
  ) {
    setPrevProps({ likeCount, dislikeCount, myReaction });
    setOptimistic(null);
  }

  const display = optimistic ?? { likeCount, dislikeCount, myReaction };

  function handleReact(reaction: ReactionType) {
    const next = computeNext(display, reaction);
    setOptimistic(next);

    startTransition(async () => {
      const res = await reactAction(threadId ? { threadId } : { replyId }, reaction);
      if (res.error) {
        toast.error(res.error);
        setOptimistic(null);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleReact("like")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-secondary",
          display.myReaction === "like" ? "text-success font-medium" : "text-muted-foreground"
        )}
      >
        <ThumbsUp className={cn("h-3.5 w-3.5", display.myReaction === "like" && "fill-success")} />
        {display.likeCount}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleReact("dislike")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-secondary",
          display.myReaction === "dislike" ? "text-destructive font-medium" : "text-muted-foreground"
        )}
      >
        <ThumbsDown className={cn("h-3.5 w-3.5", display.myReaction === "dislike" && "fill-destructive")} />
        {display.dislikeCount}
        {display.dislikeCount >= 3 && (
          <span className="ml-1 text-[10px] text-destructive">({5 - display.dislikeCount} to auto-remove)</span>
        )}
      </button>
    </div>
  );
}
