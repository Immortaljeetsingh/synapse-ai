import { QuizQuestionItem } from '@/lib/types';

/**
 * Normalizes AI-generated quiz questions into a consistent shape.
 *
 * Fixes two grading-corruption bugs:
 * - Options are letter-prefixed exactly once ("A) ...").
 * - `correct_answer` is normalized to the FULL prefixed option text:
 *   bare letters ("B"), unprefixed text ("Capital adequacy") and prefixed
 *   text ("B) Capital adequacy") all resolve to the exact option string,
 *   so the client can grade by strict equality instead of fragile
 *   first-character heuristics.
 */
export function normalizeQuizQuestions(
  rawQuestions: any[],
  opts: { quizId: string; fallbackSource?: string; fallbackPage?: number }
): QuizQuestionItem[] {
  const clean = (s: string) => String(s ?? '').trim();

  return rawQuestions
    .filter((q) => q && clean(q.question))
    .map((q, i) => {
      let options: string[] = Array.isArray(q.options) ? q.options.map((opt: any) => clean(opt)).filter(Boolean) : [];
      if (options.length < 2) {
        // Malformed options from the model — skip rather than fabricate a broken question
        return null;
      }
      options = options.slice(0, 6).map((opt: string, idx: number) => {
        const alreadyPrefixed = /^[A-F]\)\s/.test(opt);
        return alreadyPrefixed ? opt : `${String.fromCharCode(65 + idx)}) ${opt}`;
      });

      const rawAnswer = clean(q.correct_answer);
      let correct = rawAnswer;

      // Bare letter ("b", "B)", "B.") → resolve to that option
      const letterMatch = rawAnswer.match(/^([A-Fa-f])\)?\.?$/);
      if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        if (options[idx]) {
          correct = options[idx];
        }
      } else {
        // Exact or prefix match against the normalized options
        const exact = options.find((o: string) => o === rawAnswer);
        const prefixed = options.find((o: string) => o.substring(3).toLowerCase() === rawAnswer.toLowerCase());
        const startsWith = options.find((o: string) => o.startsWith(rawAnswer));
        correct = exact || prefixed || startsWith || rawAnswer;
      }

      return {
        id: `qq_${opts.quizId}_${i}`,
        quiz_id: opts.quizId,
        question: clean(q.question),
        question_type: q.question_type === 'true_false' ? 'true_false' : 'multiple_choice',
        options,
        correct_answer: correct,
        explanation: clean(q.explanation) || 'Based on source document passages.',
        topic: clean(q.topic) || 'General',
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        source_document: clean(q.source_document) || opts.fallbackSource || 'Document',
        page_number: Number(q.page_number) || opts.fallbackPage || 1,
      } as QuizQuestionItem;
    })
    .filter(Boolean) as QuizQuestionItem[];
}
