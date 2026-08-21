export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { createNote, getChunksByNotebook, getDocumentsByNotebook } from '@/lib/db/queries';
import { getAIProvider, PROMPTS } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, text, action, sourceDocument, pageNumber } = body;

    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const headerApiKey = req.headers.get('x-api-key') || undefined;
    const headerProvider = req.headers.get('x-provider') || undefined;
    const headerModel = req.headers.get('x-model') || undefined;
    const headerBaseUrl = req.headers.get('x-base-url') || undefined;

    const ai = await getAIProvider({
      apiKey: body.apiKey || headerApiKey,
      provider: body.provider || headerProvider,
      model: body.model || headerModel,
      baseUrl: body.baseUrl || headerBaseUrl,
    });

    // If specific text is passed from viewer/drawer, generate targeted note
    if (text && action) {
      let promptInstruction = 'Convert the following text into clear, comprehensive study notes.';
      let formatType = 'standard';
      let defaultTitle = 'Study Note';

      switch (action) {
        case 'cornell':
          promptInstruction = 'Synthesize this into a Cornell Notes format with Cues/Keywords, Main Section Notes, and a Summary block.';
          formatType = 'cornell';
          defaultTitle = 'Cornell Note';
          break;
        case 'bullet':
          promptInstruction = 'Convert this text into structured, hierarchical bullet points capturing key facts, rules, and takeaways.';
          formatType = 'bullet';
          defaultTitle = 'Bullet Synthesis';
          break;
        case 'simplify':
          promptInstruction = 'Explain this text simply and intuitively as if teaching a beginner, using clear analogies where helpful.';
          formatType = 'standard';
          defaultTitle = 'Simplified Concept';
          break;
        case 'exam':
          promptInstruction = 'Synthesize high-yield exam takeaways, key formulas, critical definitions, and common pitfalls.';
          formatType = 'exam';
          defaultTitle = 'Exam Prep Sheet';
          break;
        case 'summarize':
        default:
          promptInstruction = 'Provide a structured summary highlighting core findings, definitions, and conclusions.';
          formatType = 'standard';
          defaultTitle = 'Document Summary Note';
          break;
      }

      const res = await ai.generateText([
        {
          role: 'system',
          content: `You are an AI learning and note-taking assistant. ${promptInstruction} Ground all information in the provided source text.`,
        },
        {
          role: 'user',
          content: `Source Text:\n"""\n${text}\n"""\n\nGenerate structured notes:`,
        },
      ]);

      const noteId = `note_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sourceReferences = sourceDocument
        ? [{ document_name: sourceDocument, page_number: pageNumber || 1, excerpt: text.slice(0, 150) }]
        : [];

      const note = await createNote({
        id: noteId,
        notebook_id: notebookId,
        title: `${defaultTitle}: ${sourceDocument || 'Selection'}`,
        content: res.text,
        format_type: formatType,
        is_pinned: 0,
        source_references_json: JSON.stringify(sourceReferences),
      });

      return NextResponse.json({ success: true, note, notes: [note] });
    }

    // Otherwise, generate full deep notes suite for the entire notebook's uploaded documents
    const chunks = await getChunksByNotebook(notebookId);
    const docs = await getDocumentsByNotebook(notebookId);
    const combinedText = text || chunks.map((c) => c.text).join('\n\n');
    const docName = sourceDocument || docs[0]?.filename || 'Uploaded Documents';

    if (!combinedText || combinedText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'No document text found in this notebook. Please upload a document first.' }, { status: 400 });
    }

    // Sample evenly across the corpus so notes cover the whole notebook,
    // not just its first pages.
    const targetChars = 60000;
    let sampledText = combinedText;
    if (combinedText.length > targetChars && chunks.length > 0) {
      const perChunk = Math.max(300, Math.floor(targetChars / chunks.length));
      sampledText = chunks
        .map((c) => c.text.slice(0, perChunk))
        .join('\n\n')
        .slice(0, targetChars);
    }
    const notesPrompt = PROMPTS.DOCUMENT_DEEP_NOTES_AND_AUDIT(docName, sampledText);
    const res = await ai.generateStructuredJson<{
      notes: Array<{ title: string; format_type?: string; content?: string; points?: string[] }>;
    }>([
      { role: 'system', content: notesPrompt.system },
      { role: 'user', content: notesPrompt.user },
    ]);

    const createdNotes = [];
    if (res.notes && Array.isArray(res.notes)) {
      for (let i = 0; i < res.notes.length; i++) {
        const n = res.notes[i];
        let contentStr = '';
        if (typeof n.content === 'string' && n.content.trim().length > 0) {
          contentStr = n.content;
        } else if (Array.isArray(n.points) && n.points.length > 0) {
          contentStr = n.points.map((p) => `* ${p}`).join('\n\n');
        } else {
          contentStr = JSON.stringify(n, null, 2);
        }

        const noteId = `note_gen_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        const created = await createNote({
          id: noteId,
          notebook_id: notebookId,
          title: n.title || `Notes: ${docName}`,
          content: contentStr,
          format_type: n.format_type || (i === 0 ? 'cornell' : i === 1 ? 'bullet' : 'exam'),
          is_pinned: i === 0 ? 1 : 0,
        });
        createdNotes.push(created);
      }
    }

    return NextResponse.json({ success: true, notes: createdNotes });
  } catch (err: any) {
    console.error('Error generating AI notes:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
