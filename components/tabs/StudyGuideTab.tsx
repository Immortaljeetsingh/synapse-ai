'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  Download,
  RefreshCw,
  HelpCircle,
  Award,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import { StudyGuideArtifact } from '@/lib/types';

interface StudyGuideTabProps {
  studyGuide: StudyGuideArtifact | null;
  onRegenerate: () => Promise<void>;
  isLoading?: boolean;
}

export const StudyGuideTab: React.FC<StudyGuideTabProps> = ({
  studyGuide,
  onRegenerate,
  isLoading = false,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegen = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (studyGuide) {
      let md = `# ${studyGuide.title}\n\n${studyGuide.overview}\n\n`;
      for (const s of studyGuide.sections || []) {
        md += `## ${s.title}\n\n${s.summary}\n\n`;
        if (s.key_concepts?.length) {
          md += `### Key Concepts\n`;
          s.key_concepts.forEach((kc) => {
            md += `- **${kc.concept}**: ${kc.explanation}\n`;
          });
          md += `\n`;
        }
        if (s.exam_focus_points?.length) {
          md += `### Exam Focus Points\n`;
          s.exam_focus_points.forEach((efp) => {
            md += `- ${efp}\n`;
          });
          md += `\n`;
        }
      }
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Study_Guide_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-40 bg-neutral-900 rounded-2xl shadow-3d-sm"></div>
        <div className="h-64 bg-neutral-900 rounded-2xl shadow-3d-sm"></div>
      </div>
    );
  }

  if (!studyGuide) {
    return (
      <div className="p-16 text-center max-w-md mx-auto select-none">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-neutral-100 mb-1">No Study Guide Generated</h3>
        <p className="text-xs text-neutral-500 mb-6">
          Upload documents to create a structured curriculum and exam review guide from your materials.
        </p>
        <button
          onClick={handleRegen}
          disabled={isRegenerating}
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-medium inline-flex items-center gap-2 shadow-3d-sm transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>Generate Study Guide Now</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto select-none">
      {/* Top Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-3d">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">{studyGuide.title}</h2>
              <p className="text-xs text-neutral-500">Comprehensive Knowledge Synthesis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 shadow-3d-sm"
              title="Print Study Guide"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleExport}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 shadow-3d-sm"
              title="Export Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={handleRegen}
              disabled={isRegenerating}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 disabled:opacity-50 shadow-3d-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed select-text">{studyGuide.overview}</p>
      </div>

      {/* Structured Sections */}
      <div className="space-y-6">
        {(studyGuide.sections || []).map((sec, idx) => (
          <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-3d">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <h3 className="text-sm font-semibold text-neutral-100">{sec.title}</h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 shadow-3d-sm select-text">
              {sec.summary}
            </p>

            {/* Key Concepts */}
            {sec.key_concepts && sec.key_concepts.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-neutral-400" />
                  Key Concepts &amp; Explanations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sec.key_concepts.map((kc, kIdx) => (
                    <div
                      key={kIdx}
                      className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1 shadow-3d-sm"
                    >
                      <div className="font-semibold text-neutral-200">{kc.concept}</div>
                      <div className="text-neutral-400 leading-relaxed">{kc.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exam Focus Points */}
            {sec.exam_focus_points && sec.exam_focus_points.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-neutral-400" />
                  Exam &amp; Assessment Focus Points
                </h4>
                <div className="space-y-1.5">
                  {sec.exam_focus_points.map((efp, eIdx) => (
                    <div
                      key={eIdx}
                      className="flex items-start gap-2 text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 p-2.5 rounded-xl shadow-3d-sm"
                    >
                      <span className="text-neutral-400 font-bold">•</span>
                      <span>{efp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common Questions */}
            {sec.common_questions && sec.common_questions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
                  Common Test Questions &amp; Grounded Answers
                </h4>
                <div className="space-y-2">
                  {sec.common_questions.map((cq, qIdx) => (
                    <div key={qIdx} className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs space-y-1 shadow-3d-sm">
                      <div className="font-semibold text-neutral-200">Q: {cq.question}</div>
                      <div className="text-neutral-400">A: {cq.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Review Sheet */}
      {studyGuide.quick_review_sheet && studyGuide.quick_review_sheet.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-3d">
          <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-neutral-400" />
            Quick Review Sheet (Rapid Recall)
          </h3>
          <ul className="space-y-2 text-xs text-neutral-200 select-text">
            {studyGuide.quick_review_sheet.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-neutral-400 font-bold mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
