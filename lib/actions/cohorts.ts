"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { getBiodataGateStatus } from "@/lib/actions/biodata";
import { getRewardEngine } from "@/lib/reward-engine";
import { payInstructorEarnings } from "@/lib/instructor-earnings";

export interface CohortFormState {
  error: string | null;
  success?: boolean;
}

/**
 * Starts a cohort for an existing PUBLISHED course — the instructor running
 * it doesn't need to be the course's original author. Accreditation gating
 * (restricting this to verified professionals in regulated fields) is
 * intentionally not enforced yet — see the note in
 * supabase/migrations/0005_cohorts_and_location.sql. profiles.is_instructor_verified
 * already exists for exactly this purpose and can be checked here later
 * without a schema change.
 *
 * Delivery mode is NOT chosen here — it belongs to the course, decided once
 * by its original author, and every cohort inherits it (enforced at the
 * database level too, see 0006_delivery_mode_on_course.sql). This action
 * only ever reads course.delivery_mode to decide whether a location is
 * required; the instructor starting the cohort can't pick a different mode.
 */
export async function createCohortAction(
  _prevState: CohortFormState,
  formData: FormData
): Promise<CohortFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };
  if (!["instructor", "admin", "super_admin"].includes(profile.role)) {
    return { error: "Only instructors can start a cohort." };
  }

  const courseId = String(formData.get("courseId") || "");
  if (!courseId) return { error: "Choose a course to teach." };

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, status, delivery_mode")
    .eq("id", courseId)
    .single();
  if (!course || course.status !== "published") {
    return { error: "That course isn't available to teach right now." };
  }

  const stateRegion = String(formData.get("stateRegion") || "") || null;
  const lga = String(formData.get("lga") || "") || null;
  const address = String(formData.get("address") || "") || null;
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "") || null;
  const maxStudents = formData.get("maxStudents") ? Number(formData.get("maxStudents")) : null;
  const title = String(formData.get("title") || "") || null;

  if (!startDate) return { error: "Start date is required." };
  if (course.delivery_mode !== "online" && !stateRegion) {
    return { error: `This course is ${course.delivery_mode} — a state is required to start a cohort for it.` };
  }
  if (course.delivery_mode !== "online" && !lga) {
    return { error: `This course is ${course.delivery_mode} — a local government area is required to start a cohort for it.` };
  }
  if (new Date(startDate) < new Date(new Date().toDateString())) {
    return { error: "Start date can't be in the past." };
  }

  const { error } = await supabase.from("cohorts").insert({
    course_id: courseId,
    instructor_id: profile.id,
    title,
    state_region: course.delivery_mode === "online" ? null : stateRegion,
    lga: course.delivery_mode === "online" ? null : lga,
    address: course.delivery_mode === "online" ? null : address,
    max_students: maxStudents,
    start_date: startDate,
    end_date: endDate,
  });
  if (error) return { error: error.message };

  revalidatePath("/instructor/cohorts/new");
  return { error: null, success: true };
}

/**
 * Enrolls a student in a specific cohort. Reuses the same one-course-at-a-time
 * check as direct course enrollment (a cohort enrollment is a normal
 * enrollments row, just with cohort_id set), and additionally blocks
 * enrollment once the cohort's start_date has passed, and once it's at
 * max_students capacity if a cap was set.
 */
export async function enrollInCohortAction(cohortId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to enroll." };

  // Same institutional biodata requirement as direct course enrollment.
  if (profile.role === "student") {
    const biodataStatus = await getBiodataGateStatus(profile.id);
    if (!biodataStatus.hasCleared) {
      return { error: null, requiresBiodata: true };
    }
  }

  const supabase = await createClient();
  const { data: cohort } = await supabase.from("cohorts").select("*").eq("id", cohortId).single();
  if (!cohort) return { error: "Cohort not found." };

  if (new Date(cohort.start_date) < new Date(new Date().toDateString())) {
    return { error: "This cohort has already started and is no longer accepting new enrollments." };
  }

  if (cohort.max_students) {
    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("cohort_id", cohortId);
    if ((count ?? 0) >= cohort.max_students) {
      return { error: "This cohort is full." };
    }
  }

  // Same one-course-at-a-time rule as direct enrollment.
  const { data: activeElsewhereRows } = await supabase
    .from("enrollments")
    .select("course_id, courses(title)")
    .eq("student_id", profile.id)
    .eq("status", "active")
    .neq("course_id", cohort.course_id)
    .limit(1);
  const activeElsewhere = activeElsewhereRows?.[0];
  if (activeElsewhere) {
    const coursesField = activeElsewhere.courses as unknown;
    const activeCourse = Array.isArray(coursesField)
      ? (coursesField as { title: string }[])[0]
      : (coursesField as { title: string } | null);
    return {
      error: `Finish or drop "${activeCourse?.title ?? "your current course"}" before joining a new cohort — you can only have one course in progress at a time.`,
    };
  }

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", profile.id)
    .eq("course_id", cohort.course_id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") return { error: "You're already enrolled in this course." };
    if (existing.status === "completed") return { error: "You've already completed this course." };
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "active", cohort_id: cohortId })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/student/courses/${courseSlug}`);
    return { error: null };
  }

  // Same premium-course price enforcement as direct enrollment.
  const { data: course } = await supabase
    .from("courses")
    .select("price_w3tr, instructor_id")
    .eq("id", cohort.course_id)
    .single();
  const price = Number(course?.price_w3tr ?? 0);

  if (price > 0) {
    const rewardEngine = getRewardEngine(supabase);
    const wallet = await rewardEngine.getBalance(profile.id);
    const balance = Number(wallet?.balance ?? 0);

    if (balance < price) {
      return { error: null, insufficientBalance: true, needed: price, has: balance, shortfall: price - balance };
    }

    try {
      await rewardEngine.spend(profile.id, price, {
        referenceTable: "cohorts",
        referenceId: cohortId,
        description: `Joined premium course cohort`,
      });
      if (course?.instructor_id) {
        await payInstructorEarnings(rewardEngine, {
          price,
          courseId: cohort.course_id,
          courseAuthorId: course.instructor_id,
          cohortInstructorId: cohort.instructor_id,
          referenceTable: "cohorts",
          referenceId: cohortId,
        });
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to charge W3TR for this cohort." };
    }
  }

  const { error } = await supabase.from("enrollments").insert({
    student_id: profile.id,
    course_id: cohort.course_id,
    cohort_id: cohortId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}