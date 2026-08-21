import { getDb, saveDb } from './index';
import {
  Notebook,
  DocumentRecord,
  DocumentChunk,
  NoteRecord,
  FlashcardRecord,
  QuestionRecord,
  ChatMessage,
  ChatSession,
  ArtifactType,
  ReviewStatus,
  QuizRecord,
  QuizQuestionItem,
  QuizAttemptRecord,
  QuizAnswerRecord,
  TopicPerformanceRecord,
} from '../types';

// Helper to run SELECT queries returning array of objects
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

// Helper to run SELECT query returning single object
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const all = await queryAll<T>(sql, params);
  return all[0];
}

// Helper to run INSERT / UPDATE / DELETE queries and save
export async function runQuery(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  // sql.js only executes the FIRST statement when params are passed — omit
  // params entirely for parameterless SQL so multi-statement strings still work.
  if (params.length > 0) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  saveDb();
}

// ==================== NOTEBOOKS ====================

export async function getAllNotebooks(): Promise<Notebook[]> {
  const sql = `
    SELECT n.*, COUNT(d.id) AS document_count
    FROM notebooks n
    LEFT JOIN documents d ON n.id = d.notebook_id
    GROUP BY n.id
    ORDER BY n.updated_at DESC
  `;
  return await queryAll<Notebook>(sql);
}

export async function getNotebookById(id: string): Promise<Notebook | undefined> {
  const sql = `
    SELECT n.*, COUNT(d.id) AS document_count
    FROM notebooks n
    LEFT JOIN documents d ON n.id = d.notebook_id
    WHERE n.id = ?
    GROUP BY n.id
  `;
  return await queryOne<Notebook>(sql, [id]);
}

export async function createNotebook(notebook: { id: string; title: string; description?: string }): Promise<Notebook> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO notebooks (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [notebook.id, notebook.title, notebook.description || '', now, now]
  );
  return (await getNotebookById(notebook.id))!;
}

export async function updateNotebook(
  id: string,
  updates: { title?: string; description?: string }
): Promise<Notebook | undefined> {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  values.push(id);
  await runQuery(`UPDATE notebooks SET ${fields.join(', ')} WHERE id = ?`, values);
  return await getNotebookById(id);
}

export async function deleteNotebook(id: string): Promise<boolean> {
  // Explicit cascade — never rely on PRAGMA foreign_keys being enforced.
  await runQuery(`DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM documents WHERE notebook_id = ?)`, [id]);
  await runQuery(`DELETE FROM documents WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE notebook_id = ?)`, [id]);
  await runQuery(`DELETE FROM chat_sessions WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM notes WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM flashcards WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM quiz_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE notebook_id = ?)`, [id]);
  await runQuery(`DELETE FROM quiz_attempts WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE notebook_id = ?)`, [id]);
  await runQuery(`DELETE FROM quizzes WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM questions WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM generated_artifacts WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM quiz_topic_performance WHERE notebook_id = ?`, [id]);
  await runQuery(`DELETE FROM notebooks WHERE id = ?`, [id]);
  return true;
}

// ==================== DOCUMENTS ====================

export async function getDocumentsByNotebook(notebookId: string): Promise<DocumentRecord[]> {
  const sql = `SELECT * FROM documents WHERE notebook_id = ? ORDER BY created_at DESC`;
  const docs = await queryAll<any>(sql, [notebookId]);
  return docs.map((d) => ({
    ...d,
    is_scanned: Boolean(d.is_scanned),
  }));
}

export async function getDocumentById(id: string): Promise<DocumentRecord | undefined> {
  const d = await queryOne<any>(`SELECT * FROM documents WHERE id = ?`, [id]);
  if (!d) return undefined;
  return {
    ...d,
    is_scanned: Boolean(d.is_scanned),
  };
}

