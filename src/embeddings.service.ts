import { Ollama } from 'ollama';
import { getEmbeddingModel, getOllama } from './ollama-singleton';

// ========================================
// EMBEDDINGS SERVICE CLASS
// ========================================

export class EmbeddingsService {
  private ollama: Ollama;
  constructor() {
    this.ollama = getOllama();
  }

  // Generate embedding using Ollama
  async generateEmbedding(text: string): Promise<number[]> {
    if (text.length > 4000) {
      console.log(' Catting text to 4000');
      text = text.trim().substring(0, 4000);
    }
    try {
     /// console.log(text);
   ///   console.log(` Generating embedding for text using model: ${text.length}`);
      const response = await this.ollama.embeddings({
        model: 'nomic-embed-text',
        prompt: text
      });
   ///   console.log(`Embedding generated successfully (${response.embedding.length} dimensions)`);
      return response.embedding;
    } catch (error) {
      console.error('??O Error generating embedding with Ollama:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }  
}
