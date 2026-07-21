"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Mail, Phone } from "lucide-react";
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
  phone: string | null;
  avatar_url: string | null;
  state_region: string | null;
  country: string | null;
  bio: string | null;
}

export interface MatchedCourse {
  title: string;
  completedAt: string | null;
}

export interface ApplicantBiodata {
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  state_of_origin: string | null;
  lga: string | null;
  home_address: string | null;
  highest_qualification: string | null;
  occupation_or_institution: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_phone: string | null;
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

function BiodataRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ApplicantReviewCard({
  application,
  organizationId,
  matchedCourses,
  totalRequired,
  biodata,
}: {
  application: ApplicationForReview;
  organizationId: string;
  matchedCourses: MatchedCourse[];
  totalRequired: number;
  biodata: ApplicantBiodata | null;
}) {
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
        toast.success("Candidate shortlisted — they've been notified.");
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
            <p className="text-xs text-success">
              ✓ Completed {matchedCourses.length}/{totalRequired} required course{totalRequired === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={badge.variant} className="capitalize">
            {badge.label}
          </Badge>
        </div>
      </div>

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
        {/* Full profile review — contact details, matched completions, and biodata */}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              View profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Applicant profile</DialogTitle>
              <DialogDescription>Review this candidate before deciding to shortlist.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={p?.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-lg">{initials(p?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p?.state_region, p?.country].filter(Boolean).join(", ") || "No location set"}
                  </p>
                </div>
              </div>

              {p?.bio && <p className="text-sm">{p.bio}</p>}

              {/* Contact — this is how the organization reaches out after shortlisting */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
                <div className="space-y-1.5">
                  <a href={`mailto:${p?.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {p?.email}
                  </a>
                  {p?.phone ? (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {p.phone}
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> No phone number provided
                    </p>
                  )}
                </div>
              </div>

              {/* The qualifications that actually matched them to this opportunity */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required courses completed ({matchedCourses.length}/{totalRequired})
                </p>
                <div className="space-y-1.5">
                  {matchedCourses.map((c) => (
                    <div key={c.title} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {c.title}
                      </span>
                      {c.completedAt && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(c.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {matchedCourses.length === 0 && (
                    <p className="text-sm text-muted-foreground">No completion records found.</p>
                  )}
                </div>
              </div>

              {/* Full biodata on record */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biodata</p>
                {biodata ? (
                  <div className="space-y-1.5 rounded-md border border-border p-3">
                    <BiodataRow label="Date of birth" value={biodata.date_of_birth ? new Date(biodata.date_of_birth).toLocaleDateString() : null} />
                    <BiodataRow label="Gender" value={biodata.gender ? biodata.gender.charAt(0).toUpperCase() + biodata.gender.slice(1) : null} />
                    <BiodataRow label="Nationality" value={biodata.nationality} />
                    <BiodataRow label="State of origin" value={biodata.state_of_origin} />
                    <BiodataRow label="LGA" value={biodata.lga} />
                    <BiodataRow label="Home address" value={biodata.home_address} />
                    <BiodataRow label="Highest qualification" value={biodata.highest_qualification} />
                    <BiodataRow label="Occupation / Institution" value={biodata.occupation_or_institution} />
                    <BiodataRow label="Next of kin" value={biodata.next_of_kin_name} />
                    <BiodataRow label="Next of kin relationship" value={biodata.next_of_kin_relationship} />
                    <BiodataRow label="Next of kin phone" value={biodata.next_of_kin_phone} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This candidate hasn&apos;t completed their biodata yet.</p>
                )}
              </div>
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
