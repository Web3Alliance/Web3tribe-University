"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

export interface SettingsActionState {
  error: string | null;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const fullName = String(formData.get("fullName") || "");
  const username = String(formData.get("username") || "") || null;
  const bio = String(formData.get("bio") || "") || null;
  const country = String(formData.get("country") || "") || null;
  const stateRegion = String(formData.get("stateRegion") || "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, username, bio, country, state_region: stateRegion })
    .eq("id", profile.id);

  if (error) return { error: error.message };
  revalidatePath("/student/settings");
  return { error: null, success: true };
}

export async function updateThemePreferenceAction(theme: "light" | "dark" | "system") {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme_preference: theme }).eq("id", profile.id);
}

export async function changePasswordAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const newPassword = String(formData.get("newPassword") || "");
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { error: null, success: true };
}