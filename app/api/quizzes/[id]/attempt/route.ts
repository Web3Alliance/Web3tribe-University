import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";
import { gradeQuizAttempt } from "@/lib/quiz-grading";

interface SubmitQuizBody {
  answers: Record<string, unknown>;
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

  // quiz_questions (and especially correct_answer) is intentionally locked
  // down by RLS to instructors/admins only, so students can't read answers
  // ahead of time by querying the table directly. That's exactly why grading
  // must use the admin client here — using the student's own session (as
  // this route did before) silently returned zero rows, which is what
  // caused every attempt to be scored as 0% regardless of what was actually
  // answered.
  const admin = createAdminClient();
  const { data: questions } = await admin.from("quiz_questions").select("*").eq("quiz_id", quizId);

  const { scorePercent, passed, perQuestionResults } = gradeQuizAttempt(
    questions ?? [],
    body.answers,
    Number(quiz.passing_score_percent)
  );

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

  // Correct answers are only revealed on a PASS. Sending them on every
  // graded attempt (pass or fail) meant a failing student could just copy
  // the revealed answers into their next attempt instead of actually
  // re-studying — with unlimited retakes, that turned "learn from a wrong
  // answer" into "guess once, then paste the answers back." perQuestionResults
  // still tells them which questions they got wrong (see quiz-grading.ts),
  // just not what the right answer was, so a failed attempt is still useful
  // feedback without being an answer key.
  const correctAnswers = passed
    ? (questions ?? []).reduce<Record<string, unknown>>((acc, q) => {
        acc[q.id] = q.correct_answer;
        return acc;
      }, {})
    : null;

  return NextResponse.json({
    data: { attempt, scorePercent, passed, perQuestionResults, correctAnswers },
    error: null,
  });
}