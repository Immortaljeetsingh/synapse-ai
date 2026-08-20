// Lightweight vector representation generator using term-hash projection with subword n-grams
// Provides semantic cosine similarity scoring without external network dependencies

const VECTOR_DIM = 128;

export function computeTextVector(text: string): number[] {
  const vector = new Array(VECTOR_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  if (words.length === 0) return vector;

  for (const word of words) {
    // Hash whole word
    let h1 = 0;
    for (let i = 0; i < word.length; i++) {
      h1 = (Math.imul(31, h1) + word.charCodeAt(i)) | 0;
    }
    const idx1 = Math.abs(h1) % VECTOR_DIM;
    vector[idx1] += 1.0;

    // Character trigrams for morphological similarity
    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        const tri = word.slice(i, i + 3);
        let h2 = 0;
        for (let j = 0; j < 3; j++) {
          h2 = (Math.imul(37, h2) + tri.charCodeAt(j)) | 0;
        }
        const idx2 = Math.abs(h2) % VECTOR_DIM;
        vector[idx2] += 0.3;
      }
    }
  }

  // Normalize to unit length (L2 norm)
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dot));
}
