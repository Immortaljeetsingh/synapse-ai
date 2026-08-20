'use client';

import React from 'react';
import {
  Trophy,
  Award,
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Target,
  ArrowRight,
  BookOpen,
  Zap,
  Gamepad2,
} from 'lucide-react';
import { QuizAnswerRecord, QuizQuestionItem, TopicPerformanceRecord } from '@/lib/types';

interface QuizResultsDashboardProps {
  score: number;
  totalQuestions: number;
  correctCount: number;
  accuracyPct: number;
  xpEarned: number;
  maxStreak: number;
  timeSpentSeconds: number;
  answers: QuizAnswerRecord[];
  questions: QuizQuestionItem[];
  topicPerformance?: TopicPerformanceRecord[];
  onReviewAnswers: () => void;
  onRetakeQuiz: () => void;
  onPracticeWeakAreas: (weakTopics: string[]) => void;
  onNewQuiz: () => void;
}

export const QuizResultsDashboard: React.FC<QuizResultsDashboardProps> = ({
  score,
  totalQuestions,
  correctCount,
  accuracyPct,
  xpEarned,
  maxStreak,
  timeSpentSeconds,
  answers,
  questions,
  topicPerformance = [],
  onReviewAnswers,
  onRetakeQuiz,
  onPracticeWeakAreas,
  onNewQuiz,
}) => {
  // Compute session topic performance
  const sessionTopics: Record<string, { total: number; correct: number }> = {};
  for (const a of answers) {
    const t = a.topic || 'General';
    if (!sessionTopics[t]) sessionTopics[t] = { total: 0, correct: 0 };
    sessionTopics[t].total += 1;
    if (a.is_correct) sessionTopics[t].correct += 1;
  }

  const topicEntries = Object.entries(sessionTopics).map(([topic, stats]) => ({
    topic,
    total: stats.total,
    correct: stats.correct,
    accuracy: Math.round((stats.correct / (stats.total || 1)) * 100),
  }));

  const strongTopics = topicEntries.filter((t) => t.accuracy >= 75).map((t) => t.topic);
  const weakTopics = topicEntries.filter((t) => t.accuracy < 70).map((t) => t.topic);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-6 overflow-y-auto select-none animate-in fade-in zoom-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
        {/* Top Trophy Banner */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
            <Trophy className="w-8 h-8 fill-slate-950" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-100">Quiz Completed!</h2>
            <p className="text-xs text-slate-400">Knowledge assessment and grounding verified</p>
          </div>

          {/* Primary Score Ring */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-indigo-400 font-mono">
                {correctCount} / {totalQuestions}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Correct</div>
            </div>

            <div className="h-10 w-px bg-slate-800" />

            <div className="text-center">
              <div
                className={`text-3xl font-extrabold font-mono ${
                  accuracyPct >= 80 ? 'text-emerald-400' : accuracyPct >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {accuracyPct}%
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Accuracy</div>
            </div>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total XP</span>
            </div>
            <div className="text-base font-bold text-indigo-300 font-mono">+{xpEarned} XP</div>
          </div>

          <div className="space-y-0.5 border-x border-slate-800">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Max Streak</span>
            </div>
            <div className="text-base font-bold text-amber-300 font-mono">{maxStreak}</div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Time</span>
            </div>
            <div className="text-base font-bold text-cyan-300 font-mono">{formatTime(timeSpentSeconds)}</div>
          </div>
        </div>

        {/* Topic Breakdown Bars */}
        {topicEntries.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Topic Performance Breakdown
            </h4>
            <div className="space-y-2">
              {topicEntries.map((t, idx) => (
                <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{t.topic}</span>
                    <span className="font-mono text-slate-400">
                      {t.correct}/{t.total} ({t.accuracy}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        t.accuracy >= 75
                          ? 'bg-emerald-400'
                          : t.accuracy >= 50
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${t.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Areas Recommendation */}
        {weakTopics.length > 0 && (
          <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Recommended Next Step</span>
              </div>
              <p className="text-xs text-slate-300">
                Practice weak concepts: <span className="font-semibold text-amber-200">{weakTopics.join(', ')}</span>
              </p>
            </div>
            <button
              onClick={() => onPracticeWeakAreas(weakTopics)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-colors shadow shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Practice Weak Areas</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <button
            onClick={onReviewAnswers}
            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Review Answers</span>
          </button>

          <button
            onClick={onRetakeQuiz}
            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Retake Quiz</span>
          </button>

          <button
            onClick={onNewQuiz}
            className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all shadow-3d-sm border border-neutral-700 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>New Quiz</span>
          </button>
        </div>
      </div>
    </div>
  );
};
