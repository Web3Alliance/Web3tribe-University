"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

export interface DeleteAccountState {
  error: string | null;
}

/**
 * Permanently deletes the signed-in user's own account (data-rights / right to erasure).
 *
 * Safety rules, because deletion cascades through the database:
 *  - the person must type their own email address to confirm;
 *  - admins and super admins cannot self-delete (their role must be changed by another admin first);
 *  - anyone who still owns courses or an organization must have those handled first, because the
 *    deletion would otherwise remove learners' courses/records along with them.
 * Donation records are kept but detached from the person (the database sets donor_id to null).
 */
export async function deleteAccountAction(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const limited = await enforceRateLimit("account-delete", profile.id, 5, 3600);
  if (limited) return { error: "Too many attempts. Please try again later." };

  const typed = String(formData.get("confirmEmail") || "").trim().toLowerCase();
  if (!typed || typed !== profile.email.trim().toLowerCase()) {
    return { error: "Type your account email address exactly to confirm." };
  }
  if (profile.role === "admin" || profile.role === "super_admin") {
    return { error: "Admin accounts can't be deleted here. Ask another super admin to change your role first." };
  }

  const admin = createAdminClient();
  const [{ count: courseCount }, { count: orgCount }] = await Promise.all([
    admin.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", profile.id),
    admin.from("organizations").select("id", { count: "exact", head: true }).eq("owner_profile_id", profile.id),
  ]);
  if ((courseCount ?? 0) > 0) {
    return { error: "You still own courses. Contact support so your learners' courses can be handed over or archived before your account is deleted." };
  }
  if ((orgCount ?? 0) > 0) {
    return { error: "You still own an organization. Contact support so its learners and programs can be handled first." };
  }

  // Record the event with the id only (no personal details) before the account disappears.
  await admin.from("audit_logs").insert({
    actor_profile_id: null,
    action: "account.self_delete",
    target_table: "profiles",
    target_id: profile.id,
    metadata: { role: profile.role },
  });

  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) return { error: "We couldn't delete your account just now. Please try again or contact support." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?account_deleted=1");
}
