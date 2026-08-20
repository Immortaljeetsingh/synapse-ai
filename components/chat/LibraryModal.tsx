'use client';

import React, { useState } from 'react';
import {
  X,
  Bookmark,
  FileText,
  GraduationCap,
  Gamepad2,
  StickyNote,
  Trash2,
  Search,
  Check,
} from 'lucide-react';
import { NoteRecord, FlashcardRecord, QuizAttemptRecord } from '@/lib/types';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: NoteRecord[];
  flashcards: FlashcardRecord[];
  quizAttempts: QuizAttemptRecord[];
  onDeleteNote: (id: string) => Promise<void>;
  onLaunchQuizMode: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  notes = [],
  flashcards = [],
  quizAttempts = [],
  onDeleteNote,
  onLaunchQuizMode,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'quizzes'>('notes');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCards = flashcards.filter((c) =>
    c.question.toLowerCase().includes(search.toLowerCase()) || c.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-3xl shadow-3d-lg flex flex-col max-h-[85vh] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-neutral-400" />
            <div>
              <h3 className="text-sm font-bold text-neutral-100">Knowledge Library</h3>
              <p className="text-[11px] text-neutral-500">All saved notes, flashcards, and quiz attempts</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'notes'
                  ? 'bg-neutral-800 text-neutral-100 shadow-3d-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Saved Notes ({notes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('flashcards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'flashcards'
                  ? 'bg-neutral-800 text-neutral-100 shadow-3d-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Flashcard Deck ({flashcards.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'quizzes'
                  ? 'bg-neutral-800 text-neutral-100 shadow-3d-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Past Quizzes ({quizAttempts.length})</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-600 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-neutral-600">
                  No notes saved yet. Ask the AI to &ldquo;Create notes&rdquo; in chat to save them here!
                </div>
              ) : (
                filteredNotes.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2 relative group shadow-3d-sm"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-neutral-100 text-sm">{n.title}</h4>
                      <button
                        onClick={() => onDeleteNote(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans">
                      {n.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Flashcards Tab */}
          {activeTab === 'flashcards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCards.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-neutral-600">
                  No flashcards generated yet. Ask the AI to &ldquo;Make flashcards&rdquo; in chat!
                </div>
              ) : (
                filteredCards.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2 shadow-3d-sm"
                  >
                    <span className="text-[10px] text-neutral-400 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded font-mono">
                      {c.topic || 'General'}
                    </span>
                    <div className="font-semibold text-neutral-100">{c.question}</div>
                    <p className="text-neutral-400 text-[11px] leading-relaxed border-t border-neutral-900 pt-1.5">
                      {c.answer}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Past Quizzes Tab */}
          {activeTab === 'quizzes' && (
            <div className="space-y-2.5">
              {quizAttempts.length === 0 ? (
                <div className="text-center py-12 text-neutral-600 space-y-3">
                  <p>No quiz attempts recorded yet.</p>
                  <button
                    onClick={() => {
                      onClose();
                      onLaunchQuizMode();
                    }}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-bold shadow-3d-sm transition-all active:scale-95"
                  >
                    Launch a Quiz Now
                  </button>
                </div>
              ) : (
                quizAttempts.map((att) => (
                  <div
                    key={att.id}
                    className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between shadow-3d-sm"
                  >
                    <div>
                      <div className="font-semibold text-neutral-100">{att.title}</div>
                      <div className="text-[11px] text-neutral-500">
                        {att.total_questions} Questions • Score: {att.score} pts • {att.max_streak} Streak
                      </div>
                    </div>
                    <div className="font-mono font-bold text-xs text-neutral-200 bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-lg">
                      {att.accuracy_pct}% Accuracy
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
