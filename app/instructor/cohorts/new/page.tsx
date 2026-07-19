import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CohortCreateForm } from "@/components/course/cohort-create-form";

export const metadata = { title: "Start a Cohort" };

export default async function StartCohortPage() {
  const supabase = await createClient();

  // Instructors can see and start a cohort for ANY published course on the
  // platform, not just ones they authored — that's the whole point of this
  // page: an accredited professional teaching an existing, vetted course in
  // their field, not necessarily one they wrote themselves.
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, subtitle, delivery_mode, instructor:profiles!courses_instructor_id_fkey(full_name)")
    .eq("status", "published")
    .order("title");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Start a Cohort</h1>
        <p className="text-muted-foreground">
          Teach an existing course to a group of students. You don&apos;t need to be the course&apos;s original
          author — pick any published course below. The course&apos;s delivery mode (online, hybrid, or
          in-person) was fixed by its original author and applies to your cohort automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New cohort</CardTitle>
        </CardHeader>
        <CardContent>
          <CohortCreateForm
            courses={(courses ?? []).map((c) => {
              const instructorField = c.instructor as unknown;
              const author = Array.isArray(instructorField)
                ? (instructorField as { full_name: string }[])[0]
                : (instructorField as { full_name: string } | null);
              return {
                id: c.id,
                title: c.title,
                authorName: author?.full_name ?? "Unknown",
                deliveryMode: c.delivery_mode as "online" | "hybrid" | "in_person",
              };
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}