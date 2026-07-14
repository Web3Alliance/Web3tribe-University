import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

export async function GET(request: Request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const supabase = await createClient();
  let query = supabase.from("profiles").select("id,full_name,email,role,is_banned").limit(10);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
