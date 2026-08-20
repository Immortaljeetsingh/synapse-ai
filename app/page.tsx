'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Bookmark,
  Gamepad2,
  StickyNote,
  BookOpen,
  Columns,
  Cpu,
  Menu,
} from 'lucide-react';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { PromptComposer } from '@/components/chat/PromptComposer';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { SynapseLogo } from '@/components/brand/SynapseLogo';
import { DocumentDrawer } from '@/components/chat/DocumentDrawer';
import { LibraryModal } from '@/components/chat/LibraryModal';
import { SettingsModal } from '@/components/SettingsModal';
import { RightCompanionSidebar, CompanionTab } from '@/components/companion/RightCompanionSidebar';
import { QuizGameEngine } from '@/components/quiz/QuizGameEngine';
import { QuizResultsDashboard } from '@/components/quiz/QuizResultsDashboard';
import { QuizAnswerReview } from '@/components/quiz/QuizAnswerReview';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import {
  Notebook,
  DocumentRecord,
  NoteRecord,
  FlashcardRecord,
  ChatMessage,
  QuizQuestionItem,
  QuizAttemptRecord,
  QuizAnswerRecord,
  TopicPerformanceRecord,
  QuizConfig,
  ReviewStatus,
  NoteFormatType,
} from '@/lib/types';

