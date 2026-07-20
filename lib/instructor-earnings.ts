import type { RewardEngine } from "@/lib/reward-engine";

/**
 * Pays out instructor earnings when a student spends W3TR to enroll in a
 * premium course. Of the price paid: 70% goes to instructor(s), 30% is
 * retained by the platform (simply not credited to anyone — no transaction
 * needed for the platform's own share).
 *
 * - Direct enrollment, or a cohort led by the course's own author: the full
 *   70% goes to that one person.
 * - A cohort led by someone OTHER than the course's author: 40% of the price
 *   goes to the course author (a content royalty — they created the
 *   curriculum being taught), and 30% goes to the cohort's own instructor (a
 *   delivery fee — they're the one actually running this cohort).
 *
 * Both cases total 70% paid out either way; only the split between people
 * changes. This never touches the student's own spend — that's handled
 * separately by the caller before this runs.
 */
export async function payInstructorEarnings(
  rewardEngine: RewardEngine,
  params: {
    price: number;
    courseId: string;
    courseAuthorId: string;
    cohortInstructorId?: string | null;
    referenceTable: string;
    referenceId: string;
  }
) {
  const { price, courseId, courseAuthorId, cohortInstructorId, referenceTable, referenceId } = params;

  const sameInstructor = !cohortInstructorId || cohortInstructorId === courseAuthorId;

  if (sameInstructor) {
    const authorShare = Math.round(price * 0.7);
    if (authorShare > 0) {
      await rewardEngine.award(courseAuthorId, "instructor_earning", authorShare, {
        referenceTable,
        referenceId,
        description: `Earnings from a premium course enrollment`,
      });
    }
    return;
  }

  const royaltyShare = Math.round(price * 0.4);
  const deliveryShare = Math.round(price * 0.3);

  if (royaltyShare > 0) {
    await rewardEngine.award(courseAuthorId, "instructor_earning", royaltyShare, {
      referenceTable,
      referenceId,
      description: `Content royalty — a cohort instructor taught your course "${courseId}"`,
    });
  }
  if (deliveryShare > 0) {
    await rewardEngine.award(cohortInstructorId as string, "instructor_earning", deliveryShare, {
      referenceTable,
      referenceId,
      description: `Delivery fee — you taught an enrolled student in your cohort`,
    });
  }
}