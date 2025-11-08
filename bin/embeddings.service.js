"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingsService = void 0;
const ollama_singleton_1 = require("./ollama-singleton");
// ========================================
// EMBEDDINGS SERVICE CLASS
// ========================================
class EmbeddingsService {
    constructor() {
        this.ollama = (0, ollama_singleton_1.getOllama)();
    }
    // Generate embedding using Ollama
    async generateEmbedding(text) {
        if (text.length > 4000) {
            console.log(' Catting text to 4000');
            text = text.trim().substring(0, 4000);
        }
        try {
            console.log(text);
            console.log(` Generating embedding for text using model: ${text.length}`);
            const response = await this.ollama.embeddings({
                model: (0, ollama_singleton_1.getEmbeddingModel)(),
                prompt: text
            });
            console.log(`Embedding generated successfully (${response.embedding.length} dimensions)`);
            return response.embedding;
        }
        catch (error) {
            console.error('??O Error generating embedding with Ollama:', error);
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Generate embedding for a document (metadata removed)
    async generateDocumentEmbedding(title, content) {
        const combinedText = `${title}\n\n${content}`;
        return this.generateEmbedding(combinedText);
    }
    // Generate embedding for search queries
    async generateQueryEmbedding(text) {
        return this.generateEmbedding(text);
    }
}
exports.EmbeddingsService = EmbeddingsService;
//# sourceMappingURL=embeddings.service.js.map