import { CrudRepository } from './crud.repo';
import { SearchRepository } from './search.repo';
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
export declare function checkOllamaSetup(): Promise<{
    installed: boolean;
    running: boolean;
    modelsAvailable: boolean;
    instructions: string[];
}>;
export declare class OfflineEmbeddingService {
    private ollama;
    private embeddingModel;
    constructor(ollamaUrl?: string, embeddingModel?: string);
    generateEmbedding(text: string): Promise<number[]>;
    generateDocumentEmbedding(title: string, content: string): Promise<number[]>;
    checkAvailability(): Promise<boolean>;
    installEmbeddingModel(): Promise<boolean>;
    private preprocessText;
}
export declare class OfflineDatabaseChatService {
    private ollama;
    private chatModel;
    private embeddingService;
    private searchRepo;
    private crudRepo;
    private conversationHistory;
    private context;
    constructor(searchRepo: SearchRepository, crudRepo: CrudRepository, ollamaUrl?: string, chatModel?: string);
    chat(userMessage: string): Promise<ChatResponse>;
    private generateOfflineLLMResponse;
    checkAvailability(): Promise<{
        ollama: boolean;
        chatModel: boolean;
        embeddingModel: boolean;
    }>;
    installModels(): Promise<boolean>;
    listAvailableModels(): Promise<string[]>;
    switchModel(newModel: string): void;
    private prepareContext;
    private combineSearchResults;
    private calculateConfidence;
    getHistory(): ChatMessage[];
    clearHistory(): void;
    getStats(): Promise<any>;
}
export declare function startOfflineDatabaseChat(): Promise<void>;
export {};
//# sourceMappingURL=offline-chat-sqlite.d.ts.map