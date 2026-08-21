'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Bookmark,
  ExternalLink,
  Lightbulb,
  Check,
  FileText,
} from 'lucide-react';
import { QuizQuestionItem, QuizAnswerRecord } from '@/lib/types';

interface QuizAnswerReviewProps {
  questions: QuizQuestionItem[];
  answers: QuizAnswerRecord[];
  onBackToResults: () => void;
  onCreateFlashcard: (q: QuizQuestionItem) => Promise<void>;
  onOpenCitationInViewer?: (docName: string, pageNum: number, excerpt: string) => void;
}

export const QuizAnswerReview: React.FC<QuizAnswerReviewProps> = ({
  questions,
  answers,
  onBackToResults,
  onCreateFlashcard,
  onOpenCitationInViewer,
}) => {
  const [alternativeExplanations, setAlternativeExplanations] = useState<Record<string, string>>({});
  const [explainingQuestionId, setExplainingQuestionId] = useState<string | null>(null);
  const [savedFlashcards, setSavedFlashcards] = useState<Record<string, boolean>>({});

  const handleExplainDifferently = async (q: QuizQuestionItem) => {
    setExplainingQuestionId(q.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const key = localStorage.getItem('synapse_api_key');
        const provider = localStorage.getItem('synapse_provider');
        const model = localStorage.getItem('synapse_model');
        const baseUrl = localStorage.getItem('synapse_base_url');
        if (key) headers['x-api-key'] = key;
        if (provider) headers['x-provider'] = provider;
        if (model) headers['x-model'] = model;
        if (baseUrl) headers['x-base-url'] = baseUrl;
      }
      const res = await fetch('/api/quiz/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: q.question,
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
        }),
      });
      const data = await res.json();
      if (data.success && data.alternativeExplanation) {
        setAlternativeExplanations((prev) => ({
          ...prev,
          [q.id]: data.alternativeExplanation,
        }));
      }
    } catch (e) {
      console.error('Error explaining differently:', e);
    } finally {
      setExplainingQuestionId(null);
    }
  };

  const handleCreateFlashcard = async (q: QuizQuestionItem) => {
    await onCreateFlashcard(q);
    setSavedFlashcards((prev) => ({ ...prev, [q.id]: true }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none overflow-hidden animate-in fade-in">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToResults}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h2 className="text-sm font-bold text-slate-100">Detailed Answer & Grounding Review</h2>
        </div>
      </div>

      {/* Review List */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto space-y-6">
        {questions.map((q, idx) => {
          const userAnsRecord = answers.find((a) => a.question_id === q.id);
          const isCorrect = userAnsRecord?.is_correct ?? false;
          const altExplanation = alternativeExplanations[q.id];
          const isExplaining = explainingQuestionId === q.id;
          const isCardSaved = savedFlashcards[q.id];

          return (
            <div
              key={q.id}
              className={`p-6 rounded-2xl border bg-slate-900/90 space-y-4 ${
                isCorrect ? 'border-slate-800' : 'border-rose-900/40 bg-rose-950/10'
              }`}
            >
              {/* Question Top Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded">
                    {q.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4" /> Correct (+{userAnsRecord?.points_awarded ?? userAnsRecord?.points_earned ?? 0} pts)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center gap-1 text-xs">
                      <XCircle className="w-4 h-4" /> Incorrect (0 pts)
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <h3 className="text-base font-semibold text-slate-100 leading-snug">{q.question}</h3>

              {/* User Selection & Correct Answer */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-medium shrink-0">Your Answer:</span>
                  <span
                    className={
                      isCorrect ? 'text-emerald-300 font-semibold' : 'text-rose-400 line-through'
                    }
                  >
                    {userAnsRecord?.selected_answer || 'No Answer'}
                  </span>
                </div>

                {!isCorrect && (
                  <div className="flex items-start gap-2 border-t border-slate-900 pt-1.5">
                    <span className="text-slate-400 font-medium shrink-0">Correct Answer:</span>
                    <span className="text-emerald-300 font-semibold">{q.correct_answer}</span>
                  </div>
                )}
              </div>

              {/* Explanation & Source Citation */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs text-slate-300 space-y-2">
                <p className="leading-relaxed">
                  <span className="font-semibold text-indigo-300">Grounding Rationale: </span>
                  {q.explanation}
                </p>

                {/* Alternative Simplified Explanation */}
                {altExplanation && (
                  <div className="mt-3 p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 leading-relaxed space-y-1 animate-in fade-in">
                    <div className="font-bold text-indigo-300 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Alternative Explanation:</span>
                    </div>
                    <div className="whitespace-pre-wrap">{altExplanation}</div>
                  </div>
                )}

                {/* Source Link */}
                {q.source_document && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Source: {q.source_document} (Page {q.page_number || 1})
                    </span>
                    {onOpenCitationInViewer && (
                      <button
                        onClick={() =>
                          onOpenCitationInViewer(
                            q.source_document!,
                            q.page_number || 1,
                            q.explanation
                          )
                        }
                        className="text-indigo-300 hover:text-indigo-200 flex items-center gap-1 font-sans text-xs underline"
                      >
                        <span>Open Page in Viewer</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for Question */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => handleExplainDifferently(q)}
                  disabled={isExplaining || Boolean(altExplanation)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isExplaining ? 'Simplifying...' : 'Explain this differently'}</span>
                </button>

                <button
                  onClick={() => handleCreateFlashcard(q)}
                  disabled={isCardSaved}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isCardSaved
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isCardSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Flashcard Added</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>+ Create Flashcard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
