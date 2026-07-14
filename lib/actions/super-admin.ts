"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

export async function toggleFeatureFlagAction(flagId: string, isEnabled: boolean) {
  const profile = await requireRole("super_admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("feature_flags")
    .update({ is_enabled: isEnabled, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) return { error: error.message };

  revalidatePath("/super-admin/feature-flags");
  return { error: null };
}

export async function createFeatureFlagAction(formData: FormData) {
  const profile = await requireRole("super_admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("feature_flags").insert({
    flag_key: String(formData.get("flagKey") || ""),
    label: String(formData.get("label") || ""),
    description: String(formData.get("description") || "") || null,
    is_enabled: false,
    updated_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/super-admin/feature-flags");
  return { error: null };
}

export async function updateSystemSettingAction(key: string, value: unknown) {
  const profile = await requireRole("super_admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value, updated_by: profile.id, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/super-admin/system");
  return { error: null };
}

export async function toggleMaintenanceModeAction(enabled: boolean) {
  return updateSystemSettingAction("maintenance_mode", { enabled });
}
