export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getNoteById, updateNote, deleteNote } from '@/lib/db/queries';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const note = await getNoteById(params.id);
    if (!note) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const note = await updateNote(params.id, {
      title: body.title,
      content: body.content,
      format_type: body.format_type,
      is_pinned: body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : undefined,
      source_references_json: body.source_references ? JSON.stringify(body.source_references) : undefined,
    });
    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteNote(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
