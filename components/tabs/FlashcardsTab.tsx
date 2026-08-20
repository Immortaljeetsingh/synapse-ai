'use client';

import React, { useState } from 'react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  X,
  Bookmark,
  Award,
} from 'lucide-react';
import { FlashcardRecord, ReviewStatus } from '@/lib/types';

interface FlashcardsTabProps {
  flashcards: FlashcardRecord[];
  onUpdateStatus: (id: string, status: ReviewStatus) => Promise<void>;
  onRegenerate: () => Promise<void>;
  isStudyModeOpen?: boolean;
  onToggleStudyMode?: () => void;
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({
  flashcards = [],
  onUpdateStatus,
  onRegenerate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [deck, setDeck] = useState<FlashcardRecord[]>(flashcards);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Sync deck when flashcards change
  React.useEffect(() => {
    setDeck(flashcards);
  }, [flashcards]);

  const filteredCards = deck.filter((c) => {
    if (selectedTopic !== 'all' && c.topic !== selectedTopic) return false;
    if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const currentCard = filteredCards[currentIndex] || filteredCards[0];
  const topics = Array.from(new Set(flashcards.map((f) => f.topic).filter(Boolean)));

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % (filteredCards.length || 1));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % (filteredCards.length || 1));
  };

  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleRateCard = async (status: ReviewStatus) => {
    if (currentCard) {
      await onUpdateStatus(currentCard.id, status);
      // Update locally
      const updated = deck.map((c) => (c.id === currentCard.id ? { ...c, review_status: status } : c));
      setDeck(updated);
      handleNext();
    }
  };

  const handleRegen = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  // Stats
  const knownCount = flashcards.filter((c) => c.review_status === 'known').length;
  const easyCount = flashcards.filter((c) => c.review_status === 'easy').length;
  const hardCount = flashcards.filter((c) => c.review_status === 'hard').length;

  if (flashcards.length === 0) {
    return (
      <div className="p-16 text-center max-w-md mx-auto select-none">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-neutral-100 mb-1">No Flashcards Available</h3>
        <p className="text-xs text-neutral-500 mb-6">
          Upload documents or ask in chat to generate active-recall flashcards.
        </p>
        <button
          onClick={handleRegen}
          disabled={isRegenerating}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-3d-sm transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>Generate Flashcards Now</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto select-none">
      {/* Top Stats & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-300">
            <span className="font-semibold text-neutral-100">{flashcards.length}</span> Cards
          </div>
          <span className="text-neutral-700">•</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-300 flex items-center gap-1 font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {knownCount} Known
            </span>
            <span className="text-neutral-300 flex items-center gap-1 font-mono">
              <ThumbsUp className="w-3.5 h-3.5 text-neutral-400" /> {easyCount} Easy
            </span>
            <span className="text-neutral-300 flex items-center gap-1 font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> {hardCount} Hard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 transition-colors shadow-3d-sm"
            title="Shuffle Deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Shuffle</span>
          </button>

          <button
            onClick={handleRegen}
            disabled={isRegenerating}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 transition-colors disabled:opacity-50 shadow-3d-sm"
            title="Regenerate Flashcards"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <button
            onClick={() => setIsStudyMode(true)}
            className="px-3.5 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-3d-sm transition-all active:scale-95"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Fullscreen Study Mode</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-neutral-500">Filter Topic:</span>
        <select
          value={selectedTopic}
          onChange={(e) => {
            setSelectedTopic(e.target.value);
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-neutral-600 text-xs shadow-3d-sm"
        >
          <option value="all">All Topics ({flashcards.length})</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <span className="text-neutral-500 ml-2">Difficulty:</span>
        <select
          value={selectedDifficulty}
          onChange={(e) => {
            setSelectedDifficulty(e.target.value);
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-neutral-600 text-xs shadow-3d-sm"
        >
          <option value="all">All Levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      {/* Main Flashcard Display Card */}
      {currentCard ? (
        <div className="space-y-4">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer select-none perspective-1000 min-h-[300px]"
          >
            <div
              className={`relative w-full h-[320px] rounded-2xl p-8 transition-transform duration-500 transform-style-preserve-3d border shadow-3d-lg flex flex-col justify-between ${
                isFlipped
                  ? 'bg-neutral-900 border-neutral-700 rotate-y-180'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-neutral-950 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase">
                    {currentCard.card_type}
                  </span>
                  <span className="text-neutral-500">{currentCard.topic}</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300`}
                >
                  {currentCard.difficulty}
                </span>
              </div>

              {/* Card Body */}
              <div className="my-auto text-center px-4">
                {isFlipped ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Answer</p>
                    <p className="text-base text-neutral-100 leading-relaxed font-medium">
                      {currentCard.answer}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Question</p>
                    <h3 className="text-lg font-semibold text-neutral-100 leading-relaxed">
                      {currentCard.question}
                    </h3>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t border-neutral-800/60">
                <span className="flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Click anywhere to flip</span>
                </span>
                {currentCard.source_document && (
                  <span className="font-mono text-[10px] text-neutral-500">
                    Source: {currentCard.source_document} (p.{currentCard.page_number || 1})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Review Buttons & Navigation */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 text-xs flex items-center gap-1 shadow-3d-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <span className="text-xs text-neutral-500 font-mono">
                {currentIndex + 1} / {filteredCards.length}
              </span>
              <button
                onClick={handleNext}
                className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 text-xs flex items-center gap-1 shadow-3d-sm"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRateCard('hard')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors shadow-3d-sm"
              >
                Hard
              </button>
              <button
                onClick={() => handleRateCard('easy')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors shadow-3d-sm"
              >
                Easy
              </button>
              <button
                onClick={() => handleRateCard('known')}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-100 rounded-xl text-xs font-medium transition-colors shadow-3d-sm"
              >
                Mastered
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-900 rounded-2xl shadow-3d">
          No cards match the selected filter.
        </div>
      )}

      {/* Fullscreen Study Mode Modal */}
      {isStudyMode && (
        <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col p-8 select-none animate-in">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-neutral-400" />
              <span className="font-semibold text-sm text-neutral-100">Study Session</span>
              <span className="text-xs text-neutral-500 font-mono ml-3">
                Card {currentIndex + 1} of {filteredCards.length}
              </span>
            </div>
            <button
              onClick={() => setIsStudyMode(false)}
              className="p-1.5 text-neutral-500 hover:text-neutral-100 hover:bg-neutral-900 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-900 h-1 mt-3 rounded-full overflow-hidden">
            <div
              className="bg-neutral-400 h-full transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / (filteredCards.length || 1)) * 100}%`,
              }}
            />
          </div>

          {/* Study Flashcard Center */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full max-w-2xl min-h-[380px] bg-neutral-900 border border-neutral-800 rounded-3xl p-10 flex flex-col justify-between cursor-pointer hover:border-neutral-600 shadow-3d-lg transition-all"
            >
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="uppercase font-mono">{currentCard?.card_type}</span>
                <span>{currentCard?.topic}</span>
              </div>

              <div className="my-auto text-center px-6">
                {isFlipped ? (
                  <div className="space-y-4">
                    <span className="text-xs uppercase text-neutral-400 font-bold tracking-wider">
                      Answer
                    </span>
                    <p className="text-xl text-neutral-100 leading-relaxed font-medium">
                      {currentCard?.answer}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <span className="text-xs uppercase text-neutral-500 font-bold tracking-wider">
                      Question
                    </span>
                    <h2 className="text-2xl font-semibold text-neutral-100 leading-relaxed">
                      {currentCard?.question}
                    </h2>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-neutral-500">
                Press Spacebar or Click to flip
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => handleRateCard('hard')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-semibold shadow-3d-sm"
            >
              Needs Review (Hard)
            </button>
            <button
              onClick={() => handleRateCard('easy')}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-semibold shadow-3d-sm"
            >
              Good (Easy)
            </button>
            <button
              onClick={() => handleRateCard('known')}
              className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-600 rounded-xl text-xs font-semibold shadow-3d-sm"
            >
              Mastered (Known)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
