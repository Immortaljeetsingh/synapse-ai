export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTopicPerformance, getWeakTopics } from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }

    const performance = await getTopicPerformance(notebookId);
    const weakTopics = await getWeakTopics(notebookId);
    const strongTopics = performance.filter((p) => p.accuracy_pct >= 75).map((p) => p.topic);

    return NextResponse.json({
      success: true,
      performance,
      weakTopics,
      strongTopics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
