'use client';

import React from 'react';
import { ExternalLink, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onOpenCitation?: (docName: string, pageNumber: number, excerpt: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onOpenCitation,
}) => {
  if (!content) return null;

  // Pre-process lines to group blocks (headings, tables, lists, blockquotes, paragraphs)
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

    // 2. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${keyIndex++}`}
          className="text-base font-bold text-neutral-100 pb-2 mb-3 mt-4 border-b border-neutral-800 tracking-tight first:mt-0"
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
          className={`text-sm font-bold text-neutral-100 mt-5 mb-2.5 flex items-center gap-2 ${
            headingText.includes('Sources') ? 'pt-3 border-t border-neutral-800' : ''
          }`}
        >
          {isNumbered && (
            <span className="w-5 h-5 rounded-md bg-neutral-800 bevel text-neutral-300 text-[10px] font-mono flex items-center justify-center shrink-0">
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
          className="text-xs font-bold text-neutral-200 mt-3.5 mb-1.5 tracking-wide text-neutral-200 uppercase"
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
          className="text-xs font-semibold text-neutral-300 mt-2.5 mb-1 text-neutral-300"
        >
          {renderInlineFormatting(trimmed.substring(5), onOpenCitation)}
        </h4>
      );
      i++;
      continue;
    }

    // 3. Blockquotes / Callouts
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <div
          key={`quote-${keyIndex++}`}
          className="my-3 p-3 bg-neutral-900/90 border-l-2 border-neutral-400 rounded-r-xl text-xs text-neutral-200 leading-relaxed shadow-3d-sm space-y-1"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInlineFormatting(ql, onOpenCitation)}</p>
          ))}
        </div>
      );
      continue;
    }

    // 4. Markdown Tables
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

        // Skip separator line (|---|---|)
        const rowLines = tableLines.slice(2);

        elements.push(
          <div
            key={`table-${keyIndex++}`}
            className="my-3 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 shadow-3d-sm"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-900/80 border-b border-neutral-800">
                  {headerCols.map((col, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 font-semibold text-neutral-300 border-r border-neutral-800/60 last:border-r-0">
                      {renderInlineFormatting(col, onOpenCitation)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {rowLines.map((rLine, rIdx) => {
                  const cells = rLine
                    .split('|')
                    .slice(1, -1)
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx} className="hover:bg-neutral-900/40 transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-neutral-300 border-r border-neutral-850/60 last:border-r-0">
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

    // 5. Unordered / Ordered Lists
    if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
      const listItems: Array<{ isOrdered: boolean; num?: string; text: string; indent: number }> = [];

      while (i < lines.length) {
        const currLine = lines[i];
        const currTrim = currLine.trim();
        if (!currTrim) break;

        const isUnordered = currTrim.startsWith('- ');
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
        <div key={`list-${keyIndex++}`} className="my-2 space-y-1.5 text-xs text-neutral-300">
          {listItems.map((item, lIdx) => {
            const isNested = item.indent > 1;
            return (
              <div
                key={lIdx}
                className={`flex items-start gap-2 leading-relaxed ${
                  isNested ? 'ml-5 text-neutral-400' : 'text-neutral-200'
                }`}
              >
                {item.isOrdered ? (
                  <span className="font-mono text-neutral-500 font-semibold shrink-0 select-none">
                    {item.num}.
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0 mt-1.5 select-none" />
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

    // 6. Regular Paragraph
    elements.push(
      <p key={`p-${keyIndex++}`} className="text-xs text-neutral-300 leading-relaxed my-1.5 select-text">
        {renderInlineFormatting(trimmed, onOpenCitation)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
};

/**
 * Parses inline bold, code, and interactive citations like [Document.docx, p. 13].
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
      parts.push(...parseBoldAndCode(preText));
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
        className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-neutral-500 font-mono text-[10px] transition-all cursor-pointer shadow-3d-sm select-none"
        title={`Open ${docName} on Page ${pageNum}`}
      >
        <FileText className="w-2.5 h-2.5 text-neutral-400" />
        <span className="truncate max-w-[140px] font-semibold">{docName}</span>
        <span className="text-neutral-400 font-mono">p.{pageNum}</span>
        <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
      </button>
    );

    lastIndex = citationRegex.lastIndex;
  }

  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    parts.push(...parseBoldAndCode(remainingText));
  }

  return <>{parts}</>;
}

/**
 * Parses **bold** and `code` spans.
 */
function parseBoldAndCode(text: string): React.ReactNode[] {
  const spans: React.ReactNode[] = [];
  // Tokenize bold **...** and inline code `...`
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;

  const parts = text.split(tokenRegex);

  parts.forEach((part, idx) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      spans.push(
        <strong key={idx} className="font-bold text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      spans.push(
        <code key={idx} className="px-1.5 py-0.5 rounded bg-neutral-900 font-mono text-[11px] text-neutral-300 border border-neutral-800">
          {part.slice(1, -1)}
        </code>
      );
    } else {
      spans.push(<span key={idx}>{part}</span>);
    }
  });

  return spans;
}
