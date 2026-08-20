export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai';

async function performHealthCheck(req: NextRequest, bodyOverrides?: any) {
  try {
    const headerApiKey = req.headers.get('x-api-key') || undefined;
    const headerProvider = req.headers.get('x-provider') || undefined;
    const headerModel = req.headers.get('x-model') || undefined;
    const headerBaseUrl = req.headers.get('x-base-url') || undefined;

    const overrides = {
      apiKey: bodyOverrides?.apiKey || headerApiKey,
      provider: bodyOverrides?.provider || headerProvider,
      model: bodyOverrides?.model || headerModel,
      baseUrl: bodyOverrides?.baseUrl || headerBaseUrl,
    };

    const provider = await getAIProvider(overrides);

    // If it's the local fallback, report that
    if (provider.id === 'local') {
      return NextResponse.json({
        status: 'local_mode',
        connected: false,
        provider: 'local',
        model: 'Local Fallback (No API Key)',
        message: 'No API key configured. Enter your API Key in Settings or set AI_API_KEY in Vercel.',
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
        model: overrides.model || process.env.AI_MODEL || 'configured',
        fallbackModel: process.env.AI_MODEL_FALLBACK || null,
        testResponse: result.text?.slice(0, 50),
        usage: result.usage,
      });
    } catch (err: any) {
      return NextResponse.json({
        status: 'error',
        connected: false,
        provider: provider.id,
        model: overrides.model || process.env.AI_MODEL || 'configured',
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

export async function GET(req: NextRequest) {
  return performHealthCheck(req);
}

export async function POST(req: NextRequest) {
  let bodyOverrides = {};
  try {
    bodyOverrides = await req.json();
  } catch {}
  return performHealthCheck(req, bodyOverrides);
}
