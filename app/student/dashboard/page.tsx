import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatW3TR } from "@/lib/utils";
import { Flame, Wallet, GraduationCap, BookOpen } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function StudentDashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: wallet }, { data: studentProfile }, { data: enrollments }] = await Promise.all([
    supabase.from("w3tr_wallets").select("*").eq("profile_id", profile!.id).single(),
    supabase.from("student_profiles").select("*").eq("profile_id", profile!.id).single(),
    supabase
      .from("enrollments")
      .select("*, course:courses(id,title,slug,thumbnail_url)")
      .eq("student_id", profile!.id)
      .order("last_accessed_at", { ascending: false, nullsFirst: false })
      .limit(4),
  ]);

  const inProgress = (enrollments ?? []).filter((e) => e.status === "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"} 👋</h1>
        <p className="text-muted-foreground">Here&apos;s where you left off.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/20 p-3">
              <Wallet className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatW3TR(wallet?.balance ?? 0)}</p>
              <p className="text-xs text-muted-foreground">W3TR balance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentProfile?.current_streak_days ?? 0} days</p>
              <p className="text-xs text-muted-foreground">Learning streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-success/20 p-3">
              <GraduationCap className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentProfile?.total_courses_completed ?? 0}</p>
              <p className="text-xs text-muted-foreground">Courses completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-warning/20 p-3">
              <BookOpen className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentProfile?.total_lessons_completed ?? 0}</p>
              <p className="text-xs text-muted-foreground">Lessons completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Continue learning</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/courses">Browse more courses →</Link>
          </Button>
        </div>

        {inProgress.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="mb-4 text-muted-foreground">You haven&apos;t started any courses yet.</p>
              <Button asChild>
                <Link href="/student/courses">Browse courses</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {inProgress.map((e) => (
              <Card key={e.id}>
                {e.course?.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- course covers come from arbitrary Supabase Storage URLs (instructor-uploaded or auto-generated SVG), not a fixed local asset set
                  <img
                    src={e.course.thumbnail_url}
                    alt={e.course?.title ?? "Course cover"}
                    className="aspect-video w-full rounded-t-xl object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-t-xl bg-secondary">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-2 text-base">{e.course?.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={Number(e.progress_percent)} className="mb-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{e.progress_percent}% complete</span>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <Button asChild size="sm" className="mt-3 w-full">
                    <Link href={`/student/courses/${e.course?.slug}`}>Continue</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
