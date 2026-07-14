import { createClient } from "@/lib/supabase/server";
import { CreateCourseForm } from "@/components/course/create-course-form";

export const metadata = { title: "Create Course" };

export default async function NewCoursePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").eq("is_active", true).order("display_order");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create a new course</h1>
        <p className="text-muted-foreground">Start with the basics — you can add lessons next.</p>
      </div>
      <CreateCourseForm categories={categories ?? []} />
    </div>
  );
}
