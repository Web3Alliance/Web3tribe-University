import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const level = searchParams.get("level");
  const limit = Math.min(Number(searchParams.get("limit") ?? 24), 100);

  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select("*, category:categories(id,name,slug), instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (q) query = query.ilike("title", `%${q}%`);
  if (category) query = query.eq("category_id", category);
  if (level) query = query.eq("level", level);

  const { data, error } = await query;
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}

interface CreateCourseBody {
  title: string;
  subtitle?: string;
  description?: string;
  level?: string;
  categoryId?: string;
  priceW3tr?: number;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !["instructor", "admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateCourseBody;
  if (!body.title) return NextResponse.json({ data: null, error: "Title is required." }, { status: 400 });

  const supabase = await createClient();
  const slug = `${slugify(body.title)}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabase
    .from("courses")
    .insert({
      instructor_id: profile.id,
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      level: body.level ?? "beginner",
      category_id: body.categoryId ?? null,
      price_w3tr: body.priceW3tr ?? 0,
      slug,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}
