"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { notifyUser } from "@/lib/notify";
import { sendEmail, emailLayout } from "@/lib/email";

async function assertOwnsOrgOrAdmin(organizationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false, supabase: null };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("owner_profile_id").eq("id", organizationId).single();
  const ok = !!org && (org.owner_profile_id === profile.id || profile.role === "admin" || profile.role === "super_admin");
  return { profile, ok, supabase };
}

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
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { data: existingProfile } = await supabase.from("profiles").select("id, full_name").eq("email", email).maybeSingle();

  // Guard against inviting the same person twice — the unique constraint on
  // (organization_id, profile_id) only protects already-registered users;
  // a not-yet-registered invitee (profile_id null) could otherwise be
  // invited by email repeatedly, creating duplicate rows.
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .or(existingProfile ? `profile_id.eq.${existingProfile.id}` : `invited_email.eq.${email}`)
    .maybeSingle();
  if (existingMember) return { error: "This person has already been invited to your organization." };

  const { error } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    profile_id: existingProfile?.id ?? null,
    invited_email: email,
    status: existingProfile ? "active" : "invited",
  });
  if (error) return { error: error.message };

  // Actually DELIVER the invitation. Previously this action only wrote a
  // membership row — invitees never received an email or notification and
  // had no way of knowing they'd been invited at all.
  const { data: orgRecord } = await supabase.from("organizations").select("name").eq("id", organizationId).single();
  const orgName = orgRecord?.name ?? "an organization";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  if (existingProfile) {
    // Registered user: in-app notification + email pointing at their dashboard.
    await notifyUser({
      profileId: existingProfile.id,
      title: `You've been added to ${orgName}`,
      body: `${orgName} added you as a learner. Programs they assign you to will appear in your courses.`,
      linkUrl: "/student/dashboard",
    });
    await sendEmail({
      to: email,
      subject: `${orgName} added you on Web3tribe University`,
      html: emailLayout(
        `You've been added to ${orgName}`,
        `<p>Hi ${existingProfile.full_name ?? "there"},</p>
         <p><strong>${orgName}</strong> has added you as a learner on Web3tribe University. Any programs they assign you to will show up in your courses automatically.</p>`,
        `${siteUrl}/student/dashboard`,
        "Open your dashboard"
      ),
    });
  } else {
    // Not yet registered: email is the only channel we have — invite them
    // to create an account with this same email so the membership links up.
    await sendEmail({
      to: email,
      subject: `${orgName} invited you to Web3tribe University`,
      html: emailLayout(
        `${orgName} invited you to learn on Web3tribe University`,
        `<p><strong>${orgName}</strong> has invited you to join Web3tribe University as a learner.</p>
         <p>Create your free account using this email address (<strong>${email}</strong>) and your invitation will be waiting for you.</p>`,
        `${siteUrl}/register`,
        "Create your account"
      ),
    });
  }

  revalidatePath("/organization/learners");
  return { error: null };
}

export async function createProgramAction(organizationId: string, formData: FormData) {
  const { ok, supabase, profile } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const courseIds = formData.getAll("courseIds").map(String).filter(Boolean);
  const startDate = String(formData.get("startDate") || "") || null;
  const endDate = String(formData.get("endDate") || "") || null;

  const { error } = await supabase.from("organization_programs").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    course_ids: courseIds,
    start_date: startDate,
    end_date: endDate,
    created_by: profile?.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/organization/programs");
  return { error: null };
}

/**
 * Assigns an existing organization member to a program — this is what
 * actually connects a learner to the program's bundle of courses so their
 * progress can be tracked. Previously, "programs" had no way to enroll
 * anyone in them at all; course_ids and this assignments table existed in
 * the schema but nothing in the app ever wrote to them.
 */
export async function assignLearnerToProgramAction(programId: string, organizationId: string, profileId: string) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  // Confirm this profile is actually a member of this organization before
  // assigning them — otherwise anyone with the org owner's session could be
  // pointed at an arbitrary profile_id via a crafted request.
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!member) return { error: "That person isn't a member of your organization." };

  const { data: existing } = await supabase
    .from("organization_program_assignments")
    .select("id")
    .eq("program_id", programId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing) return { error: "This learner is already assigned to this program." };

  const { error } = await supabase.from("organization_program_assignments").insert({
    program_id: programId,
    profile_id: profileId,
  });
  if (error) return { error: error.message };

  // Also enroll them in every course in the program, so being "assigned"
  // actually starts their learning rather than just being a label — without
  // this, an org could assign someone to a program and nothing would happen.
  const { data: program } = await supabase.from("organization_programs").select("course_ids").eq("id", programId).single();
  for (const courseId of program?.course_ids ?? []) {
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", profileId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!existingEnrollment) {
      await supabase.from("enrollments").insert({ student_id: profileId, course_id: courseId });
    }
  }

  revalidatePath(`/organization/programs/${programId}`);
  return { error: null };
}

/**
 * Marks a program assignment as completed once the assigned learner has
 * completed every course in the program's course_ids. This is computed
 * on-demand (called from the program detail page) rather than via a
 * database trigger — simpler to reason about, and completion status is
 * always freshly accurate whenever an org manager actually looks at it.
 */
export async function checkAndMarkProgramCompletionAction(programId: string, profileId: string) {
  const supabase = await createClient();

  const { data: program } = await supabase.from("organization_programs").select("course_ids").eq("id", programId).single();
  const courseIds: string[] = program?.course_ids ?? [];
  if (courseIds.length === 0) return { completed: false };

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, status")
    .eq("student_id", profileId)
    .in("course_id", courseIds);

  const allCompleted = courseIds.every((id) => enrollments?.some((e) => e.course_id === id && e.status === "completed"));

  if (allCompleted) {
    await supabase
      .from("organization_program_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("program_id", programId)
      .eq("profile_id", profileId)
      .is("completed_at", null);
  }

  return { completed: allCompleted };
}