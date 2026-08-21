'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  Layers,
  LayoutGrid,
  StickyNote,
  GraduationCap,
  Gamepad2,
  BookOpen,
  Columns,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  DocumentRecord,
  NoteRecord,
  FlashcardRecord,
  QuizAttemptRecord,
  TopicPerformanceRecord,
  ReviewStatus,
  NoteFormatType,
  QuizConfig,
} from '@/lib/types';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { NotesTab } from '@/components/tabs/NotesTab';
import { FlashcardsTab } from '@/components/tabs/FlashcardsTab';
import { StudyGuideTab } from '@/components/tabs/StudyGuideTab';
import { QuizTab } from '@/components/tabs/QuizTab';
import { CompareTab } from '@/components/tabs/CompareTab';
import { SourcesTab } from '@/components/tabs/SourcesTab';

export type CompanionTab =
  | 'overview'
  | 'notes'
  | 'flashcards'
  | 'quiz'
  | 'study_guide'
  | 'compare'
  | 'sources';

interface RightCompanionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: CompanionTab;
  onSelectTab: (tab: CompanionTab) => void;
  // Data
  documents: DocumentRecord[];
  artifacts: Record<string, any>;
  notes: NoteRecord[];
  flashcards: FlashcardRecord[];
  quizAttempts: QuizAttemptRecord[];
  topicPerformance: TopicPerformanceRecord[];
  weakTopics: string[];
  // Handlers
  onAskQuestion: (q: string) => void;
  onRegenerateArtifact: (type: string) => Promise<void>;
  onCreateNote: (note: { title: string; content: string; format_type: NoteFormatType }) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<NoteRecord>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onUpdateFlashcardStatus: (id: string, status: ReviewStatus) => Promise<void>;
  onStartQuizConfig: (config: QuizConfig) => Promise<void>;
  onUploadFiles: (files: FileList) => Promise<void>;
  onGenerateDeepNotes?: () => Promise<void>;
  onReprocessDocument: (docId: string) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onOpenViewer: (doc: DocumentRecord) => void;
  isUploading?: boolean;
}

export const RightCompanionSidebar: React.FC<RightCompanionSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  documents,
  artifacts,
  notes,
  flashcards,
  quizAttempts,
  topicPerformance,
  weakTopics,
  onAskQuestion,
  onRegenerateArtifact,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onGenerateDeepNotes,
  onUpdateFlashcardStatus,
  onStartQuizConfig,
  onUploadFiles,
  onReprocessDocument,
  onDeleteDocument,
  onOpenViewer,
  isUploading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [generatingTypes, setGeneratingTypes] = useState<Set<string>>(new Set());

  // Track per-artifact generation so tabs can show their skeleton states
  const handleRegenerate = async (type: string) => {
    setGeneratingTypes((prev) => new Set(prev).add(type));
    try {
      await onRegenerateArtifact(type);
    } finally {
      setGeneratingTypes((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const tabButtons: { id: CompanionTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'flashcards', label: 'Flashcards', icon: GraduationCap },
    { id: 'quiz', label: 'Quiz Mode', icon: Gamepad2 },
    { id: 'study_guide', label: 'Study Guide', icon: BookOpen },
    { id: 'compare', label: 'Compare', icon: Columns },
    { id: 'sources', label: 'Sources', icon: FileText },
  ];

  return (
    <div
      className={`fixed inset-0 z-40 md:relative md:z-30 h-screen app-h border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col transition-all duration-300 select-none shrink-0 md:max-w-[calc(100vw-18rem)] ${
        isExpanded ? 'w-full md:w-[680px] lg:w-[760px]' : 'w-full md:w-[440px] lg:w-[500px]'
      }`}
    >
      {/* Top Header Bar with Tab Strip */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 glass flex items-center justify-between gap-2">
        {/* Scrollable Tab Strip */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
          {tabButtons.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                  isActive
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-3d-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-600'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="hidden md:inline-flex p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={isExpanded ? 'Collapse Width' : 'Expand Width'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tab Viewport */}
      <div className="flex-1 overflow-y-auto bg-neutral-950 p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            overview={artifacts.overview || null}
            topics={artifacts.topics || []}
            concepts={artifacts.concepts || []}
            numbers={artifacts.numbers || []}
            isLoading={generatingTypes.has('overview')}
            onAskQuestion={onAskQuestion}
            onRegenerate={handleRegenerate}
          />
        )}

        {activeTab === 'notes' && (
          <NotesTab
            notes={notes}
            onCreateNote={onCreateNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
            onGenerateDeepNotes={onGenerateDeepNotes}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsTab
            flashcards={flashcards}
            onUpdateStatus={onUpdateFlashcardStatus}
            onRegenerate={() => onRegenerateArtifact('flashcards')}
          />
        )}

        {activeTab === 'study_guide' && (
          <StudyGuideTab
            studyGuide={artifacts.study_guide || null}
            isLoading={generatingTypes.has('study_guide')}
            onRegenerate={() => handleRegenerate('study_guide')}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizTab
            documents={documents}
            topicPerformance={topicPerformance}
            weakTopics={weakTopics}
            attempts={quizAttempts}
            onStartQuizConfig={onStartQuizConfig}
          />
        )}

        {activeTab === 'compare' && (
          <CompareTab
            comparison={artifacts.comparison || null}
            isLoading={generatingTypes.has('comparison')}
            onRegenerate={() => handleRegenerate('comparison')}
          />
        )}

        {activeTab === 'sources' && (
          <SourcesTab
            documents={documents}
            onUploadFiles={onUploadFiles}
            onReprocessDocument={onReprocessDocument}
            onDeleteDocument={onDeleteDocument}
            onOpenViewer={onOpenViewer}
            isUploading={isUploading}
          />
        )}
      </div>
    </div>
  );
};
