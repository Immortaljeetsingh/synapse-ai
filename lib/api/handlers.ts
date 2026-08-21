/**
 * Consolidated API handler.
 *
 * ponytail: on Vercel every per-route API file becomes its OWN Lambda with
 * its own isolated /tmp sql.js database — uploads couldn't see notebooks,
 * chat couldn't see documents. Funneling every endpoint through this single
 * catch-all route keeps the whole app on one warm instance (one shared /tmp
 * DB) with zero external dependencies. If we ever outgrow this, the upgrade
 * path is a hosted DB (Turso/Postgres) behind these same paths.
 */
import { NextResponse } from 'next/server';
import {
  getAllNotebooks,
  getNotebookById,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  getDocumentsByNotebook,
  getDocumentById,
  deleteDocument,
  deleteChunksByDocument,
  updateDocumentStatus,
  insertChunks,
  createNote,
  createDocument,
  getNotesByNotebook,
  getNoteById,
  updateNote,
  deleteNote,
  getFlashcardsByNotebook,
  insertFlashcards,
  updateFlashcardStatus,
  createQuiz,
  insertQuizQuestions,
  recordQuizAttempt,
  getQuizAttempts,
  getTopicPerformance,
  getWeakTopics,
  getAllArtifactsForNotebook,
  queryAll,
  runQuery,
  getSetting,
  setSetting,
} from '@/lib/db/queries';
import { getCachedArtifact, setCachedArtifact, getAIProvider, PROMPTS } from '@/lib/ai';
import { detectFileType, parseDocument, ParsedDocumentResult } from '@/lib/parsers';
import { chunkDocument } from '@/lib/rag/chunker';
import { computeTextVector } from '@/lib/rag/embeddings';
import { hybridRetrieve, multiStageDeepRetrieve } from '@/lib/rag/retrieval';
import { normalizeQuizQuestions } from '@/lib/ai/quiz-normalize';
import {
  CitationReference,
  DocumentChunk,
  FlashcardRecord,
  GroundingType,
} from '@/lib/types';

const json = (data: any, status = 200) => NextResponse.json(data, { status });

const CREDENTIAL_HEADERS = (req: Request, body: any = {}) => ({
  apiKey: body.apiKey || req.headers.get('x-api-key') || undefined,
  provider: body.provider || req.headers.get('x-provider') || undefined,
  model: body.model || req.headers.get('x-model') || undefined,
  baseUrl: body.baseUrl || req.headers.get('x-base-url') || undefined,
});

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function detectIntent(message: string): {
  intent: 'deep_research' | 'flashcards' | 'quiz' | 'notes' | 'summary' | 'chat';
  count?: number;
} {
  const lower = message.toLowerCase().trim();

  if (lower.includes('flashcard') || lower.includes('flash card')) {
    const match = lower.match(/\b(\d+)\s*(?:flashcards?)\b/);
    const count = match ? parseInt(match[1], 10) : 8;
    return { intent: 'flashcards', count: Math.min(Math.max(count, 3), 20) };
  }

  if (
    lower.includes('quiz me') ||
    lower.includes('start quiz') ||
    lower.includes('create quiz') ||
    lower.includes('create a quiz') ||
    lower.includes('generate a quiz') ||
    lower.includes('make me a quiz') ||
    lower.includes('quiz about') ||
    lower.includes('quiz on') ||
    // bare "quiz" followed by a number, e.g. "quiz 10 questions"
    /\bquiz\s*\d/.test(lower) ||
    lower.includes('practice test') ||
    lower.includes('test me')
  ) {
    const match = lower.match(/\b(\d+)\s*(?:questions?|mcqs?)\b/);
    const count = match ? parseInt(match[1], 10) : 10;
    return { intent: 'quiz', count: Math.min(Math.max(count, 3), 25) };
  }

  if (
    lower.includes('detailed notes') ||
    lower.includes('deep research') ||
    lower.includes('deep dive') ||
    lower.includes('benchmarking') ||
    lower.includes('benchmark') ||
    lower.includes('process map') ||
    lower.includes('process mapping') ||
    lower.includes('flowchart') ||
    lower.includes('flow chart') ||
    lower.includes('diagram') ||
    lower.includes('workflow of') ||
    lower.includes('comprehensive analysis') ||
    lower.includes('detailed analysis') ||
    lower.includes('detailed report') ||
    lower.includes('exhaustive') ||
    lower.includes('compare the documents') ||
    lower.includes('cross-document') ||
    lower.includes('full report') ||
    lower.includes('research report')
  ) {
    return { intent: 'deep_research' };
  }

  if (lower.startsWith('notes') || lower.includes('give me notes') || lower.includes('create notes')) {
    return { intent: 'notes' };
  }

  if (lower.startsWith('summarize') || lower.startsWith('summary') || lower.includes('summarise this')) {
    return { intent: 'summary' };
  }

  return { intent: 'chat' };
}

// ==================== DOCUMENT UPLOAD HELPERS ====================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB limit
// ponytail: ~3M chars keeps the JSON body + embeddings work inside the
// serverless function; raise alongside a hosted DB if ever needed.
const MAX_TEXT_CHARS = 3_000_000;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md'];

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const head = buffer.subarray(0, 8);
  switch (ext) {
    case '.pdf':
      return head.subarray(0, 5).toString('binary') === '%PDF-';
    case '.docx':
    case '.xlsx':
    case '.xls':
      return (
        head.subarray(0, 4).toString('hex') === '504b0304' ||
        head.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1'
      );
    case '.csv':
    case '.txt':
    case '.md':
      return !buffer.subarray(0, Math.min(512, buffer.length)).includes(0);
    default:
      return false;
  }
}

