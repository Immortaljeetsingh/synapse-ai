'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flame,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Volume2,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { QuizQuestionItem, QuizAnswerRecord, QuizConfig } from '@/lib/types';

interface QuizGameEngineProps {
  questions: QuizQuestionItem[];
  config: QuizConfig;
  title: string;
  onFinishQuiz: (results: {
    score: number;
    totalQuestions: number;
    correctCount: number;
    accuracyPct: number;
    xpEarned: number;
    maxStreak: number;
    timeSpentSeconds: number;
    answers: QuizAnswerRecord[];
  }) => void;
  onOpenCitationInViewer?: (docName: string, pageNum: number, excerpt: string) => void;
  onExitGame: () => void;
}

export const QuizGameEngine: React.FC<QuizGameEngineProps> = ({
  questions,
  config,
  title,
  onFinishQuiz,
  onOpenCitationInViewer,
  onExitGame,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Gamification Metrics
  const [score, setScore] = useState(0);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);

  // Time tracking
  const [timeLeft, setTimeLeft] = useState(config.timerSeconds || 0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Collected answers
  const [answersList, setAnswersList] = useState<QuizAnswerRecord[]>([]);

  const currentQ = questions[currentIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const advanceNext = useCallback(
    (
      currentAnswers: QuizAnswerRecord[],
      currentScore: number,
      currentXp: number,
      bestStreak: number
    ) => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((idx) => idx + 1);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setQuestionStartTime(Date.now());
      } else {
        // Quiz Complete
        const totalQ = questions.length;
        const correctCount = currentAnswers.filter((a) => a.is_correct).length;
        const accuracyPct = Math.round((correctCount / (totalQ || 1)) * 100);

        onFinishQuiz({
          score: currentScore,
          totalQuestions: totalQ,
          correctCount,
          accuracyPct,
          xpEarned: currentXp,
          maxStreak: bestStreak,
          timeSpentSeconds: totalTimeSpent,
          answers: currentAnswers,
        });
      }
    },
    [currentIndex, questions.length, onFinishQuiz, totalTimeSpent]
  );

  const evaluateAnswer = useCallback(
    (chosenOpt: string | null) => {
      if (timerRef.current) clearInterval(timerRef.current);

      const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

      // Strict grading: the server normalizes correct_answer to the exact
      // prefixed option string, so equality is the primary check. The letter
      // fallbacks only handle legacy rows stored before normalization.
      const correctAns = currentQ?.correct_answer?.trim() || '';
      const chosenTrim = chosenOpt ? chosenOpt.trim() : '';
      const stripPrefix = (s: string) => s.replace(/^[A-Fa-f]\)\s*/, '');
      const letterOf = (s: string) => (s.length > 1 && /^[A-Fa-f]\)/.test(s) ? s.charAt(0).toUpperCase() : '');

      const isMatch =
        chosenOpt !== null &&
        chosenTrim !== '' &&
        (chosenTrim === correctAns ||
          stripPrefix(chosenTrim).toLowerCase() === stripPrefix(correctAns).toLowerCase() ||
          (letterOf(chosenTrim) !== '' && letterOf(chosenTrim) === letterOf(correctAns)));

      setIsCorrect(isMatch);
      setIsAnswerSubmitted(true);

      // Calculate score
      let points = 0;
      let earnedXp = 0;
      let newStreak = streak;

      if (isMatch) {
        points = 100;
        if (currentQ?.difficulty === 'hard' || currentQ?.difficulty === 'expert') points += 50;

        // Speed bonus
        if (timeSpent < 10) points += 20;

        newStreak = streak + 1;
        const streakMultiplier = Math.min(newStreak, 5);
        points = Math.round(points * (1 + (streakMultiplier - 1) * 0.2));

        earnedXp = Math.round(points / 2);
        setPointsAwarded(points);
        setScore((s) => s + points);
        setXp((x) => x + earnedXp);
        setStreak(newStreak);
        if (newStreak > maxStreak) setMaxStreak(newStreak);
      } else {
        newStreak = 0;
        setStreak(0);
        setPointsAwarded(0);
      }

      const answerRecord: QuizAnswerRecord = {
        id: `ans_${Date.now()}_${currentIndex}`,
        question_id: currentQ?.id || `q_${currentIndex}`,
        selected_answer: chosenOpt || 'NO_ANSWER',
        is_correct: isMatch,
        points_awarded: points,
        time_spent_seconds: timeSpent,
        xp_awarded: earnedXp,
        streak_count: newStreak,
      };

      const updatedAnswers = [...answersList, answerRecord];
      setAnswersList(updatedAnswers);

      // If Exam mode, advance automatically without revealing answer
      if (config.mode === 'exam') {
        setTimeout(() => {
          advanceNext(updatedAnswers, score + points, xp + earnedXp, Math.max(maxStreak, newStreak));
        }, 350);
      }
    },
    [
      questionStartTime,
      currentQ,
      currentIndex,
      streak,
      maxStreak,
      answersList,
      config.mode,
      advanceNext,
      score,
      xp,
    ]
  );

  const handleTimeUp = useCallback(() => {
    evaluateAnswer(null);
  }, [evaluateAnswer]);

  const handleSubmitAnswer = useCallback(() => {
    if (!selectedOption || isAnswerSubmitted) return;
    evaluateAnswer(selectedOption);
  }, [selectedOption, isAnswerSubmitted, evaluateAnswer]);

  const handleNextQuestion = useCallback(() => {
    advanceNext(answersList, score, xp, maxStreak);
  }, [advanceNext, answersList, score, xp, maxStreak]);

  const handleSelectOption = (opt: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(opt);
  };

  // Question timer
  useEffect(() => {
    if (config.timerSeconds > 0 && !isAnswerSubmitted) {
      setTimeLeft(config.timerSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isAnswerSubmitted, config.timerSeconds, handleTimeUp]);

  // Overall session stopwatch
  useEffect(() => {
    const sessionTimer = setInterval(() => {
      setTotalTimeSpent((s) => s + 1);
    }, 1000);
    return () => clearInterval(sessionTimer);
  }, []);

  // Keyboard shortcut listener (1-4 or A-D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswerSubmitted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const idx = key.charCodeAt(0) - 65;
        if (currentQ?.options[idx]) {
          setSelectedOption(currentQ.options[idx]);
        }
      } else if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        if (currentQ?.options[idx]) {
          setSelectedOption(currentQ.options[idx]);
        }
      } else if (e.key === 'Enter' && selectedOption) {
        handleSubmitAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOption, isAnswerSubmitted, currentQ, handleNextQuestion, handleSubmitAnswer]);


  if (!currentQ) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col justify-between overflow-hidden select-none animate-in fade-in">
      {/* Top Game Bar */}
      <div className="px-8 py-4 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onExitGame}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl border border-neutral-700 shadow-3d-sm transition-colors"
          >
            &larr; Exit Quiz
          </button>
          <div>
            <h2 className="text-sm font-bold text-neutral-100 truncate max-w-sm">{title}</h2>
            <div className="text-[11px] text-neutral-500 font-mono">
              Question {currentIndex + 1} of {questions.length} • {currentQ.topic}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Streak Flame */}
          {config.enableStreaks && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono transition-all shadow-3d-sm ${
                streak > 0
                  ? 'bg-neutral-800 text-amber-300 border border-amber-500/40 animate-pulse'
                  : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
              }`}
            >
              <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-400 fill-amber-400' : 'text-neutral-600'}`} />
              <span>{streak} Streak</span>
            </div>
          )}

          {/* XP Ticker */}
          {config.enableXp && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 shadow-3d-sm text-xs font-bold font-mono">
              <Award className="w-3.5 h-3.5 text-neutral-300" />
              <span>{xp} XP</span>
            </div>
          )}

          {/* Countdown Timer */}
          {config.timerSeconds > 0 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-3d-sm ${
                timeLeft <= 10
                  ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-bounce'
                  : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-900 h-1.5">
        <div
          className="bg-neutral-400 h-full transition-all duration-300 shadow-sm"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Main Question Card Area */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-3xl space-y-6">
          {/* Question Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-3d-lg space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="uppercase font-mono font-semibold px-2.5 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800">
                {currentQ.question_type.replace('_', ' ')}
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg border ${
                  currentQ.difficulty === 'hard' || currentQ.difficulty === 'expert'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                    : currentQ.difficulty === 'medium'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                }`}
              >
                {currentQ.difficulty}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-neutral-100 leading-snug">
              {currentQ.question}
            </h3>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const optionLetter = String.fromCharCode(65 + idx);

              let cardStyle =
                'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-850 shadow-3d-sm';

              if (isAnswerSubmitted && config.mode !== 'exam') {
                if (option === currentQ.correct_answer || option.includes(currentQ.correct_answer)) {
                  cardStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-100 font-semibold shadow-3d-sm';
                } else if (isSelected) {
                  cardStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 line-through opacity-80 shadow-3d-sm';
                } else {
                  cardStyle = 'bg-neutral-950 border-neutral-900 text-neutral-600 opacity-40';
                }
              } else if (isSelected) {
                cardStyle = 'bg-neutral-800 border-neutral-500 text-white font-medium shadow-3d-sm';
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectOption(option)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 active:scale-[0.99] ${cardStyle}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 border shadow-3d-sm ${
                        isSelected
                          ? 'bg-neutral-700 text-white border-neutral-500'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {optionLetter}
                    </span>
                    <span className="text-sm leading-relaxed">{option.replace(/^[A-D]\)\s*/, '')}</span>
                  </div>

                  {isAnswerSubmitted && config.mode !== 'exam' && (
                    <div>
                      {(option === currentQ.correct_answer || option.includes(currentQ.correct_answer)) && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      )}
                      {isSelected && option !== currentQ.correct_answer && !option.includes(currentQ.correct_answer) && (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit Answer Button */}
          {!isAnswerSubmitted && (
            <div className="flex justify-end pt-2">
              <button
                disabled={!selectedOption}
                onClick={handleSubmitAnswer}
                className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-white rounded-2xl text-sm font-bold transition-all shadow-3d-sm border border-neutral-700 flex items-center gap-2 active:scale-95"
              >
                <span>Submit Answer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Post-Answer Feedback Overlay (Practice Mode) */}
          {isAnswerSubmitted && config.mode !== 'exam' && (
            <div
              className={`p-6 rounded-3xl border space-y-4 animate-in slide-in-from-bottom-3 duration-200 shadow-3d-lg ${
                isCorrect
                  ? 'bg-emerald-950/40 border-emerald-800/80'
                  : 'bg-rose-950/40 border-rose-800/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Correct! +{pointsAwarded} Points</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <XCircle className="w-5 h-5" />
                      <span>Not quite</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-colors shadow-3d-sm border border-neutral-700 flex items-center gap-2"
                >
                  <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'View Results'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Correct Answer Explanation */}
              <div className="text-xs text-neutral-300 space-y-2 pt-2 border-t border-neutral-800/80">
                <p className="leading-relaxed">
                  <span className="font-semibold text-neutral-100">Why? </span>
                  {currentQ.explanation}
                </p>

                {/* Source Citation */}
                {currentQ.source_document && (
                  <div className="flex items-center justify-between pt-2 text-[11px] text-neutral-500 font-mono">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      Source: {currentQ.source_document} (Page {currentQ.page_number || 1})
                    </span>
                    {onOpenCitationInViewer && (
                      <button
                        onClick={() =>
                          onOpenCitationInViewer(
                            currentQ.source_document!,
                            currentQ.page_number || 1,
                            currentQ.explanation
                          )
                        }
                        className="text-neutral-300 hover:text-white flex items-center gap-1 font-sans text-xs underline"
                      >
                        <span>Open Page in Viewer</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 text-center text-[11px] text-neutral-600 border-t border-neutral-900 bg-neutral-950 font-mono">
        Keys <kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400">1-4</kbd> or{' '}
        <kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400">A-D</kbd> to select,{' '}
        <kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400">Enter</kbd> to submit
      </div>
    </div>
  );
};
