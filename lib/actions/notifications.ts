"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

export async function markNotificationRead(notificationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("profile_id", profile.id);
  revalidatePath("/student/notifications");
}

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("profile_id", profile.id).eq("is_read", false);
  revalidatePath("/student/notifications");
}
