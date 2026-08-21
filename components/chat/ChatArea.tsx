'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  Gamepad2,
  Play,
  Layers,
  ShieldCheck,
  Search,
  Sparkles,
} from 'lucide-react';
import { ChatMessageRecord, DocumentRecord, CitationReference } from '@/lib/types';
import { InlineFlashcards } from './InlineFlashcards';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SynapseLogo } from '@/components/brand/SynapseLogo';

interface ChatAreaProps {
  messages: ChatMessageRecord[];
  activeDocuments: DocumentRecord[];
  isLoading: boolean;
  onSendMessage: (msg: string) => void;
  onOpenCitation: (docName: string, pageNumber: number, excerpt: string) => void;
  onLaunchQuizMode: (quizData?: any) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  activeDocuments,
  isLoading,
  onSendMessage,
  onOpenCitation,
  onLaunchQuizMode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const isFirstRenderRef = useRef(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isFirstRenderRef.current || isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    isFirstRenderRef.current = false;
  }, [messages, isLoading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const parseCitations = (json?: string): CitationReference[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const parsePayload = (json?: string): any => {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-12 py-6 space-y-6 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Banner if empty */}
        {messages.length === 0 && (
          <div className="py-10 sm:py-16 flex flex-col items-center justify-center text-center space-y-4 px-2">
            <SynapseLogo size="xl" />
            <div className="space-y-1 max-w-md">
              <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-wider">
                SYNAPSE AI
              </h2>
              <p className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                RESEARCH • STUDY • INNOVATION
              </p>
              <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed pt-2">
                {activeDocuments.length > 0
                  ? 'Your documents are indexed and ready. Ask factual questions, generate structured notes, or launch a practice quiz.'
                  : 'Upload a research paper, playbook, or textbook to start asking grounded questions.'}
              </p>
            </div>

            {/* On-Demand Quick Starters */}
            <div className="flex flex-wrap gap-2 justify-center pt-3 max-w-xl">
              {[
                { label: 'Detailed Research Notes', prompt: 'Provide detailed notes and comprehensive benchmarking on the partnership management process.' },
                { label: 'Process & Decision Gates', prompt: 'Map the full lifecycle stages, decision gates, and RACI roles from the uploaded documents.' },
                { label: 'Quality & Error Audit', prompt: 'Perform a forensic quality audit on the document to identify errors, discrepancies, and gaps.' },
                { label: 'Make Flashcards', prompt: 'Make 10 flashcards from this document.' },
                { label: 'Quiz Me', prompt: 'Quiz me on this PDF with multiple-choice questions.' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => onSendMessage(chip.prompt)}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-full text-xs font-medium border border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 transition-all shadow-3d-sm active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const citations = parseCitations(msg.citations_json);
          const payload = parsePayload(msg.special_payload_json);

          return (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in`}
            >
              {!isUser && <SynapseLogo size="sm" className="hidden sm:flex" />}

              <div
                className={`space-y-3 max-w-[96%] sm:max-w-[90%] ${
                  isUser
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-3 rounded-2xl rounded-tr-sm text-xs sm:text-[13px] leading-relaxed font-medium shadow-3d-sm'
                    : 'text-neutral-800 dark:text-neutral-200 text-xs sm:text-[13px] leading-relaxed space-y-3 bg-neutral-50/70 dark:bg-neutral-900/40 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/60 shadow-3d-sm'
                }`}
              >
                {/* Deep Research Evidence Badge */}
                {!isUser && payload?.type === 'research_analysis' && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-200/80 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 text-[10px] font-mono text-neutral-800 dark:text-neutral-300 mb-1">
                    <ShieldCheck className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                    <span>Multi-Stage Evidence Verified ({payload.evidenceCount || citations.length} Passages Analyzed)</span>
                  </div>
                )}

                {/* Grounding Mode Badges */}
                {!isUser && msg.grounding_type === 'ai_interpretation' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>General AI knowledge — not from your documents</span>
                  </div>
                )}
                {!isUser && msg.grounding_type === 'not_in_document' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30 text-[10px] font-medium">
                    <Search className="w-3 h-3" />
                    <span>Not found in your documents</span>
                  </div>
                )}

                {/* Rich Markdown & Interactive Citations */}
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-text">{msg.content}</div>
                ) : (
                  <MarkdownRenderer
                    content={msg.content}
                    onOpenCitation={onOpenCitation}
                  />
                )}

                {/* Inline Flashcards */}
                {!isUser && payload?.type === 'flashcards' && payload.cards && (
                  <InlineFlashcards cards={payload.cards} />
                )}

                {/* Inline Quiz Launcher */}
                {!isUser && payload?.type === 'quiz_ready' && (
                  <div className="my-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-3d flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 bevel flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{payload.title || 'Quiz Ready'}</h4>
                        <p className="text-[11px] text-neutral-500">{payload.questions?.length || 5} questions</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onLaunchQuizMode(payload)}
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-3d-sm active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Quiz</span>
                    </button>
                  </div>
                )}

                {/* Assistant Message Footer: Citations & Copy */}
                {!isUser && (
                  <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
                    <div className="flex items-center gap-2">
                      {citations.length > 0 && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-neutral-400" />
                          <span>{citations.length} Grounded Source{citations.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1 rounded-md hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Generation Indicator */}
        {isLoading && (
          <div className="flex gap-3 sm:gap-3.5 justify-start animate-in">
            <SynapseLogo size="sm" className="hidden sm:flex" />
            <div className="p-4 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800/60 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Synthesizing document intelligence...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
