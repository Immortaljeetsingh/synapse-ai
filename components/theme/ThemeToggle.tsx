'use client';

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented' | 'icon-only';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'icon-only') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-xl text-neutral-500 hover:text-neutral-200 dark:hover:text-neutral-100 hover:bg-neutral-800/40 dark:hover:bg-neutral-900 transition-colors shadow-3d-sm ${className}`}
        title={`Current: ${resolvedTheme === 'dark' ? 'Dark Mode' : 'Light Mode'} (Click to toggle)`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-neutral-600" />
        )}
      </button>
    );
  }

  if (variant === 'segmented') {
    return (
      <div className={`flex items-center p-1 bg-neutral-950 dark:bg-neutral-950 border border-neutral-800 rounded-2xl gap-1 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            theme === 'light'
              ? 'bg-neutral-200 text-neutral-900 font-semibold shadow-3d-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            theme === 'dark'
              ? 'bg-neutral-800 text-white font-semibold shadow-3d-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            theme === 'system'
              ? 'bg-neutral-800 text-white font-semibold shadow-3d-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`w-full px-3 py-2 rounded-xl text-xs text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors flex items-center justify-between group ${className}`}
    >
      <div className="flex items-center gap-2.5">
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 transition-colors" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 group-hover:text-amber-400 transition-colors" />
        )}
        <span className="font-medium">Theme Mode</span>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 uppercase font-mono">
        {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
};
