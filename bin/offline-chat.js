"use strict";
// ========================================
// OFFLINE CHAT WITH OLLAMA - DEEPSEEK MODEL
// ========================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineChat = void 0;
const ollama_singleton_1 = require("./ollama-singleton");
const readline = __importStar(require("readline"));
// ========================================
// OFFLINE CHAT SERVICE
// ========================================
class OfflineChat {
    constructor(chatModel = 'deepseek-r1:32b', systemPrompt) {
        this.conversationHistory = [];
        this.ollama = (0, ollama_singleton_1.getOllama)();
        this.chatModel = chatModel;
        this.systemPrompt = systemPrompt ||
            `You are a helpful AI assistant. Provide clear, accurate, and concise responses.`;
    }
    // ========================================
    // CHAT WITH OLLAMA
    // ========================================
    async chat(userMessage, includeHistory = true) {
        const startTime = Date.now();
        try {
            // Build messages for Ollama
            const messages = [
                { role: 'system', content: this.systemPrompt }
            ];
            // Add conversation history if requested
            if (includeHistory) {
                this.conversationHistory.forEach(msg => {
                    messages.push({ role: msg.role, content: msg.content });
                });
            }
            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });
            // Get response from Ollama
            console.log(`\n[USER] ${userMessage}`);
            console.log(`[OLLAMA] Generating response with ${this.chatModel}...`);
            const response = await this.ollama.chat({
                model: this.chatModel,
                messages: messages,
                stream: false
            });
            const assistantMessage = response.message.content;
            // Update conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage,
                timestamp: new Date()
            });
            const responseTime = Date.now() - startTime;
            console.log(`\n[ASSISTANT] ${assistantMessage}`);
            console.log(`\n[INFO] Response time: ${responseTime}ms`);
            return {
                message: assistantMessage,
                model: this.chatModel,
                responseTime
            };
        }
        catch (error) {
            console.error('[ERROR] Chat failed:', error);
            throw error;
        }
    }
    // ========================================
    // RESET CONVERSATION
    // ========================================
    resetConversation() {
        this.conversationHistory = [];
        console.log('[INFO] Conversation history cleared');
    }
    // ========================================
    // GET CONVERSATION HISTORY
    // ========================================
    getHistory() {
        return this.conversationHistory;
    }
    // ========================================
    // SET SYSTEM PROMPT
    // ========================================
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        console.log('[INFO] System prompt updated');
    }
}
exports.OfflineChat = OfflineChat;
// ========================================
// INTERACTIVE CHAT LOOP
// ========================================
async function interactiveChatLoop(chatService) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log('\n========================================');
    console.log('OFFLINE CHAT - DEEPSEEK-R1:32B');
    console.log('========================================');
    console.log('Commands: /reset - clear history, /exit - quit\n');
    const askQuestion = () => {
        rl.question('You: ', async (input) => {
            const userInput = input.trim();
            if (!userInput) {
                askQuestion();
                return;
            }
            if (userInput === '/exit') {
                console.log('\nGoodbye!');
                rl.close();
                process.exit(0);
                return;
            }
            if (userInput === '/reset') {
                chatService.resetConversation();
                askQuestion();
                return;
            }
            try {
                await chatService.chat(userInput, true);
                console.log('\n');
                askQuestion();
            }
            catch (error) {
                console.error('[ERROR]', error);
                askQuestion();
            }
        });
    };
    askQuestion();
}
// ========================================
// MAIN ENTRY POINT
// ========================================
async function main() {
    try {
        console.log('[INFO] Initializing Offline Chat with DeepSeek...');
        // Initialize chat service with deepseek-r1:32b
        const chatService = new OfflineChat('deepseek-r1:32b');
        // Start interactive chat
        await interactiveChatLoop(chatService);
    }
    catch (error) {
        console.error('[FATAL] Failed to start chat:', error);
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=offline-chat.js.map