export async function createDocument(doc: {
  id: string;
  notebook_id: string;
  filename: string;
  file_type: any;
  file_size: number;
  page_count?: number;
  file_path: string;
  content_hash: string;
  processing_status?: string;
  error_message?: string | null;
  is_scanned?: boolean;
}): Promise<DocumentRecord> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO documents (
      id, notebook_id, filename, file_type, file_size, page_count,
      file_path, content_hash, processing_status, error_message, is_scanned, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id,
      doc.notebook_id,
      doc.filename,
      doc.file_type,
      doc.file_size,
      doc.page_count || 1,
      doc.file_path,
      doc.content_hash,
      doc.processing_status || 'idle',
      doc.error_message || null,
      doc.is_scanned ? 1 : 0,
      now,
    ]
  );

  // Update notebook updated_at
  await runQuery(`UPDATE notebooks SET updated_at = ? WHERE id = ?`, [now, doc.notebook_id]);
  return (await getDocumentById(doc.id))!;
}

export async function updateDocumentStatus(
  id: string,
  status: string,
  extra?: { page_count?: number; error_message?: string | null; is_scanned?: boolean }
): Promise<void> {
  const fields = ['processing_status = ?'];
  const values: any[] = [status];

  if (extra?.page_count !== undefined) {
    fields.push('page_count = ?');
    values.push(extra.page_count);
  }
  if (extra?.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(extra.error_message);
  }
  if (extra?.is_scanned !== undefined) {
    fields.push('is_scanned = ?');
    values.push(extra.is_scanned ? 1 : 0);
  }

  values.push(id);
  await runQuery(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteDocument(id: string): Promise<boolean> {
  // Explicit cascade — never rely on PRAGMA foreign_keys being enforced.
  await runQuery(`DELETE FROM document_chunks WHERE document_id = ?`, [id]);
  await runQuery(`DELETE FROM questions WHERE document_id = ?`, [id]);
  await runQuery(`DELETE FROM flashcards WHERE document_id = ?`, [id]);
  await runQuery(`DELETE FROM generated_artifacts WHERE document_id = ?`, [id]);
  await runQuery(`DELETE FROM documents WHERE id = ?`, [id]);
  return true;
}

// ==================== DOCUMENT CHUNKS ====================

export async function insertChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = await getDb();
  for (const item of chunks) {
    db.run(
      `INSERT INTO document_chunks (
        id, document_id, notebook_id, chunk_index, page_number,
        section_heading, paragraph_position, text, metadata_json, embedding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.document_id,
        item.notebook_id,
        item.chunk_index,
        item.page_number,
        item.section_heading || '',
        item.paragraph_position || 0,
        item.text,
        item.metadata_json || '{}',
        item.embedding_json || null,
      ]
    );
  }
  saveDb();
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  return await queryAll<DocumentChunk>(
    `SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC`,
    [documentId]
  );
}

export async function getChunksByNotebook(notebookId: string): Promise<(DocumentChunk & { filename?: string })[]> {
  return await queryAll<DocumentChunk & { filename?: string }>(
    `SELECT c.*, d.filename
     FROM document_chunks c
     JOIN documents d ON c.document_id = d.id
     WHERE c.notebook_id = ?
     ORDER BY c.document_id, c.chunk_index ASC`,
    [notebookId]
  );
}

export async function deleteChunksByDocument(documentId: string): Promise<void> {
  await runQuery(`DELETE FROM document_chunks WHERE document_id = ?`, [documentId]);
}

// ==================== GENERATED ARTIFACTS ====================

export async function saveArtifact(
  id: string,
  notebookId: string,
  documentId: string | null,
  artifactType: ArtifactType,
  contentJson: string
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM generated_artifacts WHERE notebook_id = ? AND artifact_type = ? AND (document_id = ? OR (document_id IS NULL AND ? IS NULL))`,
    [notebookId, artifactType, documentId, documentId]
  );

  if (existing) {
    await runQuery(`UPDATE generated_artifacts SET content_json = ?, updated_at = ? WHERE id = ?`, [
      contentJson,
      now,
      existing.id,
    ]);
  } else {
    await runQuery(
      `INSERT INTO generated_artifacts (id, notebook_id, document_id, artifact_type, content_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, notebookId, documentId, artifactType, contentJson, now, now]
    );
  }
}

export async function getArtifact(
  notebookId: string,
  artifactType: ArtifactType,
  documentId?: string | null
): Promise<any | null> {
  let row: any;
  if (documentId) {
    row = await queryOne(
      `SELECT * FROM generated_artifacts WHERE notebook_id = ? AND artifact_type = ? AND document_id = ?`,
      [notebookId, artifactType, documentId]
    );
  } else {
    row = await queryOne(
      `SELECT * FROM generated_artifacts WHERE notebook_id = ? AND artifact_type = ? AND document_id IS NULL`,
      [notebookId, artifactType]
    );
  }
  return row ? JSON.parse(row.content_json) : null;
}

export async function getAllArtifactsForNotebook(notebookId: string): Promise<Record<string, any>> {
  const rows = await queryAll<{ artifact_type: string; document_id: string | null; content_json: string }>(
    `SELECT artifact_type, document_id, content_json FROM generated_artifacts WHERE notebook_id = ? ORDER BY created_at DESC`,
    [notebookId]
  );
  const result: Record<string, any> = {};

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.content_json);
      if (!row.document_id) {
        result[row.artifact_type] = parsed;
      } else {
        result[`${row.artifact_type}_${row.document_id}`] = parsed;
        if (!result[row.artifact_type]) {
          result[row.artifact_type] = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  return result;
}

// ==================== NOTES ====================

export async function getNotesByNotebook(notebookId: string): Promise<NoteRecord[]> {
  return await queryAll<NoteRecord>(
    `SELECT * FROM notes WHERE notebook_id = ? ORDER BY is_pinned DESC, updated_at DESC`,
    [notebookId]
  );
}

export async function getNoteById(id: string): Promise<NoteRecord | undefined> {
  return await queryOne<NoteRecord>(`SELECT * FROM notes WHERE id = ?`, [id]);
}

export async function createNote(note: {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  format_type?: string;
  is_pinned?: number;
  source_references_json?: string;
}): Promise<NoteRecord> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO notes (id, notebook_id, title, content, format_type, is_pinned, source_references_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.notebook_id,
      note.title,
      note.content,
      note.format_type || 'standard',
      note.is_pinned || 0,
      note.source_references_json || '[]',
      now,
      now,
    ]
  );
  return (await getNoteById(note.id))!;
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<NoteRecord, 'title' | 'content' | 'format_type' | 'is_pinned' | 'source_references_json'>>
): Promise<NoteRecord | undefined> {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.format_type !== undefined) {
    fields.push('format_type = ?');
    values.push(updates.format_type);
  }
  if (updates.is_pinned !== undefined) {
    fields.push('is_pinned = ?');
    values.push(updates.is_pinned);
  }
  if (updates.source_references_json !== undefined) {
    fields.push('source_references_json = ?');
    values.push(updates.source_references_json);
  }

  values.push(id);
  await runQuery(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values);
  return await getNoteById(id);
}

export async function deleteNote(id: string): Promise<boolean> {
  await runQuery(`DELETE FROM notes WHERE id = ?`, [id]);
  return true;
}

// ==================== FLASHCARDS ====================

export async function getFlashcardsByNotebook(notebookId: string): Promise<FlashcardRecord[]> {
  return await queryAll<FlashcardRecord>(
    `SELECT * FROM flashcards WHERE notebook_id = ? ORDER BY created_at DESC`,
    [notebookId]
  );
}

export async function insertFlashcards(cards: FlashcardRecord[]): Promise<void> {
  const db = await getDb();
  for (const card of cards) {
    db.run(
      `INSERT INTO flashcards (
        id, notebook_id, document_id, card_type, question, answer,
        topic, difficulty, source_document, page_number, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.notebook_id,
        card.document_id || null,
        card.card_type,
        card.question,
        card.answer,
        card.topic || 'General',
        card.difficulty || 'medium',
        card.source_document || null,
        card.page_number || null,
        card.review_status || 'unreviewed',
        card.created_at || new Date().toISOString(),
      ]
    );
  }
  saveDb();
}

export async function updateFlashcardStatus(id: string, status: ReviewStatus): Promise<void> {
  await runQuery(`UPDATE flashcards SET review_status = ? WHERE id = ?`, [status, id]);
}

export async function deleteFlashcardsByNotebook(notebookId: string): Promise<void> {
  await runQuery(`DELETE FROM flashcards WHERE notebook_id = ?`, [notebookId]);
}

// ==================== GAMIFIED QUIZZES & GAME ATTEMPTS ====================

export async function createQuiz(quiz: {
  id: string;
  notebook_id: string;
  document_id?: string | null;
  title: string;
  mode: string;
  difficulty: string;
  question_count: number;
}): Promise<QuizRecord> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO quizzes (id, notebook_id, document_id, title, mode, difficulty, question_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [quiz.id, quiz.notebook_id, quiz.document_id || null, quiz.title, quiz.mode, quiz.difficulty, quiz.question_count, now]
  );
  return (await queryOne<QuizRecord>(`SELECT * FROM quizzes WHERE id = ?`, [quiz.id]))!;
}

export async function insertQuizQuestions(questions: QuizQuestionItem[]): Promise<void> {
  const db = await getDb();
  for (const q of questions) {
    db.run(
      `INSERT INTO quiz_questions (
        id, quiz_id, question, question_type, options_json, correct_answer,
        explanation, topic, difficulty, source_document, page_number, chunk_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.id,
        q.quiz_id || '',
        q.question,
        q.question_type || 'multiple_choice',
        JSON.stringify(q.options || []),
        q.correct_answer,
        q.explanation || '',
        q.topic || 'General',
        q.difficulty || 'medium',
        q.source_document || null,
        q.page_number || null,
        q.chunk_id || null,
      ]
    );
  }
  saveDb();
}

export async function getQuizQuestions(quizId: string): Promise<QuizQuestionItem[]> {
  const rows = await queryAll<any>(`SELECT * FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
  return rows.map((r) => ({
    id: r.id,
    quiz_id: r.quiz_id,
    question: r.question,
    question_type: r.question_type,
    options: JSON.parse(r.options_json || '[]'),
    correct_answer: r.correct_answer,
    explanation: r.explanation,
    topic: r.topic,
    difficulty: r.difficulty,
    source_document: r.source_document,
    page_number: r.page_number,
    chunk_id: r.chunk_id,
  }));
}

export async function recordQuizAttempt(attempt: {
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
  answers: QuizAnswerRecord[];
}): Promise<QuizAttemptRecord> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO quiz_attempts (
      id, quiz_id, notebook_id, title, score, total_questions,
      correct_count, accuracy_pct, xp_earned, max_streak, time_spent_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attempt.id,
      attempt.quiz_id,
      attempt.notebook_id,
      attempt.title,
      attempt.score,
      attempt.total_questions,
      attempt.correct_count,
      attempt.accuracy_pct,
      attempt.xp_earned,
      attempt.max_streak,
      attempt.time_spent_seconds,
      now,
    ]
  );

  // Insert individual answers
  const db = await getDb();
  for (const ans of attempt.answers) {
    const ansId = `ans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.run(
      `INSERT INTO quiz_answers (id, attempt_id, question_id, selected_answer, is_correct, response_time_ms, points_earned, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ansId,
        attempt.id,
        ans.question_id,
        ans.selected_answer,
        ans.is_correct ? 1 : 0,
        ans.response_time_ms || 0,
        ans.points_awarded ?? ans.points_earned ?? 0,
        ans.topic || 'General',
      ]
    );

    // Update topic performance stats
    const perfRow = await queryOne<any>(
      `SELECT * FROM quiz_topic_performance WHERE notebook_id = ? AND topic = ?`,
      [attempt.notebook_id, ans.topic || 'General']
    );

    if (perfRow) {
      const newTotal = perfRow.total_answered + 1;
      const newCorrect = perfRow.total_correct + (ans.is_correct ? 1 : 0);
      const newAcc = Math.round((newCorrect / newTotal) * 100);
      db.run(
        `UPDATE quiz_topic_performance SET total_answered = ?, total_correct = ?, accuracy_pct = ?, updated_at = ? WHERE id = ?`,
        [newTotal, newCorrect, newAcc, now, perfRow.id]
      );
    } else {
      const perfId = `perf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newAcc = ans.is_correct ? 100 : 0;
      db.run(
        `INSERT INTO quiz_topic_performance (id, notebook_id, topic, total_answered, total_correct, accuracy_pct, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [perfId, attempt.notebook_id, ans.topic || 'General', 1, ans.is_correct ? 1 : 0, newAcc, now]
      );
    }
  }
  saveDb();

  return (await queryOne<QuizAttemptRecord>(`SELECT * FROM quiz_attempts WHERE id = ?`, [attempt.id]))!;
}

