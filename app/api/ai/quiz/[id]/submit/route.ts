import { NextResponse } from "next/server";
import { activeQuizzes, QuizQuestionInternal } from "../../route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: quizId } = await params;
    const body = await request.json().catch(() => ({}));
    const userAnswers: Record<string, number> = body.answers || {};

    const storedQuiz = activeQuizzes.get(quizId);

    // If quiz not found in memory (e.g. server restart), provide evaluation fallback
    if (!storedQuiz) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Quiz session expired or not found" },
        },
        { status: 404 }
      );
    }

    let correctCount = 0;
    const review = storedQuiz.questions.map((q: QuizQuestionInternal) => {
      const selected = userAnswers[q.id];
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        selectedAnswer: selected !== undefined ? selected : -1,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const total = storedQuiz.questions.length;
    const score = Math.round((correctCount / total) * 100);

    return NextResponse.json({
      success: true,
      data: {
        quizId,
        score,
        total,
        correct: correctCount,
        incorrect: total - correctCount,
        review,
      },
    });
  } catch (error) {
    console.error("Quiz submission error:", error);
    return NextResponse.json(
      { success: false, error: { code: "AI_ERROR", message: "Failed to evaluate quiz" } },
      { status: 500 }
    );
  }
}