// Single indexing pipeline shared by multipart upload and /documents/text.
async function indexParsedDocument(
  notebookId: string,
  rawFilename: string,
  parsed: ParsedDocumentResult,
  fileType: string,
  fileSize: number,
  filePath: string,
  contentHash: string
) {
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Atomic indexing: the row lands as 'processing' so a mid-flight crash
  // never leaves a phantom 'ready' document with zero chunks behind.
  try {
    const rawChunks = chunkDocument(parsed, docId, notebookId, rawFilename, {
      targetChunkSize: 900,
      overlapSize: 120,
    });

    const processedChunks: DocumentChunk[] = rawChunks.map((chunk) => ({
      ...chunk,
      embedding_json: JSON.stringify(computeTextVector(chunk.text + ' ' + chunk.section_heading)),
    }));

    const document = await createDocument({
      id: docId,
      notebook_id: notebookId,
      filename: rawFilename,
      file_type: fileType,
      file_size: fileSize,
      page_count: parsed.pageCount || 1,
      file_path: filePath,
      content_hash: contentHash,
      processing_status: 'processing',
      is_scanned: parsed.isScanned,
    });

    await insertChunks(processedChunks);

    await createNote({
      id: `note_init_${docId}_${Date.now()}`,
      notebook_id: notebookId,
      title: `📌 Overview: ${rawFilename}`,
      content: `### Document Overview: ${rawFilename}\n\n**Total Pages:** ${parsed.pageCount}\n**Total Chunks:** ${processedChunks.length}\n\n#### Key Sections Detected:\n${processedChunks.slice(0, 5).map((c) => `- **${c.section_heading || 'Section'}**: ${c.text.slice(0, 140)}...`).join('\n')}\n\n---\n*Ready for grounded Q&A, active-recall study flashcards, and practice quiz generation.*`,
      format_type: 'cornell',
    });

    await updateDocumentStatus(docId, 'ready');

    const lightweightChunks = processedChunks.map((c) => ({
      id: c.id,
      document_id: docId,
      notebook_id: notebookId,
      chunk_index: c.chunk_index,
      page_number: c.page_number,
      section_heading: c.section_heading,
      text: c.text,
      filename: rawFilename,
    }));

    // Echo pages back so the browser can render the drawer statelessly
    // (each Vercel Lambda has its own /tmp DB — server reads aren't reliable).
    // ponytail: shared 3M-char budget covers both upload paths here.
    let charBudget = MAX_TEXT_CHARS;
    const pages = parsed.pages.map((p) => {
      const text = charBudget > 0 ? p.text.slice(0, charBudget) : '';
      charBudget -= text.length;
      return { pageNumber: p.pageNumber, text };
    });

    return { document, lightweightChunks, chunkCount: processedChunks.length, pageCount: parsed.pageCount, pages };
  } catch (err: any) {
    try {
      await updateDocumentStatus(docId, 'error', { error_message: err?.message || 'Indexing failed' });
    } catch {
      // Row may not exist yet if createDocument itself threw — nothing to mark.
    }
    throw err;
  }
}

async function indexDocumentFile(
  notebookId: string,
  rawFilename: string,
  buffer: Buffer,
  filePath: string,
  fileType: string,
  fileSize: number
) {
  const crypto = await import('crypto');
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const parsed = await parseDocument(filePath, rawFilename);

  return indexParsedDocument(notebookId, rawFilename, parsed, fileType, fileSize, filePath, contentHash);
}

// ==================== CHAT ====================

