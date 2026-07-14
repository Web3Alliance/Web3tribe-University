"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

export async function createOrganizationAction(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const name = String(formData.get("name") || "");
  if (!name) return { error: "Organization name is required." };

  const supabase = await createClient();
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await supabase.from("organizations").insert({
    owner_profile_id: profile.id,
    name,
    slug,
    industry: String(formData.get("industry") || "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/organization/dashboard");
  return { error: null };
}

export async function inviteLearnerAction(organizationId: string, email: string) {
  const supabase = await createClient();

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

  const { error } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    profile_id: existingProfile?.id ?? null,
    invited_email: email,
    status: existingProfile ? "active" : "invited",
  });
  if (error) return { error: error.message };

  revalidatePath("/organization/learners");
  return { error: null };
}

export async function createProgramAction(organizationId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("organization_programs").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    created_by: profile?.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/organization/programs");
  return { error: null };
}
