'use client';

import React, { useState } from 'react';
import { ExternalLink, FileText, Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onOpenCitation?: (docName: string, pageNumber: number, excerpt: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onOpenCitation,
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  let keyIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Blocks (```language ... ```)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.replace(/^```/, '').trim() || 'code';
      const codeLines: string[] = [];
      i++; // Skip opening ```

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // Skip closing ```
      }

      const fullCode = codeLines.join('\n');
      elements.push(
        <CodeBlock key={`code-${keyIndex++}`} language={lang} code={fullCode} />
      );
      continue;
    }

    // 3. Horizontal Rules (--- or *** or ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${keyIndex++}`} className="my-4 border-neutral-800 dark:border-neutral-800 border-neutral-200" />
      );
      i++;
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${keyIndex++}`}
          className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 pb-2 mb-3 mt-5 border-b border-neutral-200 dark:border-neutral-800 tracking-tight first:mt-0"
        >
          {renderInlineFormatting(trimmed.substring(2), onOpenCitation)}
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.substring(3);
      const isNumbered = /^\d+\./.test(headingText);
      elements.push(
        <h2
          key={`h2-${keyIndex++}`}
          className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 mt-5 mb-2 flex items-center gap-2"
        >
          {isNumbered && (
            <span className="w-5 h-5 rounded-md bg-neutral-200 dark:bg-neutral-800 bevel text-neutral-700 dark:text-neutral-300 text-[10px] font-mono flex items-center justify-center shrink-0">
              {headingText.split('.')[0]}
            </span>
          )}
          <span>{renderInlineFormatting(isNumbered ? headingText.replace(/^\d+\.\s*/, '') : headingText, onOpenCitation)}</span>
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${keyIndex++}`}
          className="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-4 mb-1.5 tracking-wide"
        >
          {renderInlineFormatting(trimmed.substring(4), onOpenCitation)}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4
          key={`h4-${keyIndex++}`}
          className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mt-3 mb-1 uppercase tracking-wider text-[11px]"
        >
          {renderInlineFormatting(trimmed.substring(5), onOpenCitation)}
        </h4>
      );
      i++;
      continue;
    }

    // 5. Blockquotes / Callouts (> text)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <div
          key={`quote-${keyIndex++}`}
          className="my-3 p-3 bg-neutral-100 dark:bg-neutral-900/90 border-l-3 border-neutral-400 dark:border-neutral-500 rounded-r-xl text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed shadow-3d-sm space-y-1"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInlineFormatting(ql, onOpenCitation)}</p>
          ))}
        </div>
      );
      continue;
    }

    // 6. Markdown Tables (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        // Skip separator row (|---|---|)
        const rowLines = tableLines.slice(2);

        elements.push(
          <div
            key={`table-${keyIndex++}`}
            className="my-3 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-3d-sm"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800">
                  {headerCols.map((col, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 font-semibold text-neutral-900 dark:text-neutral-200 border-r border-neutral-200 dark:border-neutral-800/60 last:border-r-0">
                      {renderInlineFormatting(col, onOpenCitation)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                {rowLines.map((rLine, rIdx) => {
                  const cells = rLine
                    .split('|')
                    .slice(1, -1)
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2.5 text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-850/60 last:border-r-0">
                          {renderInlineFormatting(cell, onOpenCitation)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 7. Unordered (- or *) / Ordered (1.) Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      const listItems: Array<{ isOrdered: boolean; num?: string; text: string; indent: number }> = [];

      while (i < lines.length) {
        const currLine = lines[i];
        const currTrim = currLine.trim();
        if (!currTrim) break;

        const isUnordered = currTrim.startsWith('- ') || currTrim.startsWith('* ');
        const isOrdered = /^\d+\.\s/.test(currTrim);

        if (!isUnordered && !isOrdered) break;

        const indent = currLine.search(/\S/);
        if (isUnordered) {
          listItems.push({ isOrdered: false, text: currTrim.substring(2), indent });
        } else {
          const match = currTrim.match(/^(\d+)\.\s*(.*)$/);
          listItems.push({
            isOrdered: true,
            num: match ? match[1] : '1',
            text: match ? match[2] : currTrim,
            indent,
          });
        }
        i++;
      }

      elements.push(
        <div key={`list-${keyIndex++}`} className="my-2 space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
          {listItems.map((item, lIdx) => {
            const isNested = item.indent > 1;
            return (
              <div
                key={lIdx}
                className={`flex items-start gap-2.5 leading-relaxed ${
                  isNested ? 'ml-5 text-neutral-600 dark:text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                {item.isOrdered ? (
                  <span className="font-mono text-neutral-500 dark:text-neutral-400 font-semibold shrink-0 select-none text-[11px]">
                    {item.num}.
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0 mt-1.5 select-none" />
                )}
                <div className="flex-1 select-text">
                  {renderInlineFormatting(item.text, onOpenCitation)}
                </div>
              </div>
            );
          })}
        </div>
      );
      continue;
    }

    // 8. Standard Paragraph
    elements.push(
      <p key={`p-${keyIndex++}`} className="text-xs sm:text-[13px] text-neutral-800 dark:text-neutral-300 leading-relaxed my-1.5 select-text">
        {renderInlineFormatting(trimmed, onOpenCitation)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
};

/**
 * Fenced Code Block component with Syntax Header and 1-Click Copy
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 shadow-3d-sm">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[11px] font-mono">
        <span className="uppercase font-semibold tracking-wider text-neutral-400">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors select-none text-[10px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto text-xs font-mono text-neutral-200 leading-relaxed no-scrollbar selection:bg-neutral-800">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Parses inline bold, italics, code, links, and interactive citations
 */
function renderInlineFormatting(
  text: string,
  onOpenCitation?: (docName: string, pageNumber: number, excerpt: string) => void
): React.ReactNode {
  if (!text) return '';

  // Regex to match citation patterns: [Doc: file.docx, p. 12] or [file.docx, p. 12] or [file.pdf, p. 12]
  const citationRegex = /\[(?:Doc:\s*|Source:\s*)?([^,\]]+\.(?:pdf|docx|txt|md|csv|xlsx|pptx|doc)),\s*p\.?\s*(\d+)\]/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index);
    if (preText) {
      parts.push(...parseMarkdownSpans(preText));
    }

    const docName = match[1].trim();
    const pageNum = parseInt(match[2], 10) || 1;

    parts.push(
      <button
        key={`cit-${match.index}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onOpenCitation) {
            onOpenCitation(docName, pageNum, '');
          }
        }}
        className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 font-mono text-[10px] transition-all cursor-pointer shadow-3d-sm select-none align-middle"
        title={`Open ${docName} on Page ${pageNum}`}
      >
        <FileText className="w-2.5 h-2.5 text-neutral-500 dark:text-neutral-400" />
        <span className="truncate max-w-[130px] font-semibold">{docName}</span>
        <span className="text-neutral-500 dark:text-neutral-400 font-mono">p.{pageNum}</span>
        <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
      </button>
    );

    lastIndex = citationRegex.lastIndex;
  }

  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    parts.push(...parseMarkdownSpans(remainingText));
  }

  return <>{parts}</>;
}

/**
 * Parses **bold**, *italic*, `code`, and [link](url) spans
 */
function parseMarkdownSpans(text: string): React.ReactNode[] {
  const spans: React.ReactNode[] = [];
  // Tokenizer regex for bold, inline code, italics, and markdown links
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(tokenRegex);

  parts.forEach((part, idx) => {
    if (!part) return;

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      spans.push(
        <strong key={idx} className="font-bold text-neutral-900 dark:text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Inline Code: `code`
    else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      spans.push(
        <code key={idx} className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-900 font-mono text-[11px] text-neutral-900 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Italic: *text*
    else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      spans.push(
        <em key={idx} className="italic text-neutral-800 dark:text-neutral-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    // Links: [label](url)
    else if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const href = linkMatch[2].trim();
        // Block script/data URLs — AI output is untrusted input
        const isSafe = /^(https?:|mailto:|\/|#)/i.test(href);
        spans.push(
          isSafe ? (
            <a
              key={idx}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 dark:text-white underline decoration-neutral-400 hover:decoration-white font-medium inline-flex items-center gap-0.5"
            >
              {linkMatch[1]}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span key={idx}>{part}</span>
          )
        );
      } else {
        spans.push(<span key={idx}>{part}</span>);
      }
    } else {
      spans.push(<span key={idx}>{part}</span>);
    }
  });

  return spans;
}
