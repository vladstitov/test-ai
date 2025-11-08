export declare class EmbeddingsService {
    private ollama;
    constructor();
    generateEmbedding(text: string): Promise<number[]>;
    generateDocumentEmbedding(title: string, content: string): Promise<number[]>;
    generateQueryEmbedding(text: string): Promise<number[]>;
}
//# sourceMappingURL=embeddings.service.d.ts.map