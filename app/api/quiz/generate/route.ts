export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  getChunksByNotebook,
  getChunksByDocument,
  createQuiz,
  insertQuizQuestions,
  getWeakTopics,
} from '@/lib/db/queries';
import { getAIProvider, PROMPTS } from '@/lib/ai';
import { QuizConfig, QuizQuestionItem } from '@/lib/types';

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
    if (documentId) {
      chunks = await getChunksByDocument(documentId);
    } else {
      chunks = await getChunksByNotebook(notebookId);
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

    // 2. Call AI Provider
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

    // 3. Validate & Format Questions
    const validatedQuestions: QuizQuestionItem[] = [];

    for (let i = 0; i < finalRawQuestions.length; i++) {
      const q = finalRawQuestions[i];
      let options = Array.isArray(q.options) ? q.options : [];
      let correctAnswer = q.correct_answer || options[0] || 'A';

      // Ensure True/False has proper options
      if (q.question_type === 'true_false' && options.length === 0) {
        options = ['True', 'False'];
      }

      // If options are bare text without A), B), prefix them cleanly
      options = options.map((opt: string, idx: number) => {
        const prefix = `${String.fromCharCode(65 + idx)}) `;
        return opt.startsWith('A)') ||
          opt.startsWith('B)') ||
          opt.startsWith('C)') ||
          opt.startsWith('D)') ||
          opt === 'True' ||
          opt === 'False'
          ? opt
          : `${prefix}${opt}`;
      });

      // Match correct answer format
      if (!options.includes(correctAnswer)) {
        const matchingOpt = options.find((opt: string) =>
          opt.toLowerCase().includes(correctAnswer.toLowerCase())
        );
        if (matchingOpt) {
          correctAnswer = matchingOpt;
        } else if (options.length > 0) {
          correctAnswer = options[0];
        }
      }

      // Link chunk / page attribution
      const matchingChunk = selectedChunks[i % selectedChunks.length];

      validatedQuestions.push({
        id: `qq_${quizId}_${i}`,
        quiz_id: quizId,
        question: q.question || `Question ${i + 1}`,
        question_type: q.question_type || 'multiple_choice',
        options,
        correct_answer: correctAnswer,
        explanation: q.explanation || 'Grounded directly in the source documents.',
        topic: q.topic || topic || 'General',
        difficulty: q.difficulty || difficulty || 'medium',
        source_document: q.source_document || matchingChunk?.filename || 'Uploaded Document',
        page_number: q.page_number || matchingChunk?.page_number || 1,
        chunk_id: matchingChunk?.id,
      });
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
