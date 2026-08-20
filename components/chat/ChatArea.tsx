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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-12 py-6 space-y-6 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Banner if empty */}
        {messages.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <SynapseLogo size="xl" />
            <div className="space-y-1 max-w-md">
              <h2 className="text-lg font-black text-neutral-100 tracking-wider">SYNAPSE AI</h2>
              <p className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                RESEARCH • STUDY • INNOVATION
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed pt-2">
                Upload your research papers, playbooks, reports, or textbooks. Ask questions, conduct deep multi-stage research, or extract active-recall study aids on demand.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center pt-2 max-w-xl">
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
                  className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-full text-xs font-medium border border-neutral-800 hover:border-neutral-700 transition-all shadow-3d-sm active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const citations = parseCitations(msg.citations_json);
          const payload = parsePayload(msg.special_payload_json);

          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in`}
            >
              {!isUser && <SynapseLogo size="sm" />}

              <div
                className={`space-y-3 max-w-[92%] ${
                  isUser
                    ? 'bg-neutral-800 text-neutral-100 px-4 py-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed font-medium shadow-3d-sm'
                    : 'text-neutral-200 text-xs leading-relaxed space-y-3 bg-neutral-900/40 p-4 rounded-2xl border border-neutral-800/60 shadow-3d-sm'
                }`}
              >
                {/* Deep Research Evidence Badge */}
                {!isUser && payload?.type === 'research_analysis' && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-850 border border-neutral-700 text-[10px] font-mono text-neutral-300 mb-1">
                    <ShieldCheck className="w-3 h-3 text-neutral-400" />
                    <span>Multi-Stage Evidence Verified ({payload.evidenceCount || citations.length} Passages Analyzed)</span>
                  </div>
                )}

                {/* Rich Markdown & Interactive Citations */}
                {isUser ? (
                  <div className="whitespace-pre-wrap select-text">{msg.content}</div>
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
                  <div className="my-3 p-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-3d flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-800 bevel flex items-center justify-center text-neutral-300">
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-100">{payload.title || 'Quiz Ready'}</h4>
                        <p className="text-[11px] text-neutral-500">{payload.questions?.length || 5} questions</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onLaunchQuizMode(payload)}
                      className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-3d transition-all active:scale-95 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Quiz</span>
                    </button>
                  </div>
                )}

                {/* Citations Footer Bar */}
                {!isUser && citations.length > 0 && (
                  <div className="pt-2.5 border-t border-neutral-800/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 mr-1">
                      <ShieldCheck className="w-3 h-3 text-neutral-400" />
                      Sources:
                    </span>
                    {citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => onOpenCitation(c.document_name, c.page_number, c.excerpt)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded text-[10px] font-mono transition-colors shadow-3d-sm"
                        title={c.excerpt}
                      >
                        <FileText className="w-2.5 h-2.5 opacity-60" />
                        <span className="truncate max-w-[120px]">{c.document_name}</span>
                        <span className="text-neutral-400">p.{c.page_number}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {!isUser && (
                  <div className="flex items-center gap-3 pt-1 text-neutral-500 text-[10px]">
                    <button onClick={() => handleCopy(msg.id, msg.content)} className="hover:text-neutral-300 flex items-center gap-1 transition-colors">
                      {copiedId === msg.id ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-neutral-800 bevel flex items-center justify-center shrink-0 mt-0.5 text-neutral-400 text-xs font-mono font-bold shadow-3d-sm">
                  U
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-3.5 justify-start animate-in">
            <SynapseLogo size="sm" />
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2 shadow-3d-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-pulse" />
              <span>Analyzing document evidence &amp; compiling research dossier...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
