'use client';

import React, { useState, useRef } from 'react';
import {
  StickyNote,
  Plus,
  Pin,
  Trash2,
  Edit3,
  Check,
  Search,
  Wand2,
  Download,
  BookOpen,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { NoteRecord, NoteFormatType } from '@/lib/types';

interface NotesTabProps {
  notes: NoteRecord[];
  onCreateNote: (note: { title: string; content: string; format_type: NoteFormatType }) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<NoteRecord>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onGenerateDeepNotes?: () => Promise<void>;
}

export const NotesTab: React.FC<NotesTabProps> = ({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onGenerateDeepNotes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(notes[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFormat, setNewFormat] = useState<NoteFormatType>('cornell');
  const [isGenerating, setIsGenerating] = useState(false);
  // Local editor draft is the source of truth while typing; persisted via debounced onUpdateNote.
  const [draft, setDraft] = useState<{ id: string; title: string; content: string } | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingRef = useRef<Record<string, Partial<NoteRecord>>>({});
  const selectNewNoteRef = useRef(false);
  const onUpdateNoteRef = useRef(onUpdateNote);
  onUpdateNoteRef.current = onUpdateNote;

  // Sync active note if deleted or updated
  React.useEffect(() => {
    if (!activeNoteId && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  // Select a freshly created note (parent prepends it at index 0)
  React.useEffect(() => {
    if (selectNewNoteRef.current && notes.length > 0) {
      selectNewNoteRef.current = false;
      setActiveNoteId(notes[0].id);
    }
  }, [notes]);

  // Flush any pending debounced save on unmount
  React.useEffect(() => {
    const timers = timersRef.current;
    const pending = pendingRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      for (const [id, updates] of Object.entries(pending)) {
        if (Object.keys(updates).length > 0) onUpdateNoteRef.current(id, updates);
      }
    };
  }, []);

  const cancelPending = (id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    delete pendingRef.current[id];
  };

  const flushNote = (id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    const pending = pendingRef.current[id];
    if (pending && Object.keys(pending).length > 0) {
      delete pendingRef.current[id];
      onUpdateNote(id, pending);
    }
  };

  const scheduleUpdate = (id: string, updates: Partial<NoteRecord>) => {
    pendingRef.current[id] = { ...pendingRef.current[id], ...updates };
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      delete timersRef.current[id];
      const pending = pendingRef.current[id];
      delete pendingRef.current[id];
      if (pending && Object.keys(pending).length > 0) onUpdateNote(id, pending);
    }, 400);
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pinned notes first, newest within each group
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    const pinDiff = (b.is_pinned || 0) - (a.is_pinned || 0);
    if (pinDiff !== 0) return pinDiff;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];
  const activeDraft = draft && activeNote && draft.id === activeNote.id ? draft : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let initialTemplateContent = newContent;
    if (!initialTemplateContent) {
      if (newFormat === 'cornell') {
        initialTemplateContent = `### Cues & Keywords\n- Key Term 1\n- Key Term 2\n\n### Main Section Notes\n- Detailed explanation of core findings...\n- Methodology and execution criteria...\n\n### Executive Summary\nBrief 2-sentence synthesis of the core lesson.`;
      } else if (newFormat === 'bullet') {
        initialTemplateContent = `* **Primary Concept**: Definition and core principles\n  * Key sub-point A\n  * Key sub-point B\n* **Quantitative Benchmarks**: Baseline metrics and targets\n* **Critical Takeaway**: Key rule to remember`;
      } else if (newFormat === 'exam') {
        initialTemplateContent = `## 🚨 Quality & Discrepancy Audit\n1. Inconsistencies / Ambiguities: ...\n2. Unverified Assumptions: ...\n3. Critical Execution Risks: ...`;
      }
    }

    await onCreateNote({
      title: newTitle.trim(),
      content: initialTemplateContent,
      format_type: newFormat,
    });

    selectNewNoteRef.current = true;
    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  const handleGenerateClick = async () => {
    if (!onGenerateDeepNotes) return;
    setIsGenerating(true);
    try {
      await onGenerateDeepNotes();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (activeNote) {
      const blob = new Blob([`# ${activeNote.title}\n\n${activeNote.content}`], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeNote.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getFormatBadge = (fmt?: string, title?: string) => {
    if (title?.includes('Audit') || title?.includes('Quality') || fmt === 'exam') {
      return (
        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
          Audit
        </span>
      );
    }
    if (title?.includes('Executive') || fmt === 'cornell') {
      return (
        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono">
          Cornell
        </span>
      );
    }
    if (title?.includes('Takeaways') || fmt === 'bullet') {
      return (
        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono">
          Takeaways
        </span>
      );
    }
    return (
      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 font-mono">
        {fmt || 'Note'}
      </span>
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden select-none">
      {/* Notes Sidebar */}
      <div className="w-80 border-r border-neutral-800 bg-neutral-950 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-neutral-400" />
              <span>Notes &amp; Audits ({notes.length})</span>
            </h3>
            <div className="flex items-center gap-1.5">
              {onGenerateDeepNotes && (
                <button
                  onClick={handleGenerateClick}
                  disabled={isGenerating}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs flex items-center gap-1 transition-colors shadow-3d-sm disabled:opacity-50"
                  title="Auto-Generate Deep Notes & Quality Audit"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={() => setIsCreating(true)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-xl text-xs flex items-center gap-1 transition-colors shadow-3d-sm"
                title="New Note"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes &amp; audits..."
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 space-y-3">
              <p>No notes in this notebook yet.</p>
              {onGenerateDeepNotes && (
                <button
                  onClick={handleGenerateClick}
                  disabled={isGenerating}
                  className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-3d-sm transition-all active:scale-95"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>Generate Deep Notes &amp; Audit</span>
                </button>
              )}
            </div>
          ) : (
            sortedNotes.map((note) => {
              const isSelected = activeNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (activeNote && activeNote.id !== note.id) {
                      flushNote(activeNote.id);
                      setDraft(null);
                    }
                    setActiveNoteId(note.id);
                  }}
                  className={`group p-3 rounded-xl text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutral-850 text-neutral-100 border border-neutral-700 shadow-3d-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold truncate flex items-center gap-1.5">
                      {note.is_pinned ? (
                        <Pin className="w-3 h-3 text-neutral-300 fill-neutral-300 shrink-0" />
                      ) : null}
                      <span className="truncate">{note.title}</span>
                    </span>
                    {getFormatBadge(note.format_type, note.title)}
                  </div>
                  <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                    {note.content.replace(/[#*`_]/g, '')}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Note Editor / Viewer Area */}
      <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
        {isCreating ? (
          <div className="p-8 max-w-3xl w-full mx-auto space-y-4">
            <h3 className="text-sm font-semibold text-neutral-100">Create New Study Note</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Risk Assessment Framework (Cornell Style)"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 shadow-3d-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Note Format Template
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cornell', 'bullet', 'exam', 'standard'] as NoteFormatType[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setNewFormat(fmt)}
                      className={`p-2 rounded-xl text-xs font-medium uppercase text-center border transition-all ${
                        newFormat === fmt
                          ? 'border-neutral-600 bg-neutral-800 text-neutral-100 shadow-3d-sm'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:bg-neutral-850 hover:text-neutral-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Content (Markdown)</label>
                <textarea
                  rows={10}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Type note content or leave blank to use the format's default template..."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 font-mono focus:outline-none focus:border-neutral-600 shadow-3d-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-medium shadow-3d-sm transition-all active:scale-95"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        ) : activeNote ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Note Top Actions */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={activeDraft ? activeDraft.title : activeNote.title}
                  onChange={(e) => {
                    setDraft({
                      id: activeNote.id,
                      title: e.target.value,
                      content: activeDraft ? activeDraft.content : activeNote.content,
                    });
                    scheduleUpdate(activeNote.id, { title: e.target.value });
                  }}
                  onBlur={() => flushNote(activeNote.id)}
                  className="bg-transparent font-semibold text-sm text-neutral-100 focus:outline-none focus:border-b border-neutral-600 px-1"
                />
                {getFormatBadge(activeNote.format_type, activeNote.title)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    onUpdateNote(activeNote.id, { is_pinned: activeNote.is_pinned ? 0 : 1 })
                  }
                  className={`p-1.5 rounded-lg transition-colors ${
                    activeNote.is_pinned
                      ? 'text-neutral-200 bg-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                  title={activeNote.is_pinned ? 'Unpin Note' : 'Pin Note'}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Export as Markdown (.md)"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete note "${activeNote.title}"?`)) {
                      cancelPending(activeNote.id);
                      onDeleteNote(activeNote.id);
                    }
                  }}
                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Delete Note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note Content Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
              <textarea
                value={activeDraft ? activeDraft.content : activeNote.content}
                onChange={(e) => {
                  setDraft({
                    id: activeNote.id,
                    title: activeDraft ? activeDraft.title : activeNote.title,
                    content: e.target.value,
                  });
                  scheduleUpdate(activeNote.id, { content: e.target.value });
                }}
                onBlur={() => flushNote(activeNote.id)}
                className="w-full h-full bg-transparent text-xs text-neutral-200 font-mono leading-relaxed resize-none focus:outline-none placeholder-neutral-600 select-text"
                placeholder="Write your research notes here..."
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-neutral-600">
            Select a note or create a new one to begin editing.
          </div>
        )}
      </div>
    </div>
  );
};
