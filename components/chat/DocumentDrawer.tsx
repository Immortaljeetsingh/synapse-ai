'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { DocumentRecord } from '@/lib/types';

interface DocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRecord | null;
  targetPage: number;
  highlightExcerpt: string;
}

export const DocumentDrawer: React.FC<DocumentDrawerProps> = ({
  isOpen,
  onClose,
  document,
  targetPage = 1,
  highlightExcerpt = '',
}) => {
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [pagesContent, setPagesContent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setCurrentPage(targetPage || 1);
  }, [targetPage]);

  useEffect(() => {
    if (document?.id && isOpen) {
      loadContent(document.id);
    }
  }, [document?.id, isOpen]);

  const loadContent = async (docId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/content`);
      const data = await res.json();
      if (data.success && data.pages) {
        setPagesContent(data.pages.map((p: any) => p.text));
      }
    } catch (e) {
      console.error('Error loading drawer document content:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !document) return null;

  const totalPages = pagesContent.length || document.page_count || 1;
  const currentText = pagesContent[currentPage - 1] || 'No extracted text available for this page.';

  // Highlight search term or citation excerpt in text
  const renderHighlightedText = (text: string) => {
    let query = searchTerm.trim();
    if (!query && highlightExcerpt) {
      query = highlightExcerpt.slice(0, 40).trim();
    }

    if (!query) return text;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-neutral-700 text-neutral-100 px-1 py-0.5 rounded font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-neutral-900 border-l border-neutral-800 shadow-3d-lg flex flex-col justify-between animate-in select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-neutral-100 text-xs truncate">{document.filename}</h3>
            <span className="text-[10px] text-neutral-500 font-mono">
              {totalPages} pages • {document.file_type.toUpperCase()}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Navigation Bar */}
      <div className="p-3 border-b border-neutral-800/80 bg-neutral-950 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-neutral-600 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search inside document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1 shrink-0 text-xs">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 shadow-3d-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-neutral-500 px-1">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 shadow-3d-sm"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page Content Display */}
      <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 text-neutral-300 text-xs leading-relaxed font-sans whitespace-pre-wrap select-text">
        {isLoading ? (
          <div className="text-center py-12 text-neutral-600 animate-pulse">
            Loading document content...
          </div>
        ) : (
          renderHighlightedText(currentText)
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between bg-neutral-950">
        <span>Grounded passage source</span>
        <span className="font-mono">Page {currentPage}</span>
      </div>
    </div>
  );
};
