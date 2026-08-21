'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, StickyNote, GraduationCap, ArrowRight } from 'lucide-react';

interface SearchResultItem {
  type: 'chunk' | 'note' | 'flashcard';
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  metadata?: any;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string | null;
  onSelectResult: (result: SearchResultItem) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  notebookId,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // ESC closes the modal (the footer advertises it)
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || !notebookId) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search?notebookId=${notebookId}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (data.success) {
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('Search error:', e);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    // Abort the in-flight request when query changes/unmounts — a slow stale
    // response used to overwrite results for the newer query.
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, notebookId]);

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'chunk':
        return <FileText className="w-4 h-4 text-neutral-400" />;
      case 'note':
        return <StickyNote className="w-4 h-4 text-neutral-300" />;
      case 'flashcard':
        return <GraduationCap className="w-4 h-4 text-neutral-200" />;
      default:
        return <Search className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/85 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-3d-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Search Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across documents, passages, notes, and flashcards..."
            className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {isLoading && (
            <div className="p-6 text-center text-xs text-slate-500">Searching notebook...</div>
          )}

          {!isLoading && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching passages, notes, or flashcards found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!isLoading && !query.trim() && (
            <div className="p-6 text-center text-xs text-slate-500">
              Type a keyword, concept, or term to search across all uploaded knowledge.
            </div>
          )}

          {results.map((item) => (
            <div
              key={`${item.type}_${item.id}`}
              onClick={() => {
                onSelectResult(item);
                onClose();
              }}
              className="p-3 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors group flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">{getIcon(item.type)}</div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {item.snippet}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between px-4">
          <span>Click any item to jump to source passage or note</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
