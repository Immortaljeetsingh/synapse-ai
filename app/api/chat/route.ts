export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  getOrCreateChatSession,
  getChatMessages,
  insertChatMessage,
  insertFlashcards,
  createQuiz,
  insertQuizQuestions,
  createNote,
} from '@/lib/db/queries';
import { hybridRetrieve, multiStageDeepRetrieve } from '@/lib/rag/retrieval';
import { getAIProvider, PROMPTS } from '@/lib/ai';
import {
  CitationReference,
  FlashcardRecord,
  QuizQuestionItem,
  GroundingType,
} from '@/lib/types';

function detectIntent(message: string): {
  intent: 'deep_research' | 'flashcards' | 'quiz' | 'notes' | 'summary' | 'chat';
  count?: number;
} {
  const lower = message.toLowerCase().trim();

  // Flashcards intent
  if (lower.includes('flashcard') || lower.includes('flash card') || lower.includes('cards')) {
    const match = lower.match(/\b(\d+)\s*(?:flashcards?|cards?)\b/);
    const count = match ? parseInt(match[1], 10) : 8;
    return { intent: 'flashcards', count: Math.min(Math.max(count, 3), 20) };
  }

  // Quiz intent
  if (
    lower.includes('quiz me') ||
    lower.includes('start quiz') ||
    lower.includes('create quiz') ||
    lower.includes('practice test') ||
    lower.includes('test me')
  ) {
    const match = lower.match(/\b(\d+)\s*(?:questions?|mcqs?)\b/);
    const count = match ? parseInt(match[1], 10) : 10;
    return { intent: 'quiz', count: Math.min(Math.max(count, 3), 25) };
  }

  // Deep Research & Analysis intent
  if (
    lower.includes('detailed notes') ||
    lower.includes('deep research') ||
    lower.includes('deep dive') ||
    lower.includes('benchmarking') ||
    lower.includes('benchmark') ||
    lower.includes('process map') ||
    lower.includes('process mapping') ||
    lower.includes('comprehensive analysis') ||
    lower.includes('detailed analysis') ||
    lower.includes('exhaustive') ||
    lower.includes('compare the documents') ||
    lower.includes('cross-document') ||
    lower.includes('full report') ||
    lower.includes('research report')
  ) {
    return { intent: 'deep_research' };
  }

  // Notes intent
  if (lower.startsWith('notes') || lower.includes('give me notes') || lower.includes('create notes')) {
    return { intent: 'notes' };
  }

  // Summary intent
  if (lower.startsWith('summarize') || lower.startsWith('summary') || lower.includes('summarise this')) {
    return { intent: 'summary' };
  }

  return { intent: 'chat' };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const session = await getOrCreateChatSession(notebookId);
    const messages = await getChatMessages(session.id);
    return NextResponse.json({ success: true, session, messages });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notebookId, message, documentFilterId } = body;

    if (!notebookId || !message) {
      return NextResponse.json({ success: false, error: 'notebookId and message are required' }, { status: 400 });
    }

    const session = await getOrCreateChatSession(notebookId);

    // 1. Save User Message
    const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await insertChatMessage({
      id: userMsgId,
      session_id: session.id,
      notebook_id: notebookId,
      role: 'user',
      content: message,
    });

    const ai = await getAIProvider();
    const intentData = detectIntent(message);

    let replyText = '';
    let groundingType: GroundingType = 'direct_source';
    let citations: CitationReference[] = [];
    let specialPayload: any = null;
    let retrievedChunksForResponse: any[] = [];

    // 2. Handle Intents

    // A. DEEP RESEARCH & ANALYTICAL REPORT (Multi-Stage Subtopic Retrieval)
    if (intentData.intent === 'deep_research') {
      const deepRetrieval = await multiStageDeepRetrieve(notebookId, message, {
        documentFilterId,
      });

      retrievedChunksForResponse = deepRetrieval.chunks;
      citations = deepRetrieval.citations;

      const history = await getChatMessages(session.id);
      const historyText = history
        .slice(-4, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const prompt = PROMPTS.DEEP_RESEARCH_REPORT(
        deepRetrieval.groundedContextText,
        historyText,
        message
      );

      const completion = await ai.generateText([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      replyText = completion.text;
      groundingType = 'direct_source';
      specialPayload = {
        type: 'research_analysis',
        evidenceCount: deepRetrieval.chunks.length,
        evidenceMap: deepRetrieval.evidenceMap,
      };
    }

    // B. FLASHCARDS ON DEMAND
    else if (intentData.intent === 'flashcards') {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 8,
        documentFilterId,
        minScore: 0.02,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const cardCount = intentData.count || 8;
      const prompt = PROMPTS.FLASHCARDS(retrieval.groundedContextText || message, cardCount);
      const res = await ai.generateStructuredJson<{ flashcards: any[] }>([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      const rawCards = res.flashcards || [];
      const createdCards: FlashcardRecord[] = rawCards.map((c, i) => ({
        id: `fc_${Date.now()}_${i}`,
        notebook_id: notebookId,
        card_type: c.card_type || 'conceptual',
        question: c.question,
        answer: c.answer,
        topic: c.topic || 'General',
        difficulty: c.difficulty || 'medium',
        source_document: retrieval.chunks[0]?.documentName || 'Document',
        page_number: retrieval.chunks[0]?.pageNumber || 1,
        review_status: 'unreviewed',
        created_at: new Date().toISOString(),
      }));

      await insertFlashcards(createdCards);

      replyText = `## Flashcards Generated (${createdCards.length} Cards)\n\n` +
        `The following active recall flashcards have been created and grounded directly in your uploaded sources:\n\n` +
        createdCards
          .map(
            (c, idx) =>
              `### Card ${idx + 1}: ${c.question}\n- **Answer**: ${c.answer}\n- **Source**: [${c.source_document}, p. ${c.page_number}]`
          )
          .join('\n\n');

      specialPayload = {
        type: 'flashcards',
        cards: createdCards,
      };
    }

    // C. QUIZ ON DEMAND
    else if (intentData.intent === 'quiz') {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 10,
        documentFilterId,
        minScore: 0.02,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const qCount = intentData.count || 10;
      const prompt = PROMPTS.GAMIFIED_QUIZ_GENERATION(retrieval.groundedContextText || message, {
        count: qCount,
        difficulty: 'medium',
      });

      const res = await ai.generateStructuredJson<{
        quiz_title?: string;
        questions?: any[];
      }>([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const quizTitle = res.quiz_title || 'Knowledge Quiz';
      const rawQuestions = res.questions || [];

      const validatedQuestions: QuizQuestionItem[] = rawQuestions.map((q, i) => {
        let opts = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];
        opts = opts.map((opt: string, idx: number) => {
          const prefix = `${String.fromCharCode(65 + idx)}) `;
          return opt.startsWith('A)') || opt.startsWith('B)') || opt.startsWith('C)') || opt.startsWith('D)') || opt === 'True' || opt === 'False'
            ? opt
            : `${prefix}${opt}`;
        });
        const matchChunk = retrieval.chunks[i % (retrieval.chunks.length || 1)];
        return {
          id: `qq_${quizId}_${i}`,
          quiz_id: quizId,
          question: q.question,
          question_type: q.question_type || 'multiple_choice',
          options: opts,
          correct_answer: q.correct_answer || opts[0],
          explanation: q.explanation || 'Based on source document passages.',
          topic: q.topic || 'General',
          difficulty: q.difficulty || 'medium',
          source_document: matchChunk?.documentName || 'Document',
          page_number: matchChunk?.pageNumber || 1,
        };
      });

      await createQuiz({
        id: quizId,
        notebook_id: notebookId,
        title: quizTitle,
        mode: 'practice',
        difficulty: 'medium',
        question_count: validatedQuestions.length,
      });
      await insertQuizQuestions(validatedQuestions);

      replyText = `## ${quizTitle}\n\nI have generated an interactive knowledge quiz with **${validatedQuestions.length} grounded questions** based on your uploaded sources. You can launch the interactive game mode below.`;

      specialPayload = {
        type: 'quiz_ready',
        quizId,
        title: quizTitle,
        questionCount: validatedQuestions.length,
        questions: validatedQuestions,
      };
    }

    // D. NOTES / SUMMARY ON DEMAND
    else if (intentData.intent === 'notes' || intentData.intent === 'summary') {
      const retrieval = await multiStageDeepRetrieve(notebookId, message, {
        documentFilterId,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const topChunk = retrieval.chunks[0];
      const sourceDoc = topChunk?.documentName || 'Uploaded Document';
      const prompt = PROMPTS.DEEP_RESEARCH_REPORT(
        retrieval.groundedContextText,
        '',
        `Provide comprehensive, structured research notes on: ${message}`
      );

      const completion = await ai.generateText([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      replyText = completion.text;

      // Also save to Notes tab
      await createNote({
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        notebook_id: notebookId,
        title: `Research Notes: ${sourceDoc}`,
        content: replyText,
        format_type: 'cornell',
      });
    }

    // E. GENERAL CONVERSATIONAL RAG CHAT
    else {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 6,
        documentFilterId,
        minScore: 0.02,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const history = await getChatMessages(session.id);
      const historyText = history
        .slice(-4, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const prompt = PROMPTS.RAG_CHAT(retrieval.groundedContextText, historyText, message);
      const completion = await ai.generateText([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      replyText = completion.text;

      if (
        replyText.includes("couldn't find this information") ||
        replyText.includes('not available in the uploaded sources') ||
        retrieval.chunks.length === 0
      ) {
        groundingType = 'not_in_document';
        citations = [];
      } else if (replyText.includes('AI Interpretation') || replyText.includes('Background Context')) {
        groundingType = 'ai_interpretation';
        citations = retrieval.citations.slice(0, 3);
      } else {
        groundingType = 'direct_source';
        citations = retrieval.citations;
      }
    }

    // 3. Save Assistant Message
    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assistantMsg = await insertChatMessage({
      id: assistantMsgId,
      session_id: session.id,
      notebook_id: notebookId,
      role: 'assistant',
      content: replyText,
      citations_json: JSON.stringify(citations),
      special_payload_json: specialPayload ? JSON.stringify(specialPayload) : undefined,
      grounding_type: groundingType,
    });

    return NextResponse.json({
      success: true,
      message: assistantMsg,
      retrievedChunks: retrievedChunksForResponse,
      specialPayload,
    });
  } catch (err: any) {
    console.error('Error in chat route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
