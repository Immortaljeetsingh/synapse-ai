export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

export type FileType = 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'xlsx' | 'other';

export interface Notebook {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

export interface DocumentRecord {
  id: string;
  notebook_id: string;
  filename: string;
  file_type: FileType;
  file_size: number;
  page_count: number;
  file_path: string;
  content_hash: string;
  processing_status: ProcessingStatus;
  error_message?: string | null;
  is_scanned?: boolean;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  notebook_id: string;
  chunk_index: number;
  page_number: number;
  section_heading: string;
  paragraph_position: number;
  text: string;
  metadata_json?: string;
  embedding_json?: string;
}

export type ArtifactType =
  | 'overview'
  | 'topics'
  | 'concepts'
  | 'entities'
  | 'numbers'
  | 'timeline'
  | 'action_items'
  | 'study_guide'
  | 'comparison';

export interface OverviewArtifact {
  one_sentence_summary: string;
  executive_summary: string;
  detailed_summary: string;
  key_takeaways: string[];
  suggested_questions: string[];
}

export interface TopicItem {
  id: string;
  name: string;
  description: string;
  relevance: number;
}

export interface ConceptItem {
  id: string;
  concept: string;
  definition: string;
  explanation: string;
  source_document?: string;
  page_number?: number;
  related_concepts: string[];
}

export interface EntityItem {
  name: string;
  category: 'Person' | 'Organization' | 'Company' | 'Place' | 'Product' | 'Date' | 'Law' | 'Technology' | 'Other';
  context: string;
  source_document?: string;
  page_number?: number;
}

export interface NumberStatisticItem {
  figure: string;
  description: string;
  context: string;
  source_document?: string;
  page_number?: number;
}

export interface TimelineEvent {
  date_or_period: string;
  event: string;
  significance: string;
  source_document?: string;
  page_number?: number;
}

export interface ActionItem {
  task: string;
  owner_or_stakeholder?: string;
  priority: 'High' | 'Medium' | 'Low';
  context: string;
  source_document?: string;
  page_number?: number;
}

export type NoteFormatType = 'cornell' | 'bullet' | 'revision' | 'exam' | 'standard';

export interface NoteRecord {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  format_type: NoteFormatType;
  is_pinned: number;
  source_references_json?: string;
  created_at: string;
  updated_at: string;
}

export type FlashcardType = 'definition' | 'conceptual' | 'relationship' | 'comparison' | 'application';
export type FlashcardDifficulty = 'easy' | 'medium' | 'hard';
export type ReviewStatus = 'unreviewed' | 'easy' | 'hard' | 'known';

export interface FlashcardRecord {
  id: string;
  notebook_id: string;
  document_id?: string | null;
  card_type: FlashcardType;
  question: string;
  answer: string;
  topic: string;
  difficulty: FlashcardDifficulty;
  source_document?: string;
  page_number?: number;
  review_status: ReviewStatus;
  created_at: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'scenario'
  | 'conceptual'
  | 'definition'
  | 'comparison'
  | 'application';

export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'adaptive';

export type QuizMode =
  | 'practice'
  | 'exam'
  | 'adaptive'
  | 'weak_areas'
  | 'quick'
  | 'standard'
  | 'deep';

export interface QuizConfig {
  sourceType: 'notebook' | 'document' | 'selected' | 'topic';
  documentId?: string | null;
  topic?: string;
  pageRange?: string;
  questionCount: number;
  difficulty: QuizDifficulty;
  questionType: QuestionType | 'mixed';
  mode: QuizMode;
  timerSeconds: number; // 0 = no timer, or 30, 60, 90
  enableXp: boolean;
  enableStreaks: boolean;
}

export interface QuizQuestionItem {
  id: string;
  quiz_id?: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  source_document?: string;
  page_number?: number;
  chunk_id?: string;
}

export interface QuizRecord {
  id: string;
  notebook_id: string;
  document_id?: string | null;
  title: string;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  question_count: number;
  created_at: string;
}

export interface QuizAnswerRecord {
  id?: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  response_time_ms?: number;
  time_spent_seconds?: number;
  points_earned?: number;
  points_awarded?: number;
  xp_awarded?: number;
  streak_count?: number;
  topic?: string;
}

export interface QuizAttemptRecord {
  id: string;
  quiz_id: string;
  notebook_id: string;
  title: string;
  score: number;
  total_questions: number;
  correct_count: number;
  accuracy_pct: number;
  xp_earned: number;
  max_streak: number;
  time_spent_seconds: number;
  created_at: string;
  answers?: QuizAnswerRecord[];
}

export interface TopicPerformanceRecord {
  topic: string;
  total_answered: number;
  total_correct: number;
  accuracy_pct: number;
}

export interface QuestionRecord {
  id: string;
  notebook_id: string;
  document_id?: string | null;
  question_type: QuestionType;
  question: string;
  options_json?: string;
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  source_document?: string;
  page_number?: number;
  created_at: string;
}

export interface StudyGuideSection {
  title: string;
  summary: string;
  key_concepts: { concept: string; explanation: string }[];
  key_relationships: string[];
  key_facts_formulas: string[];
  exam_focus_points: string[];
  common_questions: { question: string; answer: string }[];
}

export interface StudyGuideArtifact {
  title: string;
  overview: string;
  sections: StudyGuideSection[];
  quick_review_sheet: string[];
}

export interface DocumentComparisonMatrix {
  comparison_topic: string;
  documents: {
    document_name: string;
    viewpoint: string;
    key_findings: string[];
    citations: string[];
  }[];
  agreements: string[];
  contradictions: string[];
  synthesis: string;
}

export interface CitationReference {
  document_id: string;
  document_name: string;
  page_number: number;
  section_heading?: string;
  excerpt: string;
  relevance_score?: number;
}

export type GroundingType = 'direct_source' | 'ai_interpretation' | 'not_in_document';

export interface ChatMessage {
  id: string;
  session_id: string;
  notebook_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json?: string;
  special_payload_json?: string;
  grounding_type: GroundingType;
  created_at: string;
}

export type ChatMessageRecord = ChatMessage;


export interface ChatSession {
  id: string;
  notebook_id: string;
  title: string;
  created_at: string;
  messages?: ChatMessage[];
}

export interface AISettings {
  provider: 'opencode_zen' | 'openai' | 'custom' | 'local';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
}
