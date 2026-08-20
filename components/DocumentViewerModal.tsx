'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  ZoomIn,
  ZoomOut,
  FileText,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import { DocumentRecord } from '@/lib/types';
import { SynapseLogo } from '@/components/brand/SynapseLogo';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRecord | null;
  targetPage?: number;
  highlightExcerpt?: string;
  onActionFromSelection?: (action: string, selectedText: string, docName: string, pageNum: number) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document,
  targetPage = 1,
  highlightExcerpt,
  onActionFromSelection,
}) => {
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [pages, setPages] = useState<{ pageNumber: number; text: string; sectionHeadings: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    if (isOpen && document) {
      fetchPages(document.id);
      setCurrentPage(targetPage || 1);
      setSelectedText('');
    }
  }, [isOpen, document, targetPage]);

  const fetchPages = async (docId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/content`);
      const data = await res.json();
      if (data.success && data.pages) {
        setPages(data.pages);
      }
    } catch (e) {
      console.error('Error fetching document pages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText('');
    }
  };

  if (!isOpen || !document) return null;

  const totalPages = pages.length > 0 ? pages.length : document.page_count || 1;
  const currentContent = pages.find((p) => p.pageNumber === currentPage)?.text || 'Loading page content...';

  // Highlight search or citation excerpt in text
  const renderHighlightedContent = (text: string) => {
    if (!searchTerm && !highlightExcerpt) {
      return text;
    }

    const termToHighlight = searchTerm || (highlightExcerpt ? highlightExcerpt.slice(0, 50) : '');
    if (!termToHighlight) return text;

    const regex = new RegExp(`(${termToHighlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm truncate max-w-md">
                {document.filename}
              </h3>
              <p className="text-[11px] text-slate-400">
                Format: {document.file_type.toUpperCase()} • {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search inside doc */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find in page..."
                className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36"
              />
            </div>

            {/* Font Zoom */}
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
              title="Decrease Font Size"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
              title="Increase Font Size"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Page Content Body */}
        <div
          onMouseUp={handleTextSelection}
          className="flex-1 overflow-y-auto p-8 bg-slate-950 font-serif leading-relaxed text-slate-200"
          style={{ fontSize: `${fontSize}px` }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Loading document content...
            </div>
          ) : (
            <div className="max-w-2xl mx-auto whitespace-pre-wrap select-text">
              {renderHighlightedContent(currentContent)}
            </div>
          )}
        </div>

        {/* AI Selection Floating Action Bar */}
        {selectedText && onActionFromSelection && (
          <div className="bg-neutral-900 border-t border-neutral-800 p-2.5 px-6 flex items-center justify-between animate-in slide-in-from-bottom-2 shadow-3d-lg">
            <div className="flex items-center gap-2 text-xs text-neutral-300 truncate max-w-sm">
              <SynapseLogo size="xs" />
              <span className="truncate">&ldquo;{selectedText.slice(0, 50)}...&rdquo;</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onActionFromSelection('cornell', selectedText, document.filename, currentPage)
                }
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg text-xs font-semibold border border-neutral-700 shadow-3d-sm"
              >
                + Cornell Note
              </button>
              <button
                onClick={() =>
                  onActionFromSelection('bullet', selectedText, document.filename, currentPage)
                }
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 shadow-3d-sm"
              >
                + Bullet Note
              </button>
              <button
                onClick={() =>
                  onActionFromSelection('simplify', selectedText, document.filename, currentPage)
                }
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 shadow-3d-sm"
              >
                Simplify Concept
              </button>
            </div>
          </div>
        )}

        {/* Pagination Navigation Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <span className="text-slate-100 font-semibold">{currentPage}</span> of{' '}
              <span className="text-slate-100 font-semibold">{totalPages}</span>
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Tip: Highlight text to create Cornell Notes or simplify concepts
          </div>
        </div>
      </div>
    </div>
  );
};
