import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Banknote } from "lucide-react";
import { ExpressInterestButton } from "@/components/opportunities/express-interest-button";
import { ApplicationStatusCard, type MyApplication } from "@/components/opportunities/application-status-card";
import { formatPay } from "@/lib/currencies";

export const metadata = { title: "Opportunities" };

export default async function StudentOpportunitiesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: openOpportunities }, { data: completedEnrollments }, { data: myApplications }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, organization:organizations(name)")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.from("enrollments").select("course_id").eq("student_id", profile!.id).eq("status", "completed"),
    // Full application rows (not just IDs) so the student can SEE the status
    // of every application — including shortlists they need to respond to.
    supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(title, pay_amount, pay_currency, pay_period, organization:organizations(name))")
      .eq("student_id", profile!.id)
      .order("created_at", { ascending: false }),
  ]);

  const completedCourseIds = new Set((completedEnrollments ?? []).map((e) => e.course_id));
  const appliedOpportunityIds = new Set((myApplications ?? []).map((a) => a.opportunity_id));

  // Only show opportunities this student is GENUINELY matched to — every
  // required course must be in their completed set. This is computed here
  // for display; expressInterestAction re-checks the same thing server-side
  // before actually recording an application, so this filter is a UX
  // convenience, not the real security boundary.
  const matched = (openOpportunities ?? []).filter((o) => {
    const required: string[] = o.required_course_ids ?? [];
    return required.length > 0 && required.every((id) => completedCourseIds.has(id));
  });

  const applications: MyApplication[] = (myApplications ?? []).map((a) => {
    const oppField = a.opportunity as unknown;
    const opp = Array.isArray(oppField)
      ? (oppField as Record<string, unknown>[])[0]
      : (oppField as Record<string, unknown> | null);
    const orgField = opp?.organization as unknown;
    const orgName = Array.isArray(orgField)
      ? (orgField as { name: string }[])[0]?.name
      : (orgField as { name: string } | null)?.name;
    return {
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      shortlist_message: a.shortlist_message,
      response_note: a.response_note,
      opportunityTitle: (opp?.title as string) ?? "Opportunity",
      organizationName: orgName ?? "An organization",
      pay: formatPay(
        (opp?.pay_amount as number | null) ?? null,
        (opp?.pay_currency as string | null) ?? null,
        (opp?.pay_period as string | null) ?? null
      ),
    };
  });

  const awaitingResponse = applications.filter((a) => a.status === "shortlisted").length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Opportunities</h1>
        <p className="text-muted-foreground">
          Real jobs, gigs, and apprenticeships you&apos;re matched to based on courses you&apos;ve actually
          completed — not just browsed.
        </p>
      </div>

      {!profile?.visible_for_opportunities && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-4 text-sm">
            You&apos;re not currently visible to employers. Turn this on in{" "}
            <Link href="/student/settings" className="font-medium text-primary hover:underline">
              Settings
            </Link>{" "}
            before you can express interest in an opportunity.
          </CardContent>
        </Card>
      )}

      {!profile?.avatar_url && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-4 text-sm">
            You haven&apos;t added a profile photo yet. Organizations see your photo when reviewing applications, so
            a photo is required before you can express interest — add one in{" "}
            <Link href="/student/settings" className="font-medium text-primary hover:underline">
              Settings
            </Link>
            .
          </CardContent>
        </Card>
      )}

      {applications.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">My applications</h2>
            {awaitingResponse > 0 && <Badge variant="secondary">{awaitingResponse} awaiting your response</Badge>}
          </div>
          {applications.map((a) => (
            <ApplicationStatusCard key={a.id} application={a} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {applications.length > 0 && <h2 className="text-lg font-semibold">Matched opportunities</h2>}
        {matched.map((o) => {
          const orgField = o.organization as unknown;
          const orgName = Array.isArray(orgField) ? (orgField as { name: string }[])[0]?.name : (orgField as { name: string } | null)?.name;
          const alreadyApplied = appliedOpportunityIds.has(o.id);
          const pay = formatPay(o.pay_amount, o.pay_currency, o.pay_period);
          return (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{orgName ?? "An organization"}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {o.opportunity_type}
                  </Badge>
                </div>
                {o.description && <p className="text-sm text-muted-foreground">{o.description}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {o.location_state ?? "Remote / anywhere"}
                  </span>
                  {pay && (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Banknote className="h-3.5 w-3.5" /> {pay}
                    </span>
                  )}
                </div>
                <ExpressInterestButton
                  opportunityId={o.id}
                  alreadyApplied={alreadyApplied}
                  visibilityOn={!!profile?.visible_for_opportunities}
                />
              </CardContent>
            </Card>
          );
        })}
        {matched.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
              <Briefcase className="h-8 w-8" />
              <p>No matched opportunities yet — complete more courses to unlock new matches as organizations post them.</p>
              <Button variant="outline" asChild>
                <Link href="/student/courses">Browse courses</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
