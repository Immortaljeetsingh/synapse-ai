export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryAll } from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    const query = searchParams.get('q')?.trim() || '';

    if (!notebookId || !query) {
      return NextResponse.json({ success: true, results: [] });
    }

    const likeQuery = `%${query}%`;

    // 1. Search Chunks
    const chunks = await queryAll<any>(
      `SELECT c.id, c.document_id, c.page_number, c.section_heading, c.text, d.filename
       FROM document_chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE c.notebook_id = ? AND (c.text LIKE ? OR c.section_heading LIKE ?)
       LIMIT 10`,
      [notebookId, likeQuery, likeQuery]
    );

    // 2. Search Notes
    const notes = await queryAll<any>(
      `SELECT id, title, content, format_type
       FROM notes
       WHERE notebook_id = ? AND (title LIKE ? OR content LIKE ?)
       LIMIT 5`,
      [notebookId, likeQuery, likeQuery]
    );

    // 3. Search Flashcards
    const flashcards = await queryAll<any>(
      `SELECT id, question, answer, topic, difficulty, source_document, page_number
       FROM flashcards
       WHERE notebook_id = ? AND (question LIKE ? OR answer LIKE ? OR topic LIKE ?)
       LIMIT 5`,
      [notebookId, likeQuery, likeQuery, likeQuery]
    );

    const formattedResults = [
      ...chunks.map((c) => ({
        type: 'chunk',
        id: c.id,
        title: `${c.filename} (Page ${c.page_number})`,
        subtitle: c.section_heading || 'Document passage',
        snippet: c.text.length > 180 ? c.text.slice(0, 180) + '...' : c.text,
        metadata: { documentId: c.document_id, pageNumber: c.page_number },
      })),
      ...notes.map((n) => ({
        type: 'note',
        id: n.id,
        title: n.title,
        subtitle: `Note (${n.format_type})`,
        snippet: n.content.length > 180 ? n.content.slice(0, 180) + '...' : n.content,
        metadata: { noteId: n.id },
      })),
      ...flashcards.map((f) => ({
        type: 'flashcard',
        id: f.id,
        title: f.question,
        subtitle: `Flashcard • ${f.topic} (${f.difficulty})`,
        snippet: f.answer.length > 180 ? f.answer.slice(0, 180) + '...' : f.answer,
        metadata: { flashcardId: f.id },
      })),
    ];

    return NextResponse.json({ success: true, results: formattedResults });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
