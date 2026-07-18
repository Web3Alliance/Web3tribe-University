import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bucketByDay } from "@/lib/analytics";
import { GrowthLineChart } from "@/components/admin/analytics-charts";

export const metadata = { title: "Analytics" };

const TREND_DAYS = 30;

export default async function InstructorAnalyticsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id,title,enrollment_count,completion_count,average_rating,rating_count,status")
    .eq("instructor_id", profile!.id);

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: enrollments } = courseIds.length
    ? await supabase.from("enrollments").select("enrolled_at").in("course_id", courseIds)
    : { data: [] as { enrolled_at: string }[] };

  const totalEnrollments = (courses ?? []).reduce((s, c) => s + c.enrollment_count, 0);
  const totalCompletions = (courses ?? []).reduce((s, c) => s + c.completion_count, 0);
  const completionRate = totalEnrollments > 0 ? ((totalCompletions / totalEnrollments) * 100).toFixed(1) : "0";

  const enrollmentTrend = bucketByDay((enrollments ?? []).map((e) => e.enrolled_at), TREND_DAYS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Performance across all your courses.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEnrollments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCompletions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New enrollments, last {TREND_DAYS} days</CardTitle>
        </CardHeader>
        <CardContent>
          <GrowthLineChart data={enrollmentTrend} label="Enrollments" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Completions</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(courses ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="capitalize">{c.status.replace("_", " ")}</TableCell>
                  <TableCell>{c.enrollment_count}</TableCell>
                  <TableCell>{c.completion_count}</TableCell>
                  <TableCell>
                    {Number(c.average_rating).toFixed(1)} ({c.rating_count})
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}