async function handleChat(req: Request) {
  const body = await readBody(req);
  const { notebookId, message } = body;

  if (!notebookId || !message) {
    return json({ success: false, error: 'notebookId and message are required' }, 400);
  }

  // Streaming mode: SSE with live deltas, then a final done event carrying
  // the same payload shape as the non-streaming response.
  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (obj: any) => {
          if (!closed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          }
        };
        try {
          const result = await runChat(req, body, (delta: string) => send({ type: 'delta', delta }));
          send({ type: 'done', ...result });
        } catch (err: any) {
          send({ type: 'error', error: err?.message || 'Chat failed' });
        } finally {
          closed = true;
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  const result = await runChat(req, body);
  return json(result);
}

async function runChat(
  req: Request,
  body: any,
  onDelta?: (delta: string) => void
): Promise<{ success: true; message: any; retrievedChunks: any[]; specialPayload: any }> {
  const { notebookId, message, documentFilterId } = body;

  await ensureNotebookRow(notebookId);

  const { getOrCreateChatSession, getChatMessages, insertChatMessage } = await import('@/lib/db/queries');
  const session = await getOrCreateChatSession(notebookId);

  const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await insertChatMessage({
    id: userMsgId,
    session_id: session.id,
    notebook_id: notebookId,
    role: 'user',
    content: message,
  });

  const ai = await getAIProvider(CREDENTIAL_HEADERS(req, body));
  const intentData = detectIntent(message);

  let replyText = '';
  let groundingType: GroundingType = 'direct_source';
  let citations: CitationReference[] = [];
  let specialPayload: any = null;
  let retrievedChunksForResponse: any[] = [];

  let externalChunks: any[] = [];
  if (Array.isArray(body.chunks)) {
    externalChunks = body.chunks;
  } else if (Array.isArray(body.documents)) {
    for (const d of body.documents) {
      if (Array.isArray(d.chunks)) externalChunks.push(...d.chunks);
    }
  } else if (Array.isArray(body.activeDocuments)) {
    for (const d of body.activeDocuments) {
      if (Array.isArray(d.chunks)) externalChunks.push(...d.chunks);
    }
  }

  try {
    if (intentData.intent === 'deep_research') {
      const deepRetrieval = await multiStageDeepRetrieve(notebookId, message, {
        documentFilterId,
        externalChunks,
      });
      retrievedChunksForResponse = deepRetrieval.chunks;
      citations = deepRetrieval.citations;

      const history = await getChatMessages(session.id);
      // Truncate history — a full deep-research report carried verbatim in
      // every later prompt bloated context until requests hit the 60s limit.
      const historyText = history
        .slice(-4, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 400)}`)
        .join('\n\n')
        .slice(0, 1600);
      const prompt = PROMPTS.DEEP_RESEARCH_REPORT(deepRetrieval.groundedContextText, historyText, message);
      const completion = await ai.generateText(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        // Deep research must be long-form; 32K tokens of headroom. Streaming
        // deltas flow to the client live when onDelta is provided.
        { maxTokens: 32000, onDelta }
      );
      replyText = completion.text;

      // Same fabrication guard as chat: a "research report" sharing almost
      // no vocabulary with the retrieved evidence is general-knowledge
      // hallucination, not document analysis.
      const stopWords = new Set(['the','and','for','that','this','with','from','have','has','its','are','was','were','been','their','they','which','will','would','could','should','there','these','those','then','than','when','what','where','while','about','into','over','also','only','very','more','most','such','each','both','between','because','after','before','under','above','other','some','all','any','not','but','can','may','must','does','did','doing','being']);
      const evidenceVocab = new Set(
        ((deepRetrieval.chunks.slice(0, 5).map((c) => c.text).join(' ') || '').toLowerCase().match(/[a-z]{4,}/g)) || []
      );
      const reportWords = (replyText.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !stopWords.has(w));
      const reportOverlap =
        reportWords.length > 0
          ? reportWords.filter((w) => evidenceVocab.has(w)).length / reportWords.length
          : 0;
      if (deepRetrieval.chunks.length === 0 || reportOverlap < 0.1) {
        replyText =
          "**I couldn't find sufficient evidence in the uploaded documents to write this research report.**\n\n" +
          'Deep analysis requires your question to relate to the uploaded sources. Try asking about a topic your documents actually cover.';
        groundingType = 'not_in_document';
        citations = [];
        specialPayload = null;
        retrievedChunksForResponse = [];
      } else {
        groundingType = 'direct_source';
        specialPayload = {
          type: 'research_analysis',
          evidenceCount: deepRetrieval.chunks.length,
          evidenceMap: deepRetrieval.evidenceMap,
        };
      }
    } else if (intentData.intent === 'flashcards') {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 8,
        documentFilterId,
        minScore: 0.02,
        externalChunks,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const cardCount = intentData.count || 8;
      // Cap context — oversized contexts blow past the 60s function limit.
      const context = (retrieval.groundedContextText || message).slice(0, 12000);
      const prompt = PROMPTS.FLASHCARDS(context, cardCount);
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

      if (createdCards.length > 0) {
        await insertFlashcards(createdCards);
      }

      replyText =
        `## Flashcards Generated (${createdCards.length} Cards)\n\n` +
        `The following active recall flashcards have been created and grounded directly in your uploaded sources:\n\n` +
        createdCards
          .map(
            (c, idx) =>
              `### Card ${idx + 1}: ${c.question}\n- **Answer**: ${c.answer}\n- **Source**: [${c.source_document}, p. ${c.page_number}]`
          )
          .join('\n\n');

      specialPayload = { type: 'flashcards', cards: createdCards };
    } else if (intentData.intent === 'quiz') {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 10,
        documentFilterId,
        minScore: 0.02,
        externalChunks,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const qCount = intentData.count || 10;
      const context = (retrieval.groundedContextText || message).slice(0, 14000);
      const prompt = PROMPTS.GAMIFIED_QUIZ_GENERATION(context, {
        count: qCount,
        difficulty: 'medium',
      });

      const res = await ai.generateStructuredJson<{ quiz_title?: string; questions?: any[] }>([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const quizTitle = res.quiz_title || 'Knowledge Quiz';

      const validatedQuestions = normalizeQuizQuestions(res.questions || [], {
        quizId,
        fallbackSource: retrieval.chunks[0]?.documentName,
        fallbackPage: retrieval.chunks[0]?.pageNumber,
      });

      if (validatedQuestions.length > 0) {
        await createQuiz({
          id: quizId,
          notebook_id: notebookId,
          title: quizTitle,
          mode: 'practice',
          difficulty: 'medium',
          question_count: validatedQuestions.length,
        });
        await insertQuizQuestions(validatedQuestions);
      }

      replyText = `## ${quizTitle}\n\nI have generated an interactive knowledge quiz with **${validatedQuestions.length} grounded questions** based on your uploaded sources. You can launch the interactive game mode below.`;
      specialPayload = {
        type: 'quiz_ready',
        quizId,
        title: quizTitle,
        questionCount: validatedQuestions.length,
        questions: validatedQuestions,
      };
    } else if (intentData.intent === 'notes' || intentData.intent === 'summary') {
      const retrieval = await multiStageDeepRetrieve(notebookId, message, {
        documentFilterId,
        externalChunks,
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
      const completion = await ai.generateText(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        { maxTokens: 32000, onDelta }
      );
      replyText = completion.text;

      const note = await createNote({
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        notebook_id: notebookId,
        title: `Research Notes: ${sourceDoc}`,
        content: replyText,
        format_type: 'cornell',
      });
      specialPayload = { type: 'note_created', note };
    } else {
      const retrieval = await hybridRetrieve(notebookId, message, {
        topK: 6,
        documentFilterId,
        minScore: 0.02,
        externalChunks,
      });
      retrievedChunksForResponse = retrieval.chunks;
      citations = retrieval.citations;

      const history = await getChatMessages(session.id);
      // Truncate history — long prior answers (e.g. full research reports)
      // bloated every later prompt until requests hit the 60s limit.
      const historyText = history
        .slice(-4, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 400)}`)
        .join('\n\n')
        .slice(0, 1600);

      const prompt = PROMPTS.RAG_CHAT(retrieval.groundedContextText, historyText, message);

      // Confidence floor: below this the best chunk is noise, so skip the AI
      // entirely — small models will happily answer off-topic questions from
      // general knowledge instead of refusing.
      const RETRIEVAL_CONFIDENCE_FLOOR = 0.06;
      const topScore = retrieval.chunks[0]?.score ?? 0;
      if (topScore < RETRIEVAL_CONFIDENCE_FLOOR) {
        replyText =
          "**I couldn't find sufficient evidence for this in the uploaded documents.**\n\n" +
          'Your question may be outside the scope of what you\'ve uploaded. Try rephrasing, or ask about a topic your documents actually cover.';
        groundingType = 'not_in_document';
        citations = [];
        retrievedChunksForResponse = [];
      } else {
        const completion = await ai.generateText(
          [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          { maxTokens: 8000, onDelta }
        );
        replyText = completion.text;

        // Grounding classification. Hedge phrases alone are unreliable — a
        // long grounded answer may legitimately say "no information about X"
        // for one sub-topic. Genuine refusals are SHORT, so require both the
        // phrase AND a refusal-shaped (brief) reply.
        const hedgePhrases = [
          "couldn't find sufficient evidence",
          "couldn't find this information",
          'not available in the uploaded sources',
          'does not contain any information',
          "don't have enough information",
          'no relevant information',
        ];
        const lowerReply = replyText.toLowerCase();
        // Fabrication signature: hedge language present AND no real source
        // citation anywhere. Grounded answers cite files per the prompt
        // ([name.ext, p. X]); general-knowledge rambles don't.
        const hasCitationMarker = /\[[^\]\n]{2,80}\.(docx|pdf|txt|md|csv|xlsx|xls)[^\]\n]*\]/i.test(replyText);
        const hasHedge = hedgePhrases.some((p) => lowerReply.includes(p));
        // Vocabulary-overlap check: a genuinely grounded answer reuses the
        // document's own words; general-knowledge fabrications share almost
        // no content vocabulary with the retrieved chunks.
        const STOP_WORDS = new Set(['the','and','for','that','this','with','from','have','has','its','are','was','were','been','their','they','which','will','would','could','should','there','these','those','then','than','when','what','where','while','about','into','over','also','only','very','more','most','such','each','both','between','because','after','before','under','above','other','some','all','any','not','but','can','may','must','does','did','doing','being']);
        const evidenceWords = new Set(
          ((retrieval.chunks.slice(0, 3).map((c) => c.text).join(' ') || '').toLowerCase().match(/[a-z]{4,}/g)) || []
        );
        const replyContentWords = (lowerReply.match(/[a-z]{4,}/g) || []).filter((w) => !STOP_WORDS.has(w));
        const vocabOverlap =
          replyContentWords.length > 0
            ? replyContentWords.filter((w) => evidenceWords.has(w)).length / replyContentWords.length
            : 0;

        const looksLikeRefusal =
          (hasHedge && !hasCitationMarker) ||
          (!hasCitationMarker && topScore < 0.15) ||
          vocabOverlap < 0.1;

        if (looksLikeRefusal) {
          // The model ignored grounding instructions and answered from
          // general knowledge — discard the fabrication entirely.
          replyText =
            "**I couldn't find sufficient evidence for this in the uploaded documents.**\n\n" +
            'The question appears to be outside the scope of what you\'ve uploaded. Try rephrasing, or ask about a topic your documents actually cover.';
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
    }
  } catch (genErr: any) {
    console.error('AI generation failed in chat route:', genErr);
    replyText = `**I couldn't complete that request.**\n\n\`${genErr?.message || 'The AI provider returned an error.'}\`\n\nYour message was saved — try again in a moment, or check **Settings → connection status** if the problem persists.`;
    groundingType = 'ai_interpretation';
    citations = [];
    specialPayload = null;
  }

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

  return {
    success: true as const,
    message: assistantMsg,
    retrievedChunks: retrievedChunksForResponse,
    specialPayload,
  };
}

// ==================== QUIZ GENERATION ====================

async function handleQuizGenerate(req: Request) {
  const body = await readBody(req);
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
    return json({ success: false, error: 'notebookId is required' }, 400);
  }

  await ensureNotebookRow(notebookId);

  const targetCount = Math.max(3, Math.min(parseInt(String(questionCount), 10) || 10, 30));

  const { getChunksByNotebook, getChunksByDocument } = await import('@/lib/db/queries');
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
    return json({ success: false, error: 'No indexed source documents found in this notebook.' }, 400);
  }

  let weakTopicsList: string[] = [];
  if (mode === 'weak_areas') {
    weakTopicsList = await getWeakTopics(notebookId);
  }

  if (topic && topic !== 'all') {
    const topicChunks = chunks.filter(
      (c) =>
        c.section_heading?.toLowerCase().includes(topic.toLowerCase()) ||
        c.text?.toLowerCase().includes(topic.toLowerCase())
    );
    if (topicChunks.length > 0) chunks = topicChunks;
  }

  const ai = await getAIProvider(CREDENTIAL_HEADERS(req, body));

  const shuffledChunks = [...chunks].sort(() => 0.5 - Math.random());
  const sampleSize = Math.min(shuffledChunks.length, Math.max(12, targetCount * 2));
  const selectedChunks = shuffledChunks.slice(0, sampleSize);

  // Cap context to stay well inside the 60s function limit
  const sourceContext = selectedChunks
    .map(
      (c, i) =>
        `[Source Passage ${i + 1}] (Document: "${c.filename || 'Doc'}", Page: ${c.page_number ?? 1}${
          c.section_heading ? `, Section: "${c.section_heading}"` : ''
        })\n${c.text}`
    )
    .join('\n\n---\n\n')
    .slice(0, 12000);

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

  const finalRawQuestions = (aiRes.questions || []).slice(0, targetCount);
  if (finalRawQuestions.length === 0) {
    return json({ success: false, error: 'Failed to generate questions from source material.' }, 500);
  }

  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const quizTitle = aiRes.quiz_title || `Quiz on ${topic || 'Document Knowledge'}`;

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
    return json({ success: false, error: 'The AI returned malformed questions. Please try again.' }, 502);
  }

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

  return json({ success: true, quiz: quizRecord, questions: validatedQuestions });
}

// ==================== ARTIFACTS ====================

async function handleArtifactsPost(req: Request) {
  const body = await readBody(req);
  const { notebookId, artifactType } = body;

  if (!notebookId || !artifactType) {
    return json({ success: false, error: 'notebookId and artifactType are required' }, 400);
  }

  await ensureNotebookRow(notebookId);

  const { getChunksByNotebook, getDocumentsByNotebook, insertFlashcards, deleteFlashcardsByNotebook } =
    await import('@/lib/db/queries');
  // Client-provided chunks win — the browser is the source of truth on
  // stateless serverless (each Lambda instance has its own /tmp DB).
  const chunks: any[] =
    Array.isArray(body.chunks) && body.chunks.length > 0
      ? body.chunks.map((c: any) => ({
          ...c,
          filename: c.filename || 'Doc',
          page_number: c.page_number ?? 1,
          text: String(c.text ?? ''),
        }))
      : await getChunksByNotebook(notebookId);
  const docs = await getDocumentsByNotebook(notebookId);

  if (chunks.length === 0) {
    return json({ success: false, error: 'No documents or chunks available in this notebook' }, 400);
  }

  const stride = Math.max(1, Math.ceil(chunks.length / 60));
  const sampledChunks = chunks.filter((_: any, i: number) => i % stride === 0).slice(0, 60);
  const fullContextText = sampledChunks
    .map((c: any) => `[Doc: ${c.filename || 'Doc'}, Page: ${c.page_number ?? 1}] ${c.text}`)
    .join('\n\n')
    .slice(0, 14000);

  const primaryDocName = docs[0]?.filename || 'Uploaded Documents';
  const ai = await getAIProvider(CREDENTIAL_HEADERS(req, body));
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
      if (data?.topics && Array.isArray(data.topics)) await setCachedArtifact(notebookId, 'topics', data.topics);
      if (data?.concepts && Array.isArray(data.concepts)) await setCachedArtifact(notebookId, 'concepts', data.concepts);
      if (data?.numbers && Array.isArray(data.numbers)) await setCachedArtifact(notebookId, 'numbers', data.numbers);
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
      if (!(data.flashcards && data.flashcards.length > 0)) {
        return json(
          { success: false, error: 'No flashcards could be generated from this notebook\'s documents. Please try again.' },
          502
        );
      }
      // Replace the deck instead of appending — regenerating used to
      // duplicate every card on every click.
      await deleteFlashcardsByNotebook(notebookId);
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
      return json({ success: false, error: 'Unknown artifact type' }, 400);
  }

  return json({ success: true, artifact: generatedData });
}

