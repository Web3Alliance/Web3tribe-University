import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap, Wallet, TrendingUp } from "lucide-react";
import { formatW3TR } from "@/lib/utils";
import { bucketByDay, bucketAmountByDay } from "@/lib/analytics";
import { GrowthLineChart, StatusBarChart, DistributionPieChart } from "@/components/admin/analytics-charts";

export const metadata = { title: "Analytics" };

const TREND_DAYS = 30;

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: courses },
    { data: enrollments },
    { data: wallets },
    { data: recentTransactions },
    { data: categoriesWithCourses },
  ] = await Promise.all([
    supabase.from("profiles").select("id, role, created_at"),
    supabase.from("courses").select("id, title, status, enrollment_count, category_id, created_at"),
    supabase.from("enrollments").select("id, status, enrolled_at, completed_at"),
    supabase.from("w3tr_wallets").select("balance, lifetime_earned"),
    supabase.from("w3tr_transactions").select("amount, created_at").gt("amount", 0),
    supabase.from("categories").select("id, name, courses(id)"),
  ]);

  const totalUsers = profiles?.length ?? 0;
  const usersByRole = (profiles ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  const totalCourses = courses?.length ?? 0;
  const coursesByStatus = (courses ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalEnrollments = enrollments?.length ?? 0;
  const totalCompletions = (enrollments ?? []).filter((e) => e.status === "completed").length;
  const completionRate = totalEnrollments > 0 ? ((totalCompletions / totalEnrollments) * 100).toFixed(1) : "0";

  const totalW3trInCirculation = (wallets ?? []).reduce((s, w) => s + Number(w.balance), 0);
  const totalW3trEverDistributed = (wallets ?? []).reduce((s, w) => s + Number(w.lifetime_earned), 0);

  const topCourses = [...(courses ?? [])].sort((a, b) => b.enrollment_count - a.enrollment_count).slice(0, 5);

  const signupTrend = bucketByDay(
    (profiles ?? []).map((p) => p.created_at),
    TREND_DAYS
  );
  const w3trAmountByDay = bucketAmountByDay(
    (recentTransactions ?? []).map((t) => ({ timestamp: t.created_at, amount: Number(t.amount) })),
    TREND_DAYS
  );

  const categoryDistribution = (categoriesWithCourses ?? [])
    .map((c) => ({ name: c.name, value: (c.courses as { id: string }[] | null)?.length ?? 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const roleDistribution = Object.entries(usersByRole).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
  }));

  const statusDistribution = Object.entries(coursesByStatus).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide activity and growth, last {TREND_DAYS} days.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-success/20 p-3">
              <BookOpen className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCourses}</p>
              <p className="text-xs text-muted-foreground">Total courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/20 p-3">
              <GraduationCap className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">
                Completion rate ({totalCompletions}/{totalEnrollments})
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-warning/20 p-3">
              <Wallet className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatW3TR(totalW3trInCirculation)}</p>
              <p className="text-xs text-muted-foreground">
                W3TR in circulation ({formatW3TR(totalW3trEverDistributed)} ever distributed)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> New signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthLineChart data={signupTrend} label="New users" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-accent-foreground" /> W3TR distributed per day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthLineChart data={w3trAmountByDay} label="W3TR awarded" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by role</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionPieChart data={roleDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courses by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={statusDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionPieChart data={categoryDistribution} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 courses by enrollment</CardTitle>
        </CardHeader>
        <CardContent>
          {topCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses yet.</p>
          ) : (
            <ul className="space-y-3">
              {topCourses.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {i + 1}
                    </span>
                    {c.title}
                  </span>
                  <span className="font-medium">{c.enrollment_count} students</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}