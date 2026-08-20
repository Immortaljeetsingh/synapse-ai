import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: 'SYNAPSE AI — Research • Study • Innovation',
  description: 'AI-powered document intelligence workspace, grounded research analysis, study guides, interactive flashcards, and verified citations.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-neutral-800 selection:text-neutral-100 transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