// ==================== NOTES GENERATION ====================

async function handleNotesGenerate(req: Request) {
  const body = await readBody(req);
  const { notebookId, sourceDocument, format } = body;

  if (!notebookId) {
    return json({ success: false, error: 'notebookId is required' }, 400);
  }

  await ensureNotebookRow(notebookId);

  const { getChunksByNotebook, getDocumentsByNotebook } = await import('@/lib/db/queries');
  const ai = await getAIProvider(CREDENTIAL_HEADERS(req, body));

  // Client-provided chunks win — stateless serverless can't rely on this
  // Lambda instance's /tmp DB holding the notebook's rows.
  const clientChunks: any[] | null =
    Array.isArray(body.chunks) && body.chunks.length > 0
      ? body.chunks.map((c: any) => ({
          ...c,
          filename: c.filename || 'Doc',
          page_number: c.page_number ?? 1,
          text: String(c.text ?? ''),
        }))
      : null;

  async function persistGeneratedNotes(notesPrompt: any, textOverride?: string) {
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
          contentStr = n.points.map((p) => `- ${p}`).join('\n\n');
        } else {
          contentStr = JSON.stringify(n, null, 2);
        }

        const noteId = `note_gen_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        const created = await createNote({
          id: noteId,
          notebook_id: notebookId,
          title: n.title || `Notes: ${textOverride || 'Document'}`,
          content: contentStr,
          format_type: n.format_type || (i === 0 ? 'cornell' : i === 1 ? 'bullet' : 'exam'),
          is_pinned: i === 0 ? 1 : 0,
        });
        createdNotes.push(created);
      }
    }
    return createdNotes;
  }

  if (sourceDocument) {
    const docs = await getDocumentsByNotebook(notebookId);
    const targetDoc = docs.find((d) => d.id === sourceDocument || d.filename === sourceDocument);
    if (!targetDoc && !clientChunks) {
      return json({ success: false, error: 'Source document not found in this notebook.' }, 404);
    }

    const chunks = clientChunks ?? (await getChunksByNotebook(notebookId));
    // Client chunks may carry no server document_id — fall back to filename match.
    const docName = targetDoc?.filename || String(sourceDocument);
    const docChunks = chunks.filter(
      (c) => (targetDoc && c.document_id === targetDoc.id) || c.filename === docName
    );
    const combinedText = docChunks.map((c) => c.text).join('\n\n');

    if (!combinedText || combinedText.trim().length === 0) {
      return json({ success: false, error: 'No text content found for that document.' }, 400);
    }

    const targetChars = 60000;
    const sampledText = combinedText.slice(0, targetChars);
    const notesPrompt = PROMPTS.DOCUMENT_DEEP_NOTES_AND_AUDIT(docName, sampledText);
    const createdNotes = await persistGeneratedNotes(notesPrompt, docName);

    const sourceReferences = [
      {
        document_id: targetDoc?.id || null,
        document_name: docName,
        pages: Array.from(new Set(docChunks.map((c) => c.page_number))).slice(0, 10),
      },
    ];

    // Human-readable content — the raw JSON blob used to render as the note
    // body; structured data lives in source_references_json instead.
    const sourceListMd = sourceReferences
      .map((r) => `- **${r.document_name}** — pages ${r.pages.join(', ') || 'n/a'}`)
      .join('\n');

    const note = await import('@/lib/db/queries').then((q) =>
      q.createNote({
        id: `note_deep_${Date.now()}`,
        notebook_id: notebookId,
        title: `Deep Notes & Audit: ${docName}`,
        content: `### Deep Notes & Audit\n\n**Sources used:**\n${sourceListMd}\n\nSee the generated notes below for the full breakdown.`,
        format_type: format || 'cornell',
        is_pinned: 0,
        source_references_json: JSON.stringify(sourceReferences),
      })
    );

    return json({ success: true, note, notes: createdNotes.length > 0 ? createdNotes : [note] });
  }

  const chunks = clientChunks ?? (await getChunksByNotebook(notebookId));
  const docs = await getDocumentsByNotebook(notebookId);
  const combinedText = chunks.map((c) => c.text).join('\n\n');
  const docName = docs[0]?.filename || chunks[0]?.filename || 'Uploaded Documents';

  if (!combinedText || combinedText.trim().length === 0) {
    return json({ success: false, error: 'No document text found in this notebook. Please upload a document first.' }, 400);
  }

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
  const createdNotes = await persistGeneratedNotes(notesPrompt, docName);

  return json({ success: true, notes: createdNotes });
}

