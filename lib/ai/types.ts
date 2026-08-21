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
  // When provided, providers stream tokens from the model SSE and invoke
  // this per delta; generateText still resolves with the full text.
  onDelta?: (delta: string) => void;
}

export interface AICompletionResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Providers that support token streaming read options.onDelta; when provided
// they stream from the provider SSE and invoke onDelta per chunk, still
// resolving with the FULL text so callers need no branching.
export interface AIProvider {
  id: string;
  name: string;
  generateText(messages: AIChatMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
  generateStructuredJson<T>(messages: AIChatMessage[], schemaDescription?: string, options?: AICompletionOptions): Promise<T>;
}