export async function getQuizAttempts(notebookId: string): Promise<QuizAttemptRecord[]> {
  return await queryAll<QuizAttemptRecord>(
    `SELECT * FROM quiz_attempts WHERE notebook_id = ? ORDER BY created_at DESC LIMIT 20`,
    [notebookId]
  );
}

export async function getTopicPerformance(notebookId: string): Promise<TopicPerformanceRecord[]> {
  return await queryAll<TopicPerformanceRecord>(
    `SELECT topic, total_answered, total_correct, accuracy_pct
     FROM quiz_topic_performance
     WHERE notebook_id = ?
     ORDER BY accuracy_pct ASC`,
    [notebookId]
  );
}

export async function getWeakTopics(notebookId: string): Promise<string[]> {
  const rows = await queryAll<{ topic: string }>(
    `SELECT topic FROM quiz_topic_performance
     WHERE notebook_id = ? AND accuracy_pct < 65
     ORDER BY accuracy_pct ASC`,
    [notebookId]
  );
  return rows.map((r) => r.topic);
}

// ==================== LEGACY QUESTIONS ====================

export async function getQuestionsByNotebook(notebookId: string): Promise<QuestionRecord[]> {
  return await queryAll<QuestionRecord>(
    `SELECT * FROM questions WHERE notebook_id = ? ORDER BY created_at DESC`,
    [notebookId]
  );
}

