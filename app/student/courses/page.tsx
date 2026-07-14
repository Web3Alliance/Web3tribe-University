import { createClient } from "@/lib/supabase/server";
import { CourseCard } from "@/components/course/course-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { Course } from "@/lib/types";

export const metadata = { title: "Browse Courses" };

interface SearchParams {
  q?: string;
  category?: string;
  level?: string;
  sort?: string;
}

export default async function BrowseCoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase.from("categories").select("*").eq("is_active", true).order("display_order");

  let query = supabase
    .from("courses")
    .select("*, category:categories(id,name,slug), instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url,username)")
    .eq("status", "published");

  if (params.q) query = query.ilike("title", `%${params.q}%`);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.level) query = query.eq("level", params.level);

  if (params.sort === "popular") query = query.order("enrollment_count", { ascending: false });
  else if (params.sort === "rating") query = query.order("average_rating", { ascending: false });
  else query = query.order("published_at", { ascending: false });

  const { data: courses } = await query.limit(24);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Courses</h1>
        <p className="text-muted-foreground">Find your next skill in AI, cybersecurity, data science, and more.</p>
      </div>

      <form className="grid gap-3 sm:grid-cols-4" method="get">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="Search courses…" defaultValue={params.q} className="pl-9" />
        </div>
        <Select name="category" defaultValue={params.category}>
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sort" defaultValue={params.sort ?? "newest"}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="popular">Most popular</SelectItem>
            <SelectItem value="rating">Top rated</SelectItem>
          </SelectContent>
        </Select>
      </form>

      {(courses ?? []).length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No courses match your search yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(courses as unknown as Course[]).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
