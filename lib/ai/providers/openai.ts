import { BaseAIProvider } from './base';
import { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types';

export class OpenAIProvider extends BaseAIProvider {
  id = 'openai';
  name = 'OpenAI Compatible Provider';

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options: { apiKey?: string; baseUrl?: string; model?: string } = {}) {
    super();
    this.apiKey = options.apiKey || process.env.AI_API_KEY || '';
    this.baseUrl = options.baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    this.model = options.model || process.env.AI_MODEL || 'gpt-4o-mini';
  }

  async generateText(messages: AIChatMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
    return this.retryWithBackoff(async () => {
      const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const body: Record<string, any> = {
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      };

      if (options?.maxTokens) {
        body.max_tokens = options.maxTokens;
      }
      if (options?.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`OpenAI API error (${res.status}): ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        text: content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    });
  }
}
