export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { recordQuizAttempt, getQuizAttempts } from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }
    const attempts = await getQuizAttempts(notebookId);
    return NextResponse.json({ success: true, attempts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      quizId,
      notebookId,
      title = 'Quiz Attempt',
      score = 0,
      totalQuestions = 10,
      correctCount = 0,
      accuracyPct = 0,
      xpEarned = 0,
      maxStreak = 0,
      timeSpentSeconds = 0,
      answers = [],
    } = body;

    if (!quizId || !notebookId) {
      return NextResponse.json({ success: false, error: 'quizId and notebookId are required' }, { status: 400 });
    }

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const attempt = await recordQuizAttempt({
      id: attemptId,
      quiz_id: quizId,
      notebook_id: notebookId,
      title,
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      accuracy_pct: accuracyPct,
      xp_earned: xpEarned,
      max_streak: maxStreak,
      time_spent_seconds: timeSpentSeconds,
      answers,
    });

    return NextResponse.json({ success: true, attempt });
  } catch (err: any) {
    console.error('Error recording quiz attempt:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
