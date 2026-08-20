export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getFlashcardsByNotebook, insertFlashcards } from '@/lib/db/queries';
import { FlashcardRecord } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }
    const flashcards = await getFlashcardsByNotebook(notebookId);
    return NextResponse.json({ success: true, flashcards });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, card_type, question, answer, topic, difficulty, source_document, page_number } = body;

    if (!notebookId || !question || !answer) {
      return NextResponse.json({ success: false, error: 'notebookId, question, and answer are required' }, { status: 400 });
    }

    const card: FlashcardRecord = {
      id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notebook_id: notebookId,
      document_id: null,
      card_type: card_type || 'conceptual',
      question,
      answer,
      topic: topic || 'General',
      difficulty: difficulty || 'medium',
      source_document: source_document || null,
      page_number: page_number || null,
      review_status: 'unreviewed',
      created_at: new Date().toISOString(),
    };

    await insertFlashcards([card]);
    return NextResponse.json({ success: true, flashcard: card });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
