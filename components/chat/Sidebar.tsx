'use client';

import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  BookOpen,
  Settings,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Bookmark,
  Gamepad2,
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

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
  };

  if (isCollapsed) {
    return (
      <div className="w-14 h-screen bg-neutral-950 border-r border-neutral-900 flex flex-col items-center justify-between py-4 select-none shrink-0">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <SynapseLogo size="sm" />
          <button
            onClick={handleStartNewChat}
            className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 flex items-center justify-center transition-colors shadow-3d-sm"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <ThemeToggle variant="icon-only" />
          <button
            onClick={onOpenLibrary}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 transition-colors"
            title="Library"
          >
            <Bookmark className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 h-screen bg-neutral-950 border-r border-neutral-900 flex flex-col justify-between select-none shrink-0">
      {/* Top Brand & New Chat */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SynapseLogo size="sm" showText showTagline />
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleStartNewChat}
          className="w-full py-2.5 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 rounded-2xl text-xs font-semibold border border-neutral-800 transition-all flex items-center gap-2 shadow-3d-sm"
        >
          <Plus className="w-4 h-4 text-neutral-400" />
          <span>New Chat</span>
        </button>

        {/* Search Chats */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-600 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-900/50 border border-neutral-900 rounded-xl text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Conversation History Groupings */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4 text-xs">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((n) => {
                const isActive = n.id === activeNotebookId;
                return (
                  <div
                    key={n.id}
                    onClick={() => onSelectNotebook(n.id)}
                    className={`group px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isActive
                        ? 'bg-neutral-800 text-neutral-100 font-medium shadow-3d-sm'
                        : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-neutral-300' : 'text-neutral-700'}`} />
                      <span className="truncate">{n.title || 'Untitled Chat'}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNotebook(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-neutral-600 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Library & Settings */}
      <div className="p-3 border-t border-neutral-900 space-y-1">
        <ThemeToggle />

        <button
          onClick={onOpenLibrary}
          className="w-full px-3 py-2 rounded-xl text-xs text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors flex items-center gap-2.5"
        >
          <Bookmark className="w-4 h-4 text-neutral-600" />
          <span>Library &amp; Saved Notes</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full px-3 py-2 rounded-xl text-xs text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors flex items-center gap-2.5"
        >
          <Settings className="w-4 h-4 text-neutral-600" />
          <span>Settings &amp; Model Info</span>
        </button>
      </div>
    </div>
  );
};
