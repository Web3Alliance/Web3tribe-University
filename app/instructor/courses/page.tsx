import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

export const metadata = { title: "My Courses" };

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "outline",
  pending_review: "warning",
  changes_requested: "destructive",
  approved: "secondary",
  published: "success",
  rejected: "destructive",
  archived: "outline",
};

export default async function InstructorCoursesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", profile!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <Button asChild>
          <Link href="/instructor/courses/new">
            <PlusCircle className="h-4 w-4" /> New Course
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>W3TR Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(courses ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[c.status] ?? "outline"} className="capitalize">
                    {c.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/instructor/courses/${c.id}/students`} className="text-primary hover:underline">
                    {c.enrollment_count}
                  </Link>
                </TableCell>
                <TableCell>{Number(c.average_rating).toFixed(1)}</TableCell>
                <TableCell>{c.price_w3tr > 0 ? `${c.price_w3tr} W3TR` : "Free"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/instructor/courses/${c.id}/edit`}>Edit</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(courses ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No courses yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
