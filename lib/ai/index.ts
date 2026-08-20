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

let cachedProvider: BaseAIProvider | null = null;
let lastProviderConfigKey = '';

export async function getAIProvider(): Promise<BaseAIProvider> {
  const dbProvider = await getSetting('ai_provider', process.env.AI_PROVIDER || process.env.OPENCODE_ZEN_PROVIDER || 'openrouter');
  const dbModel = await getSetting('ai_model', process.env.AI_MODEL || process.env.OPENCODE_ZEN_MODEL || 'openai/gpt-oss-20b:free');
  const dbApiKey = await getSetting('ai_api_key', process.env.AI_API_KEY || process.env.OPENCODE_ZEN_API_KEY || '');
  const dbBaseUrl = await getSetting('ai_base_url', process.env.AI_BASE_URL || process.env.OPENCODE_ZEN_BASE_URL || 'https://openrouter.ai/api/v1');
  const dbFallbackModel = process.env.AI_MODEL_FALLBACK || 'dots-studio/dots-3-note-preview:free';

  const configKey = `${dbProvider}:${dbModel}:${dbApiKey ? 'key' : 'none'}:${dbBaseUrl}`;

  if (cachedProvider && lastProviderConfigKey === configKey) {
    return cachedProvider;
  }

  // If no API key at all and not ollama/local, use local fallback
  if (!dbApiKey && dbProvider !== 'ollama' && dbProvider !== 'local') {
    cachedProvider = new LocalFallbackProvider();
    lastProviderConfigKey = configKey;
    return cachedProvider;
  }

  switch (dbProvider) {
    case 'openrouter':
      cachedProvider = new OpenRouterProvider({
        apiKey: dbApiKey,
        baseUrl: dbBaseUrl || 'https://openrouter.ai/api/v1',
        model: dbModel,
        fallbackModel: dbFallbackModel,
      });
      break;

    case 'opencode_zen':
      cachedProvider = new OpenCodeZenProvider({
        apiKey: dbApiKey,
        baseUrl: dbBaseUrl,
        model: dbModel,
      });
      break;

    case 'openai':
    case 'custom':
    case 'groq':
    case 'deepseek':
    case 'together':
    case 'ollama':
      cachedProvider = new OpenAIProvider({
        apiKey: dbApiKey || 'ollama-key',
        baseUrl: dbBaseUrl || 'https://api.openai.com/v1',
        model: dbModel || (dbProvider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'),
      });
      break;

    case 'local':
    default:
      cachedProvider = new LocalFallbackProvider();
      break;
  }

  lastProviderConfigKey = configKey;
  return cachedProvider;
}