// The browser is the source of truth for notebooks. When a request lands on
// a Lambda instance that never saw this notebook (isolated /tmp DB), create a
// stub row instead of failing — the client holds the real title/metadata.
async function ensureNotebookRow(notebookId: string): Promise<boolean> {
  if (!notebookId) return false;
  const existing = await getNotebookById(notebookId);
  if (existing) return true;
  try {
    await createNotebook({ id: notebookId, title: 'Notebook', description: '' });
    return true;
  } catch {
    return false;
  }
}


// ==================== MAIN DISPATCHER ====================

export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method.toUpperCase();
  const [resource, second, third] = segments;
  const sp = url.searchParams;

  try {
    // ---------- /api/notebooks ----------
    if (resource === 'notebooks' && !second) {
      if (method === 'GET') {
        const notebooks = await getAllNotebooks();
        return json({ success: true, notebooks });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const id = `nb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notebook = await createNotebook({
          id,
          title: body.title || 'Untitled Notebook',
          description: body.description || '',
        });
        return json({ success: true, notebook });
      }
    }

    if (resource === 'notebooks' && second && !third) {
      if (method === 'GET' || method === 'HEAD') {
        const notebook = await getNotebookById(second);
        if (!notebook) return json({ success: false, error: 'Notebook not found' }, 404);

        const [documents, artifacts, notes, flashcards, questions] = await Promise.all([
          getDocumentsByNotebook(second),
          getAllArtifactsForNotebook(second),
          getNotesByNotebook(second),
          getFlashcardsByNotebook(second),
          import('@/lib/db/queries').then((q) => q.getQuestionsByNotebook(second)),
        ]);
        const { getOrCreateChatSession, getChatMessages } = await import('@/lib/db/queries');
        const chatSession = await getOrCreateChatSession(second);
        const messages = await getChatMessages(chatSession.id);

        return json({
          success: true,
          notebook,
          documents,
          artifacts,
          notes,
          flashcards,
          questions,
          chat: { session: chatSession, messages },
        });
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = await readBody(req);
        const updated = await updateNotebook(second, {
          title: body.title,
          description: body.description,
        });
        return json({ success: true, notebook: updated });
      }
      if (method === 'DELETE') {
        await deleteNotebook(second);
        return json({ success: true });
      }
    }

    // ---------- /api/documents ----------
    if (resource === 'documents' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const documents = await getDocumentsByNotebook(notebookId);
        return json({ success: true, documents });
      }
      if (method === 'POST') {
        const formData = await req.formData();
        const notebookId = formData.get('notebookId') as string;
        const file = formData.get('file') as File;

        if (!notebookId || !file) {
          return json({ success: false, error: 'notebookId and file are required' }, 400);
        }

        // Upsert — never 404 just because this Lambda instance hasn't seen
        // the notebook (the browser owns notebook state).
        await ensureNotebookRow(notebookId);

        if (file.size > MAX_FILE_SIZE) {
          return json(
            { success: false, error: `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)` },
            413
          );
        }

        const path = await import('path');
        const rawFilename = path.basename(file.name || 'document.pdf');
        const ext = path.extname(rawFilename).toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return json(
            { success: false, error: `Unsupported file type "${ext}". Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD.` },
            415
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
          return json({ success: false, error: 'Uploaded file is empty (0 bytes).' }, 400);
        }

        if (!validateMagicBytes(buffer, ext)) {
          return json(
            { success: false, error: `File content does not match its "${ext}" extension.` },
            415
          );
        }

        const { saveUploadedFile } = await import('@/lib/storage');
        const { filePath } = saveUploadedFile(rawFilename, buffer);
        const fileType = detectFileType(rawFilename);

        const result = await indexDocumentFile(notebookId, rawFilename, buffer, filePath, fileType, file.size);

        return json({
          success: true,
          document: { ...result.document, chunks: result.lightweightChunks, pages: result.pages },
          chunkCount: result.chunkCount,
          pageCount: result.pageCount,
        });
      }
    }

    // ---------- /api/documents/text (client-extracted text, bypasses lambda body limit) ----------
    if (resource === 'documents' && second === 'text' && method === 'POST') {
      const body = await readBody(req);
      const { notebookId, filename, pages } = body;

      if (!notebookId || !filename || !Array.isArray(pages) || pages.length === 0) {
        return json({ success: false, error: 'notebookId, filename, and a non-empty pages array are required' }, 400);
      }

      // Upsert — never 404 on a cold instance (browser owns notebook state).
      await ensureNotebookRow(notebookId);

      const cleanPages = pages.map((p: any, i: number) => ({
        pageNumber: Number(p?.pageNumber) || i + 1,
        text: String(p?.text ?? ''),
        headings: Array.isArray(p?.headings) ? p.headings.map(String) : [],
      }));
      const fullText = cleanPages.map((p: any) => p.text).join('\n\n');

      if (fullText.length > MAX_TEXT_CHARS) {
        return json(
          { success: false, error: `Extracted text is ${(fullText.length / 1_000_000).toFixed(1)}M characters; the limit is ~3M. Split the document and upload in parts.` },
          413
        );
      }

      const path = await import('path');
      const rawFilename = path.basename(String(filename));
      // Same extension allowlist as the multipart path — a .exe masquerading
      // as extracted text must not slip through.
      const ext = path.extname(rawFilename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return json(
          { success: false, error: `Unsupported file type "${ext}". Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD.` },
          415
        );
      }
      const crypto = await import('crypto');
      const contentHash = crypto.createHash('sha256').update(fullText).digest('hex');

      const parsed: ParsedDocumentResult = {
        pageCount: cleanPages.length,
        pages: cleanPages,
        fullText,
        isScanned: fullText.trim().length < 50 * cleanPages.length,
        metadata: { source: 'client-extracted' },
      };

      const result = await indexParsedDocument(
        notebookId,
        rawFilename,
        parsed,
        detectFileType(rawFilename),
        Buffer.byteLength(fullText),
        '',
        contentHash
      );

      return json({
        success: true,
        document: { ...result.document, chunks: result.lightweightChunks, pages: result.pages },
        chunkCount: result.chunkCount,
        pageCount: result.pageCount,
      });
    }

    if (resource === 'documents' && second && third === 'process' && method === 'POST') {
      const doc = await getDocumentById(second);
      if (!doc) return json({ success: false, error: 'Document not found' }, 404);

      await updateDocumentStatus(second, 'processing');
      try {
        const parsed = await parseDocument(doc.file_path, doc.filename);
        const rawChunks = chunkDocument(parsed, doc.id, doc.notebook_id, doc.filename, {
          targetChunkSize: 900,
          overlapSize: 120,
        });
        const processedChunks: DocumentChunk[] = rawChunks.map((chunk) => ({
          ...chunk,
          embedding_json: JSON.stringify(computeTextVector(chunk.text + ' ' + chunk.section_heading)),
        }));
        await deleteChunksByDocument(doc.id);
        await insertChunks(processedChunks);
        await updateDocumentStatus(doc.id, 'ready', {
          page_count: parsed.pageCount,
          is_scanned: parsed.isScanned,
        });

        const fullText = parsed.fullText || processedChunks.map((c) => c.text).join('\n\n');
        if (fullText.trim().length > 30) {
          try {
            await createNote({
              id: `note_auto_${doc.id}_${Date.now()}`,
              notebook_id: doc.notebook_id,
              title: `📌 Overview: ${doc.filename}`,
              content: `### Document Overview: ${doc.filename}\n\n**Total Pages:** ${parsed.pageCount}\n**Total Chunks:** ${processedChunks.length}\n\n#### Key Sections Detected:\n${processedChunks.slice(0, 5).map((c) => `- **${c.section_heading || 'Section'}**: ${c.text.slice(0, 120)}...`).join('\n')}\n\n---\n*Ready for grounded Q&A, active-recall study flashcards, and practice quiz generation.*`,
              format_type: 'cornell',
            });
          } catch {}
        }

        return json({
          success: true,
          documentId: second,
          pageCount: parsed.pageCount,
          chunkCount: processedChunks.length,
          status: 'ready',
        });
      } catch (err: any) {
        console.error('Error processing document:', err);
        await updateDocumentStatus(second, 'error', { error_message: err.message });
        return json({ success: false, error: err.message }, 500);
      }
    }

    if (resource === 'documents' && second && third === 'content' && method === 'GET') {
      const fs = await import('fs');
      const doc = await getDocumentById(second);
      if (!doc) return json({ success: false, error: 'Document not found' }, 404);

      try {
        if (!fs.existsSync(doc.file_path)) {
          return json({ success: false, error: 'File not found on disk' }, 404);
        }
        const parsed = await parseDocument(doc.file_path, doc.filename);
        return json({
          success: true,
          filename: doc.filename,
          fileType: doc.file_type,
          totalPages: parsed.pageCount,
          pages: parsed.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
        });
      } catch (parseErr: any) {
        return json({ success: false, error: `Failed to re-parse document: ${parseErr.message}` }, 500);
      }
    }

    if (resource === 'documents' && second && !third) {
      if (method === 'GET') {
        const doc = await getDocumentById(second);
        if (!doc) return json({ success: false, error: 'Document not found' }, 404);
        const { getChunksByDocument } = await import('@/lib/db/queries');
        const chunks = await getChunksByDocument(second);
        return json({ success: true, document: doc, chunks });
      }
      if (method === 'DELETE') {
        const fs = await import('fs');
        const doc = await getDocumentById(second);
        if (doc && fs.existsSync(doc.file_path)) {
          try { fs.unlinkSync(doc.file_path); } catch {}
        }
        await deleteDocument(second);
        return json({ success: true });
      }
    }

    // ---------- /api/chat ----------
    if (resource === 'chat' && second === 'stream' && method === 'POST') {
      // handleChat inspects body.stream and returns an SSE Response.
      return await handleChat(req);
    }

    if (resource === 'chat' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const { getOrCreateChatSession, getChatMessages } = await import('@/lib/db/queries');
        const session = await getOrCreateChatSession(notebookId);
        const messages = await getChatMessages(session.id);
        return json({ success: true, session, messages });
      }
      if (method === 'POST') {
        return await handleChat(req);
      }
    }

    // ---------- /api/flashcards ----------
    if (resource === 'flashcards' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const flashcards = await getFlashcardsByNotebook(notebookId);
        return json({ success: true, flashcards });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        if (!body.notebookId || !body.question || !body.answer) {
          return json({ success: false, error: 'notebookId, question, and answer are required' }, 400);
        }
        await ensureNotebookRow(body.notebookId);
        const card: FlashcardRecord = {
          id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          notebook_id: body.notebookId,
          document_id: body.documentId || null,
          card_type: body.card_type || 'conceptual',
          question: body.question,
          answer: body.answer,
          topic: body.topic || 'General',
          difficulty: body.difficulty || 'medium',
          source_document: body.source_document || null,
          page_number: body.page_number || null,
          review_status: 'unreviewed',
          created_at: new Date().toISOString(),
        };
        await insertFlashcards([card]);
        return json({ success: true, flashcard: card });
      }
    }

    if (resource === 'flashcards' && second && !third) {
      if (method === 'PUT') {
        const body = await readBody(req);
        if (!body.review_status) {
          return json({ success: false, error: 'review_status is required' }, 400);
        }
        await updateFlashcardStatus(second, body.review_status);
        return json({ success: true });
      }
      if (method === 'DELETE') {
        await runQuery(`DELETE FROM flashcards WHERE id = ?`, [second]);
        return json({ success: true });
      }
    }

    // ---------- /api/notes ----------
    if (resource === 'notes' && second === 'generate' && method === 'POST') {
      return await handleNotesGenerate(req);
    }

    if (resource === 'notes' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const notes = await getNotesByNotebook(notebookId);
        return json({ success: true, notes });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const { notebookId, title, content, format_type, is_pinned, source_references } = body;
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        await ensureNotebookRow(notebookId);
        const note = await createNote({
          id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          notebook_id: notebookId,
          title: title || 'Untitled Note',
          content: content || '',
          format_type: format_type || 'standard',
          is_pinned: is_pinned ? 1 : 0,
          source_references_json: source_references ? JSON.stringify(source_references) : '[]',
        });
        return json({ success: true, note });
      }
    }

    if (resource === 'notes' && second && !third) {
      if (method === 'GET') {
        const note = await getNoteById(second);
        if (!note) return json({ success: false, error: 'Note not found' }, 404);
        return json({ success: true, note });
      }
      if (method === 'PUT') {
        const body = await readBody(req);
        const note = await updateNote(second, {
          title: body.title,
          content: body.content,
          format_type: body.format_type,
          is_pinned: body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : undefined,
          source_references_json: body.source_references ? JSON.stringify(body.source_references) : undefined,
        });
        return json({ success: true, note });
      }
      if (method === 'DELETE') {
        await deleteNote(second);
        return json({ success: true });
      }
    }

    // ---------- /api/questions ----------
    if (resource === 'questions' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const { getQuestionsByNotebook } = await import('@/lib/db/queries');
        const questions = await getQuestionsByNotebook(notebookId);
        return json({ success: true, questions });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const { notebookId, question_type, question, options, correct_answer, explanation, difficulty, source_document, page_number } = body;
        if (!notebookId || !question || !correct_answer) {
          return json({ success: false, error: 'Missing required fields' }, 400);
        }
        const { insertQuestions } = await import('@/lib/db/queries');
        const q = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          notebook_id: notebookId,
          document_id: null,
          question_type: question_type || 'multiple_choice',
          question,
          options_json: options ? JSON.stringify(options) : undefined,
          correct_answer,
          explanation: explanation || '',
          difficulty: difficulty || 'medium',
          source_document: source_document || null,
          page_number: page_number || null,
          created_at: new Date().toISOString(),
        };
        await insertQuestions([q]);
        return json({ success: true, question: q });
      }
      if (method === 'DELETE') {
        const id = sp.get('id');
        if (!id) return json({ success: false, error: 'id is required' }, 400);
        const { runQuery } = await import('@/lib/db/queries');
        await runQuery(`DELETE FROM questions WHERE id = ?`, [id]);
        return json({ success: true });
      }
    }

    // ---------- /api/quiz/generate ----------
    if (resource === 'quiz' && second === 'generate' && method === 'POST') {
      return await handleQuizGenerate(req);
    }

    // ---------- /api/quiz/attempt ----------
    if (resource === 'quiz' && second === 'attempt') {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
        const attempts = await getQuizAttempts(notebookId);
        return json({ success: true, attempts });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const { quizId, notebookId, title = 'Quiz Attempt', score = 0, totalQuestions = 10, correctCount = 0, accuracyPct = 0, xpEarned = 0, maxStreak = 0, timeSpentSeconds = 0, answers = [] } = body;
        if (!quizId || !notebookId) {
          return json({ success: false, error: 'quizId and notebookId are required' }, 400);
        }
        // Coerce client numerics — strings/NaN from the UI used to poison
        // the numeric columns on insert.
        const num = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const attempt = await recordQuizAttempt({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          quiz_id: quizId,
          notebook_id: notebookId,
          title,
          score: num(score),
          total_questions: num(totalQuestions),
          correct_count: num(correctCount),
          accuracy_pct: num(accuracyPct),
          xp_earned: num(xpEarned),
          max_streak: num(maxStreak),
          time_spent_seconds: num(timeSpentSeconds),
          answers: answers || [],
        });
        return json({ success: true, attempt });
      }
    }

    // ---------- /api/quiz/weak-areas ----------
    if (resource === 'quiz' && second === 'weak-areas' && method === 'GET') {
      const notebookId = sp.get('notebookId');
      if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);
      const [performance, weakTopics] = await Promise.all([
        getTopicPerformance(notebookId),
        getWeakTopics(notebookId),
      ]);
      return json({ success: true, performance, weakTopics });
    }

    // ---------- /api/quiz/explain ----------
    if (resource === 'quiz' && second === 'explain' && method === 'POST') {
      const body = await readBody(req);
      const { question, correctAnswer, explanation } = body;
      if (!question || !correctAnswer) {
        return json({ success: false, error: 'Question and correctAnswer are required' }, 400);
      }
      const ai = await getAIProvider(CREDENTIAL_HEADERS(req, body));
      const prompt = PROMPTS.EXPLAIN_DIFFERENTLY(question, correctAnswer, explanation || '');
      const res = await ai.generateText([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);
      return json({ success: true, alternativeExplanation: res.text });
    }

    // ---------- /api/artifacts ----------
    if (resource === 'artifacts' && !second) {
      if (method === 'GET') {
        const notebookId = sp.get('notebookId');
        const artifactType = sp.get('type') as any;
        const documentId = sp.get('documentId');
        if (!notebookId || !artifactType) {
          return json({ success: false, error: 'notebookId and type are required' }, 400);
        }
        const data = await getCachedArtifact(notebookId, artifactType, documentId);
        return json({ success: true, artifact: data });
      }
      if (method === 'POST') {
        return await handleArtifactsPost(req);
      }
    }

    // ---------- /api/search ----------
    if (resource === 'search' && method === 'GET') {
      const notebookId = sp.get('notebookId');
      const query = sp.get('q')?.trim() || '';
      if (!notebookId || !query) {
        return json({ success: false, error: 'notebookId and q (search query) are required' }, 400);
      }

      // Escape LIKE wildcards so user input like "50%" or "a_b" matches literally
      const likeQuery = `%${query.replace(/[%_]/g, (m) => `[${m}]`)}%`;
      const chunks = await queryAll<any>(
        `SELECT c.id, c.document_id, c.page_number, c.section_heading, c.text, d.filename
         FROM document_chunks c
         JOIN documents d ON c.document_id = d.id
         WHERE c.notebook_id = ? AND (c.text LIKE ? OR c.section_heading LIKE ?)
         LIMIT 10`,
        [notebookId, likeQuery, likeQuery]
      );
      const notes = await queryAll<any>(
        `SELECT id, title, content, format_type
         FROM notes
         WHERE notebook_id = ? AND (title LIKE ? OR content LIKE ?)
         LIMIT 5`,
        [notebookId, likeQuery, likeQuery]
      );
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
          title: `${c.filename} (Page ${c.page_number ?? 1})`,
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
          subtitle: `Flashcard - ${f.topic} (${f.difficulty})`,
          snippet: f.answer.length > 180 ? f.answer.slice(0, 180) + '...' : f.answer,
          metadata: { flashcardId: f.id },
        })),
      ];
      return json({ success: true, results: formattedResults });
    }

    // ---------- /api/settings ----------
    if (resource === 'settings' && !second) {
      if (method === 'GET') {
        const provider = await getSetting('ai_provider', process.env.AI_PROVIDER || 'openrouter');
        const model = await getSetting('ai_model', process.env.AI_MODEL || 'openai/gpt-oss-20b:free');
        const baseUrl = await getSetting('ai_base_url', process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1');
        const hasApiKey = Boolean(await getSetting('ai_api_key', process.env.AI_API_KEY || ''));
        return json({ success: true, settings: { provider, model, baseUrl, hasApiKey } });
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const { provider, model, baseUrl, apiKey } = body;
        if (provider) await setSetting('ai_provider', provider);
        if (model) await setSetting('ai_model', model);
        if (baseUrl !== undefined) await setSetting('ai_base_url', baseUrl);
        if (apiKey !== undefined && apiKey !== '********') {
          await setSetting('ai_api_key', apiKey);
        }
        return json({ success: true, message: 'Settings updated successfully' });
      }
    }

    // ---------- /api/compare ----------
    if (resource === 'compare' && method === 'GET') {
      const notebookId = sp.get('notebookId');
      if (!notebookId) return json({ success: false, error: 'notebookId is required' }, 400);

      const cached = await getCachedArtifact(notebookId, 'comparison');
      if (cached) return json({ success: true, comparison: cached });

      const { getChunksByNotebook } = await import('@/lib/db/queries');
      const docs = await getDocumentsByNotebook(notebookId);
      if (docs.length < 2) {
        return json({
          success: true,
          comparison: {
            comparison_topic: 'Single Document Available',
            documents: docs.map((d) => ({
              document_name: d.filename,
              viewpoint: 'Primary source reference',
              key_findings: ['Upload a second document to generate cross-document comparison and contradiction matrix.'],
              citations: ['Page 1'],
            })),
            agreements: ['Upload additional documents to detect consensus points.'],
            contradictions: ['No conflicting documents uploaded yet.'],
            synthesis: 'Once you upload 2 or more documents into this notebook, the AI comparison engine will automatically contrast methodologies, findings, and statements.',
          },
        });
      }

      const chunks = await getChunksByNotebook(notebookId);
      const docSummarySnippets = docs
        .map((d) => {
          const docChunks = chunks.filter((c) => c.document_id === d.id).slice(0, 4);
          return `=== Document: ${d.filename} ===\n${docChunks.map((c) => `[p.${c.page_number ?? 1}] ${c.text}`).join('\n')}`;
        })
        .join('\n\n');

      const ai = await getAIProvider(CREDENTIAL_HEADERS(req));
      const prompt = PROMPTS.DOCUMENT_COMPARISON(docSummarySnippets);
      const comparison = await ai.generateStructuredJson([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ]);

      await setCachedArtifact(notebookId, 'comparison', comparison);
      return json({ success: true, comparison });
    }

    // ---------- /api/ai/health ----------
    if (resource === 'ai' && second === 'health' && method === 'POST') {
      const body = await readBody(req);
      const { provider, model, apiKey, baseUrl } = body;
      const aiProvider = await getAIProvider({ apiKey, provider, model, baseUrl });

      // Offline fallback must report local_mode so the UI shows
      // "Local Engine (Offline)" instead of a fake "Connected".
      if (aiProvider.id === 'local') {
        return json({
          success: true,
          status: 'local_mode',
          connected: false,
          provider: 'local',
          model: 'Local Fallback (No API Key)',
          message: 'No API key configured. Enter your API Key in Settings or set AI_API_KEY.',
        });
      }

      try {
        const result = await aiProvider.generateText([
          { role: 'user', content: 'Reply with exactly: OK' },
        ]);
        return json({
          success: true,
          connected: true,
          status: 'ok',
          provider: aiProvider.name,
          model: model || 'default',
          response: result.text.slice(0, 100),
        });
      } catch (healthErr: any) {
        return json({ success: true, connected: false, status: 'error', provider: aiProvider.name, error: healthErr.message });
      }
    }

    return json({ success: false, error: `Not found: ${method} ${url.pathname}` }, 404);
  } catch (err: any) {
    console.error(`API error [${method} ${url.pathname}]:`, err);
    return json({ success: false, error: err.message }, 500);
  }
}
