"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { moderateCourseAction } from "@/lib/actions/admin";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";

export function ModerationPanel({ courseId }: { courseId: string }) {
  const [isPending, startTransition] = React.useTransition();
  const [notes, setNotes] = React.useState("");
  const [dialogAction, setDialogAction] = React.useState<"reject" | "request_changes" | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const res = await moderateCourseAction(courseId, "approve", "");
      if (res?.error) toast.error(res.error);
      else toast.success("Course approved and published.");
    });
  }

  function handleDialogSubmit() {
    if (!dialogAction) return;
    startTransition(async () => {
      const res = await moderateCourseAction(courseId, dialogAction, notes);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(dialogAction === "reject" ? "Course rejected." : "Changes requested.");
        setDialogAction(null);
        setNotes("");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        <CheckCircle2 className="h-4 w-4" /> Approve
      </Button>

      <Dialog open={dialogAction === "request_changes"} onOpenChange={(o) => setDialogAction(o ? "request_changes" : null)}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <MessageSquare className="h-4 w-4" /> Request changes
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Explain what needs to change…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          <DialogFooter>
            <Button onClick={handleDialogSubmit} disabled={isPending || !notes.trim()}>
              Send feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAction === "reject"} onOpenChange={(o) => setDialogAction(o ? "reject" : null)}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive">
            <XCircle className="h-4 w-4" /> Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject course</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="destructive" onClick={handleDialogSubmit} disabled={isPending || !notes.trim()}>
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
