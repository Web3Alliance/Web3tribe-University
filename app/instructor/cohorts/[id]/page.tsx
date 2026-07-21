import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Globe } from "lucide-react";

export const metadata = { title: "Cohort" };

export default async function InstructorCohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cohortId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("*, course:courses(title, slug, delivery_mode)")
    .eq("id", cohortId)
    .single();
  if (!cohort) notFound();
  if (cohort.instructor_id !== profile!.id && profile!.role !== "admin" && profile!.role !== "super_admin") notFound();

  const courseField = cohort.course as unknown;
  const course = Array.isArray(courseField)
    ? (courseField as { title: string; slug: string; delivery_mode: string }[])[0]
    : (courseField as { title: string; slug: string; delivery_mode: string } | null);
  const isOnline = course?.delivery_mode === "online";

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("*, student:profiles(full_name, email, state_region, lga)")
    .eq("cohort_id", cohortId)
    .order("enrolled_at", { ascending: false });

  const hasStarted = new Date(cohort.start_date) < new Date(new Date().toDateString());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/instructor/cohorts" className="flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Cohorts
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{course?.title ?? "Course"}</h1>
          <p className="text-muted-foreground">{cohort.title ?? `Cohort starting ${cohort.start_date}`}</p>
        </div>
        <Badge variant={hasStarted ? "outline" : "success"}>{hasStarted ? "Started" : "Open for enrollment"}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            {isOnline ? (
              <>
                <Globe className="h-4 w-4" /> Fully online
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" /> {cohort.lga ? `${cohort.lga}, ` : ""}
                {cohort.state_region}
                {cohort.address ? ` — ${cohort.address}` : ""}
              </>
            )}
          </p>
          <p className="text-muted-foreground">
            Starts {new Date(cohort.start_date).toLocaleDateString()}
            {cohort.end_date ? ` · Ends ${new Date(cohort.end_date).toLocaleDateString()}` : ""}
            {cohort.max_students ? ` · Max ${cohort.max_students} students` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered students ({enrollments?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(enrollments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has registered for this cohort yet.</p>
          ) : (
            (enrollments ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{e.student?.full_name ?? e.student?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.student?.lga ? `${e.student.lga}, ` : ""}
                    {e.student?.state_region ?? "No location set"}
                  </p>
                </div>
                <Badge variant={e.status === "completed" ? "success" : "outline"} className="capitalize">
                  {e.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}