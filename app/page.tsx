'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { idbSet, idbGet, idbDel } from '@/lib/client-db';

// ---- Local-first storage (browser is source of truth; Vercel lambdas have
// isolated /tmp DBs so server-persisted state cannot be relied on) ----
type DocPage = { pageNumber: number; text: string };
type LightweightChunk = {
  id: string;
  document_id: string;
  notebook_id?: string;
  chunk_index: number;
  page_number: number;
  section_heading?: string | null;
  text: string;
  filename?: string;
};
type LocalDocument = DocumentRecord & { chunks?: LightweightChunk[]; pages?: DocPage[] };

interface NotebookBundle {
  documents: LocalDocument[];
  messages: ChatMessage[];
  notes: NoteRecord[];
  flashcards: FlashcardRecord[];
  attempts: QuizAttemptRecord[];
  artifacts: Record<string, any>;
}

const NB_KEY = 'synapse_notebooks';
const ACTIVE_KEY = 'synapse_active_nb';
const nbBundleKey = (id: string) => `synapse_nb_${id}`;
const emptyBundle = (): NotebookBundle => ({
  documents: [],
  messages: [],
  notes: [],
  flashcards: [],
  attempts: [],
  artifacts: {},
});

// Topic performance computed client-side from stored attempts:
// accuracy <70% with >=2 answers = weak topic.
function computeTopicPerformance(attempts: QuizAttemptRecord[]) {
  const stats = new Map<string, { total: number; correct: number }>();
  for (const att of attempts) {
    for (const ans of att.answers || []) {
      const topic = ans.topic || 'General';
      const s = stats.get(topic) || { total: 0, correct: 0 };
      s.total++;
      if (ans.is_correct) s.correct++;
      stats.set(topic, s);
    }
  }
  const performance: TopicPerformanceRecord[] = [...stats.entries()].map(([topic, s]) => ({
    topic,
    total_answered: s.total,
    total_correct: s.correct,
    accuracy_pct: Math.round((s.correct / s.total) * 100),
  }));
  const weakTopics = performance
    .filter((p) => p.accuracy_pct < 70 && p.total_answered >= 2)
    .map((p) => p.topic);
  return { performance, weakTopics };
}

