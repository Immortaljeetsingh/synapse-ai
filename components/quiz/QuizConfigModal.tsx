'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Gamepad2,
  BookOpen,
  FileText,
  Clock,
  Flame,
  Award,
  Zap,
  Target,
  GraduationCap,
} from 'lucide-react';
import { QuizConfig, DocumentRecord, QuizDifficulty, QuizMode, QuestionType } from '@/lib/types';

interface QuizConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentRecord[];
  topics: string[];
  weakTopics: string[];
  initialConfig?: Partial<QuizConfig>;
  onStartQuiz: (config: QuizConfig) => Promise<void>;
  isGenerating?: boolean;
}

export const QuizConfigModal: React.FC<QuizConfigModalProps> = ({
  isOpen,
  onClose,
  documents,
  topics = [],
  weakTopics = [],
  initialConfig,
  onStartQuiz,
  isGenerating = false,
}) => {
  const [sourceType, setSourceType] = useState<'notebook' | 'document' | 'topic'>('notebook');
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  const [questionType, setQuestionType] = useState<QuestionType | 'mixed'>('mixed');
  const [mode, setMode] = useState<QuizMode>('practice');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [enableXp, setEnableXp] = useState<boolean>(true);
  const [enableStreaks, setEnableStreaks] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen && initialConfig) {
      if (initialConfig.mode) setMode(initialConfig.mode);
      if (initialConfig.questionCount) setQuestionCount(initialConfig.questionCount);
      if (initialConfig.difficulty) setDifficulty(initialConfig.difficulty);
      if (initialConfig.sourceType) {
        if (initialConfig.sourceType === 'selected') {
          setSourceType('document');
        } else {
          setSourceType(initialConfig.sourceType);
        }
      }
      if (initialConfig.documentId) setSelectedDocId(initialConfig.documentId);
      if (initialConfig.topic) setSelectedTopic(initialConfig.topic);
    }
  }, [isOpen, initialConfig]);

  // Keep the doc selection in sync — the modal is permanently mounted while
  // documents load async, so the one-time initializer used to capture ''.
  useEffect(() => {
    setSelectedDocId((prev) => {
      if (prev && documents.some((d) => d.id === prev)) return prev;
      return documents[0]?.id || '';
    });
  }, [documents]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === 'document' && !selectedDocId) return;
    if (sourceType === 'topic' && (!selectedTopic || selectedTopic === 'all')) return;
    await onStartQuiz({
      sourceType,
      documentId: sourceType === 'document' ? selectedDocId : null,
      topic: sourceType === 'topic' ? selectedTopic : undefined,
      questionCount,
      difficulty,
      questionType,
      mode,
      timerSeconds,
      enableXp,
      enableStreaks,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none animate-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-xl shadow-3d-lg overflow-y-auto max-h-[90vh] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-neutral-800 bevel text-neutral-300 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-100 text-base">Start Knowledge Quiz &amp; Game</h3>
              <p className="text-xs text-neutral-500">Configure an interactive quiz grounded in your documents</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quick Mode Presets */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
              Quiz Mode Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'practice', name: 'Practice', desc: 'Instant feedback & citations', icon: BookOpen },
                { id: 'exam', name: 'Exam Mode', desc: 'Timed test, results at end', icon: GraduationCap },
                { id: 'adaptive', name: 'Adaptive', desc: 'Scales difficulty with streak', icon: Zap },
                { id: 'weak_areas', name: 'Weak Areas', desc: 'Focus on missed concepts', icon: Target },
              ].map((m) => {
                const isSelected = mode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id as QuizMode);
                      if (m.id === 'exam') setTimerSeconds(60);
                      if (m.id === 'adaptive') setDifficulty('adaptive');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-neutral-600 bg-neutral-800 text-neutral-100 shadow-3d-sm'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-neutral-200' : 'text-neutral-500'}`} />
                    <div className="text-xs font-bold text-neutral-200">{m.name}</div>
                    <div className="text-[10px] text-neutral-500 leading-tight mt-0.5">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Source Scope</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSourceType('notebook')}
                className={`py-1.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  sourceType === 'notebook'
                    ? 'bg-neutral-800 text-neutral-100 border-neutral-700 shadow-3d-sm'
                    : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                }`}
              >
                All Documents
              </button>
              <button
                type="button"
                onClick={() => setSourceType('document')}
                className={`py-1.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  sourceType === 'document'
                    ? 'bg-neutral-800 text-neutral-100 border-neutral-700 shadow-3d-sm'
                    : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                }`}
              >
                Single Document
              </button>
              <button
                type="button"
                onClick={() => setSourceType('topic')}
                className={`py-1.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  sourceType === 'topic'
                    ? 'bg-neutral-800 text-neutral-100 border-neutral-700 shadow-3d-sm'
                    : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                }`}
              >
                Specific Topic
              </button>
            </div>

            {sourceType === 'document' && (
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} (p.{d.page_count || 1})
                  </option>
                ))}
              </select>
            )}

            {sourceType === 'topic' && (
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
              >
                <option value="all">Select Topic...</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Question Count & Difficulty Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                Number of Questions
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`py-1.5 rounded-xl text-xs font-semibold border text-center transition-colors ${
                      questionCount === count
                        ? 'bg-neutral-700 text-white border-neutral-600 shadow-3d-sm'
                        : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:bg-neutral-850'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
              >
                <option value="easy">Easy (Direct Recall)</option>
                <option value="medium">Medium (Comprehension)</option>
                <option value="hard">Hard (Relational Analysis)</option>
                <option value="expert">Expert (Multi-step Synthesis)</option>
                <option value="adaptive">Adaptive Scaling</option>
              </select>
            </div>
          </div>

          {/* Question Types & Timer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Question Types</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
              >
                <option value="mixed">Mixed (All Formats)</option>
                <option value="multiple_choice">Standard Multiple Choice</option>
                <option value="scenario">Scenario-Based MCQs</option>
                <option value="conceptual">Conceptual Questions</option>
                <option value="true_false">True / False</option>
                <option value="comparison">Comparison Questions</option>
                <option value="application">Application Questions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                Timer per Question
              </label>
              <select
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
              >
                <option value={0}>No Timer (Relaxed)</option>
                <option value={30}>30 Seconds (Fast)</option>
                <option value={60}>60 Seconds (Standard)</option>
                <option value={90}>90 Seconds (Deep Think)</option>
              </select>
            </div>
          </div>

          {/* Gamification Toggles */}
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs text-neutral-300 shadow-3d-sm">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-neutral-400" />
              <span>Streaks &amp; XP System</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableStreaks}
                  onChange={(e) => setEnableStreaks(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0"
                />
                <span>Streak Bonuses</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableXp}
                  onChange={(e) => setEnableXp(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0"
                />
                <span>Award XP</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-bold transition-all shadow-3d-sm flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{isGenerating ? 'Generating Grounded Quiz...' : 'Start Game'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
