export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDocumentsByNotebook, getChunksByNotebook } from '@/lib/db/queries';
import { getAIProvider, PROMPTS, getCachedArtifact, setCachedArtifact } from '@/lib/ai';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const cached = await getCachedArtifact(notebookId, 'comparison');
    if (cached) {
      return NextResponse.json({ success: true, comparison: cached });
    }

    const docs = await getDocumentsByNotebook(notebookId);
    if (docs.length < 2) {
      return NextResponse.json({
        success: true,
        comparison: {
          comparison_topic: 'Single Document Available',
          documents: docs.map((d) => ({
            document_name: d.filename,
            viewpoint: 'Primary source reference',
            key_findings: ['Upload a second document to generate cross-document comparison and contradiction matrix.'],
            citations: ['Page 1'],
          })),
          agreements: ['Upload additional documents to detect consensus points.'],
          contradictions: ['No conflicting documents uploaded yet.'],
          synthesis: 'Once you upload 2 or more documents into this notebook, the AI comparison engine will automatically contrast methodologies, findings, and statements.',
        },
      });
    }

    const chunks = await getChunksByNotebook(notebookId);
    const docSummarySnippets = docs
      .map((d) => {
        const docChunks = chunks.filter((c) => c.document_id === d.id).slice(0, 4);
        return `=== Document: ${d.filename} ===\n${docChunks.map((c) => `[p.${c.page_number}] ${c.text}`).join('\n')}`;
      })
      .join('\n\n');

    const ai = await getAIProvider();
    const prompt = PROMPTS.DOCUMENT_COMPARISON(docSummarySnippets);
    const comparison = await ai.generateStructuredJson([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ]);

    await setCachedArtifact(notebookId, 'comparison', comparison);
    return NextResponse.json({ success: true, comparison });
  } catch (err: any) {
    console.error('Error generating document comparison:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
