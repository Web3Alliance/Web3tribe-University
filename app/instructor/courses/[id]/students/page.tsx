import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail } from "lucide-react";
import { initials, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Students" };

const STATUS_VARIANTS: Record<string, "secondary" | "success" | "outline" | "destructive"> = {
  active: "secondary",
  completed: "success",
  dropped: "outline",
  suspended: "destructive",
};

/**
 * Previously an instructor could only see who was taking their course by
 * opening a specific COHORT (a location/time-based subset) — anyone
 * enrolled directly online, outside a cohort, was invisible to them
 * entirely. This shows every student enrolled in the course itself,
 * cohort or not, with their profile so an instructor can actually see who
 * they're teaching.
 */
export default async function CourseStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("id, title, instructor_id").eq("id", courseId).single();
  if (!course) notFound();
  if (course.instructor_id !== profile!.id && !isAdmin(profile)) {
    redirect("/instructor/courses");
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("*, student:profiles(id, full_name, username, email, avatar_url, bio, state_region, country)")
    .eq("course_id", courseId)
    .order("enrolled_at", { ascending: false });

  const active = (enrollments ?? []).filter((e) => e.status === "active").length;
  const completed = (enrollments ?? []).filter((e) => e.status === "completed").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/instructor/courses/${courseId}/edit`} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to course
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Students \u2014 {course.title}</h1>
        <p className="text-muted-foreground">
          {enrollments?.length ?? 0} enrolled \u00B7 {active} active \u00B7 {completed} completed
        </p>
      </div>

      <div className="space-y-3">
        {(enrollments ?? []).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No one has enrolled in this course yet.
            </CardContent>
          </Card>
        )}
        {(enrollments ?? []).map((e) => {
          const s = e.student as { id: string; full_name: string | null; username: string | null; email: string; avatar_url: string | null; bio: string | null; state_region: string | null; country: string | null } | null;
          const name = s?.full_name ?? s?.username ?? s?.email ?? "Student";
          return (
            <Card key={e.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={s?.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback>{initials(s?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate font-medium">{name}</p>
                    <Badge variant={STATUS_VARIANTS[e.status] ?? "outline"} className="capitalize">
                      {e.status}
                    </Badge>
                  </div>
                  {s?.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Mail className="h-3 w-3" /> {s.email}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[s?.state_region, s?.country].filter(Boolean).join(", ") || "No location set"} \u00B7 enrolled{" "}
                    {formatRelativeTime(e.enrolled_at)}
                  </p>
                  {s?.bio && <p className="text-xs text-muted-foreground line-clamp-2">{s.bio}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Progress value={Number(e.progress_percent)} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{Number(e.progress_percent).toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
