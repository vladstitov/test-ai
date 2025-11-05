import { Ollama } from 'ollama';

// ========================================
// EMBEDDINGS SERVICE CLASS
// ========================================

export class EmbeddingsService {
  private ollama: Ollama;
  private embeddingModel: string;

  constructor(embeddingModel: string = 'nomic-embed-text', ollamaInstance?: Ollama) {
    this.ollama = ollamaInstance || new Ollama();
    this.embeddingModel = embeddingModel;
  }

  // Generate embedding using Ollama
  async generateEmbedding(text: string): Promise<number[]> {

    if(text.length > 4000) {
      console.log(' Catting text to 4000');
      text = text.trim().substring(0, 4000);
    }
    try {
      console.log(text);
      console.log(` Generating embedding for text using model: ${text.length}`);
      
      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text
      });
      
      console.log(`Embedding generated successfully (${response.embedding.length} dimensions)`);
      return response.embedding;
    } catch (error) {
      console.error('❌ Error generating embedding with Ollama:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate embedding for a document (metadata removed)
  async generateDocumentEmbedding(title: string, content: string): Promise<number[]> {
    const combinedText = `${title}\n\n${content}`;
    return this.generateEmbedding(combinedText);
  }

  // Generate embedding for search queries
  async generateQueryEmbedding(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  // Get the embedding model being used
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  // Set a different embedding model
  setEmbeddingModel(model: string): void {
    this.embeddingModel = model;
    console.log(`🔄 Embedding model changed to: ${model}`);
  }

  // Get the Ollama instance (useful for sharing across multiple services)
  getOllamaInstance(): Ollama {
    return this.ollama;
  }
}
