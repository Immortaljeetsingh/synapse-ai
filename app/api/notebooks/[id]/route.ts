export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  getNotebookById,
  updateNotebook,
  deleteNotebook,
  getDocumentsByNotebook,
  getAllArtifactsForNotebook,
  getNotesByNotebook,
  getFlashcardsByNotebook,
  getQuestionsByNotebook,
  getOrCreateChatSession,
  getChatMessages,
} from '@/lib/db/queries';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const notebookId = params.id;
    const notebook = await getNotebookById(notebookId);
    if (!notebook) {
      return NextResponse.json({ success: false, error: 'Notebook not found' }, { status: 404 });
    }

    const documents = await getDocumentsByNotebook(notebookId);
    const artifacts = await getAllArtifactsForNotebook(notebookId);
    const notes = await getNotesByNotebook(notebookId);
    const flashcards = await getFlashcardsByNotebook(notebookId);
    const questions = await getQuestionsByNotebook(notebookId);
    const chatSession = await getOrCreateChatSession(notebookId);
    const messages = await getChatMessages(chatSession.id);

    return NextResponse.json({
      success: true,
      notebook,
      documents,
      artifacts,
      notes,
      flashcards,
      questions,
      chat: {
        session: chatSession,
        messages,
      },
    });
  } catch (err: any) {
    console.error('Error fetching notebook data:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const notebookId = params.id;
    const body = await req.json();
    const updated = await updateNotebook(notebookId, {
      title: body.title,
      description: body.description,
    });
    return NextResponse.json({ success: true, notebook: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const notebookId = params.id;
    await deleteNotebook(notebookId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
