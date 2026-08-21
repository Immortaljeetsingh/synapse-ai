# SYNAPSE AI — Document Intelligence & Active Recall Platform

A high-performance, document-grounded research partner and active-recall learning platform built with Next.js 14 App Router, TypeScript, and Tailwind CSS.

---

## 🌟 Core Features

- **Document-Grounded RAG Intelligence**: Upload PDFs, Word documents, Excel spreadsheets, CSVs, or text files. Query them with zero-hallucination factual grounding, multi-stage retrieval, and precise document citations (page, paragraph, and excerpt).
- **Gamified Quiz & Exam Arena**: Generate customizable assessments (5, 10, 15, 20 questions) with instant answer review, streak multipliers, time-tracking, and document citation jump-links.
- **Active Recall Flashcard Engine**: Smart flashcard generation with front/back flip animations, topic categorization, difficulty rating, and spaced repetition tracking.
- **Structured Note Generation**: Auto-generate Cornell notes, key executive summaries, error analyses, and actionable bullet takeaways directly from uploaded sources.
- **Universal AI Provider Architecture**: Seamlessly switch between OpenCode Zen (free DeepSeek V4 Flash), OpenRouter, OpenAI (GPT-4o / GPT-4o-mini), Groq Cloud (Llama 3.3 70B), DeepSeek API, Together AI, or 100% offline local models via Ollama / LM Studio.
- **Responsive 3D Black / Metallic Silver Interface**: Fully responsive across mobile, tablet, laptop, and ultrawide desktop viewports with beveled 3D tactile buttons and dark/light mode support.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router). All endpoints are consolidated in a single catch-all Route Handler (`app/api/[[...path]]/route.ts`), so the whole app runs inside one serverless function sharing a single warm instance and `/tmp` database.
- **Language**: TypeScript (Strict type checking)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: SQLite via `sql.js` (Serverless-compatible embedded DB)
- **Document Parsers**: `pdf-parse`, `mammoth` (DOCX), `xlsx` (Spreadsheets) — plus client-side PDF extraction via `pdfjs-dist`
- **Vector Retrieval**: Hybrid BM25 keyword + Cosine similarity semantic retrieval

---

## 🚀 Quickstart & Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/your-username/synapse-ai.git
cd synapse-ai
npm install
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your preferred AI provider credentials:

```ini
# Primary Provider ('opencode_zen', 'openrouter', 'openai', 'groq', 'deepseek', 'together', or 'ollama')
AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-oss-20b:free
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your_api_key_here
```

> **Note**: For local offline use with **Ollama**, set `AI_PROVIDER=ollama`, `AI_BASE_URL=http://localhost:11434/v1`, and leave `AI_API_KEY` empty.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Production Build & Verification

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Production build
npm run build

# Start production server
npm run start
```

---

## 🔒 Security & Privacy

- **Bring-Your-Own-Key**: API keys are entered in Settings and stored in your browser (localStorage) plus the local app database; they are sent with each AI request so serverless deployments never need persistent secrets. Anyone using the app in a shared/browser environment should treat keys accordingly.
- **Upload Validation**: Filenames are sanitized, extensions are allow-listed, file content is validated against magic-byte signatures (PDF `%PDF-`, OOXML/OLE2 ZIP headers, binary rejection for text formats), and uploads are capped at 50 MB.
- **Prompt Injection Defense**: Document passages and user queries are treated strictly as inert source data with strict system prompt boundaries.
- **Zero Secret Commits**: Sensitive files (`.env`, `.env.local`, SQLite databases, uploads) are strictly excluded via `.gitignore`.
- **Honest Offline Mode**: With no API key configured, the app clearly says AI features are unavailable instead of fabricating document-grounded content.

> **Deployment note**: Your browser (IndexedDB) is the source of truth for notebooks, documents, chat history, notes, flashcards, and quiz attempts. The server-side SQLite store (`./data` locally, `/tmp` on Vercel) is best-effort sync — serverless storage is ephemeral per warm instance, so don't rely on it for persistence. For durable multi-user persistence, point `DB_PATH`/`UPLOAD_DIR` at a mounted volume or migrate to a hosted database.

> **Large-file deployment note**: Vercel serverless functions reject request bodies over ~4.5MB (HTTP 413), so the browser extracts text client-side before upload — TXT/MD/CSV are read directly with `file.text()`, and PDFs over ~3MB are parsed per-page in-browser via `pdfjs-dist` — then POSTed as JSON to `/api/documents/text`. This bypasses the lambda body limit for PDF/TXT/MD/CSV. DOCX/XLSX have no browser parser and remain capped at the multipart limit (~3.5MB); larger office files must be converted to PDF or split.

> **Memory model**: The AI model itself is stateless — no server-side conversation memory. Each chat request injects the last ~3 exchanges (each message truncated, total capped) as context into the prompt, so the model always answers grounded in recent conversation plus retrieved document chunks.

---

## 📄 License

MIT License. Designed and built with Next.js and TypeScript.
