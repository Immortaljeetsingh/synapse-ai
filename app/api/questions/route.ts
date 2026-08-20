export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getQuestionsByNotebook, insertQuestions, runQuery } from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }
    const questions = await getQuestionsByNotebook(notebookId);
    return NextResponse.json({ success: true, questions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, question_type, question, options, correct_answer, explanation, difficulty, source_document, page_number } = body;

    if (!notebookId || !question || !correct_answer) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const q = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notebook_id: notebookId,
      document_id: null,
      question_type: question_type || 'multiple_choice',
      question,
      options_json: options ? JSON.stringify(options) : undefined,
      correct_answer,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      source_document: source_document || null,
      page_number: page_number || null,
      created_at: new Date().toISOString(),
    };

    await insertQuestions([q]);
    return NextResponse.json({ success: true, question: q });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    await runQuery(`DELETE FROM questions WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
