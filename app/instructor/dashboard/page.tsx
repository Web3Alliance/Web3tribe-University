import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatW3TR } from "@/lib/utils";
import { BookOpen, Users, Star, Wallet, PlusCircle } from "lucide-react";

export const metadata = { title: "Instructor Dashboard" };

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "outline",
  pending_review: "warning",
  changes_requested: "destructive",
  approved: "secondary",
  published: "success",
  rejected: "destructive",
  archived: "outline",
};

export default async function InstructorDashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: courses }, { data: wallet }] = await Promise.all([
    supabase.from("courses").select("*").eq("instructor_id", profile!.id).order("created_at", { ascending: false }),
    supabase.from("w3tr_wallets").select("balance").eq("profile_id", profile!.id).single(),
  ]);

  const totalStudents = (courses ?? []).reduce((sum, c) => sum + c.enrollment_count, 0);
  const avgRating =
    (courses ?? []).length > 0
      ? (courses ?? []).reduce((sum, c) => sum + Number(c.average_rating), 0) / (courses ?? []).length
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instructor Dashboard</h1>
          <p className="text-muted-foreground">Manage your courses and track your impact.</p>
        </div>
        <Button asChild>
          <Link href="/instructor/courses/new">
            <PlusCircle className="h-4 w-4" /> New Course
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(courses ?? []).length}</p>
              <p className="text-xs text-muted-foreground">Total courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-success/20 p-3">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Total students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/20 p-3">
              <Star className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Average rating</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-warning/20 p-3">
              <Wallet className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatW3TR(wallet?.balance ?? 0)}</p>
              <p className="text-xs text-muted-foreground">W3TR balance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Your courses</h2>
        {(courses ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="mb-4 text-muted-foreground">You haven&apos;t created any courses yet.</p>
              <Button asChild>
                <Link href="/instructor/courses/new">Create your first course</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(courses ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.enrollment_count} students · {Number(c.average_rating).toFixed(1)}★
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "outline"} className="capitalize">
                      {c.status.replace("_", " ")}
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/instructor/courses/${c.id}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
