import { Ollama } from 'ollama';
export declare class EmbeddingsService {
    private ollama;
    private embeddingModel;
    constructor(embeddingModel?: string, ollamaInstance?: Ollama);
    generateEmbedding(text: string): Promise<number[]>;
    generateDocumentEmbedding(title: string, content: string): Promise<number[]>;
    generateQueryEmbedding(text: string): Promise<number[]>;
    getEmbeddingModel(): string;
    setEmbeddingModel(model: string): void;
    getOllamaInstance(): Ollama;
}
//# sourceMappingURL=embeddings.service.d.ts.map