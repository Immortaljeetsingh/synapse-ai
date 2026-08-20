import { getChunksByNotebook } from '../db/queries';
import { computeTextVector, cosineSimilarity } from './embeddings';
import { CitationReference } from '../types';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  sectionHeading: string;
  text: string;
  score: number;
  bm25Score: number;
  vectorScore: number;
  subtopic?: string;
}

export interface EvidenceMapItem {
  subtopic: string;
  documentName: string;
  pageNumber: number;
  sectionHeading: string;
  excerpt: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  citations: CitationReference[];
  groundedContextText: string;
  evidenceMap?: EvidenceMapItem[];
  subtopicResults?: Record<string, RetrievedChunk[]>;
}

// Stopwords set
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Single-query hybrid BM25 + vector similarity retrieval.
 */
export async function hybridRetrieve(
  notebookId: string,
  query: string,
  options: {
    topK?: number;
    documentFilterId?: string;
    minScore?: number;
    subtopicName?: string;
    externalChunks?: any[];
  } = {}
): Promise<RetrievalResult> {
  const topK = options.topK || 12;
  const minScore = options.minScore || 0.02;

  let allChunks = options.externalChunks && options.externalChunks.length > 0
    ? [...options.externalChunks]
    : await getChunksByNotebook(notebookId);

  if (options.documentFilterId) {
    allChunks = allChunks.filter((c) => c.document_id === options.documentFilterId);
  }

  // Serverless Lambda Fallback: If chunks were not in memory for this lambda, re-index documents on disk
  if (allChunks.length === 0) {
    try {
      const { getDocumentsByNotebook, insertChunks } = await import('../db/queries');
      const { parseDocument } = await import('../parsers');
      const { chunkDocument } = await import('./chunker');
      const fs = await import('fs');

      const docs = await getDocumentsByNotebook(notebookId);
      for (const doc of docs) {
        if (doc.file_path && fs.existsSync(doc.file_path)) {
          const parsed = await parseDocument(doc.file_path, doc.filename);
          const rawChunks = chunkDocument(parsed, doc.id, doc.notebook_id, doc.filename, {
            targetChunkSize: 900,
            overlapSize: 120,
          });
          const processedChunks = rawChunks.map((chunk) => ({
            ...chunk,
            embedding_json: JSON.stringify(computeTextVector(chunk.text + ' ' + chunk.section_heading)),
          }));
          await insertChunks(processedChunks);
          allChunks.push(...processedChunks);
        }
      }
    } catch (e) {
      console.warn('Fallback serverless chunking error:', e);
    }
  }

  if (allChunks.length === 0) {
    return { query, chunks: [], citations: [], groundedContextText: '' };
  }

  const queryTerms = tokenize(query);
  const queryVector = computeTextVector(query);

  const k1 = 1.2;
  const b = 0.75;
  const totalChunks = allChunks.length;
  let totalLength = 0;

  const chunkTokenMap: Map<string, string[]> = new Map();
  const docFreqMap: Map<string, number> = new Map();

  for (const chunk of allChunks) {
    const tokens = tokenize(chunk.text + ' ' + chunk.section_heading);
    chunkTokenMap.set(chunk.id, tokens);
    totalLength += tokens.length;

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFreqMap.set(token, (docFreqMap.get(token) || 0) + 1);
    }
  }

  const avgDocLength = totalLength / (totalChunks || 1);
  const scoredChunks: RetrievedChunk[] = [];

  for (const chunk of allChunks) {
    const tokens = chunkTokenMap.get(chunk.id) || [];
    const docLen = tokens.length;

    const tfMap: Map<string, number> = new Map();
    for (const t of tokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }

    let bm25Score = 0;
    for (const qTerm of queryTerms) {
      const tf = tfMap.get(qTerm) || 0;
      const df = docFreqMap.get(qTerm) || 0;
      const idf = Math.log(1 + (totalChunks - df + 0.5) / (df + 0.5));
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLength));
      bm25Score += idf * (numerator / (denominator || 1));
    }

    let chunkVector: number[];
    if (chunk.embedding_json) {
      try {
        chunkVector = JSON.parse(chunk.embedding_json);
      } catch {
        chunkVector = computeTextVector(chunk.text);
      }
    } else {
      chunkVector = computeTextVector(chunk.text);
    }

    const vectorScore = cosineSimilarity(queryVector, chunkVector);
    const normalizedBM25 = Math.min(1.0, bm25Score / (queryTerms.length * 2.5 || 1));

    let headingBoost = 0;
    if (chunk.section_heading) {
      const headingTokens = tokenize(chunk.section_heading);
      const hasHeadingMatch = queryTerms.some((qt) => headingTokens.includes(qt));
      if (hasHeadingMatch) headingBoost = 0.15;
    }

    const totalScore = 0.45 * normalizedBM25 + 0.45 * vectorScore + headingBoost;

    if (totalScore >= minScore || scoredChunks.length < 2) {
      scoredChunks.push({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentName: chunk.filename || 'Document',
        pageNumber: chunk.page_number,
        sectionHeading: chunk.section_heading || '',
        text: chunk.text,
        score: totalScore,
        bm25Score: normalizedBM25,
        vectorScore,
        subtopic: options.subtopicName,
      });
    }
  }

  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, topK);

  const citations: CitationReference[] = topChunks.map((c) => ({
    document_id: c.documentId,
    document_name: c.documentName,
    page_number: c.pageNumber,
    section_heading: c.sectionHeading,
    excerpt: c.text.length > 200 ? c.text.slice(0, 200) + '...' : c.text,
    relevance_score: Math.round(c.score * 100) / 100,
  }));

  const groundedContextText = topChunks
    .map(
      (c, idx) =>
        `[EVIDENCE ${idx + 1}] (Document: "${c.documentName}", Page: ${c.pageNumber}${
          c.sectionHeading ? `, Section: "${c.sectionHeading}"` : ''
        }${c.subtopic ? `, Subtopic: "${c.subtopic}"` : ''})\n${c.text}`
    )
    .join('\n\n---\n\n');

  return {
    query,
    chunks: topChunks,
    citations,
    groundedContextText,
  };
}

