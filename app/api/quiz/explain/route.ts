export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAIProvider, PROMPTS } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, correctAnswer, explanation } = body;

    if (!question || !correctAnswer) {
      return NextResponse.json({ success: false, error: 'Question and correctAnswer are required' }, { status: 400 });
    }

    const ai = await getAIProvider({
      apiKey: req.headers.get('x-api-key') || undefined,
      provider: req.headers.get('x-provider') || undefined,
      model: req.headers.get('x-model') || undefined,
      baseUrl: req.headers.get('x-base-url') || undefined,
    });
    const prompt = PROMPTS.EXPLAIN_DIFFERENTLY(question, correctAnswer, explanation || '');

    const res = await ai.generateText([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ]);

    return NextResponse.json({ success: true, alternativeExplanation: res.text });
  } catch (err: any) {
    console.error('Error generating alternative explanation:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
