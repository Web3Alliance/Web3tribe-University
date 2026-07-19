"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { BIODATA_SKIP_LIMIT, type BiodataFormState, type BiodataGateStatus } from "@/lib/biodata-types";

export async function getBiodataGateStatus(profileId: string): Promise<BiodataGateStatus> {
  const supabase = await createClient();

  const [{ data: own }, { count }] = await Promise.all([
    supabase.from("student_biodata").select("profile_id").eq("profile_id", profileId).maybeSingle(),
    supabase.from("student_biodata").select("*", { count: "exact", head: true }),
  ]);

  const totalThroughGate = count ?? 0;
  return {
    hasCleared: !!own,
    skipAllowed: totalThroughGate < BIODATA_SKIP_LIMIT,
    totalThroughGate,
  };
}

export async function submitBiodataAction(
  _prevState: BiodataFormState,
  formData: FormData
): Promise<BiodataFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const dateOfBirth = String(formData.get("dateOfBirth") || "");
  const gender = String(formData.get("gender") || "");
  const nationality = String(formData.get("nationality") || "");
  const stateOfOrigin = String(formData.get("stateOfOrigin") || "");
  const lga = String(formData.get("lga") || "");
  const homeAddress = String(formData.get("homeAddress") || "");
  const nextOfKinName = String(formData.get("nextOfKinName") || "");
  const nextOfKinRelationship = String(formData.get("nextOfKinRelationship") || "");
  const nextOfKinPhone = String(formData.get("nextOfKinPhone") || "");
  const nextOfKinAddress = String(formData.get("nextOfKinAddress") || "") || null;
  const highestQualification = String(formData.get("highestQualification") || "") || null;
  const occupationOrInstitution = String(formData.get("occupationOrInstitution") || "") || null;

  if (!dateOfBirth || !gender || !nationality || !stateOfOrigin || !lga || !homeAddress) {
    return { error: "Please fill in every required field." };
  }
  if (!nextOfKinName || !nextOfKinRelationship || !nextOfKinPhone) {
    return { error: "Next of kin details are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("student_biodata").upsert(
    {
      profile_id: profile.id,
      skipped: false,
      date_of_birth: dateOfBirth,
      gender,
      nationality,
      state_of_origin: stateOfOrigin,
      lga,
      home_address: homeAddress,
      next_of_kin_name: nextOfKinName,
      next_of_kin_relationship: nextOfKinRelationship,
      next_of_kin_phone: nextOfKinPhone,
      next_of_kin_address: nextOfKinAddress,
      highest_qualification: highestQualification,
      occupation_or_institution: occupationOrInstitution,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/student/biodata");
  return { error: null, success: true };
}

export async function skipBiodataAction(): Promise<BiodataFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const status = await getBiodataGateStatus(profile.id);
  if (!status.skipAllowed) {
    return {
      error: `Skipping is no longer available — the first ${BIODATA_SKIP_LIMIT} students have already been through this step, so biodata is now required for everyone.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("student_biodata").upsert(
    { profile_id: profile.id, skipped: true, updated_at: new Date().toISOString() },
    { onConflict: "profile_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/student/biodata");
  return { error: null, success: true };
}