export default function ChatStudioWorkspace() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);

  // Active Notebook State
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Cmd/Ctrl+K toggles global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
  // Real quiz row ID for attempt persistence — a fabricated ID used to be sent
  // here, orphaning every attempt from its quiz.
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [modelBadge, setModelBadge] = useState<string>('');
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

  // Helper: Build AI credential headers from localStorage for every API call.
  // Vercel lambdas are ephemeral — no persistent env vars or DB between cold starts.
  // The client MUST send credentials with every request.
  const getAIHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('synapse_api_key');
      const provider = localStorage.getItem('synapse_provider');
      const model = localStorage.getItem('synapse_model');
      const baseUrl = localStorage.getItem('synapse_base_url');
      if (key) headers['x-api-key'] = key;
      if (provider) headers['x-provider'] = provider;
      if (model) headers['x-model'] = model;
      if (baseUrl) headers['x-base-url'] = baseUrl;
    }
    return headers;
  }, []);

  // Read-modify-write the notebook's persisted bundle; returns the new bundle
  // so callers can mirror it into React state (always reads fresh from idb).
  const mutateBundle = useCallback(
    async (nbId: string, mutate: (b: NotebookBundle) => Partial<NotebookBundle>) => {
      const prev = (await idbGet<NotebookBundle>(nbBundleKey(nbId))) || emptyBundle();
      const next = { ...prev, ...mutate(prev) };
      await idbSet(nbBundleKey(nbId), next);
      return next;
    },
    []
  );

  const handleCreateNotebook = useCallback(async (title: string, description: string) => {
    const now = new Date().toISOString();
    const nb: Notebook = {
      id: `nb_${Date.now()}_cl`,
      title: title || 'New Chat',
      description,
      created_at: now,
      updated_at: now,
    };
    const list = (await idbGet<Notebook[]>(NB_KEY)) || [];
    const next = [nb, ...list];
    await idbSet(NB_KEY, next);
    setNotebooks(next);
    setActiveNotebookId(nb.id);

    // Fire-and-forget server sync. The server mints its own id, so adopt it —
    // uploads need a server-side notebook row or they 404 "Notebook not found".
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nb.title, description }),
      });
      const data = await res.json();
      const serverId = data?.notebook?.id;
      if (data.success && serverId && serverId !== nb.id) {
        // ponytail: last-writer-wins on the registry during concurrent creates;
        // single-user UI makes that window negligible.
        const renamed = (((await idbGet<Notebook[]>(NB_KEY)) as Notebook[]) || []).map((n) =>
          n.id === nb.id ? { ...n, id: serverId } : n
        );
        await idbSet(NB_KEY, renamed);
        const bundle = await idbGet<NotebookBundle>(nbBundleKey(nb.id));
        if (bundle) {
          await idbSet(nbBundleKey(serverId), bundle);
          await idbDel(nbBundleKey(nb.id));
        }
        setNotebooks(renamed);
        setActiveNotebookId((current) => (current === nb.id ? serverId : current));
      }
    } catch (e) {
      console.error('Error syncing notebook to server:', e);
    }
  }, []);

  const fetchNotebooks = useCallback(async () => {
    let local = await idbGet<Notebook[]>(NB_KEY);
    if (!local || local.length === 0) {
      const now = new Date().toISOString();
      local = [
        {
          id: `nb_${Date.now()}_cl`,
          title: 'Research & Learning Studio',
          description: '',
          created_at: now,
          updated_at: now,
        },
      ];
      await idbSet(NB_KEY, local);
    }
    setNotebooks(local);
    const savedActive = await idbGet<string>(ACTIVE_KEY);
    setActiveNotebookId(
      savedActive && local.some((n) => n.id === savedActive) ? savedActive : local[0].id
    );

    // Best-effort merge of any server notebooks not present locally (local wins).
    try {
      const res = await fetch('/api/notebooks');
      const data = await res.json();
      if (data.success && Array.isArray(data.notebooks)) {
        const byId = new Map(local.map((n) => [n.id, n]));
        for (const nb of data.notebooks) if (!byId.has(nb.id)) byId.set(nb.id, nb);
        const merged = [...byId.values()];
        setNotebooks(merged);
        await idbSet(NB_KEY, merged);
      }
    } catch {
      /* offline or cold lambda — local state already good */
    }
  }, []);

  const loadNotebook = useCallback(async (id: string) => {
    const b = (await idbGet<NotebookBundle>(nbBundleKey(id))) || emptyBundle();
    setDocuments(b.documents);
    setArtifacts(b.artifacts);
    setNotes(b.notes);
    setFlashcards(b.flashcards);
    setChatMessages(b.messages);
    setQuizAttempts(b.attempts);
    const { performance, weakTopics } = computeTopicPerformance(b.attempts);
    setTopicPerformance(performance);
    setWeakTopics(weakTopics);
  }, []);

  // 1. Initial Load
  useEffect(() => {
    fetchNotebooks();
    if (typeof window !== 'undefined') {
      setModelBadge(localStorage.getItem('synapse_model') || '');
    }
  }, [fetchNotebooks]);

  // 2. Load Notebook Details on change
  useEffect(() => {
    if (activeNotebookId) {
      idbSet(ACTIVE_KEY, activeNotebookId);
      loadNotebook(activeNotebookId);
    }
  }, [activeNotebookId, loadNotebook]);

  const handleDeleteNotebook = async (id: string) => {
    const remaining = notebooks.filter((n) => n.id !== id);
    setNotebooks(remaining);
    await idbSet(NB_KEY, remaining);
    await idbDel(nbBundleKey(id));
    if (activeNotebookId === id) {
      setActiveNotebookId(remaining[0]?.id || null);
    }
    fetch(`/api/notebooks/${id}`, { method: 'DELETE' }).catch((e) =>
      console.error('Error deleting notebook on server:', e)
    );
  };

  // Upload Handlers
  // Vercel lambdas reject request bodies >4.5MB (HTTP 413), so large files are
  // extracted to text IN THE BROWSER and sent as JSON instead of raw binaries.
  const PDF_MULTIPART_LIMIT = 3 * 1024 * 1024;
  const OFFICE_MULTIPART_LIMIT = 3.5 * 1024 * 1024;

  const uploadMultipart = async (file: File) => {
    const formData = new FormData();
    formData.append('notebookId', activeNotebookId!);
    formData.append('file', file);
    const res = await fetch('/api/documents', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data.document as LocalDocument;
  };

  const uploadViaTextEndpoint = async (filename: string, pages: { pageNumber: number; text: string }[]) => {
    const res = await fetch('/api/documents/text', {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ notebookId: activeNotebookId!, filename, fileType: filename.split('.').pop(), pages }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data.document as LocalDocument;
  };

  // Mirrors lib/parsers/pdf.ts pager logic: newline when y moves >5, space otherwise.
  const extractPdfPagesInBrowser = async (file: File) => {
    const pdfjs = await import('pdfjs-dist');
    // ponytail: worker served from public/, kept in sync by the postinstall
    // copy script — re-copy manually if pdfjs-dist is ever bumped without it.
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: { pageNumber: number; text: string }[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let text = '';
      for (const item of textContent.items as any[]) {
        if (lastY == null || Math.abs(item.transform[5] - lastY) > 5) {
          text += '\n' + item.str;
        } else {
          text += (text.endsWith(' ') ? '' : ' ') + item.str;
        }
        lastY = item.transform[5];
      }
      pages.push({ pageNumber: n, text: text.trim() });
    }
    return pages;
  };

  const handleUploadFiles = async (files: FileList) => {
    if (!activeNotebookId) return;
    setIsUploading(true);

    let failures = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.name.toLowerCase();
        try {
          let newDoc: DocumentRecord;
          if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
            // Text formats never need the binary — read in-browser and send JSON.
            const text = await file.text();
            newDoc = await uploadViaTextEndpoint(file.name, [{ pageNumber: 1, text }]);
          } else if (name.endsWith('.pdf') && file.size > PDF_MULTIPART_LIMIT) {
            newDoc = await uploadViaTextEndpoint(file.name, await extractPdfPagesInBrowser(file));
          } else if (
            (name.endsWith('.docx') || name.endsWith('.xlsx') || name.endsWith('.xls')) &&
            file.size > OFFICE_MULTIPART_LIMIT
          ) {
            alert(
              `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Files over ~4MB must be under the platform limit for DOCX/XLSX — convert to PDF or split the file.`
            );
            failures++;
            continue;
          } else {
            newDoc = await uploadMultipart(file);
          }

          // Merge (document now carries .chunks + .pages from the server) and
          // persist BEFORE reporting success so the doc survives any lambda.
          setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
          await mutateBundle(activeNotebookId, (b) => ({
            documents: [newDoc, ...b.documents.filter((d) => d.id !== newDoc.id)],
          }));
        } catch (uploadErr: any) {
          failures++;
          console.error(`Upload failed for ${file.name}:`, uploadErr);
          alert(`Upload failed: ${uploadErr?.message || String(uploadErr)}`);
        }
      }
    } finally {
      setIsUploading(false);
      if (failures > 0) {
        alert(`${failures} of ${files.length} file(s) failed to upload.`);
      }
    }
  };

  // Chat Message Handler with Auto Companion Tab Switching
  const handleSendMessage = async (msg: string) => {
    if (!activeNotebookId) return;
    const nbId = activeNotebookId;
    setIsChatLoading(true);

    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      session_id: 'session',
      notebook_id: nbId,
      role: 'user',
      content: msg,
      grounding_type: 'direct_source',
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);
    await mutateBundle(nbId, (b) => ({ messages: [...b.messages, tempUserMsg] }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          notebookId: nbId,
          message: msg,
          documents: documents,
        }),
      });
      const data = await res.json();

      if (data.success && data.message) {
        // Keep the user's message visible — only append the assistant response
        setChatMessages((prev) => [...prev, data.message]);
        await mutateBundle(nbId, (b) => ({ messages: [...b.messages, data.message] }));

        // If intent was flashcards, refresh and open Flashcards Companion tab
        if (data.specialPayload?.type === 'flashcards' && data.specialPayload.cards) {
          setFlashcards((prev) => [...data.specialPayload.cards, ...prev]);
          await mutateBundle(nbId, (b) => ({
            flashcards: [...data.specialPayload.cards, ...b.flashcards],
          }));
          setActiveCompanionTab('flashcards');
          setIsCompanionOpen(true);
        }

        // If intent was notes, refresh and open Notes Companion tab
        if (data.specialPayload?.type === 'note_created' && data.specialPayload.note) {
          setNotes((prev) => [data.specialPayload.note, ...prev]);
          await mutateBundle(nbId, (b) => ({
            notes: [data.specialPayload.note, ...b.notes],
          }));
          setActiveCompanionTab('notes');
          setIsCompanionOpen(true);
        }

        // If intent was quiz, launch focused Quiz Game Mode!
        if (data.specialPayload?.type === 'quiz_ready' && data.specialPayload.questions) {
          setQuizQuestions(data.specialPayload.questions);
          setQuizTitle(data.specialPayload.title);
          setActiveQuizId(data.specialPayload.quizId || null);
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
    } catch (e: any) {
      console.error('Error sending chat message:', e);
      // Never fail silently — show an assistant-side error bubble so the
      // user knows the message was received but the reply failed.
      const errMsg = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content:
          '**The reply failed to arrive.**\n\n' +
          `\`${e?.message || 'Network or server error'}\`\n\n` +
          'This usually means a timeout or rate limit on the AI provider. Your message was saved — try again in a moment.',
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errMsg as any]);
      await mutateBundle(nbId, (b) => ({ messages: [...b.messages, errMsg as any] }));
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
    const now = new Date().toISOString();
    const note: NoteRecord = {
      id: `note_${Date.now()}_cl`,
      notebook_id: activeNotebookId,
      title: noteData.title,
      content: noteData.content,
      format_type: noteData.format_type,
      is_pinned: 0,
      created_at: now,
      updated_at: now,
    };
    setNotes((prev) => [note, ...prev]);
    await mutateBundle(activeNotebookId, (b) => ({ notes: [note, ...b.notes] }));
    // Best-effort server sync; the local copy is authoritative.
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notebookId: activeNotebookId,
        ...noteData,
      }),
    }).catch((err) => console.error('Error syncing note to server:', err));
  };

  // Debounce timers for note autosave — one in-flight write per keystroke
  // used to hammer the API and out-of-order responses could revert typing.
  const noteSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleUpdateNote = async (id: string, updates: Partial<NoteRecord>) => {
    if (!activeNotebookId) return;
    // Optimistic local update first so typing stays instant
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    await mutateBundle(activeNotebookId, (b) => ({
      notes: b.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
    if (noteSaveTimers.current[id]) clearTimeout(noteSaveTimers.current[id]);
    noteSaveTimers.current[id] = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      } catch (err) {
        console.error('Error updating note:', err);
      }
    }, 500);
  };

  const handleDeleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNotebookId) {
      await mutateBundle(activeNotebookId, (b) => ({
        notes: b.notes.filter((n) => n.id !== id),
      }));
    }
    fetch(`/api/notes/${id}`, { method: 'DELETE' }).catch((e) =>
      console.error('Error deleting note:', e)
    );
  };

  // Flashcard Status
  const handleUpdateFlashcardStatus = async (id: string, status: ReviewStatus) => {
    setFlashcards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, review_status: status } : c))
    );
    if (activeNotebookId) {
      await mutateBundle(activeNotebookId, (b) => ({
        flashcards: b.flashcards.map((c) => (c.id === id ? { ...c, review_status: status } : c)),
      }));
    }
    fetch(`/api/flashcards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: status }),
    }).catch((err) => console.error('Error updating flashcard status:', err));
  };

  // Artifact Regeneration
  const handleRegenerateArtifact = async (artifactType: string) => {
    if (!activeNotebookId) return;
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          notebookId: activeNotebookId,
          artifactType,
          // Stateless lambdas can't read the /tmp DB — send the source text.
          chunks: documents.flatMap((d) => d.chunks || []),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setArtifacts((prev) => ({ ...prev, [artifactType]: data.artifact }));
        await mutateBundle(activeNotebookId, (b) => ({
          artifacts: { ...b.artifacts, [artifactType]: data.artifact },
        }));
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

    // Tag answers with their question topics so weak-area tracking works
    // fully client-side (the game engine doesn't set topic itself).
    const topicByQuestion = new Map(quizQuestions.map((q) => [q.id, q.topic]));
    const enrichedAnswers = (results.answers || []).map((a) => ({
      ...a,
      topic: a.topic || topicByQuestion.get(a.question_id) || 'General',
    }));

    const attempt: QuizAttemptRecord = {
      id: `att_${Date.now()}_cl`,
      // Server quiz rows can vanish between Lambda instances — a local id
      // keeps history intact when there is nothing to reference.
      quiz_id: activeQuizId || `quiz_local_${Date.now()}`,
      notebook_id: activeNotebookId,
      title: quizTitle,
      score: results.score,
      total_questions: results.totalQuestions,
      correct_count: results.correctCount,
      accuracy_pct: results.accuracyPct,
      xp_earned: results.xpEarned,
      max_streak: results.maxStreak,
      time_spent_seconds: results.timeSpentSeconds,
      created_at: new Date().toISOString(),
      answers: enrichedAnswers,
    };

    const next = await mutateBundle(activeNotebookId, (b) => ({
      attempts: [attempt, ...b.attempts],
    }));
    setQuizAttempts(next.attempts);
    const { performance, weakTopics } = computeTopicPerformance(next.attempts);
    setTopicPerformance(performance);
    setWeakTopics(weakTopics);

    // Best-effort server sync — history works without it.
    fetch('/api/quiz/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: attempt.quiz_id,
        notebookId: activeNotebookId,
        title: quizTitle,
        ...results,
        answers: enrichedAnswers,
      }),
    }).catch((e) => console.error('Error saving quiz attempt:', e));
  };

  const handleStartQuizConfig = async (config: QuizConfig) => {
    if (!activeNotebookId) return;
    // Scoped chunks make generation work on ANY server instance (stateless).
    const scopedDocs = config.documentId
      ? documents.filter((d) => d.id === config.documentId)
      : documents;
    let chunks = scopedDocs.flatMap((d) => d.chunks || []);
    if (config.topic) {
      const t = config.topic.toLowerCase();
      chunks = chunks.filter(
        (c) =>
          (c.section_heading || '').toLowerCase().includes(t) ||
          c.text.toLowerCase().includes(t)
      );
    }
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          notebookId: activeNotebookId,
          documents: documents,
          chunks,
          ...config,
        }),
      });
      const data = await res.json();
      if (data.success && data.questions?.length > 0) {
        setQuizQuestions(data.questions);
        setQuizTitle(data.quiz?.title || 'Interactive Knowledge Quiz');
        setActiveQuizId(data.quiz?.id || null);
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
        headers: getAIHeaders(),
        body: JSON.stringify({
          notebookId: activeNotebookId,
          // Stateless lambdas can't read the /tmp DB — send the source text.
          chunks: documents.flatMap((d) => d.chunks || []),
        }),
      });
      const data = await res.json();
      if (data.success && data.notes) {
        setNotes((prev) => [...data.notes, ...prev]);
        await mutateBundle(activeNotebookId, (b) => ({
          notes: [...data.notes, ...b.notes],
        }));
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
              <span>{modelBadge || 'AI Model'}</span>
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
          onLaunchQuizMode={(payload) => {
            // Launch the quiz that was already generated for this message —
            // the old handler discarded the payload and asked the AI to
            // regenerate a different quiz.
            if (payload?.questions?.length > 0) {
              setQuizQuestions(payload.questions);
              setQuizTitle(payload.title || 'Knowledge Quiz');
              setActiveQuizId(payload.quizId || null);
              setQuizConfig({
                sourceType: 'notebook',
                questionCount: payload.questionCount || payload.questions.length,
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
            } else {
              handleSendMessage('Quiz me on this document with 10 questions.');
            }
          }}
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
          setDocuments((prev) => prev.filter((d) => d.id !== id));
          if (activeNotebookId) {
            await mutateBundle(activeNotebookId, (b) => ({
              documents: b.documents.filter((d) => d.id !== id),
            }));
          }
          fetch(`/api/documents/${id}`, { method: 'DELETE' }).catch(() => {});
        }}
        onOpenViewer={(doc) => {
          setDrawerDoc(doc);
          setDrawerTargetPage(1);
          setDrawerExcerpt('');
          setIsDrawerOpen(true);
        }}
        isUploading={isUploading}
      />

      {/* Global Knowledge Search (Cmd/Ctrl+K) — runs on local scope */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        notebookId={activeNotebookId}
        scope={{
          chunks: documents.flatMap((d) => d.chunks || []),
          notes,
          flashcards,
        }}
        onSelectResult={(r) => {
          setIsSearchOpen(false);
          if (r.type === 'chunk') {
            const doc =
              documents.find((d) => d.id === r.metadata?.documentId) || documents[0];
            if (doc) {
              setDrawerDoc(doc);
              setDrawerTargetPage(r.metadata?.pageNumber || 1);
              setDrawerExcerpt(r.snippet || '');
              setIsDrawerOpen(true);
            }
          } else if (r.type === 'note') {
            setActiveCompanionTab('notes');
            setIsCompanionOpen(true);
          } else {
            setActiveCompanionTab('flashcards');
            setIsCompanionOpen(true);
          }
        }}
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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (typeof window !== 'undefined') {
            setModelBadge(localStorage.getItem('synapse_model') || '');
          }
        }}
      />

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
              headers: getAIHeaders(),
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
