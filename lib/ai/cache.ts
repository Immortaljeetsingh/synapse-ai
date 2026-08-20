import crypto from 'crypto';
import { getArtifact, saveArtifact } from '../db/queries';
import { ArtifactType } from '../types';

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function getCachedArtifact<T = any>(
  notebookId: string,
  artifactType: ArtifactType,
  documentId?: string | null
): Promise<T | null> {
  try {
    return await getArtifact(notebookId, artifactType, documentId);
  } catch (err) {
    return null;
  }
}

export async function setCachedArtifact(
  notebookId: string,
  artifactType: ArtifactType,
  content: any,
  documentId?: string | null
): Promise<void> {
  const artifactId = `art_${notebookId}_${artifactType}${documentId ? `_${documentId}` : ''}`;
  await saveArtifact(artifactId, notebookId, documentId || null, artifactType, JSON.stringify(content));
}
