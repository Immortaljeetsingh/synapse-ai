export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getNotesByNotebook, createNote } from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }
    const notes = await getNotesByNotebook(notebookId);
    return NextResponse.json({ success: true, notes });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, title, content, format_type, is_pinned, source_references } = body;

    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const note = await createNote({
      id: noteId,
      notebook_id: notebookId,
      title: title || 'Untitled Note',
      content: content || '',
      format_type: format_type || 'standard',
      is_pinned: is_pinned ? 1 : 0,
      source_references_json: source_references ? JSON.stringify(source_references) : '[]',
    });

    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
