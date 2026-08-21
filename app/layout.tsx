import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: 'SYNAPSE AI — Research • Study • Innovation',
  description: 'AI-powered document intelligence workspace, grounded research analysis, study guides, interactive flashcards, and verified citations.',
  icons: {
    icon: '/favicon.svg',
  },
};

// Must match ThemeProvider.tsx: key 'synapse_theme', values 'dark' | 'light' | 'system', default dark.
const themeInitScript = `
(function(){try{var t=localStorage.getItem('synapse_theme');var e=(t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches))?'light':'dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(e);r.style.colorScheme=e;}catch(_){}})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-neutral-800 selection:text-neutral-100 transition-colors duration-200">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