export async function insertQuestions(questions: QuestionRecord[]): Promise<void> {
  const db = await getDb();
  for (const q of questions) {
    db.run(
      `INSERT INTO questions (
        id, notebook_id, document_id, question_type, question, options_json,
        correct_answer, explanation, difficulty, source_document, page_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.id,
        q.notebook_id,
        q.document_id || null,
        q.question_type,
        q.options_json || null,
        q.correct_answer,
        q.explanation,
        q.difficulty || 'medium',
        q.source_document || null,
        q.page_number || null,
        q.created_at || new Date().toISOString(),
      ]
    );
  }
  saveDb();
}

export async function deleteQuestionsByNotebook(notebookId: string): Promise<void> {
  await runQuery(`DELETE FROM questions WHERE notebook_id = ?`, [notebookId]);
}

// ==================== CHAT SESSIONS & MESSAGES ====================

export async function getOrCreateChatSession(notebookId: string): Promise<ChatSession> {
  let session = await queryOne<ChatSession>(
    `SELECT * FROM chat_sessions WHERE notebook_id = ? ORDER BY created_at ASC LIMIT 1`,
    [notebookId]
  );

  if (!session) {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO chat_sessions (id, notebook_id, title, created_at) VALUES (?, ?, ?, ?)`,
      [id, notebookId, 'Main Discussion', now]
    );
    session = { id, notebook_id: notebookId, title: 'Main Discussion', created_at: now };
  }

  return session;
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return await queryAll<ChatMessage>(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );
}

export async function insertChatMessage(msg: {
  id: string;
  session_id: string;
  notebook_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json?: string;
  special_payload_json?: string;
  grounding_type?: string;
}): Promise<ChatMessage> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO chat_messages (id, session_id, notebook_id, role, content, citations_json, special_payload_json, grounding_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.session_id,
      msg.notebook_id,
      msg.role,
      msg.content,
      msg.citations_json || '[]',
      msg.special_payload_json || null,
      msg.grounding_type || 'direct_source',
      now,
    ]
  );

  return {
    ...msg,
    grounding_type: (msg.grounding_type as any) || 'direct_source',
    created_at: now,
  };
}

// ==================== APP SETTINGS ====================

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return row ? row.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  );
}
