import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

export async function GET(request: Request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("staff_profiles", { p_query: q || null, p_limit: 10 });
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  const data = ((rows ?? []) as Array<{ id: string; full_name: string | null; email: string; role: string; is_banned: boolean }>).map(
    (u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role, is_banned: u.is_banned })
  );
  return NextResponse.json({ data, error: null });
}
