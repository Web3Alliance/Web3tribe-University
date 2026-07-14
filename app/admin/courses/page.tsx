import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import Link from "next/link";

export const metadata = { title: "Course Moderation" };

export default async function AdminCoursesPage() {
  const supabase = await createClient();

  const { data: pendingCourses } = await supabase
    .from("courses")
    .select("*, instructor:profiles!courses_instructor_id_fkey(full_name,email)")
    .eq("status", "pending_review")
    .order("submitted_for_review_at", { ascending: true });

  const { data: allCoursesRaw } = await supabase
    .from("courses")
    .select("id,title,status,instructor:profiles!courses_instructor_id_fkey(full_name)")
    .neq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(20);

  interface AllCourseRow {
    id: string;
    title: string;
    status: string;
    instructor: { full_name: string | null } | { full_name: string | null }[] | null;
  }
  const allCourses = (allCoursesRaw as unknown as AllCourseRow[] | null)?.map((c) => ({
    ...c,
    instructor: Array.isArray(c.instructor) ? c.instructor[0] : c.instructor,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Course Moderation</h1>
        <p className="text-muted-foreground">{(pendingCourses ?? []).length} course(s) awaiting review.</p>
      </div>

      <div className="space-y-4">
        {(pendingCourses ?? []).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No courses awaiting review.</CardContent>
          </Card>
        )}
        {(pendingCourses ?? []).map((course) => (
          <Card key={course.id}>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/instructor/courses/${course.id}/edit`} className="font-semibold hover:underline" target="_blank">
                    {course.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    by {course.instructor?.full_name} ({course.instructor?.email})
                  </p>
                </div>
                <Badge variant="warning">Pending Review</Badge>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
              <ModerationPanel courseId={course.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent decisions</h2>
        <div className="space-y-2">
          {(allCourses ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span>
                {c.title} <span className="text-muted-foreground">by {c.instructor?.full_name}</span>
              </span>
              <Badge variant="outline" className="capitalize">
                {c.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
