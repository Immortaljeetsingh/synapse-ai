'use client';

import React, { useState } from 'react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  GraduationCap,
  Bookmark,
  Check,
} from 'lucide-react';
import { FlashcardRecord } from '@/lib/types';

interface InlineFlashcardsProps {
  cards: FlashcardRecord[];
}

export const InlineFlashcards: React.FC<InlineFlashcardsProps> = ({ cards = [] }) => {
  const [deck, setDeck] = useState<FlashcardRecord[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (deck.length === 0) return null;

  const currentCard = deck[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % deck.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
  };

  return (
    <div className="my-4 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-xl w-full mx-auto shadow-3d space-y-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-neutral-400" />
          <span className="font-semibold text-neutral-200">Interactive Flashcard Deck</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShuffle}
            className="hover:text-neutral-200 p-1 transition-colors"
            title="Shuffle Deck"
          >
            <Shuffle className="w-3.5 h-3.5 text-neutral-600 hover:text-neutral-300" />
          </button>
          <span className="font-mono text-neutral-500">
            {currentIndex + 1} / {deck.length}
          </span>
        </div>
      </div>

      {/* 3D Flip Card */}
      <div
        onClick={() => setIsFlipped((prev) => !prev)}
        className="cursor-pointer min-h-[220px] p-6 bg-neutral-950 hover:bg-neutral-950/80 border border-neutral-800 hover:border-neutral-600 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-3d-sm group"
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono text-neutral-400 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">
            {currentCard.topic || 'General'}
          </span>
          <span className="text-neutral-600 group-hover:text-neutral-400 text-[10px] flex items-center gap-1">
            <RotateCw className="w-3 h-3" />
            <span>Click to flip</span>
          </span>
        </div>

        <div className="py-4 text-center">
          {!isFlipped ? (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                Question
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-neutral-100 leading-snug">
                {currentCard.question}
              </h4>
            </div>
          ) : (
            <div className="space-y-2 animate-in">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Answer
              </div>
              <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-normal">
                {currentCard.answer}
              </p>
            </div>
          )}
        </div>

        <div className="text-[10px] text-neutral-600 font-mono text-right">
          {currentCard.source_document ? `${currentCard.source_document} (p.${currentCard.page_number || 1})` : ''}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handlePrev}
          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center gap-1 text-xs font-medium shadow-3d-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <button
          onClick={() => setIsFlipped((prev) => !prev)}
          className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors shadow-3d-sm"
        >
          {isFlipped ? 'Show Question' : 'Reveal Answer'}
        </button>

        <button
          onClick={handleNext}
          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center gap-1 text-xs font-medium shadow-3d-sm"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
