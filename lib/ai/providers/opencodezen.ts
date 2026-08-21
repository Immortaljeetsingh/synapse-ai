import { BaseAIProvider } from './base';
import { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types';

export class OpenCodeZenProvider extends BaseAIProvider {
  id = 'opencode_zen';
  name = 'OpenCode Zen (DeepSeek V4 Flash Free)';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    super();
    this.apiKey =
      config?.apiKey ||
      process.env.OPENCODE_ZEN_API_KEY ||
      process.env.AI_API_KEY ||
      '';
    this.baseUrl =
      config?.baseUrl ||
      process.env.OPENCODE_ZEN_BASE_URL ||
      process.env.AI_BASE_URL ||
      'https://opencode.ai/zen/v1';
    this.model =
      config?.model ||
      process.env.OPENCODE_ZEN_MODEL ||
      process.env.AI_MODEL ||
      'deepseek-v4-flash-free';
  }

  async verifyModelAvailability(): Promise<{
    available: boolean;
    models: string[];
    error?: string;
  }> {
    try {
      if (!this.apiKey) {
        return { available: false, models: [], error: 'API key is missing. Set OPENCODE_ZEN_API_KEY in settings or .env.local.' };
      }

      const modelsUrl = `${this.baseUrl.replace(/\/+$/, '')}/models`;
      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          available: false,
          models: [],
          error: `HTTP ${res.status} (${res.statusText}): ${errText}`,
        };
      }

      const data = await res.json();
      const modelList: string[] = Array.isArray(data.data)
        ? data.data.map((m: any) => m.id || m.name || String(m))
        : [];

      const exists =
        modelList.length === 0 ||
        modelList.includes(this.model) ||
        modelList.some((m) => m.toLowerCase().includes('deepseek'));

      return {
        available: exists,
        models: modelList,
      };
    } catch (err: any) {
      return { available: false, models: [], error: err.message };
    }
  }

  async generateText(
    messages: AIChatMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.apiKey) {
      throw new Error(
        'OPENCODE_ZEN_API_KEY is not configured. Please set OPENCODE_ZEN_API_KEY in settings or .env.local.'
      );
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 8K cap — unbounded completions let slow free models run past the
    // 60s serverless limit, which killed requests silently.
    const maxTokens = options?.maxTokens ?? 8000;

    const requestBody: any = {
      model: this.model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: maxTokens,
    };

    if (options?.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    // Attach HTTP status so base.ts retryWithBackoff's 400/401 no-retry
    // guard actually fires instead of blindly retrying client errors.
    const fail = (message: string, status?: number): never => {
      const err: any = new Error(message);
      if (status !== undefined) err.status = status;
      throw err;
    };

    const sendRequest = () =>
      this.retryWithBackoff(async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errorText = await res.text();
          if (res.status === 401) {
            fail(`OpenCode Zen authentication failed (401). Check your API Key: ${errorText}`, 401);
          } else if (res.status === 429) {
            fail(`OpenCode Zen rate limit reached (429). Please wait a moment and try again.`, 429);
          } else if (res.status === 404) {
            fail(`Model '${this.model}' was not found on ${this.baseUrl}.`, 404);
          }
          fail(`OpenCode Zen API error (${res.status}): ${errorText}`, res.status);
        }

        return res;
      }, 2, 800);

    let response;
    try {
      response = await sendRequest();
    } catch (err: any) {
      // Some models reject response_format json_object with a 400 — retry
      // once without it and rely on prompt instructions + JSON repair.
      if (
        err?.status === 400 &&
        requestBody.response_format &&
        /response_format|json/i.test(String(err?.message || ''))
      ) {
        delete requestBody.response_format;
        response = await sendRequest();
      } else {
        throw err;
      }
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || '';

    if (!replyText && data.error) {
      throw new Error(`OpenCode Zen Error: ${JSON.stringify(data.error)}`);
    }

    return {
      text: replyText,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}
