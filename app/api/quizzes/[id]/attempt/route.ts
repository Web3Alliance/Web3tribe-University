import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

interface SubmitQuizBody {
  answers: Record<string, unknown>;
}

function isAnswerCorrect(question: { question_type: string; correct_answer: unknown }, given: unknown): boolean {
  if (question.question_type === "multiple_choice") {
    const correct = new Set((question.correct_answer as string[]) ?? []);
    const givenArr = new Set((given as string[]) ?? []);
    return correct.size === givenArr.size && [...correct].every((c) => givenArr.has(c));
  }
  return JSON.stringify(question.correct_answer) === JSON.stringify(given);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as SubmitQuizBody;
  const supabase = await createClient();

  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
  if (!quiz) return NextResponse.json({ data: null, error: "Quiz not found" }, { status: 404 });

  const { count: attemptCount } = await supabase
    .from("quiz_attempts")
    .select("*", { count: "exact", head: true })
    .eq("quiz_id", quizId)
    .eq("student_id", profile.id);

  if ((attemptCount ?? 0) >= quiz.max_attempts) {
    return NextResponse.json({ data: null, error: "Maximum attempts reached for this quiz." }, { status: 400 });
  }

  const { data: questions } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId);

  let totalPoints = 0;
  let earnedPoints = 0;
  for (const q of questions ?? []) {
    totalPoints += Number(q.points);
    if (isAnswerCorrect(q, body.answers[q.id])) earnedPoints += Number(q.points);
  }
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = scorePercent >= Number(quiz.passing_score_percent);

  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: profile.id,
      attempt_number: (attemptCount ?? 0) + 1,
      status: "graded",
      answers: body.answers,
      score_percent: scorePercent,
      passed,
      submitted_at: new Date().toISOString(),
      graded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  if (passed) {
    const rewardEngine = getRewardEngine(supabase);
    await rewardEngine.award(
      profile.id,
      quiz.is_final_exam ? "exam_pass" : "quiz_pass",
      Number(quiz.w3tr_reward),
      { referenceTable: "quizzes", referenceId: quizId, description: `Passed "${quiz.title}"` }
    );
  }

  return NextResponse.json({ data: { attempt, scorePercent, passed }, error: null });
}
