import { Ollama } from 'ollama';

// Single Ollama instance for the whole app
let instance: Ollama | null = null;

// Embedding model configured at Ollama creation time
const EMBEDDING_MODEL =  'nomic-embed-text';

export function getOllama(): Ollama {
  if (!instance) {
    instance = new Ollama();
  }
  return instance;
}

export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

