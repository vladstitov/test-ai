"use strict";
// ========================================
// SIMPLE CONSOLE CHAT INTERFACE (Clean logging)
// ========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleChatInterface = void 0;
class ConsoleChatInterface {
    constructor(chatService) {
        this.chatService = chatService;
    }
    async start() {
        console.log('[INFO] Database Chat Assistant Started!');
        console.log('Type "exit" to quit, "stats" for database info, "history" to see conversation');
        console.log(''.padEnd(60, '='));
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const askQuestion = () => {
            return new Promise((resolve) => {
                readline.question('\nYou: ', (answer) => {
                    resolve(answer.trim());
                });
            });
        };
        try {
            while (true) {
                const userInput = await askQuestion();
                if (userInput.toLowerCase() === 'exit') {
                    console.log('Goodbye!');
                    break;
                }
                if (userInput.toLowerCase() === 'stats') {
                    const stats = await this.chatService.getStats();
                    console.log('\n[INFO] Database Statistics:');
                    console.log(`   Documents: ${stats.documents}`);
                    console.log(`   Embeddings: ${stats.embeddings}`);
                    continue;
                }
                if (userInput.toLowerCase() === 'history') {
                    const history = this.chatService.getHistory();
                    console.log('\n[INFO] Conversation History:');
                    history.forEach((msg) => {
                        const role = msg.role === 'user' ? 'You' : 'Assistant';
                        console.log(`${role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
                    });
                    continue;
                }
                if (userInput.toLowerCase() === 'clear') {
                    this.chatService.clearHistory();
                    console.log('[INFO] Conversation history cleared');
                    continue;
                }
                if (!userInput) {
                    console.log('Please enter a question or command.');
                    continue;
                }
                try {
                    console.log('\n[INFO] Searching and thinking...');
                    const response = await this.chatService.chat(userInput);
                    console.log(`\nAssistant: ${response.message}`);
                    if (response.searchResults.length > 0) {
                        console.log(`\nSources (${response.sources.length}):`);
                        response.sources.slice(0, 3).forEach((source, i) => {
                            console.log(`   ${i + 1}. ${source}`);
                        });
                        console.log(`[INFO] Confidence: ${response.confidence.toFixed(1)}%`);
                        console.log(`Response time: ${response.responseTime}ms | Model: ${response.model}`);
                    }
                    else {
                        console.log('\n[WARN] No relevant documents found in database');
                    }
                }
                catch (error) {
                    console.error('\n[ERROR] Error:', error instanceof Error ? error.message : 'Unknown error');
                }
            }
        }
        finally {
            readline.close();
        }
    }
}
exports.ConsoleChatInterface = ConsoleChatInterface;
//# sourceMappingURL=chat-interface.js.map