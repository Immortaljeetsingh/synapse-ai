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
  let dbProvider = overrides?.provider || process.env.AI_PROVIDER || process.env.OPENCODE_ZEN_PROVIDER || 'openrouter';
  let dbModel = overrides?.model || process.env.AI_MODEL || process.env.OPENCODE_ZEN_MODEL || 'openai/gpt-oss-20b:free';
  let dbApiKey = overrides?.apiKey || process.env.AI_API_KEY || process.env.OPENCODE_ZEN_API_KEY || '';
  let dbBaseUrl = overrides?.baseUrl || process.env.AI_BASE_URL || process.env.OPENCODE_ZEN_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!overrides?.apiKey) {
    try {
      dbProvider = await getSetting('ai_provider', dbProvider);
      dbModel = await getSetting('ai_model', dbModel);
      dbApiKey = await getSetting('ai_api_key', dbApiKey);
      dbBaseUrl = await getSetting('ai_base_url', dbBaseUrl);
    } catch (e) {
      console.warn('Could not read settings from DB, using process.env:', e);
    }
  }

  // If no API key at all and not ollama/local, use local fallback
  if (!dbApiKey && dbProvider !== 'ollama' && dbProvider !== 'local') {
    return new LocalFallbackProvider();
  }

  switch (dbProvider) {
    case 'openrouter':
      return new OpenRouterProvider({
        apiKey: dbApiKey,
        baseUrl: dbBaseUrl || 'https://openrouter.ai/api/v1',
        model: dbModel,
      });

    case 'opencode_zen':
      return new OpenCodeZenProvider({
        apiKey: dbApiKey,
        baseUrl: dbBaseUrl,
        model: dbModel,
      });

    case 'openai':
    case 'custom':
    case 'groq':
    case 'deepseek':
    case 'together':
    case 'ollama':
      return new OpenAIProvider({
        apiKey: dbApiKey || 'ollama-key',
        baseUrl: dbBaseUrl || 'https://api.openai.com/v1',
        model: dbModel || (dbProvider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'),
      });

    case 'local':
    default:
      return new LocalFallbackProvider();
  }
}
