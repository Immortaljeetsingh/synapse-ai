'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Tag,
  BookOpen,
  TrendingUp,
  HelpCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import {
  OverviewArtifact,
  TopicItem,
  ConceptItem,
  EntityItem,
  NumberStatisticItem,
  TimelineEvent,
  ActionItem,
} from '@/lib/types';
import { SynapseLogo } from '@/components/brand/SynapseLogo';

interface OverviewTabProps {
  overview: OverviewArtifact | null;
  topics: TopicItem[];
  concepts: ConceptItem[];
  entities: EntityItem[];
  numbers: NumberStatisticItem[];
  timeline: TimelineEvent[];
  actionItems: ActionItem[];
  isLoading?: boolean;
  onAskQuestion: (question: string) => void;
  onRegenerate: (type: string) => Promise<void>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  overview,
  topics = [],
  concepts = [],
  entities = [],
  numbers = [],
  timeline = [],
  actionItems = [],
  isLoading = false,
  onAskQuestion,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopySummary = () => {
    if (overview?.executive_summary) {
      navigator.clipboard.writeText(overview.executive_summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegen = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate('overview');
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-44 bg-neutral-900 rounded-2xl shadow-3d-sm"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-neutral-900 rounded-2xl shadow-3d-sm"></div>
          <div className="h-64 bg-neutral-900 rounded-2xl shadow-3d-sm"></div>
        </div>
      </div>
    );
  }

  if (!overview && topics.length === 0 && concepts.length === 0) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="flex justify-center mb-2">
          <SynapseLogo size="lg" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-neutral-100">Document Overview &amp; Taxonomy</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Extract executive briefings, key takeaways, topic taxonomies, and core technical concepts from your uploaded documents.
          </p>
        </div>
        <button
          onClick={handleRegen}
          disabled={isRegenerating}
          className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-3d-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>{isRegenerating ? 'Analyzing Documents...' : 'Generate Full Document Overview'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Executive Summary Card */}
      {overview && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-3d space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-300 text-xs font-bold uppercase tracking-wider">
              <SynapseLogo size="xs" />
              <span>Executive Briefing</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySummary}
                className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-xl transition-colors shadow-3d-sm"
                title="Copy Executive Summary"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleRegen}
                disabled={isRegenerating}
                className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-xl transition-colors disabled:opacity-50 shadow-3d-sm"
                title="Regenerate Overview"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          {overview.one_sentence_summary && (
            <p className="text-sm font-medium text-neutral-200 italic border-l-2 border-neutral-500 pl-3 leading-relaxed">
              &ldquo;{overview.one_sentence_summary}&rdquo;
            </p>
          )}

          <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line space-y-3 font-normal select-text">
            {overview.executive_summary}
          </div>
        </div>
      )}

      {/* Key Takeaways */}
      {overview?.key_takeaways && overview.key_takeaways.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-3d">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-neutral-400" />
            Key Takeaways
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview.key_takeaways.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 leading-relaxed shadow-3d-sm"
              >
                <span className="w-5 h-5 rounded-md bg-neutral-850 text-neutral-300 border border-neutral-700 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Topics */}
      {topics.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-neutral-500" />
            Main Topics &amp; Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <div
                key={t.id || t.name}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs flex items-center gap-2 hover:bg-neutral-850 transition-colors shadow-3d-sm"
              >
                <span className="font-medium">{t.name}</span>
                {t.relevance && (
                  <span className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded-md font-mono">
                    {t.relevance}/10
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important Concepts */}
      {concepts.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-neutral-500" />
            Important Concepts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {concepts.map((c, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors space-y-2 shadow-3d"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-100">{c.concept}</h4>
                  {c.source_document && (
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {c.source_document}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-200 font-medium">{c.definition}</p>
                <p className="text-xs text-neutral-400 leading-relaxed">{c.explanation}</p>
                {c.related_concepts && c.related_concepts.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1">
                    {c.related_concepts.map((rc, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded text-neutral-400 border border-neutral-800 font-mono"
                      >
                        {rc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Numbers & Statistics */}
      {numbers.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neutral-500" />
            Important Metrics &amp; Quantitative Data
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {numbers.map((n, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1 shadow-3d-sm"
              >
                <div className="text-base font-bold text-neutral-100 font-mono">{n.figure}</div>
                <div className="text-xs font-medium text-neutral-300">{n.description}</div>
                <p className="text-[11px] text-neutral-500 line-clamp-2">{n.context}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {overview?.suggested_questions && overview.suggested_questions.length > 0 && (
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-3d">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-neutral-400" />
            Suggested Research Questions (Click to Ask AI)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {overview.suggested_questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onAskQuestion(q)}
                className="text-left p-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 hover:text-neutral-100 transition-all flex items-center justify-between gap-2 shadow-3d-sm"
              >
                <span>&rarr; {q}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
