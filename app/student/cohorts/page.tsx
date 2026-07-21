import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe } from "lucide-react";

export const metadata = { title: "Upcoming Cohorts" };

export default async function StudentCohortsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("*, course:courses(title, slug, delivery_mode), instructor:profiles!cohorts_instructor_id_fkey(full_name)")
    .eq("status", "upcoming")
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .order("start_date");

  const myState = profile?.state_region;
  const myLga = profile?.lga;

  const rows = (cohorts ?? []).map((c) => {
    const courseField = c.course as unknown;
    const course = Array.isArray(courseField)
      ? (courseField as { title: string; slug: string; delivery_mode: string }[])[0]
      : (courseField as { title: string; slug: string; delivery_mode: string } | null);
    const instructorField = c.instructor as unknown;
    const instructor = Array.isArray(instructorField)
      ? (instructorField as { full_name: string }[])[0]
      : (instructorField as { full_name: string } | null);

    const isOnline = course?.delivery_mode === "online";
    const matchesLga = !isOnline && !!myLga && c.lga === myLga;
    const matchesState = !isOnline && !!myState && c.state_region === myState;

    return { cohort: c, course, instructorName: instructor?.full_name ?? "Instructor", isOnline, matchesLga, matchesState };
  });

  const nearMe = rows.filter((r) => r.matchesLga || r.matchesState);
  const others = rows.filter((r) => !r.matchesLga && !r.matchesState);

  function CohortCard({ row }: { row: (typeof rows)[number] }) {
    const { cohort, course, instructorName, isOnline, matchesLga } = row;
    return (
      <Link key={cohort.id} href={course ? `/student/courses/${course.slug}` : "#"}>
        <Card className={matchesLga ? "border-primary transition-shadow hover:shadow-md" : "transition-shadow hover:shadow-md"}>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{course?.title ?? "Course"}</p>
                <p className="text-xs text-muted-foreground">{cohort.title ?? `Cohort starting ${cohort.start_date}`}</p>
              </div>
              {matchesLga && <Badge variant="accent">Near you</Badge>}
            </div>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {isOnline ? (
                <>
                  <Globe className="h-3.5 w-3.5" /> Fully online
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5" /> {cohort.lga ? `${cohort.lga}, ` : ""}
                  {cohort.state_region}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Starts {new Date(cohort.start_date).toLocaleDateString()} · Led by {instructorName}
            </p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upcoming Cohorts</h1>
        <p className="text-muted-foreground">
          Browse cohorts across every course on the platform — hybrid and in-person ones near your state and LGA
          are highlighted first, with everything else still explorable below.
        </p>
        {!myState && (
          <p className="mt-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            Set your state and LGA in{" "}
            <Link href="/student/settings" className="font-medium text-primary hover:underline">
              Settings
            </Link>{" "}
            to see cohorts near you highlighted here.
          </p>
        )}
      </div>

      {nearMe.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Near you</h2>
          {nearMe.map((row) => (
            <CohortCard key={row.cohort.id} row={row} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {nearMe.length > 0 ? "All other upcoming cohorts" : "Upcoming cohorts"}
        </h2>
        {others.map((row) => (
          <CohortCard key={row.cohort.id} row={row} />
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground">No upcoming cohorts right now.</p>}
      </div>
    </div>
  );
}