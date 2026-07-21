"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initials, formatRelativeTime } from "@/lib/utils";
import { shortlistApplicantAction } from "@/lib/actions/opportunities";

export interface ApplicantProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  state_region: string | null;
  country: string | null;
  bio: string | null;
}

export interface ApplicationForReview {
  id: string;
  status: string;
  created_at: string;
  shortlist_message: string | null;
  response_note: string | null;
  responded_at: string | null;
  profile: ApplicantProfile | null;
}

const STATUS_BADGE: Record<string, { variant: "success" | "outline" | "secondary" | "destructive"; label: string }> = {
  interested: { variant: "outline", label: "Interested" },
  shortlisted: { variant: "secondary", label: "Shortlisted — awaiting response" },
  accepted: { variant: "success", label: "Accepted your offer" },
  rejected: { variant: "destructive", label: "Declined your offer" },
  closed: { variant: "outline", label: "Closed" },
};

export function ApplicantReviewCard({ application, organizationId }: { application: ApplicationForReview; organizationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [shortlistOpen, setShortlistOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const p = application.profile;
  const name = p?.full_name ?? p?.email ?? "Applicant";
  const badge = STATUS_BADGE[application.status] ?? { variant: "outline" as const, label: application.status };

  function handleShortlist() {
    startTransition(async () => {
      const res = await shortlistApplicantAction(application.id, organizationId, message);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Candidate shortlisted — they've been notified in-app and by email.");
        setShortlistOpen(false);
        setMessage("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={p?.avatar_url ?? undefined} alt={name} />
            <AvatarFallback>{initials(p?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[p?.state_region, p?.country].filter(Boolean).join(", ") || "No location set"} · applied{" "}
              {formatRelativeTime(application.created_at)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={badge.variant} className="capitalize">
            {badge.label}
          </Badge>
        </div>
      </div>

      {p?.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}

      {/* The organization sees exactly what it sent, and the student's answer. */}
      {application.shortlist_message && (
        <p className="rounded-md bg-secondary/50 p-2 text-xs">
          <span className="font-medium">Your shortlist message:</span> {application.shortlist_message}
        </p>
      )}
      {application.response_note && (
        <p className="rounded-md bg-secondary/50 p-2 text-xs">
          <span className="font-medium">{application.status === "rejected" ? "Their reason for declining:" : "Their note:"}</span>{" "}
          {application.response_note}
        </p>
      )}

      <div className="flex items-center gap-2">
        {/* Full profile review before deciding whether to shortlist */}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              View profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Applicant profile</DialogTitle>
              <DialogDescription>Review this candidate before deciding to shortlist.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={p?.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-lg">{initials(p?.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-muted-foreground">{p?.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p?.state_region, p?.country].filter(Boolean).join(", ") || "No location set"}
                  </p>
                </div>
              </div>
              {p?.bio ? (
                <p className="text-sm">{p.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">This candidate hasn&apos;t written a bio yet.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {application.status === "interested" && (
          <Dialog open={shortlistOpen} onOpenChange={setShortlistOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Shortlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Shortlist {name}</DialogTitle>
                <DialogDescription>
                  Your message is sent to the candidate by email and in-app — tell them exactly what happens next
                  (interview date, who will contact them, links, timelines). They&apos;ll then accept or decline your offer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`shortlist-message-${application.id}`}>Next steps for the candidate (required)</Label>
                <Textarea
                  id={`shortlist-message-${application.id}`}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Congratulations! We'd like to interview you on Friday at 10am. Our HR lead Ada will call the number on your profile…"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShortlistOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleShortlist} disabled={isPending || !message.trim()}>
                  {isPending ? "Shortlisting…" : "Shortlist & notify candidate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
