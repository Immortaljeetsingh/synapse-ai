'use client';

import React, { useState } from 'react';
import {
  Columns,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { DocumentComparisonMatrix } from '@/lib/types';

interface CompareTabProps {
  comparison: DocumentComparisonMatrix | null;
  onRegenerate: () => Promise<void>;
  isLoading?: boolean;
}

export const CompareTab: React.FC<CompareTabProps> = ({
  comparison,
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

  if (!comparison) {
    return (
      <div className="p-16 text-center max-w-md mx-auto select-none">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center mx-auto mb-4">
          <Columns className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-neutral-100 mb-1">No Comparison Matrix Available</h3>
        <p className="text-xs text-neutral-500 mb-6">
          Upload 2 or more documents into this notebook to cross-compare methodologies, detect contradictions, and synthesize findings.
        </p>
        <button
          onClick={handleRegen}
          disabled={isRegenerating}
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-medium inline-flex items-center gap-2 shadow-3d-sm transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>Generate Comparison Matrix</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Top Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-3d">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-800 bevel text-neutral-400 flex items-center justify-center">
              <Columns className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                {comparison.comparison_topic || 'Multi-Document Comparison Matrix'}
              </h2>
              <p className="text-xs text-neutral-500">Cross-source synthesis &amp; contradiction analysis</p>
            </div>
          </div>

          <button
            onClick={handleRegen}
            disabled={isRegenerating}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl text-xs flex items-center gap-1.5 border border-neutral-800 disabled:opacity-50 shadow-3d-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>
        </div>

        {comparison.synthesis && (
          <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-4 rounded-xl border border-neutral-800 shadow-3d-sm select-text">
            <span className="font-semibold text-neutral-200 block mb-1">Overarching Synthesis:</span>
            {comparison.synthesis}
          </div>
        )}
      </div>

      {/* Document Viewpoints Grid */}
      {comparison.documents && comparison.documents.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-400" />
            Document Viewpoints &amp; Perspectives
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comparison.documents.map((doc, idx) => (
              <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3 shadow-3d">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-100">{doc.document_name}</h4>
                  {doc.citations && doc.citations.length > 0 && (
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {doc.citations.join(', ')}
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-300 font-medium">{doc.viewpoint}</div>

                {doc.key_findings && doc.key_findings.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-neutral-800">
                    <span className="text-[10px] uppercase font-semibold text-neutral-500">
                      Key Assertions:
                    </span>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {doc.key_findings.map((f, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <span className="text-neutral-500 font-bold">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agreements & Contradictions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Agreements */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-3 shadow-3d">
          <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Points of Agreement / Consensus
          </h3>
          <ul className="space-y-2 text-xs text-neutral-200 select-text">
            {(comparison.agreements || []).map((agr, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                <span>{agr}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contradictions / Divergences */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-3 shadow-3d">
          <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Points of Divergence / Discrepancies
          </h3>
          <ul className="space-y-2 text-xs text-neutral-200 select-text">
            {(comparison.contradictions || []).map((ctr, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold mt-0.5">⚠</span>
                <span>{ctr}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
