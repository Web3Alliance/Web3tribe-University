"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { notifyUser } from "@/lib/notify";
import { sendEmail, emailLayout } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

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

  // Expected pay is REQUIRED on every new opportunity, in the currency of
  // the opportunity's country — students should never have to guess what
  // an opportunity pays before expressing interest.
  const payAmount = Number(formData.get("payAmount"));
  const payCurrency = String(formData.get("payCurrency") || "NGN");
  const payPeriod = String(formData.get("payPeriod") || "month");
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return { error: "Expected pay is required — enter the amount in the opportunity's local currency." };
  }

  const { error } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    title,
    description: String(formData.get("description") || "") || null,
    opportunity_type: String(formData.get("opportunityType") || "job"),
    location_state: String(formData.get("locationState") || "") || null,
    required_course_ids: requiredCourseIds,
    application_method: String(formData.get("applicationMethod") || "") || null,
    pay_amount: payAmount,
    pay_currency: payCurrency,
    pay_period: payPeriod,
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
 * server-side, not just trusted from the client), to have their visibility
 * toggle on, and to have a profile photo — organizations review applicants
 * by profile (photo included) before deciding to shortlist, so applying
 * without one would put a faceless card in front of every employer.
 *
 * On success the organization's owner gets an in-app notification and an
 * email so applications never sit unseen.
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

  if (!profile.avatar_url) {
    return {
      error:
        "Add a profile photo in Settings first — organizations see your photo when reviewing applications.",
    };
  }

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("required_course_ids, status, title, organization_id, organization:organizations(name, owner_profile_id)")
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

  // Tell the organization someone applied — in-app always; email best-effort.
  const orgField = opportunity.organization as unknown;
  const org = Array.isArray(orgField)
    ? (orgField as { name: string; owner_profile_id: string }[])[0]
    : (orgField as { name: string; owner_profile_id: string } | null);
  if (org?.owner_profile_id) {
    const applicantName = profile.full_name ?? profile.email;
    await notifyUser({
      profileId: org.owner_profile_id,
      title: "New interest in your opportunity",
      body: `${applicantName} expressed interest in "${opportunity.title}". Review their profile to decide whether to shortlist them.`,
      linkUrl: `/organization/opportunities/${opportunityId}`,
    });
    const { data: ownerProfile } = await supabase.from("profiles").select("email").eq("id", org.owner_profile_id).single();
    if (ownerProfile?.email) {
      await sendEmail({
        to: ownerProfile.email,
        subject: `New applicant for "${opportunity.title}"`,
        html: emailLayout(
          "New interest in your opportunity",
          `<p><strong>${applicantName}</strong> has expressed interest in <strong>${opportunity.title}</strong>.</p>
           <p>Open the applicant list to review their profile and decide whether to shortlist them.</p>`,
          `${SITE_URL}/organization/opportunities/${opportunityId}`,
          "Review applicant"
        ),
      });
    }
  }

  revalidatePath("/student/opportunities");
  return { error: null };
}

/**
 * Shortlists an applicant WITH a required next-steps message. The message is
 * what the student actually acts on (interview date, contact person, links),
 * so shortlisting without one is rejected outright. The student receives
 * both an in-app notification and an email containing the message, and can
 * then accept or reject the offer from their Opportunities page.
 */
export async function shortlistApplicantAction(applicationId: string, organizationId: string, message: string) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const trimmed = message.trim();
  if (!trimmed) {
    return { error: "A shortlist message is required — tell the candidate what happens next (interview details, who to contact, timelines)." };
  }

  const { data: application } = await supabase
    .from("opportunity_applications")
    .select("id, student_id, status, opportunity:opportunities(id, title, organization_id, organization:organizations(name))")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "Application not found." };

  const oppField = application.opportunity as unknown;
  const opp = Array.isArray(oppField)
    ? (oppField as { id: string; title: string; organization_id: string; organization: { name: string } | { name: string }[] }[])[0]
    : (oppField as { id: string; title: string; organization_id: string; organization: { name: string } | { name: string }[] } | null);
  if (!opp || opp.organization_id !== organizationId) return { error: "This application does not belong to your organization." };
  if (application.status !== "interested") return { error: "Only applications still in \"interested\" can be shortlisted." };

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ status: "shortlisted", shortlist_message: trimmed, shortlisted_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  const orgNameField = opp.organization as unknown;
  const orgName = Array.isArray(orgNameField)
    ? (orgNameField as { name: string }[])[0]?.name
    : (orgNameField as { name: string } | null)?.name;

  await notifyUser({
    profileId: application.student_id,
    title: "You've been shortlisted! 🎉",
    body: `${orgName ?? "An organization"} shortlisted you for "${opp.title}". Next steps: ${trimmed}`,
    linkUrl: "/student/opportunities",
  });

  const { data: studentProfile } = await supabase.from("profiles").select("email, full_name").eq("id", application.student_id).single();
  if (studentProfile?.email) {
    await sendEmail({
      to: studentProfile.email,
      subject: `You've been shortlisted for "${opp.title}"`,
      html: emailLayout(
        "You've been shortlisted!",
        `<p>Hi ${studentProfile.full_name ?? "there"},</p>
         <p><strong>${orgName ?? "An organization"}</strong> has shortlisted you for <strong>${opp.title}</strong>.</p>
         <p><strong>Next steps from the organization:</strong></p>
         <blockquote style="margin: 12px 0; padding: 12px 16px; background: #f5f5f5; border-left: 3px solid #16a34a; border-radius: 4px;">${trimmed}</blockquote>
         <p>Please open your Opportunities page to <strong>accept or decline</strong> this offer so the organization knows where you stand.</p>`,
        `${SITE_URL}/student/opportunities`,
        "Respond to this offer"
      ),
    });
  }

  revalidatePath("/organization/opportunities");
  revalidatePath("/student/opportunities");
  return { error: null };
}