export default function ChatStudioWorkspace() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);

  // Active Notebook State
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardRecord[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRecord[]>([]);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformanceRecord[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);

  // UI Panels State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [activeCompanionTab, setActiveCompanionTab] = useState<CompanionTab>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Document Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerDoc, setDrawerDoc] = useState<DocumentRecord | null>(null);
  const [drawerTargetPage, setDrawerTargetPage] = useState<number>(1);
  const [drawerExcerpt, setDrawerExcerpt] = useState<string>('');

  // Interactive Quiz Game Mode State
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionItem[]>([]);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('Document Knowledge Quiz');
  const [quizResults, setQuizResults] = useState<{
    score: number;
    totalQuestions: number;
    correctCount: number;
    accuracyPct: number;
    xpEarned: number;
    maxStreak: number;
    timeSpentSeconds: number;
    answers: QuizAnswerRecord[];
  } | null>(null);
  const [isReviewingAnswers, setIsReviewingAnswers] = useState(false);

  // Loading States
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleCreateNotebook = useCallback(async (title: string, description: string) => {
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'New Chat', description }),
      });
      const data = await res.json();
      if (data.success) {
        setNotebooks((prev) => [data.notebook, ...prev]);
        setActiveNotebookId(data.notebook.id);
      }
    } catch (e) {
      console.error('Error creating notebook:', e);
    }
  }, []);

  const fetchNotebooks = useCallback(async () => {
    try {
      const res = await fetch('/api/notebooks');
      const data = await res.json();
      if (data.success && data.notebooks?.length > 0) {
        setNotebooks(data.notebooks);
        if (!activeNotebookId) {
          setActiveNotebookId(data.notebooks[0].id);
        }
      } else if (data.notebooks?.length === 0) {
        handleCreateNotebook('Research & Learning Studio', '');
      }
    } catch (e) {
      console.error('Error loading notebooks:', e);
    }
  }, [activeNotebookId, handleCreateNotebook]);

  const loadNotebook = useCallback(async (id: string) => {
    try {
      const [nbRes, attRes, weakRes] = await Promise.all([
        fetch(`/api/notebooks/${id}`),
        fetch(`/api/quiz/attempt?notebookId=${id}`),
        fetch(`/api/quiz/weak-areas?notebookId=${id}`),
      ]);

      const [nbData, attData, weakData] = await Promise.all([
        nbRes.json(),
        attRes.json(),
        weakRes.json(),
      ]);

      if (nbData.success) {
        setDocuments(nbData.documents || []);
        setArtifacts(nbData.artifacts || {});
        setNotes(nbData.notes || []);
        setFlashcards(nbData.flashcards || []);
        setChatMessages(nbData.chat?.messages || []);
      }
      if (attData.success) {
        setQuizAttempts(attData.attempts || []);
      }
      if (weakData.success) {
        setTopicPerformance(weakData.performance || []);
        setWeakTopics(weakData.weakTopics || []);
      }
    } catch (e) {
      console.error('Error loading notebook details:', e);
    }
  }, []);

  // 1. Initial Load
  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  // 2. Load Notebook Details on change
  useEffect(() => {
    if (activeNotebookId) {
      loadNotebook(activeNotebookId);
    }
  }, [activeNotebookId, loadNotebook]);

  const handleDeleteNotebook = async (id: string) => {
    try {
      await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (activeNotebookId === id) {
        const remaining = notebooks.filter((n) => n.id !== id);
        setActiveNotebookId(remaining[0]?.id || null);
      }
    } catch (e) {
      console.error('Error deleting notebook:', e);
    }
  };

  const getClientHeaders = () => {
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('synapse_api_key') || '' : '';
    const provider = typeof window !== 'undefined' ? localStorage.getItem('synapse_provider') || 'openrouter' : 'openrouter';
    const model = typeof window !== 'undefined' ? localStorage.getItem('synapse_model') || 'openai/gpt-oss-20b:free' : 'openai/gpt-oss-20b:free';
    const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('synapse_base_url') || 'https://openrouter.ai/api/v1' : 'https://openrouter.ai/api/v1';

    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-provider': provider,
      'x-model': model,
      'x-base-url': baseUrl,
    };
  };

  // Upload Handlers
  const handleUploadFiles = async (files: FileList) => {
    if (!activeNotebookId) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('notebookId', activeNotebookId);
        formData.append('file', file);

        const uploadRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          const newDoc = uploadData.document;
          setDocuments((prev) => [newDoc, ...prev]);

          // Trigger lightweight background indexing
          await fetch(`/api/documents/${newDoc.id}/process`, {
            method: 'POST',
            headers: getClientHeaders(),
          });
          if (activeNotebookId) {
            loadNotebook(activeNotebookId);
          }
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Chat Message Handler with Auto Companion Tab Switching
  const handleSendMessage = async (msg: string) => {
    if (!activeNotebookId) return;
    setIsChatLoading(true);

    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      session_id: 'session',
      notebook_id: activeNotebookId,
      role: 'user',
      content: msg,
      grounding_type: 'direct_source',
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: activeNotebookId,
          message: msg,
        }),
      });
      const data = await res.json();

      if (data.success && data.message) {
        setChatMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), data.message]);

        // If intent was flashcards, refresh and open Flashcards Companion tab
        if (data.specialPayload?.type === 'flashcards' && data.specialPayload.cards) {
          setFlashcards((prev) => [...data.specialPayload.cards, ...prev]);
          setActiveCompanionTab('flashcards');
          setIsCompanionOpen(true);
        }

        // If intent was notes, refresh and open Notes Companion tab
        if (data.specialPayload?.type === 'note_created' && data.specialPayload.note) {
          setNotes((prev) => [data.specialPayload.note, ...prev]);
          setActiveCompanionTab('notes');
          setIsCompanionOpen(true);
        }

        // If intent was quiz, launch focused Quiz Game Mode!
        if (data.specialPayload?.type === 'quiz_ready' && data.specialPayload.questions) {
          setQuizQuestions(data.specialPayload.questions);
          setQuizTitle(data.specialPayload.title);
          setQuizConfig({
            sourceType: 'notebook',
            questionCount: data.specialPayload.questionCount,
            difficulty: 'medium',
            questionType: 'mixed',
            mode: 'practice',
            timerSeconds: 0,
            enableXp: true,
            enableStreaks: true,
          });
          setQuizResults(null);
          setIsReviewingAnswers(false);
          setIsQuizActive(true);
        }
      }
    } catch (e) {
      console.error('Error sending chat message:', e);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Open Citation in Document Drawer
  const handleOpenCitation = (docName: string, pageNum: number, excerpt: string) => {
    const matchedDoc =
      documents.find((d) => d.filename.toLowerCase() === docName.toLowerCase()) || documents[0];
    if (matchedDoc) {
      setDrawerDoc(matchedDoc);
      setDrawerTargetPage(pageNum || 1);
      setDrawerExcerpt(excerpt || '');
      setIsDrawerOpen(true);
    }
  };

  // Note Handlers
  const handleCreateNote = async (noteData: {
    title: string;
    content: string;
    format_type: NoteFormatType;
  }) => {
    if (!activeNotebookId) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: activeNotebookId,
          ...noteData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [data.note, ...prev]);
      }
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleUpdateNote = async (id: string, updates: Partial<NoteRecord>) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
      }
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error('Error deleting note:', e);
    }
  };

  // Flashcard Status
  const handleUpdateFlashcardStatus = async (id: string, status: ReviewStatus) => {
    try {
      await fetch(`/api/flashcards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: status }),
      });
      setFlashcards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, review_status: status } : c))
      );
    } catch (err) {
      console.error('Error updating flashcard status:', err);
    }
  };

  // Artifact Regeneration
  const handleRegenerateArtifact = async (artifactType: string) => {
    if (!activeNotebookId) return;
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: activeNotebookId,
          artifactType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadNotebook(activeNotebookId);
      }
    } catch (err) {
      console.error('Error regenerating artifact:', err);
    }
  };

  // Quiz Game Completion Handler
  const handleFinishQuiz = async (results: {
    score: number;
    totalQuestions: number;
    correctCount: number;
    accuracyPct: number;
    xpEarned: number;
    maxStreak: number;
    timeSpentSeconds: number;
    answers: QuizAnswerRecord[];
  }) => {
    if (!activeNotebookId) return;
    setQuizResults(results);
    setIsQuizActive(false);

    try {
      await fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: `quiz_${Date.now()}`,
          notebookId: activeNotebookId,
          title: quizTitle,
          ...results,
        }),
      });
      loadNotebook(activeNotebookId);
    } catch (e) {
      console.error('Error saving quiz attempt:', e);
    }
  };

  const handleStartQuizConfig = async (config: QuizConfig) => {
    if (!activeNotebookId) return;
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: activeNotebookId,
          ...config,
        }),
      });
      const data = await res.json();
      if (data.success && data.questions?.length > 0) {
        setQuizQuestions(data.questions);
        setQuizTitle(data.quiz?.title || 'Interactive Knowledge Quiz');
        setQuizConfig(config);
        setQuizResults(null);
        setIsReviewingAnswers(false);
        setIsQuizActive(true);
      }
    } catch (e) {
      console.error('Error starting quiz:', e);
    }
  };

  const handleGenerateDeepNotes = async () => {
    if (!activeNotebookId) return;
    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId: activeNotebookId }),
      });
      const data = await res.json();
      if (data.success && data.notes) {
        setNotes((prev) => [...data.notes, ...prev]);
        loadNotebook(activeNotebookId);
      }
    } catch (e) {
      console.error('Error generating deep notes:', e);
    }
  };

  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 antialiased font-sans select-none">
      {/* 1. Left Collapsible Sidebar */}
      <Sidebar
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onSelectNotebook={(id) => setActiveNotebookId(id)}
        onCreateNotebook={handleCreateNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Central Conversational Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="h-12 border-b border-neutral-200 dark:border-neutral-800/80 glass px-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-850 transition-colors shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <SynapseLogo size="xs" />
            <h2 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-200 truncate">
              {activeNotebook?.title || 'SYNAPSE AI Research Workspace'}
            </h2>
            <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-500 font-mono">
              <Cpu className="w-3 h-3 text-neutral-400" />
              <span>GPT-OSS 20B</span>
            </div>
          </div>

          {/* Right Companion Panel Toggle Button */}
          <button
            onClick={() => setIsCompanionOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isCompanionOpen
                ? 'bg-neutral-800 dark:bg-neutral-700 text-white shadow-3d-sm'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-800'
            }`}
            title={isCompanionOpen ? 'Hide Studio Tools' : 'Open Studio Tools'}
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studio Tools</span>
            <span className="sm:hidden">Tools</span>
          </button>
        </div>

        {/* Main Conversation Stream */}
        <ChatArea
          messages={chatMessages}
          activeDocuments={documents}
          isLoading={isChatLoading}
          onSendMessage={handleSendMessage}
          onOpenCitation={handleOpenCitation}
          onLaunchQuizMode={() => handleSendMessage('Quiz me on this PDF with 10 questions.')}
        />

        {/* Large Rounded Prompt Composer */}
        <PromptComposer
          onSendMessage={handleSendMessage}
          onUploadFiles={handleUploadFiles}
          isLoading={isChatLoading}
          activeDocuments={documents}
          onOpenCompanionTab={(tab) => {
            setActiveCompanionTab(tab);
            setIsCompanionOpen(true);
          }}
          isUploading={isUploading}
        />
      </div>

      {/* 3. Right Companion Studio Sidebar */}
      <RightCompanionSidebar
        isOpen={isCompanionOpen}
        onClose={() => setIsCompanionOpen(false)}
        activeTab={activeCompanionTab}
        onSelectTab={(tab) => setActiveCompanionTab(tab)}
        documents={documents}
        artifacts={artifacts}
        notes={notes}
        flashcards={flashcards}
        quizAttempts={quizAttempts}
        topicPerformance={topicPerformance}
        weakTopics={weakTopics}
        onAskQuestion={(q) => handleSendMessage(q)}
        onRegenerateArtifact={handleRegenerateArtifact}
        onCreateNote={handleCreateNote}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
        onGenerateDeepNotes={handleGenerateDeepNotes}
        onUpdateFlashcardStatus={handleUpdateFlashcardStatus}
        onStartQuizConfig={handleStartQuizConfig}
        onUploadFiles={handleUploadFiles}
        onReprocessDocument={async (id) => {
          await fetch(`/api/documents/${id}/process`, { method: 'POST' });
          if (activeNotebookId) loadNotebook(activeNotebookId);
        }}
        onDeleteDocument={async (id) => {
          await fetch(`/api/documents/${id}`, { method: 'DELETE' });
          setDocuments((prev) => prev.filter((d) => d.id !== id));
        }}
        onOpenViewer={(doc) => {
          setDrawerDoc(doc);
          setDrawerTargetPage(1);
          setDrawerExcerpt('');
          setIsDrawerOpen(true);
        }}
        isUploading={isUploading}
      />

      {/* Sliding Document & Citation Drawer */}
      <DocumentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        document={drawerDoc}
        targetPage={drawerTargetPage}
        highlightExcerpt={drawerExcerpt}
      />

      {/* Knowledge Library Modal (Notes, Flashcards, Quizzes) */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        notes={notes}
        flashcards={flashcards}
        quizAttempts={quizAttempts}
        onDeleteNote={handleDeleteNote}
        onLaunchQuizMode={() => {
          setIsLibraryOpen(false);
          handleSendMessage('Quiz me on this PDF with 10 questions.');
        }}
      />

      {/* AI Settings & Connection Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Focused Interactive Quiz Mode Overlay */}
      {isQuizActive && quizConfig && (
        <QuizGameEngine
          questions={quizQuestions}
          config={quizConfig}
          title={quizTitle}
          onFinishQuiz={handleFinishQuiz}
          onOpenCitationInViewer={handleOpenCitation}
          onExitGame={() => setIsQuizActive(false)}
        />
      )}

      {/* Quiz Results Dashboard */}
      {quizResults && !isQuizActive && !isReviewingAnswers && (
        <QuizResultsDashboard
          score={quizResults.score}
          totalQuestions={quizResults.totalQuestions}
          correctCount={quizResults.correctCount}
          accuracyPct={quizResults.accuracyPct}
          xpEarned={quizResults.xpEarned}
          maxStreak={quizResults.maxStreak}
          timeSpentSeconds={quizResults.timeSpentSeconds}
          answers={quizResults.answers}
          questions={quizQuestions}
          onReviewAnswers={() => setIsReviewingAnswers(true)}
          onRetakeQuiz={() => {
            setQuizResults(null);
            setIsQuizActive(true);
          }}
          onPracticeWeakAreas={() => {
            setQuizResults(null);
            handleSendMessage('Quiz me on weak areas from this document.');
          }}
          onNewQuiz={() => setQuizResults(null)}
        />
      )}

      {/* Quiz Detailed Answer Review */}
      {isReviewingAnswers && quizResults && (
        <QuizAnswerReview
          questions={quizQuestions}
          answers={quizResults.answers}
          onBackToResults={() => setIsReviewingAnswers(false)}
          onCreateFlashcard={async (q) => {
            if (!activeNotebookId) return;
            const res = await fetch('/api/flashcards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notebookId: activeNotebookId,
                card_type: 'conceptual',
                question: q.question,
                answer: `${q.correct_answer}\n\nRationale: ${q.explanation}`,
                topic: q.topic || 'General',
                difficulty: q.difficulty || 'medium',
                source_document: q.source_document,
                page_number: q.page_number,
              }),
            });
            const data = await res.json();
            if (data.success && data.flashcard) {
              setFlashcards((prev) => [data.flashcard, ...prev]);
            }
          }}
          onOpenCitationInViewer={handleOpenCitation}
        />
      )}
    </div>
  );
}
