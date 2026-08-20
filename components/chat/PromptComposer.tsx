'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Paperclip,
  BrainCircuit,
  LayoutGrid,
  FileText,
  Gamepad2,
  BookOpen,
  StickyNote,
  Columns,
  GraduationCap,
  Loader2,
  PanelRightOpen,
} from 'lucide-react';
import { DocumentRecord } from '@/lib/types';
import { CompanionTab } from '@/components/companion/RightCompanionSidebar';

interface PromptComposerProps {
  onSendMessage: (message: string) => void;
  onUploadFiles: (files: FileList) => void;
  isLoading: boolean;
  activeDocuments: DocumentRecord[];
  onOpenCompanionTab: (tab: CompanionTab) => void;
  isUploading?: boolean;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSendMessage,
  onUploadFiles,
  isLoading,
  activeDocuments = [],
  onOpenCompanionTab,
  isUploading = false,
}) => {
  const [input, setInput] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  // Close tools menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 pt-2">
      {/* Active Source Pill Banner */}
      {activeDocuments.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {activeDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onOpenCompanionTab('sources')}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-neutral-300 dark:border-neutral-800 rounded-full transition-colors shrink-0 group"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
                <span className="font-medium truncate max-w-[160px] sm:max-w-[220px]">{doc.filename}</span>
                <span className="text-[10px] text-neutral-500 font-mono">({doc.page_count || 1}p)</span>
              </button>
            ))}

            {isUploading && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-full text-neutral-600 dark:text-neutral-400 text-[11px] animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Indexing document...</span>
              </div>
            )}
          </div>

          {/* Tools Panel Toggle */}
          <button
            onClick={() => onOpenCompanionTab('overview')}
            className="text-[11px] text-neutral-600 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-800 transition-colors shrink-0 font-medium"
            title="Open Tools Panel"
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tools Panel</span>
          </button>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 focus-within:border-neutral-500 dark:focus-within:border-neutral-600 rounded-3xl p-2.5 sm:p-3 shadow-3d transition-all">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadFiles(e.target.files);
            }
          }}
        />

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            activeDocuments.length > 0
              ? 'Ask anything about your uploaded documents...'
              : 'Ask anything or upload a document to get started...'
          }
          rows={1}
          className="w-full bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 text-xs sm:text-sm resize-none focus:outline-none px-2 py-1 leading-relaxed max-h-[180px]"
        />

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800/60 mt-1">
          <div className="flex items-center gap-1">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Attach PDF or Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Tools Dropdown Button */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isToolsOpen
                    ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Tools</span>
              </button>

              {/* Tools Popup Menu */}
              {isToolsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-3d-lg space-y-0.5 z-50 animate-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500 uppercase tracking-wider">
                    On-Demand Tools
                  </div>

                  <button
                    onClick={() => { onOpenCompanionTab('overview'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Document Overview</span>
                  </button>

                  <button
                    onClick={() => { onOpenCompanionTab('notes'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Research Notes</span>
                  </button>

                  <button
                    onClick={() => { onOpenCompanionTab('flashcards'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Flashcards Deck</span>
                  </button>

                  <button
                    onClick={() => { onOpenCompanionTab('quiz'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <Gamepad2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Quiz &amp; Exam Arena</span>
                  </button>

                  <button
                    onClick={() => { onOpenCompanionTab('study_guide'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Study Guide &amp; Syllabus</span>
                  </button>

                  <button
                    onClick={() => { onOpenCompanionTab('compare'); setIsToolsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded-xl flex items-center gap-2.5 transition-colors"
                  >
                    <Columns className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Compare Documents</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            type="button"
            disabled={!input.trim() || isLoading}
            onClick={handleSend}
            className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-700 hover:bg-neutral-800 dark:hover:bg-neutral-600 disabled:opacity-30 text-white flex items-center justify-center transition-all shadow-3d-sm active:scale-95 shrink-0"
            title="Send Message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
