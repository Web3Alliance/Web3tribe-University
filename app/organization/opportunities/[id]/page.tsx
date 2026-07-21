import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { closeOpportunityAction } from "@/lib/actions/opportunities";
import { formatPay } from "@/lib/currencies";
import {
  ApplicantReviewCard,
  type ApplicationForReview,
  type ApplicantBiodata,
  type MatchedCourse,
} from "@/components/opportunities/applicant-review-card";

export const metadata = { title: "Opportunity" };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: opportunityId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: opportunity } = await supabase.from("opportunities").select("*").eq("id", opportunityId).single();
  if (!opportunity) notFound();

  const { data: org } = await supabase.from("organizations").select("*").eq("id", opportunity.organization_id).single();
  if (!org || org.owner_profile_id !== profile!.id) notFound();

  const requiredCourseIds: string[] = opportunity.required_course_ids ?? [];

  const [{ data: requiredCourses }, { data: applications }] = await Promise.all([
    requiredCourseIds.length
      ? supabase.from("courses").select("id, title").in("id", requiredCourseIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    supabase
      .from("opportunity_applications")
      .select("*, profile:profiles(full_name, email, phone, avatar_url, state_region, country, bio)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
  ]);

  // For every applicant in one pass: which REQUIRED courses they completed
  // (and when), plus their biodata — both readable by this org thanks to the
  // applicant-scoped policies in migration 0014.
  const applicantIds = (applications ?? []).map((a) => a.student_id);
  const [{ data: applicantEnrollments }, { data: applicantBiodata }] = await Promise.all([
    applicantIds.length && requiredCourseIds.length
      ? supabase
          .from("enrollments")
          .select("student_id, course_id, completed_at")
          .in("student_id", applicantIds)
          .in("course_id", requiredCourseIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [] as { student_id: string; course_id: string; completed_at: string | null }[] }),
    applicantIds.length
      ? supabase.from("student_biodata").select("*").in("profile_id", applicantIds)
      : Promise.resolve({ data: [] as ({ profile_id: string } & ApplicantBiodata)[] }),
  ]);

  const courseTitleById = new Map((requiredCourses ?? []).map((c) => [c.id, c.title]));
  const matchedCoursesByStudent = new Map<string, MatchedCourse[]>();
  for (const e of applicantEnrollments ?? []) {
    const list = matchedCoursesByStudent.get(e.student_id) ?? [];
    list.push({ title: courseTitleById.get(e.course_id) ?? "Course", completedAt: e.completed_at });
    matchedCoursesByStudent.set(e.student_id, list);
  }
  const biodataByStudent = new Map(
    ((applicantBiodata ?? []) as ({ profile_id: string } & ApplicantBiodata)[]).map((b) => [b.profile_id, b])
  );

  const pay = formatPay(opportunity.pay_amount, opportunity.pay_currency, opportunity.pay_period);

  async function handleClose() {
    "use server";
    await closeOpportunityAction(opportunityId, opportunity!.organization_id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/organization/opportunities" className="flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{opportunity.title}</h1>
          <p className="text-muted-foreground capitalize">
            {opportunity.opportunity_type} · {opportunity.location_state ?? "Remote/anywhere"}
          </p>
          {pay && <p className="text-sm font-medium">{pay}</p>}
        </div>
        <Badge variant={opportunity.status === "open" ? "success" : "outline"} className="capitalize">
          {opportunity.status}
        </Badge>
      </div>

      {opportunity.description && <p className="text-sm text-muted-foreground">{opportunity.description}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required courses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(requiredCourses ?? []).map((c) => (
            <p key={c.id} className="text-sm">
              {c.title}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interested candidates ({applications?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(applications ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one has expressed interest yet. Matched students (who&apos;ve completed every required course and
              opted in to visibility) will show up here as they apply.
            </p>
          ) : (
            (applications ?? []).map((a) => (
              <ApplicantReviewCard
                key={a.id}
                application={a as unknown as ApplicationForReview}
                organizationId={opportunity.organization_id}
                matchedCourses={matchedCoursesByStudent.get(a.student_id) ?? []}
                totalRequired={requiredCourseIds.length}
                biodata={biodataByStudent.get(a.student_id) ?? null}
              />
            ))
          )}
        </CardContent>
      </Card>

      {opportunity.status === "open" && (
        <form action={handleClose}>
          <Button variant="destructive" type="submit">
            Close this opportunity
          </Button>
        </form>
      )}
    </div>
  );
}
