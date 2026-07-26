"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRewardEngine } from "@/lib/reward-engine";
import { requireRole } from "@/lib/rbac";
import { generateCourseCoverSvg } from "@/lib/course-cover";

export async function moderateCourseAction(
  courseId: string,
  action: "approve" | "reject" | "request_changes",
  notes: string
) {
  const profile = await requireRole("moderator");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const statusMap = {
    approve: "published",
    reject: "rejected",
    request_changes: "changes_requested",
  } as const;

  const newStatus = statusMap[action];
  const update: Record<string, unknown> = {
    status: newStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.id,
    review_notes: notes || null,
  };
  if (newStatus === "published") update.published_at = new Date().toISOString();

  const { error } = await supabase.from("courses").update(update).eq("id", courseId);
  if (error) return { error: error.message };

  await supabase.from("course_moderation_log").insert({
    course_id: courseId,
    actor_profile_id: profile.id,
    action,
    notes: notes || null,
  });

  // Reward the instructor for a course being approved & published
  if (action === "approve") {
    const { data: course } = await supabase
      .from("courses")
      .select("instructor_id, title, cover_is_custom, category:categories(name)")
      .eq("id", courseId)
      .single();
    if (course) {
      // Generate the official, on-brand cover for this course — but ONLY
      // when the instructor hasn't uploaded their own. Overwriting a
      // deliberately-chosen custom cover here was the bug: a required
      // upload that then got silently destroyed on approval. Instructor
      // uploads are now permanent unless the instructor changes them again.
      if (!course.cover_is_custom) {
        const categoryField = course.category as unknown;
        const categoryName = Array.isArray(categoryField)
          ? (categoryField as { name: string }[])[0]?.name
          : (categoryField as { name: string } | null)?.name;

        const svg = generateCourseCoverSvg(course.title, categoryName ?? null);
        const coverPath = `official-covers/${courseId}.svg`;
        const { error: uploadError } = await supabase.storage
          .from("course-images")
          .upload(coverPath, Buffer.from(svg, "utf-8"), {
            contentType: "image/svg+xml",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("course-images").getPublicUrl(coverPath);
          await supabase.from("courses").update({ thumbnail_url: publicUrlData.publicUrl }).eq("id", courseId);
        } else {
          // Don't let a cover-generation hiccup block the actual approval —
          // the course is still published either way, just without (or with
          // its prior) thumbnail; log it for visibility instead.
          console.error("Failed to generate/upload official course cover:", uploadError.message);
        }
      }

      const rewardEngine = getRewardEngine(supabase);
      await rewardEngine.award(course.instructor_id, "course_publish_bonus", 100, {
        referenceTable: "courses",
        referenceId: courseId,
        description: `"${course.title}" approved and published`,
      });
      await supabase.from("notifications").insert({
        profile_id: course.instructor_id,
        title: "Course published!",
        body: `Your course "${course.title}" has been approved and is now live.`,
        link_url: `/instructor/courses/${courseId}/edit`,
      });
    }
  } else {
    const { data: course } = await supabase.from("courses").select("instructor_id,title").eq("id", courseId).single();
    if (course) {
      await supabase.from("notifications").insert({
        profile_id: course.instructor_id,
        title: action === "reject" ? "Course rejected" : "Changes requested",
        body: notes || `Your course "${course.title}" needs attention.`,
        link_url: `/instructor/courses/${courseId}/edit`,
      });
    }
  }

  revalidatePath("/admin/courses");
  return { error: null };
}

export async function banUserAction(userId: string, ban: boolean, reason: string) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: ban, ban_reason: ban ? reason : null })
    .eq("id", userId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_profile_id: profile.id,
    action: ban ? "user.ban" : "user.unban",
    target_table: "profiles",
    target_id: userId,
    metadata: { reason },
  });

  revalidatePath("/admin/users");
  return { error: null };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_profile_id: profile.id,
    action: "user.role_change",
    target_table: "profiles",
    target_id: userId,
    metadata: { new_role: role },
  });

  revalidatePath("/admin/users");
  return { error: null };
}

export async function grantW3trAction(userId: string, amount: number, description: string) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };
  if (amount === 0) return { error: "Amount must be non-zero." };

  const supabase = await createClient();
  const rewardEngine = getRewardEngine(supabase);

  try {
    await rewardEngine.award(userId, amount > 0 ? "admin_grant" : "admin_deduction", amount, {
      description,
      awardedBy: profile.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to grant W3TR." };
  }

  await supabase.from("audit_logs").insert({
    actor_profile_id: profile.id,
    action: "reward.manual_grant",
    target_table: "w3tr_transactions",
    target_id: userId,
    metadata: { amount, description },
  });

  revalidatePath("/admin/rewards");
  return { error: null };
}

export async function createCategoryAction(formData: FormData) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };

  const name = String(formData.get("name") || "");
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { slugify } = await import("@/lib/utils");
  const { error } = await supabase.from("categories").insert({
    name,
    slug: slugify(name),
    icon: String(formData.get("icon") || "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/categories");
  return { error: null };
}

export async function toggleCategoryActiveAction(categoryId: string, isActive: boolean) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  await supabase.from("categories").update({ is_active: isActive }).eq("id", categoryId);
  revalidatePath("/admin/categories");
}

export async function confirmDonationAction(donationId: string) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: donation } = await supabase.from("donations").select("*").eq("id", donationId).single();
  if (!donation) return { error: "Donation not found." };

  await supabase
    .from("donations")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", donationId);

  if (donation.campaign_id) {
    const { data: campaign } = await supabase
      .from("donation_campaigns")
      .select("raised_amount")
      .eq("id", donation.campaign_id)
      .single();
    if (campaign) {
      await supabase
        .from("donation_campaigns")
        .update({ raised_amount: Number(campaign.raised_amount) + Number(donation.amount) })
        .eq("id", donation.campaign_id);
    }
  }

  revalidatePath("/admin/donations");
  return { error: null };
}

export async function createAnnouncementAction(formData: FormData) {
  const profile = await requireRole("admin");
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const audience = String(formData.get("audience") || "");
  const { error } = await supabase.from("announcements").insert({
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
    audience: audience || null,
    is_banner: formData.get("isBanner") === "on",
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/announcements");
  return { error: null };
}

export async function toggleAnnouncementActiveAction(id: string, isActive: boolean) {
  const profile = await requireRole("admin");
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("announcements").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/announcements");
}