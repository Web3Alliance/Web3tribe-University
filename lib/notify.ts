import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Inserts an in-app notification for ANY user, from server code only.
 *
 * Why the service-role client: the notifications table's RLS only permits
 * admins to insert (see 0001 "notifications_admin_manage"). That's why
 * organization-triggered events (invites, shortlists) historically produced
 * no notification — a non-admin session's insert was silently blocked.
 * Every caller of this helper is a server action that has ALREADY verified
 * the caller is authorized to trigger this event (e.g. owns the org that
 * posted the opportunity), so writing the row with elevated privileges is
 * the deliberate, audited exception the admin client exists for.
 *
 * Never import from a "use client" file.
 */
export async function notifyUser(params: {
  profileId: string;
  title: string;
  body?: string;
  linkUrl?: string;
}): Promise<void> {
  const row = {
    profile_id: params.profileId,
    title: params.title,
    body: params.body ?? null,
    link_url: params.linkUrl ?? null,
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(row);
    if (error) console.error("[notify] Failed to insert notification:", error.message);
    return;
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY missing (e.g. local dev) — best-effort
    // fallback through the session client; succeeds when the caller is an
    // admin, otherwise logs so the gap is visible instead of silent.
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").insert(row);
    if (error) console.error("[notify] Fallback insert also failed (set SUPABASE_SERVICE_ROLE_KEY):", error.message);
  }
}

/**
 * Notifies every admin/super_admin, not one hardcoded recipient — course
 * submissions and re-reviews previously notified only the instructor, which
 * meant nothing requiring an admin's attention ever actually reached an
 * admin; the only way to find out was to manually check the moderation
 * queue. Moderators are deliberately excluded here — this is specifically
 * for things that need an ADMIN decision, not general moderation traffic.
 */
export async function notifyAdmins(params: { title: string; body?: string; linkUrl?: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: admins, error: fetchError } = await admin
      .from("profiles")
      .select("id")
      .in("role", ["admin", "super_admin"]);
    if (fetchError) {
      console.error("[notifyAdmins] Failed to fetch admin list:", fetchError.message);
      return;
    }
    if (!admins || admins.length === 0) return;

    const rows = admins.map((a) => ({
      profile_id: a.id,
      title: params.title,
      body: params.body ?? null,
      link_url: params.linkUrl ?? null,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("[notifyAdmins] Failed to insert notifications:", error.message);
  } catch (err) {
    console.error("[notifyAdmins] Unexpected failure (is SUPABASE_SERVICE_ROLE_KEY set?):", err);
  }
}
