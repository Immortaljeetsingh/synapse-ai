export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { updateFlashcardStatus, runQuery } from '@/lib/db/queries';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { review_status } = body;
    if (!review_status) {
      return NextResponse.json({ success: false, error: 'review_status is required' }, { status: 400 });
    }
    await updateFlashcardStatus(params.id, review_status);
    return NextResponse.json({ success: true, status: review_status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await runQuery(`DELETE FROM flashcards WHERE id = ?`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
