# SYNAPSE AI — Document Intelligence & Active Recall Platform

A high-performance, document-grounded research partner and active-recall learning platform built with Next.js 14 App Router, TypeScript, and Tailwind CSS.

---

## 🌟 Core Features

- **Document-Grounded RAG Intelligence**: Upload PDFs, Word documents, Excel spreadsheets, CSVs, or text files. Query them with zero-hallucination factual grounding, multi-stage retrieval, and precise document citations (page, paragraph, and excerpt).
- **Gamified Quiz & Exam Arena**: Generate customizable assessments (5, 10, 15, 20 questions) with instant answer review, streak multipliers, time-tracking, and document citation jump-links.
- **Active Recall Flashcard Engine**: Smart flashcard generation with front/back flip animations, topic categorization, difficulty rating, and spaced repetition tracking.
- **Structured Note Generation**: Auto-generate Cornell notes, key executive summaries, error analyses, and actionable bullet takeaways directly from uploaded sources.
- **Universal AI Provider Architecture**: Seamlessly switch between OpenRouter, OpenAI (GPT-4o / GPT-4o-mini), Groq Cloud (Llama 3.3 70B), DeepSeek API, Together AI, or 100% offline local models via Ollama / LM Studio.
- **Responsive 3D Black / Metallic Silver Interface**: Fully responsive across mobile, tablet, laptop, and ultrawide desktop viewports with beveled 3D tactile buttons and dark/light mode support.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router, Server Actions & API Routes)
- **Language**: TypeScript (Strict type checking)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: SQLite via `sql.js` (Serverless-compatible embedded DB)
- **Document Parsers**: `pdf-parse`, `mammoth` (DOCX), `xlsx` (Spreadsheets)
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
# Primary Provider ('openrouter', 'openai', 'groq', 'deepseek', 'together', or 'ollama')
AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-oss-20b:free
AI_MODEL_FALLBACK=dots-studio/dots-3-note-preview:free
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

> **Deployment note**: SQLite data and uploaded files live on the server filesystem (`./data` locally, `/tmp` on Vercel). On serverless platforms storage is ephemeral per warm instance — for durable multi-user persistence, point `DB_PATH`/`UPLOAD_DIR` at a mounted volume or migrate to a hosted database.

---

## 📄 License

MIT License. Designed and built with Next.js and TypeScript.
