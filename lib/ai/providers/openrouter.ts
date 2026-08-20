import { BaseAIProvider } from './base';
import { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types';

export class OpenRouterProvider extends BaseAIProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private fallbackModel: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string; fallbackModel?: string }) {
    super();
    this.apiKey = config?.apiKey || process.env.AI_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = config?.model || process.env.AI_MODEL || 'openai/gpt-oss-20b:free';
    this.fallbackModel = config?.fallbackModel || process.env.AI_MODEL_FALLBACK || 'dots-studio/dots-3-note-preview:free';
  }

  async generateText(
    messages: AIChatMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.apiKey) {
      throw new Error('AI_API_KEY is not configured. Set it in .env.local or Settings.');
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const maxTokens = options?.maxTokens ?? 20000;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const requestBody: any = {
      model: this.model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: maxTokens,
    };

    if (options?.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    // Try primary model first, fallback on failure or rate-limit
    let lastError: any;
    const modelsToTry = [this.model, this.fallbackModel];

    for (const modelId of modelsToTry) {
      // Allow up to 2 retries per model with backoff
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          requestBody.model = modelId;

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://document-ai.app',
              'X-Title': 'Document AI Studio',
            },
            body: JSON.stringify(requestBody),
            signal: options?.signal,
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(`OpenRouter model ${modelId} attempt ${attempt + 1} failed (${res.status}):`, errText);

            if (res.status === 401) {
              throw new Error('OpenRouter authentication failed (401). Check your API key.');
            }
            if (res.status === 429) {
              // Rate limited - wait 2 seconds and retry or continue
              if (attempt === 0) {
                await new Promise((r) => setTimeout(r, 2000));
                continue;
              }
              lastError = new Error(`OpenRouter rate limit hit (429) on ${modelId}.`);
              break; // try fallback model
            }

            lastError = new Error(`OpenRouter error (${res.status}): ${errText}`);
            continue;
          }

          const data = await res.json();
          const choice = data.choices?.[0];
          let replyText = choice?.message?.content || '';

          // If content is empty/null but reasoning exists (e.g. reasoning models), use reasoning
          if (!replyText && choice?.message?.reasoning) {
            replyText = choice.message.reasoning;
          }
          if (!replyText && choice?.text) {
            replyText = choice.text;
          }

          if (!replyText && data.error) {
            lastError = new Error(`OpenRouter: ${JSON.stringify(data.error)}`);
            continue;
          }

          if (!replyText) {
            lastError = new Error(`OpenRouter model ${modelId} returned an empty response.`);
            continue;
          }

          return {
            text: replyText,
            usage: {
              promptTokens: data.usage?.prompt_tokens || 0,
              completionTokens: data.usage?.completion_tokens || 0,
              totalTokens: data.usage?.total_tokens || 0,
            },
          };
        } catch (err: any) {
          lastError = err;
          if (err.message?.includes('401') || err.message?.includes('authentication')) {
            throw err; // don't retry auth failures
          }
          console.error(`OpenRouter model ${modelId} error:`, err.message);
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }

    throw lastError || new Error('All OpenRouter models failed to respond.');
  }
}