/**
 * A shortlisted student accepts or rejects the offer. Rejection requires a
 * note back to the organization (so employers get a reason, not silence);
 * for acceptance the note is optional. The organization owner is notified
 * in-app and by email either way.
 */
export async function respondToShortlistAction(applicationId: string, response: "accepted" | "rejected", note: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const trimmedNote = note.trim();

  if (response === "rejected" && !trimmedNote) {
    return { error: "Please add a short note explaining why you're declining — the organization will see it." };
  }

  const { data: application } = await supabase
    .from("opportunity_applications")
    .select("id, student_id, status, opportunity:opportunities(id, title, organization:organizations(name, owner_profile_id))")
    .eq("id", applicationId)
    .single();
  if (!application || application.student_id !== profile.id) return { error: "Application not found." };
  if (application.status !== "shortlisted") return { error: "You can only respond to an offer you've been shortlisted for." };

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ status: response, response_note: trimmedNote || null, responded_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("student_id", profile.id);
  if (error) return { error: error.message };

  const oppField = application.opportunity as unknown;
  const opp = Array.isArray(oppField)
    ? (oppField as { id: string; title: string; organization: unknown }[])[0]
    : (oppField as { id: string; title: string; organization: unknown } | null);
  const orgRaw = opp?.organization;
  const org = Array.isArray(orgRaw)
    ? (orgRaw as { name: string; owner_profile_id: string }[])[0]
    : (orgRaw as { name: string; owner_profile_id: string } | null);

  if (org?.owner_profile_id && opp) {
    const studentName = profile.full_name ?? profile.email;
    const accepted = response === "accepted";
    await notifyUser({
      profileId: org.owner_profile_id,
      title: accepted ? "Offer accepted 🎉" : "Offer declined",
      body: accepted
        ? `${studentName} accepted your offer for "${opp.title}".${trimmedNote ? ` Note: ${trimmedNote}` : ""}`
        : `${studentName} declined your offer for "${opp.title}". Reason: ${trimmedNote}`,
      linkUrl: `/organization/opportunities/${opp.id}`,
    });

    const { data: ownerProfile } = await supabase.from("profiles").select("email").eq("id", org.owner_profile_id).single();
    if (ownerProfile?.email) {
      await sendEmail({
        to: ownerProfile.email,
        subject: accepted ? `${studentName} accepted your offer for "${opp.title}"` : `${studentName} declined your offer for "${opp.title}"`,
        html: emailLayout(
          accepted ? "Offer accepted" : "Offer declined",
          `<p><strong>${studentName}</strong> has ${accepted ? "accepted" : "declined"} your offer for <strong>${opp.title}</strong>.</p>
           ${trimmedNote ? `<p><strong>Their note:</strong></p><blockquote style="margin: 12px 0; padding: 12px 16px; background: #f5f5f5; border-left: 3px solid ${accepted ? "#16a34a" : "#dc2626"}; border-radius: 4px;">${trimmedNote}</blockquote>` : ""}`,
          `${SITE_URL}/organization/opportunities/${opp.id}`,
          "View application"
        ),
      });
    }
  }

  revalidatePath("/student/opportunities");
  revalidatePath("/organization/opportunities");
  return { error: null };
}

/**
 * Kept for the non-shortlist transitions (e.g. closing an application).
 * Shortlisting itself MUST go through shortlistApplicantAction so a
 * next-steps message and the student notification are never skipped.
 */
export async function updateApplicationStatusAction(
  applicationId: string,
  organizationId: string,
  status: "interested" | "closed"
) {
  const { ok, supabase } = await assertOwnsOrgOrAdmin(organizationId);
  if (!ok || !supabase) return { error: "Not authorized." };

  await supabase.from("opportunity_applications").update({ status }).eq("id", applicationId);
  revalidatePath("/organization/opportunities");
  return { error: null };
}

