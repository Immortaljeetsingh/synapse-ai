'use client';

import React, { useState } from 'react';
import {
  Gamepad2,
  Zap,
  Target,
  GraduationCap,
  BookOpen,
  Trophy,
  Flame,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  QuizQuestionItem,
  QuizAttemptRecord,
  TopicPerformanceRecord,
  DocumentRecord,
  QuizConfig,
} from '@/lib/types';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { QuizHistoryView } from '@/components/quiz/QuizHistoryView';

export type PrepStatus = {
  overview?: 'pending' | 'done' | 'failed';
  flashcards?: 'pending' | 'done' | 'failed';
  quiz?: 'pending' | 'done' | 'failed';
};

export type PreGeneratedQuiz = {
  title: string;
  questions: QuizQuestionItem[];
  quizId?: string | null;
};

interface QuizTabProps {
  documents: DocumentRecord[];
  topicPerformance: TopicPerformanceRecord[];
  weakTopics: string[];
  attempts: QuizAttemptRecord[];
  onStartQuizConfig: (config: QuizConfig) => Promise<void>;
  isGenerating?: boolean;
  preGeneratedQuiz?: PreGeneratedQuiz | null;
  prepStatus?: PrepStatus | null;
  onConsumePreGeneratedQuiz?: () => void;
}

export const QuizTab: React.FC<QuizTabProps> = ({
  documents = [],
  topicPerformance = [],
  weakTopics = [],
  attempts = [],
  onStartQuizConfig,
  isGenerating = false,
  preGeneratedQuiz,
  prepStatus,
  onConsumePreGeneratedQuiz,
}) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [presetConfig, setPresetConfig] = useState<Partial<QuizConfig>>({});

  const allTopics = Array.from(
    new Set(topicPerformance.map((t) => t.topic).filter(Boolean))
  );

  const handleLaunchPreset = (presetMode: 'practice' | 'exam' | 'adaptive' | 'weak_areas') => {
    setPresetConfig({ mode: presetMode });
    setIsConfigOpen(true);
  };

  // Aggregated Overall Stats
  const totalAttempts = attempts.length;
  const avgAccuracy =
    totalAttempts > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.accuracy_pct, 0) / totalAttempts)
      : 0;
  const totalXp = attempts.reduce((acc, a) => acc + (a.xp_earned || 0), 0);
  const bestStreak = attempts.reduce((max, a) => Math.max(max, a.max_streak || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Pre-generated quiz ready banner */}
      {preGeneratedQuiz && (
        <div className="bg-neutral-900 border border-emerald-700/50 rounded-3xl p-6 shadow-3d relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quiz ready — generated from your upload
              </div>
              <div className="font-bold text-neutral-100 truncate">{preGeneratedQuiz.title}</div>
              <div className="text-xs text-neutral-400 font-mono">
                {preGeneratedQuiz.questions.length} question{preGeneratedQuiz.questions.length === 1 ? '' : 's'}
              </div>
            </div>
            <button
              onClick={onConsumePreGeneratedQuiz}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-3d flex items-center justify-center gap-2.5 transition-all transform active:scale-95 shrink-0"
            >
              <Gamepad2 className="w-5 h-5" />
              <span>Start Quiz Now</span>
            </button>
          </div>
          <div className="text-[11px] text-neutral-500 mt-3">or customize below</div>
        </div>
      )}

      {/* Background generation spinner */}
      {prepStatus?.quiz === 'pending' && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
          Generating practice quiz in background…
        </div>
      )}

      {/* Hero Interactive Quiz Launcher Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-3d-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-800 text-neutral-300 border border-neutral-700 uppercase tracking-wider">
              <Gamepad2 className="w-4 h-4 text-neutral-400" />
              <span>Interactive Knowledge Game</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              Transform Your Documents Into a Quiz Game
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Challenge yourself with AI-generated questions strictly grounded in your indexed source passages. Track streaks, earn XP, and target weak topics.
            </p>
          </div>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="px-8 py-3.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl font-bold text-sm shadow-3d flex items-center gap-2.5 transition-all transform active:scale-95 shrink-0"
          >
            <Gamepad2 className="w-5 h-5" />
            <span>Start Interactive Quiz</span>
          </button>
        </div>

        {/* Quick Mode Preset Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-neutral-800">
          <button
            onClick={() => handleLaunchPreset('practice')}
            className="p-3.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left transition-all group shadow-3d-sm"
          >
            <BookOpen className="w-4 h-4 text-neutral-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-neutral-100">Practice Mode</div>
            <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
              Instant feedback &amp; citations
            </div>
          </button>

          <button
            onClick={() => handleLaunchPreset('exam')}
            className="p-3.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left transition-all group shadow-3d-sm"
          >
            <GraduationCap className="w-4 h-4 text-neutral-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-neutral-100">Exam Mode</div>
            <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
              Timed test, results at end
            </div>
          </button>

          <button
            onClick={() => handleLaunchPreset('adaptive')}
            className="p-3.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left transition-all group shadow-3d-sm"
          >
            <Zap className="w-4 h-4 text-neutral-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-neutral-100">Adaptive Mode</div>
            <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
              Scales difficulty with streaks
            </div>
          </button>

          <button
            onClick={() => handleLaunchPreset('weak_areas')}
            className="p-3.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left transition-all group shadow-3d-sm"
          >
            <Target className="w-4 h-4 text-neutral-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-neutral-100">Weak Areas</div>
            <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
              Target missed topics
            </div>
          </button>
        </div>
      </div>

      {/* Gamification Stats Bar */}
      {totalAttempts > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-3d-sm">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-neutral-500 font-medium">Total Quizzes</div>
              <div className="text-lg font-bold text-neutral-100 font-mono">{totalAttempts}</div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-3d-sm">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-neutral-500 font-medium">Avg Accuracy</div>
              <div className="text-lg font-bold text-neutral-100 font-mono">{avgAccuracy}%</div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-3d-sm">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-neutral-300" />
            </div>
            <div>
              <div className="text-xs text-neutral-500 font-medium">Total XP Earned</div>
              <div className="text-lg font-bold text-neutral-200 font-mono">+{totalXp} XP</div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-3d-sm">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-neutral-300" />
            </div>
            <div>
              <div className="text-xs text-neutral-500 font-medium">Best Streak</div>
              <div className="text-lg font-bold text-neutral-200 font-mono">{bestStreak} 🔥</div>
            </div>
          </div>
        </div>
      )}

      {/* Topic Mastery & Weak Areas Breakdown */}
      {topicPerformance.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-3d">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neutral-400" />
              Topic Mastery &amp; Accuracy Tracking
            </h3>
            {weakTopics.length > 0 && (
              <span className="text-[11px] text-neutral-300 bg-neutral-800 border border-neutral-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-neutral-400" />
                {weakTopics.length} topic(s) need practice
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicPerformance.map((perf, idx) => (
              <div
                key={idx}
                className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 shadow-3d-sm"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-200">{perf.topic}</span>
                  <span className="font-mono font-bold text-neutral-300">
                    {perf.accuracy_pct}% ({perf.total_correct}/{perf.total_answered})
                  </span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-400"
                    style={{ width: `${perf.accuracy_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Gameplay History */}
      <QuizHistoryView attempts={attempts} />

      {/* Configuration Modal */}
      <QuizConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        documents={documents}
        topics={allTopics}
        weakTopics={weakTopics}
        initialConfig={presetConfig}
        onStartQuiz={async (config) => {
          setIsConfigOpen(false);
          await onStartQuizConfig(config);
        }}
        isGenerating={isGenerating}
      />
    </div>
  );
};
