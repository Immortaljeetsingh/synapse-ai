'use client';

import React, { useRef, useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  BookOpen,
  Settings,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Bookmark,
  Gamepad2,
  X,
} from 'lucide-react';
import { Notebook } from '@/lib/types';
import { SynapseLogo } from '@/components/brand/SynapseLogo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface SidebarProps {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  onSelectNotebook: (id: string) => void;
  onCreateNotebook: (title: string, description: string) => Promise<void>;
  onDeleteNotebook: (id: string) => Promise<void>;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notebooks,
  activeNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  onOpenSettings,
  onOpenLibrary,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = (id: string) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDeleteId === id) {
      setPendingDeleteId(null);
      onDeleteNotebook(id);
      return;
    }
    // ponytail: single pending id + one timer; per-row timers only if lists get huge
    setPendingDeleteId(id);
    deleteTimerRef.current = setTimeout(() => setPendingDeleteId(null), 3000);
  };

  // Group conversations by date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const last7Days = today - 7 * 86400000;

  const filteredNotebooks = notebooks.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: { label: string; items: Notebook[] }[] = [
    {
      label: 'Today',
      items: filteredNotebooks.filter((n) => new Date(n.updated_at).getTime() >= today),
    },
    {
      label: 'Yesterday',
      items: filteredNotebooks.filter((n) => {
        const time = new Date(n.updated_at).getTime();
        return time >= yesterday && time < today;
      }),
    },
    {
      label: 'Previous 7 Days',
      items: filteredNotebooks.filter((n) => {
        const time = new Date(n.updated_at).getTime();
        return time >= last7Days && time < yesterday;
      }),
    },
    {
      label: 'Older',
      items: filteredNotebooks.filter((n) => new Date(n.updated_at).getTime() < last7Days),
    },
  ].filter((g) => g.items.length > 0);

  const handleStartNewChat = () => {
    onCreateNotebook('New Research Chat', '');
    onCloseMobile?.();
  };

  const handleSelect = (id: string) => {
    onSelectNotebook(id);
    onCloseMobile?.();
  };

  const renderSidebarContent = (isMobileView = false) => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Brand & New Chat */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SynapseLogo size="sm" showText showTagline />
          {isMobileView ? (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 transition-colors"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-850 transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleStartNewChat}
          className="w-full py-2.5 px-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-200 rounded-2xl text-xs font-semibold border border-neutral-300 dark:border-neutral-800 transition-all flex items-center gap-2 shadow-3d-sm"
        >
          <Plus className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span>New Chat</span>
        </button>

        {/* Search Chats */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-600 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-100/80 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-900 rounded-xl text-xs text-neutral-900 dark:text-neutral-300 placeholder-neutral-500 dark:placeholder-neutral-600 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Conversation History Groupings */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4 text-xs">
        {groups.length === 0 ? (
          <div className="px-3 py-4 text-center text-neutral-500 text-[11px]">
            No previous chats
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-600 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((n) => {
                  const isActive = n.id === activeNotebookId;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleSelect(n.id)}
                      className={`group px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                        isActive
                          ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium shadow-3d-sm'
                          : 'text-neutral-600 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-neutral-800 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-700'}`} />
                        <span className="truncate">{n.title || 'Untitled Chat'}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(n.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${
                          pendingDeleteId === n.id
                            ? 'text-rose-500'
                            : 'text-neutral-400 dark:text-neutral-600 hover:text-rose-500'
                        }`}
                        title={pendingDeleteId === n.id ? 'Click again to confirm delete' : 'Delete chat'}
                      >
                        {pendingDeleteId === n.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Library & Settings */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-900 space-y-1">
        <ThemeToggle />

        <button
          onClick={() => { onOpenLibrary(); onCloseMobile?.(); }}
          className="w-full px-3 py-2 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-2.5"
        >
          <Bookmark className="w-4 h-4 text-neutral-500 dark:text-neutral-600" />
          <span>Library &amp; Saved Notes</span>
        </button>

        <button
          onClick={() => { onOpenSettings(); onCloseMobile?.(); }}
          className="w-full px-3 py-2 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-2.5"
        >
          <Settings className="w-4 h-4 text-neutral-500 dark:text-neutral-600" />
          <span>Settings &amp; Model Info</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-900 shadow-2xl z-10 animate-in">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* 2. Desktop Persistent / Collapsed Sidebar */}
      {isCollapsed ? (
        <div className="hidden md:flex w-14 app-h bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-900 flex-col items-center justify-between py-4 select-none shrink-0">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <SynapseLogo size="sm" />
            <button
              onClick={handleStartNewChat}
              className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-800 flex items-center justify-center transition-colors shadow-3d-sm"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <ThemeToggle variant="icon-only" />
            <button
              onClick={onOpenLibrary}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              title="Library"
            >
              <Bookmark className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex w-64 lg:w-72 app-h bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-900 shrink-0">
          {renderSidebarContent(false)}
        </div>
      )}
    </>
  );
};
