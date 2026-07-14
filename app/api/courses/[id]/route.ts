import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select("*, category:categories(name), instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ data: null, error: "Course not found." }, { status: 404 });
  return NextResponse.json({ data, error: null });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", id).single();
  if (!course) return NextResponse.json({ data: null, error: "Course not found." }, { status: 404 });
  if (course.instructor_id !== profile.id && !isAdmin(profile)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields = [
    "title",
    "subtitle",
    "description",
    "level",
    "category_id",
    "price_w3tr",
    "estimated_hours",
    "requirements",
    "learning_outcomes",
    "target_audience",
    "thumbnail_url",
    "promo_video_url",
    "tags",
  ];
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowedFields.includes(k)));

  const { data, error } = await supabase.from("courses").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", id).single();
  if (!course) return NextResponse.json({ data: null, error: "Course not found." }, { status: 404 });
  if (course.instructor_id !== profile.id && !isAdmin(profile)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  return NextResponse.json({ data: { success: true }, error: null });
}
