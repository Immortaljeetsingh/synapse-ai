export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import {
  getChunksByNotebook,
  getChunksByDocument,
  createQuiz,
  insertQuizQuestions,
  getWeakTopics,
} from '@/lib/db/queries';
import { getAIProvider, PROMPTS } from '@/lib/ai';
import { normalizeQuizQuestions } from '@/lib/ai/quiz-normalize';
import { QuizConfig } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      notebookId,
      sourceType = 'notebook',
      documentId = null,
      topic = null,
      questionCount = 10,
      difficulty = 'medium',
      questionType = 'mixed',
      mode = 'practice',
    } = body;

    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const targetCount = Math.max(3, Math.min(parseInt(String(questionCount), 10) || 10, 30));

    // 1. Fetch relevant chunks based on source selection
    let chunks: any[] = [];
    if (Array.isArray(body.chunks) && body.chunks.length > 0) {
      chunks = body.chunks;
    } else if (Array.isArray(body.documents) && body.documents.length > 0) {
      for (const d of body.documents) {
        if (Array.isArray(d.chunks)) chunks.push(...d.chunks);
      }
    } else if (documentId) {
      chunks = await getChunksByDocument(documentId);
    } else {
      chunks = await getChunksByNotebook(notebookId);
    }

    if (chunks.length === 0) {
      try {
        const { getDocumentsByNotebook, insertChunks } = await import('@/lib/db/queries');
        const { parseDocument } = await import('@/lib/parsers');
        const { chunkDocument } = await import('@/lib/rag/chunker');
        const { computeTextVector } = await import('@/lib/rag/embeddings');
        const fs = await import('fs');

        const docs = await getDocumentsByNotebook(notebookId);
        for (const doc of docs) {
          if (doc.file_path && fs.existsSync(doc.file_path)) {
            const parsed = await parseDocument(doc.file_path, doc.filename);
            const rawChunks = chunkDocument(parsed, doc.id, doc.notebook_id, doc.filename, {
              targetChunkSize: 900,
              overlapSize: 120,
            });
            const processedChunks = rawChunks.map((chunk) => ({
              ...chunk,
              embedding_json: JSON.stringify(computeTextVector(chunk.text + ' ' + chunk.section_heading)),
            }));
            await insertChunks(processedChunks);
            chunks.push(...processedChunks);
          }
        }
      } catch (e) {
        console.warn('Quiz fallback chunking error:', e);
      }
    }

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No indexed source documents found in this notebook.' },
        { status: 400 }
      );
    }

    // If Weak Areas mode, fetch weak topics
    let weakTopicsList: string[] = [];
    if (mode === 'weak_areas') {
      weakTopicsList = await getWeakTopics(notebookId);
    }

    // Filter chunks by topic if specified
    if (topic && topic !== 'all') {
      const topicChunks = chunks.filter(
        (c) =>
          c.section_heading?.toLowerCase().includes(topic.toLowerCase()) ||
          c.text?.toLowerCase().includes(topic.toLowerCase())
      );
      if (topicChunks.length > 0) {
        chunks = topicChunks;
      }
    }

    const apiKeyHeader = req.headers.get('x-api-key') || undefined;
    const providerHeader = req.headers.get('x-provider') || undefined;
    const modelHeader = req.headers.get('x-model') || undefined;
    const baseUrlHeader = req.headers.get('x-base-url') || undefined;

    const ai = await getAIProvider({
      apiKey: body.apiKey || apiKeyHeader,
      provider: body.provider || providerHeader,
      model: body.model || modelHeader,
      baseUrl: body.baseUrl || baseUrlHeader,
    });

    // Shuffle chunks to ensure variety across quizzes
    const shuffledChunks = [...chunks].sort(() => 0.5 - Math.random());

    // Construct source context string with citations
    const sampleSize = Math.min(shuffledChunks.length, Math.max(12, targetCount * 2));
    const selectedChunks = shuffledChunks.slice(0, sampleSize);

    const sourceContext = selectedChunks
      .map(
        (c, i) =>
          `[Source Passage ${i + 1}] (Document: "${c.filename || 'Doc'}", Page: ${c.page_number}${
            c.section_heading ? `, Section: "${c.section_heading}"` : ''
          })\n${c.text}`
      )
      .join('\n\n---\n\n');

    const seed = Math.floor(Math.random() * 100000);

    const prompt = PROMPTS.GAMIFIED_QUIZ_GENERATION(sourceContext, {
      count: targetCount,
      difficulty,
      questionType,
      targetTopic: topic || (weakTopicsList.length > 0 ? weakTopicsList.join(', ') : undefined),
      focusWeakAreas: mode === 'weak_areas',
      seed,
    });

    const aiRes = await ai.generateStructuredJson<{ quiz_title?: string; questions: any[] }>([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ]);

    let rawQuestions = aiRes.questions || [];

    // Fallback: If model returned fewer questions than requested, fill the remainder with an additional pass
    if (rawQuestions.length < targetCount && shuffledChunks.length > 5) {
      const remainingNeeded = targetCount - rawQuestions.length;
      const secondBatchChunks = shuffledChunks.slice(sampleSize, sampleSize + 10);
      if (secondBatchChunks.length > 0) {
        try {
          const secondContext = secondBatchChunks
            .map(
              (c, i) =>
                `[Source Passage ${i + 1}] (Document: "${c.filename || 'Doc'}", Page: ${c.page_number})\n${c.text}`
            )
            .join('\n\n---\n\n');

          const secondPrompt = PROMPTS.GAMIFIED_QUIZ_GENERATION(secondContext, {
            count: remainingNeeded,
            difficulty,
            questionType,
            seed: seed + 1,
          });

          const secondRes = await ai.generateStructuredJson<{ questions: any[] }>([
            { role: 'system', content: secondPrompt.system },
            { role: 'user', content: secondPrompt.user },
          ]);

          if (secondRes.questions && Array.isArray(secondRes.questions)) {
            rawQuestions = [...rawQuestions, ...secondRes.questions];
          }
        } catch (e) {
          console.warn('Second batch quiz fill warning:', e);
        }
      }
    }

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate questions from source material.' },
        { status: 500 }
      );
    }

    // Limit to exactly requested count
    const finalRawQuestions = rawQuestions.slice(0, targetCount);

    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const quizTitle = aiRes.quiz_title || `Quiz on ${topic || 'Document Knowledge'}`;

    // 3. Validate & Format Questions (shared normalizer — guarantees options
    // are letter-prefixed once and correct_answer resolves to the exact
    // option string, so client grading is strict-equality safe)
    const validatedQuestions = normalizeQuizQuestions(finalRawQuestions, {
      quizId,
      fallbackSource: selectedChunks[0]?.filename,
      fallbackPage: selectedChunks[0]?.page_number,
    }).map((q, i) => ({
      ...q,
      id: `qq_${quizId}_${i}`,
      topic: q.topic === 'General' && topic ? topic : q.topic,
      chunk_id: selectedChunks[i % selectedChunks.length]?.id,
    }));

    if (validatedQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'The AI returned malformed questions. Please try again.' },
        { status: 502 }
      );
    }

    // 4. Save Quiz in DB
    const quizRecord = await createQuiz({
      id: quizId,
      notebook_id: notebookId,
      document_id: documentId,
      title: quizTitle,
      mode,
      difficulty,
      question_count: validatedQuestions.length,
    });

    await insertQuizQuestions(validatedQuestions);

    return NextResponse.json({
      success: true,
      quiz: quizRecord,
      questions: validatedQuestions,
    });
  } catch (err: any) {
    console.error('Error generating gamified quiz:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
