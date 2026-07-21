"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/utils";
import { respondToShortlistAction } from "@/lib/actions/opportunities";

export interface MyApplication {
  id: string;
  status: string;
  created_at: string;
  shortlist_message: string | null;
  response_note: string | null;
  opportunityTitle: string;
  organizationName: string;
  pay: string | null;
}

const STATUS_BADGE: Record<string, { variant: "success" | "outline" | "secondary" | "destructive"; label: string }> = {
  interested: { variant: "outline", label: "Application sent" },
  shortlisted: { variant: "secondary", label: "Shortlisted 🎉" },
  accepted: { variant: "success", label: "Offer accepted" },
  rejected: { variant: "destructive", label: "Offer declined" },
  closed: { variant: "outline", label: "Closed" },
};

export function ApplicationStatusCard({ application }: { application: MyApplication }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const badge = STATUS_BADGE[application.status] ?? { variant: "outline" as const, label: application.status };

  function respond(response: "accepted" | "rejected", responseNote: string) {
    startTransition(async () => {
      const res = await respondToShortlistAction(application.id, response, responseNote);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          response === "accepted"
            ? "Offer accepted — the organization has been notified. Congratulations!"
            : "Offer declined — the organization has been notified with your note."
        );
        setRejectOpen(false);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{application.opportunityTitle}</p>
            <p className="text-xs text-muted-foreground">
              {application.organizationName} · applied {formatRelativeTime(application.created_at)}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        {application.pay && <p className="text-xs text-muted-foreground">Expected pay: {application.pay}</p>}

        {application.shortlist_message && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Next steps from the organization</p>
            <p>{application.shortlist_message}</p>
          </div>
        )}

        {application.response_note && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Your note:</span> {application.response_note}
          </p>
        )}

        {application.status === "shortlisted" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={isPending} onClick={() => respond("accepted", "")}>
              {isPending ? "Sending…" : "Accept offer"}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRejectOpen(true)}>
              Decline
            </Button>
          </div>
        )}

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline this offer</DialogTitle>
              <DialogDescription>
                Please tell {application.organizationName} why you&apos;re declining — your note is sent to them
                along with your response.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`decline-note-${application.id}`}>Reason (required)</Label>
              <Textarea
                id={`decline-note-${application.id}`}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Thank you, but I've accepted another role closer to home."
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={isPending || !note.trim()} onClick={() => respond("rejected", note)}>
                {isPending ? "Sending…" : "Decline offer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
