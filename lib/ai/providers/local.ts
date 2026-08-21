import { BaseAIProvider } from './base';
import { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types';

/**
 * Offline fallback provider.
 *
 * ponytail: this provider deliberately does NOT fabricate document-grounded
 * answers, quizzes or flashcards — a previous version returned hardcoded
 * banking/credit-risk content for ANY document, which silently poisoned the
 * "zero-hallucination" guarantee whenever no API key was configured. It now
 * returns an explicit configuration prompt instead.
 */
export class LocalFallbackProvider extends BaseAIProvider {
  id = 'local';
  name = 'Local Knowledge Engine';

  private offlineNotice(task: string): string {
    return [
      `**Offline mode — ${task} needs an AI connection.**`,
      '',
      'No API key is configured, so I cannot analyze your documents without making things up.',
      '',
      'To enable full AI features:',
      '1. Open **Settings** (sidebar → Settings & Model Info)',
      '2. Pick a provider preset (OpenRouter has free models)',
      '3. Paste your API key and save',
      '',
      'Everything else keeps working meanwhile: uploading & indexing documents, browsing them with page navigation, full-text search, and notes.',
    ].join('\n');
  }

  async generateText(messages: AIChatMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
    const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    const task = userMsg.includes('quiz') || userMsg.includes('"questions"')
      ? 'quiz generation'
      : userMsg.includes('flashcard')
        ? 'flashcard generation'
        : 'chat';

    return {
      text: this.offlineNotice(task),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}
