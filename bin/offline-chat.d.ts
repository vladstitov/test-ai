interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}
interface ChatResponse {
    message: string;
    model: string;
    responseTime: number;
}
export declare class OfflineChat {
    private ollama;
    private chatModel;
    private conversationHistory;
    private systemPrompt;
    constructor(chatModel?: string, systemPrompt?: string);
    chat(userMessage: string, includeHistory?: boolean): Promise<ChatResponse>;
    resetConversation(): void;
    getHistory(): ChatMessage[];
    setSystemPrompt(prompt: string): void;
}
export {};
//# sourceMappingURL=offline-chat.d.ts.map