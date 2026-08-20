export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai';

export async function GET() {
  try {
    const provider = await getAIProvider();

    // If it's the local fallback, report that
    if (provider.id === 'local') {
      return NextResponse.json({
        status: 'local_mode',
        connected: false,
        provider: 'local',
        model: 'Local Fallback (No API Key)',
        message: 'No API key configured. Set AI_API_KEY in .env.local or Settings to enable real AI.',
      });
    }

    // Test with a real completion
    try {
      const result = await provider.generateText([
        { role: 'user', content: 'Reply with exactly: CONNECTED' },
      ], { maxTokens: 10, temperature: 0 });

      return NextResponse.json({
        status: 'connected',
        connected: true,
        provider: provider.id,
        model: process.env.AI_MODEL || process.env.OPENCODE_ZEN_MODEL || 'unknown',
        fallbackModel: process.env.AI_MODEL_FALLBACK || null,
        testResponse: result.text?.slice(0, 50),
        usage: result.usage,
      });
    } catch (err: any) {
      return NextResponse.json({
        status: 'error',
        connected: false,
        provider: provider.id,
        model: process.env.AI_MODEL || process.env.OPENCODE_ZEN_MODEL || 'unknown',
        error: err.message,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      connected: false,
      error: err.message,
    }, { status: 500 });
  }
}