/**
 * Deep Multi-Stage Subtopic Retrieval Engine for Comprehensive Research & Analysis.
 * Executes multiple targeted retrieval passes across core analytical facets.
 */
export async function multiStageDeepRetrieve(
  notebookId: string,
  userQuery: string,
  options: { documentFilterId?: string; externalChunks?: any[] } = {}
): Promise<RetrievalResult> {
  // Define comprehensive analytical passes
  const subtopicPasses = [
    {
      name: 'Lifecycle & Sourcing',
      queries: [
        `${userQuery} lifecycle stages opportunity identification sourcing qualification due diligence`,
        'process stages workflow phase step discovery selection',
      ],
    },
    {
      name: 'Governance & Decision Gates',
      queries: [
        'decision gates approval criteria go no-go sign-off governance escalation committee',
        'risk assessment compliance clearance thresholds authorization',
      ],
    },
    {
      name: 'Monitoring & KPIs',
      queries: [
        'performance monitoring review cycles KPIs indicators metrics tracking milestones variance RAG status',
        'evaluation ongoing review progress tracking operational benchmarks',
      ],
    },
    {
      name: 'Reporting & Timelines',
      queries: [
        'reporting frequency reporting cycles donor reporting financial narrative submission deadlines schedule timeline T+',
        'reconciliation validation quality review submission approval',
      ],
    },
    {
      name: 'Roles & Responsibilities',
      queries: [
        'roles responsibilities partnerships team finance programme M&E grants leadership coordinator lead reviewer',
        'ownership accountability RACI matrix delegation',
      ],
    },
    {
      name: 'Risks, Gaps & Contradictions',
      queries: [
        'risks challenges bottlenecks friction gaps limitations issues assumptions errors discrepancies inconsistencies',
        'vulnerabilities audit constraints missing data',
      ],
    },
  ];

  const allFoundChunks: Map<string, RetrievedChunk> = new Map();
  const subtopicResults: Record<string, RetrievedChunk[]> = {};

  // Execute primary user query pass first
  const primaryResult = await hybridRetrieve(notebookId, userQuery, {
    topK: 8,
    documentFilterId: options.documentFilterId,
    minScore: 0.01,
    externalChunks: options.externalChunks,
  });
  primaryResult.chunks.forEach((c) => allFoundChunks.set(c.chunkId, c));

  // Execute multi-stage subtopic passes
  for (const pass of subtopicPasses) {
    const passChunks: RetrievedChunk[] = [];
    for (const q of pass.queries) {
      const res = await hybridRetrieve(notebookId, q, {
        topK: 4,
        documentFilterId: options.documentFilterId,
        minScore: 0.02,
        subtopicName: pass.name,
        externalChunks: options.externalChunks,
      });

      for (const chunk of res.chunks) {
        passChunks.push(chunk);
        if (!allFoundChunks.has(chunk.chunkId) || (allFoundChunks.get(chunk.chunkId)!.score < chunk.score)) {
          allFoundChunks.set(chunk.chunkId, { ...chunk, subtopic: pass.name });
        }
      }
    }
    subtopicResults[pass.name] = passChunks;
  }

  // Deduplicate and sort all retrieved chunks
  const deduplicatedChunks = Array.from(allFoundChunks.values()).sort((a, b) => b.score - a.score);

  // Build unified Evidence Map
  const evidenceMap: EvidenceMapItem[] = deduplicatedChunks.map((c) => ({
    subtopic: c.subtopic || 'General Evidence',
    documentName: c.documentName,
    pageNumber: c.pageNumber,
    sectionHeading: c.sectionHeading || 'Main Content',
    excerpt: c.text.length > 250 ? c.text.slice(0, 250) + '...' : c.text,
    confidence: c.score >= 0.25 ? 'HIGH' : c.score >= 0.1 ? 'MEDIUM' : 'LOW',
  }));

  // Build high-density structured context text for LLM
  const structuredContextByDoc: Record<string, RetrievedChunk[]> = {};
  for (const chunk of deduplicatedChunks) {
    if (!structuredContextByDoc[chunk.documentName]) {
      structuredContextByDoc[chunk.documentName] = [];
    }
    structuredContextByDoc[chunk.documentName].push(chunk);
  }

  let groundedContextText = `=== COMPREHENSIVE MULTI-STAGE EVIDENCE MAP (${deduplicatedChunks.length} VERIFIED PASSAGES ACROSS ${Object.keys(structuredContextByDoc).length} DOCUMENTS) ===\n\n`;

  for (const [docName, chunks] of Object.entries(structuredContextByDoc)) {
    groundedContextText += `## DOCUMENT: "${docName}" (Total Retrieved Passages: ${chunks.length})\n\n`;
    chunks.forEach((c, idx) => {
      groundedContextText += `### [Passage ${idx + 1}] Page ${c.pageNumber}${c.sectionHeading ? ` — Section: "${c.sectionHeading}"` : ''}${c.subtopic ? ` (Facet: ${c.subtopic})` : ''}\n"""\n${c.text}\n"""\n\n`;
    });
    groundedContextText += `--------------------------------------------------\n\n`;
  }

  // Build clean citation references
  const citations: CitationReference[] = deduplicatedChunks.map((c) => ({
    document_id: c.documentId,
    document_name: c.documentName,
    page_number: c.pageNumber,
    section_heading: c.sectionHeading,
    excerpt: c.text.slice(0, 200),
    relevance_score: Math.round(c.score * 100) / 100,
  }));

  return {
    query: userQuery,
    chunks: deduplicatedChunks,
    citations,
    groundedContextText,
    evidenceMap,
    subtopicResults,
  };
}
