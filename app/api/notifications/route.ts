import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const supabase = await createClient();
  let query = supabase.from("notifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false });
  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { notificationId?: string; markAll?: boolean };
  const supabase = await createClient();

  if (body.markAll) {
    await supabase.from("notifications").update({ is_read: true }).eq("profile_id", profile.id).eq("is_read", false);
    return NextResponse.json({ data: { success: true }, error: null });
  }

  if (body.notificationId) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.notificationId)
      .eq("profile_id", profile.id);
    return NextResponse.json({ data: { success: true }, error: null });
  }

  return NextResponse.json({ data: null, error: "notificationId or markAll is required." }, { status: 400 });
}
