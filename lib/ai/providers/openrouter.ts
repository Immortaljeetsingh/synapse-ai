import { BaseAIProvider } from './base';
import { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types';

export class OpenRouterProvider extends BaseAIProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    super();
    this.apiKey = config?.apiKey || process.env.AI_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = config?.model || process.env.AI_MODEL || 'openai/gpt-oss-20b:free';
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

  // Reasoning models burn thousands of thinking tokens at default effort
  // before answering, blowing past the 60s function limit — damp them all.
  if (/gpt-oss|o1|o3|o4|deepseek-r1|qwen.*think|thinking/i.test(this.model)) {
    requestBody.reasoning = { effort: 'low' };
  }

    if (options?.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    // Only ever call the user's chosen model. ponytail: no silent fallback —
    // retry once on 429 only; every other failure throws with the model id.
    for (let attempt = 0; attempt < 2; attempt++) {
      // Streaming mode: SSE-parse deltas, invoke onDelta live, resolve full text.
      if (options?.onDelta) {
        const streamBody = { ...requestBody, stream: true };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://document-ai.app',
            'X-Title': 'Document AI Studio',
          },
          body: JSON.stringify(streamBody),
          signal: options?.signal,
        });

        if (!res.ok || !res.body) {
          const errText = res.body ? await res.text() : 'no response body';
          if (res.status === 401) throw new Error('OpenRouter authentication failed (401). Check your API key.');
          if (res.status === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error(`OpenRouter model '${this.model}' failed (${res.status}): ${errText.slice(0, 200)}`);
        }

        let full = '';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                full += delta;
                options.onDelta(delta);
              }
            } catch {}
          }
        }
        if (!full.trim()) {
          throw new Error(`OpenRouter model '${this.model}' returned an empty stream.`);
        }
        return { text: full, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
      }

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
        console.error(`OpenRouter model ${this.model} failed (${res.status}):`, errText);

        if (res.status === 401) {
          throw new Error('OpenRouter authentication failed (401). Check your API key.');
        }
        if (res.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`OpenRouter model '${this.model}' failed (${res.status}): ${errText.slice(0, 200)}`);
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

      if (!replyText) {
        const detail = data.error ? JSON.stringify(data.error) : 'empty response';
        throw new Error(`OpenRouter model '${this.model}' failed: ${detail}`);
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

    throw new Error(`OpenRouter model '${this.model}' is rate limited (429). Try again shortly.`);
  }
}
