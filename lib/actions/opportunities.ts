"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

async function assertOwnsOrgOrAdmin(organizationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false, supabase: null };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("owner_profile_id").eq("id", organizationId).single();
  const ok = !!org && (org.owner_profile_id === profile.id || profile.role === "admin" || profile.role === "super_admin");
  return { profile, ok, supabase };
}

export async function createOpportunityAction(organizationId: string, formData: FormData) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const title = String(formData.get("title") || "");
  if (!title) return { error: "Title is required." };

  const requiredCourseIds = formData.getAll("requiredCourseIds").map(String).filter(Boolean);
  if (requiredCourseIds.length === 0) {
    return { error: "Select at least one required course — this is what students are matched against." };
  }

  const { error } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    title,
    description: String(formData.get("description") || "") || null,
    opportunity_type: String(formData.get("opportunityType") || "job"),
    location_state: String(formData.get("locationState") || "") || null,
    required_course_ids: requiredCourseIds,
    application_method: String(formData.get("applicationMethod") || "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/organization/opportunities");
  return { error: null };
}

export async function closeOpportunityAction(opportunityId: string, organizationId: string) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  await supabase.from("opportunities").update({ status: "closed" }).eq("id", opportunityId);
  revalidatePath("/organization/opportunities");
  return { error: null };
}

/**
 * A student turning this on is the ONLY thing that makes them visible in an
 * organization's applicant list — completing a course never does this
 * automatically. Off by default (see migration 0011).
 */
export async function toggleOpportunityVisibilityAction(visible: boolean) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ visible_for_opportunities: visible })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/student/settings");
  revalidatePath("/student/opportunities");
  return { error: null };
}

/**
 * Expresses interest in an opportunity. Requires the student to have
 * genuinely COMPLETED every course the opportunity requires (checked
 * server-side, not just trusted from the client) and to have their
 * visibility toggle on — applying without visibility on would create an
 * application record the organization still couldn't meaningfully act on,
 * so we ask for both together rather than a confusing partial state.
 */
export async function expressInterestAction(opportunityId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to apply." };

  const supabase = await createClient();

  if (!profile.visible_for_opportunities) {
    return {
      error:
        "Turn on \"Visible to employers\" in Settings first — this is what lets organizations see your application.",
    };
  }

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("required_course_ids, status")
    .eq("id", opportunityId)
    .single();
  if (!opportunity) return { error: "Opportunity not found." };
  if (opportunity.status !== "open") return { error: "This opportunity is no longer open." };

  const requiredCourseIds: string[] = opportunity.required_course_ids ?? [];
  const { data: completed } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", profile.id)
    .eq("status", "completed")
    .in("course_id", requiredCourseIds);

  const completedIds = new Set((completed ?? []).map((e) => e.course_id));
  const isFullyQualified = requiredCourseIds.every((id) => completedIds.has(id));
  if (!isFullyQualified) {
    return { error: "You haven't completed all the courses this opportunity requires yet." };
  }

  const { data: existing } = await supabase
    .from("opportunity_applications")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("student_id", profile.id)
    .maybeSingle();
  if (existing) return { error: "You've already expressed interest in this opportunity." };

  const { error } = await supabase.from("opportunity_applications").insert({
    opportunity_id: opportunityId,
    student_id: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/student/opportunities");
  return { error: null };
}

export async function updateApplicationStatusAction(
  applicationId: string,
  organizationId: string,
  status: "interested" | "shortlisted" | "closed"
) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  await supabase.from("opportunity_applications").update({ status }).eq("id", applicationId);
  revalidatePath("/organization/opportunities");
  return { error: null };
}