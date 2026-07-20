import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { closeOpportunityAction, updateApplicationStatusAction } from "@/lib/actions/opportunities";

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
      .select("*, profile:profiles(full_name, email, state_region)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
  ]);

  async function handleClose() {
    "use server";
    await closeOpportunityAction(opportunityId, opportunity!.organization_id);
  }

  async function handleShortlist(applicationId: string) {
    "use server";
    await updateApplicationStatusAction(applicationId, opportunity!.organization_id, "shortlisted");
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
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{a.profile?.full_name ?? a.profile?.email}</p>
                  <p className="text-xs text-muted-foreground">{a.profile?.state_region ?? "No location set"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "shortlisted" ? "success" : "outline"} className="capitalize">
                    {a.status}
                  </Badge>
                  {a.status !== "shortlisted" && (
                    <form action={handleShortlist.bind(null, a.id)}>
                      <Button size="sm" variant="outline" type="submit">
                        Shortlist
                      </Button>
                    </form>
                  )}
                </div>
              </div>
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