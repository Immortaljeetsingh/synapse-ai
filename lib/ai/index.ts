import { BaseAIProvider } from './providers/base';
import { OpenRouterProvider } from './providers/openrouter';
import { OpenCodeZenProvider } from './providers/opencodezen';
import { OpenAIProvider } from './providers/openai';
import { LocalFallbackProvider } from './providers/local';
import { getSetting } from '../db/queries';

export * from './types';
export * from './prompts';
export * from './json-repair';
export * from './cache';

export async function getAIProvider(overrides?: {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<BaseAIProvider> {
  // Resolve the full default chain first (env + DB), THEN overlay any
  // provided override fields individually — a partial override (e.g. only
  // apiKey from headers) used to skip the DB lookup entirely and jump the
  // remaining fields back to hardcoded defaults.
  let provider = process.env.AI_PROVIDER || process.env.OPENCODE_ZEN_PROVIDER || 'openrouter';
  let model = process.env.AI_MODEL || process.env.OPENCODE_ZEN_MODEL || 'dots-studio/dots-3-note-preview:free';
  let apiKey = process.env.AI_API_KEY || process.env.OPENCODE_ZEN_API_KEY || '';
  let baseUrl = process.env.AI_BASE_URL || process.env.OPENCODE_ZEN_BASE_URL || 'https://openrouter.ai/api/v1';

  try {
    provider = await getSetting('ai_provider', provider);
    model = await getSetting('ai_model', model);
    apiKey = await getSetting('ai_api_key', apiKey);
    baseUrl = await getSetting('ai_base_url', baseUrl);
  } catch (e) {
    console.warn('Could not read settings from DB, using process.env:', e);
  }

  if (overrides?.provider) provider = overrides.provider;
  if (overrides?.model) model = overrides.model;
  if (overrides?.apiKey) apiKey = overrides.apiKey;
  if (overrides?.baseUrl) baseUrl = overrides.baseUrl;

  // If no API key at all and not ollama/local, use local fallback
  if (!apiKey && provider !== 'ollama' && provider !== 'local') {
    return new LocalFallbackProvider();
  }

  switch (provider) {
    case 'openrouter':
      return new OpenRouterProvider({
        apiKey,
        baseUrl: baseUrl || 'https://openrouter.ai/api/v1',
        model,
      });

    case 'opencode_zen':
      return new OpenCodeZenProvider({
        apiKey,
        baseUrl,
        model,
      });

    case 'openai':
    case 'custom':
    case 'groq':
    case 'deepseek':
    case 'together':
    case 'ollama':
      return new OpenAIProvider({
        apiKey: apiKey || 'ollama-key',
        baseUrl: baseUrl || 'https://api.openai.com/v1',
        model: model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'),
      });

    case 'local':
    default:
      return new LocalFallbackProvider();
  }
}
