export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  stopSequences?: string[];
  signal?: AbortSignal;
}

export interface AICompletionResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  id: string;
  name: string;
  generateText(messages: AIChatMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
  generateStructuredJson<T>(messages: AIChatMessage[], schemaDescription?: string, options?: AICompletionOptions): Promise<T>;
}
