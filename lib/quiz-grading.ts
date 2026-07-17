export interface GradableQuestion {
  id: string;
  question_type: string;
  correct_answer: unknown;
  points: number;
}

/** Lenient text match for short-answer/subjective questions: trims whitespace,
 * lowercases, and strips common punctuation. This is deliberately forgiving
 * rather than an exact match, since genuinely subjective answers shouldn't
 * fail a student over capitalization or a trailing period. It's an
 * automatable approximation appropriate for short factual answers, not a
 * substitute for real free-form grading of long-form essay responses. */
export function normalizeShortAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ");
}

export function isAnswerCorrect(question: GradableQuestion, given: unknown): boolean {
  if (question.question_type === "multiple_choice") {
    const correct = new Set((question.correct_answer as string[]) ?? []);
    const givenArr = new Set((given as string[]) ?? []);
    return correct.size === givenArr.size && [...correct].every((c) => givenArr.has(c));
  }
  if (question.question_type === "short_answer") {
    if (typeof given !== "string" || typeof question.correct_answer !== "string") return false;
    return normalizeShortAnswer(given) === normalizeShortAnswer(question.correct_answer);
  }
  return JSON.stringify(question.correct_answer) === JSON.stringify(given);
}

export interface GradingResult {
  scorePercent: number;
  passed: boolean;
  perQuestionResults: { questionId: string; correct: boolean }[];
}

/**
 * Grades a full quiz attempt. Every question is weighted equally and the
 * result always sums to exactly 100% of the total, regardless of question
 * count — a 5-question quiz is 20% per question, a 1-question quiz is 100%
 * for that one question, a 50-question final exam is 2% per question. This
 * falls directly out of every question having equal `points` and computing
 * the percentage from the ratio of earned-to-total points, rather than any
 * hardcoded per-question value.
 */
export function gradeQuizAttempt(
  questions: GradableQuestion[],
  answers: Record<string, unknown>,
  passingScorePercent: number
): GradingResult {
  let totalPoints = 0;
  let earnedPoints = 0;
  const perQuestionResults: { questionId: string; correct: boolean }[] = [];

  for (const q of questions) {
    totalPoints += Number(q.points);
    const correct = isAnswerCorrect(q, answers[q.id]);
    if (correct) earnedPoints += Number(q.points);
    perQuestionResults.push({ questionId: q.id, correct });
  }

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = scorePercent >= passingScorePercent;

  return { scorePercent, passed, perQuestionResults };
}