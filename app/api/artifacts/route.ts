export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  getChunksByNotebook,
  getDocumentsByNotebook,
  insertFlashcards,
  insertQuestions,
  deleteFlashcardsByNotebook,
  deleteQuestionsByNotebook,
} from '@/lib/db/queries';
import { getAIProvider, PROMPTS, setCachedArtifact, getCachedArtifact } from '@/lib/ai';
import { ArtifactType, FlashcardRecord, QuestionRecord } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    const artifactType = searchParams.get('type') as ArtifactType;
    const documentId = searchParams.get('documentId');

    if (!notebookId || !artifactType) {
      return NextResponse.json({ success: false, error: 'notebookId and type are required' }, { status: 400 });
    }

    const data = await getCachedArtifact(notebookId, artifactType, documentId);
    return NextResponse.json({ success: true, artifact: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, artifactType, documentId } = body;

    if (!notebookId || !artifactType) {
      return NextResponse.json({ success: false, error: 'notebookId and artifactType are required' }, { status: 400 });
    }

    const chunks = await getChunksByNotebook(notebookId);
    const docs = await getDocumentsByNotebook(notebookId);

    if (chunks.length === 0) {
      return NextResponse.json({ success: false, error: 'No documents or chunks available in this notebook' }, { status: 400 });
    }

    const fullContextText = chunks
      .slice(0, 20)
      .map((c) => `[Doc: ${c.filename || 'Doc'}, Page: ${c.page_number}] ${c.text}`)
      .join('\n\n');

    const primaryDocName = docs[0]?.filename || 'Uploaded Documents';
    const ai = await getAIProvider();
    let generatedData: any = null;

    switch (artifactType) {
      case 'overview': {
        const prompt = PROMPTS.DOCUMENT_ALL_IN_ONE_OVERVIEW(primaryDocName, fullContextText);
        const data = await ai.generateStructuredJson<any>([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);

        const overviewData = {
          one_sentence_summary: data?.one_sentence_summary || '',
          executive_summary: data?.executive_summary || '',
          detailed_summary: data?.detailed_summary || '',
          key_takeaways: data?.key_takeaways || [],
          suggested_questions: data?.suggested_questions || [],
        };

        generatedData = overviewData;
        await setCachedArtifact(notebookId, 'overview', overviewData);

        if (data?.topics && Array.isArray(data.topics)) {
          await setCachedArtifact(notebookId, 'topics', data.topics);
        }
        if (data?.concepts && Array.isArray(data.concepts)) {
          await setCachedArtifact(notebookId, 'concepts', data.concepts);
        }
        if (data?.numbers && Array.isArray(data.numbers)) {
          await setCachedArtifact(notebookId, 'numbers', data.numbers);
        }

        break;
      }
      case 'topics': {
        const prompt = PROMPTS.TOPICS_EXTRACTION(fullContextText);
        const data = await ai.generateStructuredJson<{ topics: any[] }>([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        generatedData = data.topics || [];
        await setCachedArtifact(notebookId, 'topics', generatedData);
        break;
      }
      case 'concepts': {
        const prompt = PROMPTS.CONCEPTS_EXTRACTION(fullContextText);
        const data = await ai.generateStructuredJson<{ concepts: any[] }>([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        generatedData = data.concepts || [];
        await setCachedArtifact(notebookId, 'concepts', generatedData);
        break;
      }
      case 'entities': {
        const prompt = PROMPTS.ENTITIES_AND_NUMBERS(fullContextText);
        const data = await ai.generateStructuredJson<{ entities: any[]; numbers: any[] }>([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        generatedData = data.entities || [];
        await setCachedArtifact(notebookId, 'entities', data.entities || []);
        await setCachedArtifact(notebookId, 'numbers', data.numbers || []);
        break;
      }
      case 'study_guide': {
        const prompt = PROMPTS.STUDY_GUIDE(fullContextText);
        generatedData = await ai.generateStructuredJson([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        await setCachedArtifact(notebookId, 'study_guide', generatedData);
        break;
      }
      case 'flashcards': {
        const prompt = PROMPTS.FLASHCARDS(fullContextText, 8);
        const data = await ai.generateStructuredJson<{ flashcards: any[] }>([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        if (data.flashcards && data.flashcards.length > 0) {
          const cards: FlashcardRecord[] = data.flashcards.map((c, i) => ({
            id: `fc_regen_${Date.now()}_${i}`,
            notebook_id: notebookId,
            document_id: null,
            card_type: c.card_type || 'conceptual',
            question: c.question,
            answer: c.answer,
            topic: c.topic || 'General',
            difficulty: c.difficulty || 'medium',
            source_document: primaryDocName,
            page_number: 1,
            review_status: 'unreviewed',
            created_at: new Date().toISOString(),
          }));
          await insertFlashcards(cards);
          generatedData = cards;
        }
        break;
      }
      case 'comparison': {
        const prompt = PROMPTS.DOCUMENT_COMPARISON(fullContextText);
        generatedData = await ai.generateStructuredJson([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);
        await setCachedArtifact(notebookId, 'comparison', generatedData);
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown artifact type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, artifact: generatedData });
  } catch (err: any) {
    console.error('Error regenerating artifact:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
