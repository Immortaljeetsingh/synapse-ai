import { AIChatMessage, AICompletionOptions, AICompletionResult, AIProvider } from '../types';
import { parseAndRepairJson } from '../json-repair';

export abstract class BaseAIProvider implements AIProvider {
  abstract id: string;
  abstract name: string;

  abstract generateText(messages: AIChatMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;

  async generateStructuredJson<T>(
    messages: AIChatMessage[],
    schemaDescription?: string,
    options?: AICompletionOptions
  ): Promise<T> {
    const jsonOptions: AICompletionOptions = {
      // Cap unbounded completions — oversized max_tokens made slow models
      // generate until the 60s serverless limit killed the request.
      maxTokens: 8000,
      ...options,
      responseFormat: 'json',
    };

    const res = await this.generateText(messages, jsonOptions);
    return parseAndRepairJson<T>(res.text);
  }

  // Exponential backoff helper
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        // Don't retry client-side validation errors
        if (err.status === 400 || err.status === 401) {
          throw err;
        }
        const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}
