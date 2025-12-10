import { QdrantRepository } from './qdrant.repo';
import { EmbeddingsService } from './embeddings.service';
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
    searchResults?: any[];
}
interface ChatResponse {
    message: string;
    searchResults: any[];
    sources: string[];
    confidence: number;
    model: string;
    responseTime: number;
}
export declare class OfflineChatApp {
    private ollama;
    private qdrantRepo;
    private embeddings;
    private chatModel;
    private conversationHistory;
    private systemPrompt;
    constructor(qdrantRepo: QdrantRepository, embeddings: EmbeddingsService, chatModel?: string);
    searchFunds(query: string, topK?: number): Promise<any[]>;
    private formatSearchResults;
    chat(userMessage: string, includeHistory?: boolean, useAIQueryBuilder?: boolean): Promise<ChatResponse>;
    resetConversation(): void;
    getHistory(): ChatMessage[];
}
export {};
//# sourceMappingURL=offline-chat-app.d.ts.map