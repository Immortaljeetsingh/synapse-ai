export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db/queries';

export async function GET() {
  try {
    const provider = await getSetting('ai_provider', process.env.AI_PROVIDER || 'openrouter');
    const model = await getSetting('ai_model', process.env.AI_MODEL || 'openai/gpt-oss-20b:free');
    const baseUrl = await getSetting('ai_base_url', process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1');
    const hasApiKey = Boolean(await getSetting('ai_api_key', process.env.AI_API_KEY || ''));

    return NextResponse.json({
      success: true,
      settings: {
        provider,
        model,
        baseUrl,
        hasApiKey,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, model, baseUrl, apiKey } = body;

    if (provider) await setSetting('ai_provider', provider);
    if (model) await setSetting('ai_model', model);
    if (baseUrl !== undefined) await setSetting('ai_base_url', baseUrl);
    if (apiKey !== undefined && apiKey !== '********') {
      await setSetting('ai_api_key', apiKey);
    }

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
