'use client';

import React from 'react';
import { Clock, Trophy, Flame, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import { QuizAttemptRecord } from '@/lib/types';

interface QuizHistoryViewProps {
  attempts: QuizAttemptRecord[];
}

export const QuizHistoryView: React.FC<QuizHistoryViewProps> = ({ attempts = [] }) => {
  if (attempts.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
        No quiz history recorded yet. Complete a quiz to track accuracy trends and XP progress!
      </div>
    );
  }

  // Calculate improvement trend
  let improvementText = '';
  if (attempts.length >= 2) {
    const latest = attempts[0].accuracy_pct;
    const previous = attempts[1].accuracy_pct;
    const diff = Math.round(latest - previous);
    if (diff > 0) {
      improvementText = `+${diff}% improvement since previous attempt`;
    } else if (diff < 0) {
      improvementText = `${diff}% vs previous attempt`;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Quiz Gameplay History ({attempts.length})
        </h4>
        {improvementText && (
          <span className="text-[11px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            {improvementText}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {attempts.map((att) => {
          const dateStr = new Date(att.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={att.id}
              className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate">{att.title}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {dateStr}
                  </span>
                  <span>•</span>
                  <span>{att.total_questions} Questions</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1 text-amber-300 font-mono text-xs">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{att.max_streak} Streak</span>
                </div>

                <div className="flex items-center gap-1 text-indigo-300 font-mono text-xs">
                  <Trophy className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+{att.xp_earned} XP</span>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-lg font-bold font-mono text-xs border ${
                    att.accuracy_pct >= 80
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : att.accuracy_pct >= 60
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}
                >
                  {att.accuracy_pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
