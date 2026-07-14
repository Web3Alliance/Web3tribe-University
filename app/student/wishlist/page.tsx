import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { CourseCard } from "@/components/course/course-card";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";
import type { Course } from "@/lib/types";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: wishlistItems } = await supabase
    .from("wishlists")
    .select("course:courses(*, category:categories(name))")
    .eq("student_id", profile!.id);

  const courses = (wishlistItems ?? []).map((w) => w.course).filter(Boolean) as unknown as Course[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wishlist</h1>
        <p className="text-muted-foreground">Courses you&apos;ve saved for later.</p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Your wishlist is empty.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
