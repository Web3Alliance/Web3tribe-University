import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Globe, Plus } from "lucide-react";

export const metadata = { title: "My Cohorts" };

export default async function MyCohortsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("*, course:courses(title, slug, delivery_mode), enrollments(id)")
    .eq("instructor_id", profile!.id)
    .order("start_date", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Cohorts</h1>
          <p className="text-muted-foreground">Cohorts you&apos;ve started, and who&apos;s registered in each.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/instructor/cohorts/new">
            <Plus className="h-3.5 w-3.5" /> Start a Cohort
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        {(cohorts ?? []).map((cohort) => {
          const courseField = cohort.course as unknown;
          const course = Array.isArray(courseField)
            ? (courseField as { title: string; slug: string; delivery_mode: string }[])[0]
            : (courseField as { title: string; slug: string; delivery_mode: string } | null);
          const isOnline = course?.delivery_mode === "online";
          const hasStarted = new Date(cohort.start_date) < new Date(new Date().toDateString());

          return (
            <Link key={cohort.id} href={`/instructor/cohorts/${cohort.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{course?.title ?? "Course"}</p>
                    <p className="text-xs text-muted-foreground">{cohort.title ?? `Cohort starting ${cohort.start_date}`}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {isOnline ? (
                        <>
                          <Globe className="h-3 w-3" /> Fully online
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3" /> {cohort.lga ? `${cohort.lga}, ` : ""}
                          {cohort.state_region}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">{(cohort.enrollments ?? []).length} registered</Badge>
                    <Badge variant={hasStarted ? "outline" : "success"}>{hasStarted ? "Started" : "Open"}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(cohorts ?? []).length === 0 && (
          <p className="text-center text-muted-foreground">
            You haven&apos;t started any cohorts yet.{" "}
            <Link href="/instructor/cohorts/new" className="text-primary hover:underline">
              Start one
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}