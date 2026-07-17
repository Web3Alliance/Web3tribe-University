import { describe, it, expect } from "vitest";
import { gradeQuizAttempt, isAnswerCorrect, normalizeShortAnswer } from "@/lib/quiz-grading";
import type { GradableQuestion } from "@/lib/quiz-grading";

describe("gradeQuizAttempt — the actual reported bug: correct answer scoring 0%", () => {
  it("scores 100% when a single-choice question is answered correctly", () => {
    const questions: GradableQuestion[] = [
      { id: "q1", question_type: "single_choice", correct_answer: "b", points: 1 },
    ];
    const result = gradeQuizAttempt(questions, { q1: "b" }, 70);
    expect(result.scorePercent).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.perQuestionResults).toEqual([{ questionId: "q1", correct: true }]);
  });

  it("scores 0% only when the answer is actually wrong, not when it's correct", () => {
    const questions: GradableQuestion[] = [
      { id: "q1", question_type: "single_choice", correct_answer: "b", points: 1 },
    ];
    const wrong = gradeQuizAttempt(questions, { q1: "a" }, 70);
    expect(wrong.scorePercent).toBe(0);
    const right = gradeQuizAttempt(questions, { q1: "b" }, 70);
    expect(right.scorePercent).toBe(100);
  });
});

describe("gradeQuizAttempt — equal weighting regardless of question count", () => {
  it("a 5-question quiz weights each question at exactly 20%", () => {
    const questions: GradableQuestion[] = Array.from({ length: 5 }, (_, i) => ({
      id: `q${i}`,
      question_type: "single_choice",
      correct_answer: "a",
      points: 1,
    }));
    // Answer exactly 1 of 5 correctly
    const answers = { q0: "a", q1: "wrong", q2: "wrong", q3: "wrong", q4: "wrong" };
    const result = gradeQuizAttempt(questions, answers, 70);
    expect(result.scorePercent).toBe(20);
  });

  it("a 1-question quiz is worth 100% for that single question", () => {
    const questions: GradableQuestion[] = [
      { id: "q1", question_type: "single_choice", correct_answer: "a", points: 1 },
    ];
    const result = gradeQuizAttempt(questions, { q1: "a" }, 70);
    expect(result.scorePercent).toBe(100);
  });

  it("a 50-question final exam weights each question at 2%", () => {
    const questions: GradableQuestion[] = Array.from({ length: 50 }, (_, i) => ({
      id: `q${i}`,
      question_type: "single_choice",
      correct_answer: "a",
      points: 1,
    }));
    const answers: Record<string, string> = {};
    // Answer exactly 25 of 50 correctly
    questions.forEach((q, i) => {
      answers[q.id] = i < 25 ? "a" : "wrong";
    });
    const result = gradeQuizAttempt(questions, answers, 70);
    expect(result.scorePercent).toBe(50);
  });

  it("passing threshold is respected regardless of question count", () => {
    const questions: GradableQuestion[] = Array.from({ length: 5 }, (_, i) => ({
      id: `q${i}`,
      question_type: "single_choice",
      correct_answer: "a",
      points: 1,
    }));
    // 3 of 5 = 60%, below a 70% passing bar
    const answers = { q0: "a", q1: "a", q2: "a", q3: "wrong", q4: "wrong" };
    const result = gradeQuizAttempt(questions, answers, 70);
    expect(result.scorePercent).toBe(60);
    expect(result.passed).toBe(false);
  });
});

describe("isAnswerCorrect — multiple_choice", () => {
  it("requires the exact same set of selected options, order-independent", () => {
    const q: GradableQuestion = { id: "q1", question_type: "multiple_choice", correct_answer: ["a", "c"], points: 1 };
    expect(isAnswerCorrect(q, ["c", "a"])).toBe(true);
    expect(isAnswerCorrect(q, ["a"])).toBe(false);
    expect(isAnswerCorrect(q, ["a", "b"])).toBe(false);
  });
});

describe("isAnswerCorrect / normalizeShortAnswer — subjective questions", () => {
  it("matches despite case and trailing punctuation differences", () => {
    const q: GradableQuestion = { id: "q1", question_type: "short_answer", correct_answer: "Lagos", points: 1 };
    expect(isAnswerCorrect(q, "lagos")).toBe(true);
    expect(isAnswerCorrect(q, "Lagos.")).toBe(true);
    expect(isAnswerCorrect(q, "  LAGOS  ")).toBe(true);
  });

  it("does not match a genuinely different answer", () => {
    const q: GradableQuestion = { id: "q1", question_type: "short_answer", correct_answer: "Lagos", points: 1 };
    expect(isAnswerCorrect(q, "Abuja")).toBe(false);
  });

  it("normalizes internal whitespace", () => {
    expect(normalizeShortAnswer("  Nigeria   is   great  ")).toBe("nigeria is great");
  });

  it("does not throw or false-positive on non-string given answers", () => {
    const q: GradableQuestion = { id: "q1", question_type: "short_answer", correct_answer: "Lagos", points: 1 };
    expect(isAnswerCorrect(q, undefined)).toBe(false);
    expect(isAnswerCorrect(q, 42)).toBe(false);
    expect(isAnswerCorrect(q, null)).toBe(false);
  });
});

describe("gradeQuizAttempt — edge cases", () => {
  it("returns 0% for a quiz with no questions rather than dividing by zero", () => {
    const result = gradeQuizAttempt([], {}, 70);
    expect(result.scorePercent).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("treats an unanswered question as incorrect, not as an error", () => {
    const questions: GradableQuestion[] = [
      { id: "q1", question_type: "single_choice", correct_answer: "a", points: 1 },
      { id: "q2", question_type: "single_choice", correct_answer: "b", points: 1 },
    ];
    const result = gradeQuizAttempt(questions, { q1: "a" }, 70); // q2 never answered
    expect(result.scorePercent).toBe(50);
  });
});