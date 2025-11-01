"use strict";
// ========================================
// OFFLINE LLM CHAT SERVICE USING OLLAMA
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
exports.OfflineDatabaseChatService = exports.OfflineEmbeddingService = void 0;
exports.checkOllamaSetup = checkOllamaSetup;
exports.startOfflineDatabaseChat = startOfflineDatabaseChat;
const ollama_1 = require("ollama");
const crud_repo_1 = require("./crud.repo");
const search_repo_1 = require("./search.repo");
const embeddings_service_1 = require("./embeddings.service");
// ========================================
// OLLAMA SETUP CHECKER
// ========================================
async function checkOllamaSetup() {
    const instructions = [];
    let installed = false;
    let running = false;
    let modelsAvailable = false;
    try {
        // Check if Ollama is running
        const ollama = new ollama_1.Ollama({ host: 'http://localhost:11434' });
        const response = await ollama.list();
        installed = true;
        running = true;
        // Check if required models are available
        const hasLlama = response.models?.some((model) => model.name.includes('gemma'));
        const hasEmbedding = response.models?.some((model) => model.name.includes('nomic-embed'));
        modelsAvailable = hasLlama && hasEmbedding;
        if (!hasLlama) {
            instructions.push('Install chat model: ollama pull gemma3:4b');
        }
        if (!hasEmbedding) {
            instructions.push('Install embedding model: ollama pull nomic-embed-text');
        }
        if (modelsAvailable) {
            instructions.push('âœ… Ollama is ready to use!');
        }
    }
    catch (error) {
        instructions.push('ðŸ“± Download Ollama from: https://ollama.ai');
        instructions.push('ðŸš€ Start Ollama: ollama serve');
        instructions.push('ðŸ“¥ Install models:');
        instructions.push('   ollama pull gemma3:4b');
        instructions.push('   ollama pull nomic-embed-text');
    }
    return {
        installed,
        running,
        modelsAvailable,
        instructions
    };
}
// ========================================
// OFFLINE EMBEDDING SERVICE
// ========================================
class OfflineEmbeddingService {
    constructor(ollamaUrl = 'http://localhost:11434', embeddingModel = 'nomic-embed-text') {
        this.ollama = new ollama_1.Ollama({ host: ollamaUrl });
        this.embeddingModel = embeddingModel;
    }
    // Generate embeddings using Ollama's embedding models
    async generateEmbedding(text) {
        try {
            const response = await this.ollama.embeddings({
                model: this.embeddingModel,
                prompt: this.preprocessText(text)
            });
            return response.embedding;
        }
        catch (error) {
            console.error('âŒ Error generating offline embedding:', error);
            throw error;
        }
    }
    // Generate embeddings for both title and content
    async generateDocumentEmbedding(title, content) {
        const combinedText = `${title}\n\n${content}`;
        return this.generateEmbedding(combinedText);
    }
    // Check if Ollama is running and model is available
    async checkAvailability() {
        try {
            const models = await this.ollama.list();
            const hasEmbeddingModel = models.models?.some((model) => model.name.includes(this.embeddingModel) || model.name.includes('nomic-embed'));
            return hasEmbeddingModel;
        }
        catch (error) {
            return false;
        }
    }
    // Install embedding model if not available
    async installEmbeddingModel() {
        try {
            console.log(`ðŸ“¥ Installing embedding model: ${this.embeddingModel}`);
            await this.ollama.pull({ model: this.embeddingModel });
            console.log(`âœ… Successfully installed ${this.embeddingModel}`);
            return true;
        }
        catch (error) {
            console.error('âŒ Failed to install embedding model:', error);
            return false;
        }
    }
    preprocessText(text) {
        return text
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 4000); // Limit for embedding models
    }
}
exports.OfflineEmbeddingService = OfflineEmbeddingService;
// ========================================
// OFFLINE DATABASE CHAT SERVICE
// ========================================
class OfflineDatabaseChatService {
    constructor(searchRepo, crudRepo, ollamaUrl = 'http://localhost:11434', chatModel = 'gemma3:4b' // Default chat model
    ) {
        this.conversationHistory = [];
        this.context = []; // For maintaining conversation context
        this.ollama = new ollama_1.Ollama({ host: ollamaUrl });
        this.chatModel = chatModel;
        this.embeddingService = new OfflineEmbeddingService(ollamaUrl);
        this.searchRepo = searchRepo;
        this.crudRepo = crudRepo;
        // Initialize with system prompt
        this.conversationHistory.push({
            role: 'system',
            content: `You are a helpful AI assistant that searches and answers questions about documents in a local database. 

IMPORTANT INSTRUCTIONS:
- Use ONLY information from the provided documents
- Always cite which documents you reference
- If no relevant information is found, say so clearly
- Keep responses concise but helpful
- Be conversational and friendly

SPECIAL DATABASE CAPABILITIES:
- When users ask about "categories", "what categories do you have", "list categories", etc., you should respond with: "I can show you the available categories. Let me retrieve them from the database."
- When users ask about "tags", "what tags do you have", "list tags", "get all tags", etc., you should respond with the available tags from the database.
- When users ask for documents from a specific category (like "Cloud documents", "AI/ML papers", etc.), search for those specifically
- You have access to categorized documents with metadata including categories and tags

You are running completely offline with no internet access.`
        });
    }
    // Main chat method - handles user queries offline
    async chat(userMessage) {
        const startTime = Date.now();
        try {
            console.log(`ðŸ’¬ User: ${userMessage}`);
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });
            // Check for specific category document requests
            const lowerMessage = userMessage.toLowerCase();
            // Check for Cloud category specific requests (keep this one as example)
            if (lowerMessage.includes('cloud') && (lowerMessage.includes('documents') || lowerMessage.includes('category'))) {
                console.log('ðŸ“‚ Detected Cloud category search - retrieving from database...');
                try {
                    const documents = this.crudRepo.getDocumentsByCategory('Cloud');
                    if (documents.length > 0) {
                        const docList = documents.map((doc, i) => `${i + 1}. **${doc.title}**\n   ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`).join('\n\n');
                        const message = `Found ${documents.length} document(s) in the "Cloud" category:\n\n${docList}`;
                        // Add assistant response to history
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: message,
                            timestamp: new Date(),
                            searchResults: documents
                        });
                        const responseTime = Date.now() - startTime;
                        return {
                            message,
                            searchResults: documents,
                            sources: documents.map((doc) => doc.title),
                            confidence: 100,
                            model: this.chatModel,
                            responseTime
                        };
                    }
                    else {
                        const message = 'No documents found in the "Cloud" category.';
                        // Add assistant response to history
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: message,
                            timestamp: new Date(),
                            searchResults: []
                        });
                        const responseTime = Date.now() - startTime;
                        return {
                            message,
                            searchResults: [],
                            sources: [],
                            confidence: 100,
                            model: this.chatModel,
                            responseTime
                        };
                    }
                }
                catch (error) {
                    console.error('âŒ Error searching Cloud category:', error);
                    // Fall through to normal search
                }
            }
            // Step 1: Generate embedding for the user's question (offline)
            console.log('ðŸ” Searching database with offline embeddings...');
            const queryEmbedding = await this.embeddingService.generateEmbedding(userMessage);
            // Step 2: Search for relevant documents
            const searchResults = this.searchRepo.searchSimilar(queryEmbedding, 5);
            // Step 3: Also try text search for better coverage
            const textResults = this.searchRepo.searchByText(userMessage, 3);
            // Step 4: Combine and deduplicate results
            const allResults = this.combineSearchResults(searchResults, textResults);
            console.log(`ðŸ“Š Found ${allResults.length} relevant documents`);
            // Step 5: Prepare context for LLM
            const context = this.prepareContext(allResults);
            // Step 6: Check if this might be a categories or tags request and enhance context
            let enhancedContext = context;
            if (lowerMessage.includes('categor')) {
                try {
                    const categories = this.crudRepo.getAllCategories();
                    const categoryInfo = `\nAVAILABLE CATEGORIES IN DATABASE:\n${categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}\n\nTotal categories: ${categories.length}\n`;
                    enhancedContext = categoryInfo + '\n' + context;
                }
                catch (error) {
                    console.log('Could not retrieve categories for context');
                }
            }
            if (lowerMessage.includes('tag')) {
                try {
                    const tags = this.crudRepo.getAllTags();
                    const tagInfo = `\nAVAILABLE TAGS IN DATABASE:\n${tags.join(', ')}\n\nTotal tags: ${tags.length}\n`;
                    enhancedContext = tagInfo + '\n' + enhancedContext;
                }
                catch (error) {
                    console.log('Could not retrieve tags for context');
                }
            }
            // Step 7: Generate LLM response (offline)
            const llmResponse = await this.generateOfflineLLMResponse(userMessage, enhancedContext);
            // Step 8: Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: llmResponse.message,
                timestamp: new Date(),
                searchResults: allResults
            });
            const responseTime = Date.now() - startTime;
            return {
                message: llmResponse.message,
                searchResults: allResults,
                sources: allResults.map(doc => doc.title),
                confidence: this.calculateConfidence(allResults),
                model: this.chatModel,
                responseTime
            };
        }
        catch (error) {
            console.error('âŒ Offline chat error:', error);
            throw error;
        }
    }
    // Generate LLM response using local Ollama
    async generateOfflineLLMResponse(userMessage, context) {
        const systemPrompt = `Based on the following documents from the local database, answer the user's question.

AVAILABLE DOCUMENTS:
${context}

Instructions:
- Use ONLY information from the provided documents
- If documents don't contain relevant information, say so clearly
- Always mention which documents you're referencing
- Be helpful and conversational
- Keep responses concise but informative`;
        // Prepare the full prompt
        const fullPrompt = `${systemPrompt}

User Question: ${userMessage}

Answer:`;
        try {
            const response = await this.ollama.generate({
                model: this.chatModel,
                prompt: fullPrompt,
                context: this.context,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40
                }
            });
            // Update context for future messages
            if (response.context) {
                this.context = response.context;
            }
            return {
                message: response.response || 'I apologize, but I was unable to generate a response.'
            };
        }
        catch (error) {
            console.error('âŒ Ollama generation error:', error);
            return {
                message: 'I apologize, but I encountered an error generating a response. Please make sure Ollama is running and the model is installed.'
            };
        }
    }
    // Check if Ollama is running and models are available
    async checkAvailability() {
        try {
            const models = await this.ollama.list();
            const hasChatModel = models.models?.some((model) => model.name.includes(this.chatModel.split(':')[0]));
            const embeddingAvailable = await this.embeddingService.checkAvailability();
            return {
                ollama: true,
                chatModel: hasChatModel,
                embeddingModel: embeddingAvailable
            };
        }
        catch (error) {
            return {
                ollama: false,
                chatModel: false,
                embeddingModel: false
            };
        }
    }
    // Install required models
    async installModels() {
        try {
            console.log('ðŸ“¥ Installing required models for offline chat...');
            // Install chat model
            console.log(`Installing chat model: ${this.chatModel}`);
            await this.ollama.pull({ model: this.chatModel });
            // Install embedding model
            await this.embeddingService.installEmbeddingModel();
            console.log('âœ… All models installed successfully!');
            return true;
        }
        catch (error) {
            console.error('âŒ Failed to install models:', error);
            return false;
        }
    }
    // List available models
    async listAvailableModels() {
        try {
            const models = await this.ollama.list();
            return models.models?.map((model) => model.name) || [];
        }
        catch (error) {
            console.error('âŒ Failed to list models:', error);
            return [];
        }
    }
    // Switch to different model
    switchModel(newModel) {
        this.chatModel = newModel;
        this.context = []; // Reset context when switching models
        console.log(`ðŸ”„ Switched to model: ${newModel}`);
    }
    // Prepare context from search results for LLM
    prepareContext(results) {
        if (results.length === 0) {
            return 'No relevant documents found in the local database.';
        }
        return results.map((doc, index) => {
            return `Document ${index + 1}: "${doc.title}"
Content: ${doc.content.substring(0, 500)}${doc.content.length > 500 ? '...' : ''}
Relevance Score: ${doc.similarity?.toFixed(3) || 'N/A'}
---`;
        }).join('\n\n');
    }
    // Combine and deduplicate search results
    combineSearchResults(vectorResults, textResults) {
        const seen = new Set();
        const combined = [];
        for (const result of vectorResults) {
            if (!seen.has(result.id)) {
                seen.add(result.id);
                combined.push({ ...result, searchType: 'vector' });
            }
        }
        for (const result of textResults) {
            if (!seen.has(result.id)) {
                seen.add(result.id);
                combined.push({ ...result, searchType: 'text' });
            }
        }
        return combined;
    }
    // Calculate confidence based on search results
    calculateConfidence(results) {
        if (results.length === 0)
            return 0;
        const avgSimilarity = results
            .filter(r => r.similarity)
            .reduce((sum, r) => sum + r.similarity, 0) / results.length;
        return Math.min(avgSimilarity * 100, 95);
    }
    // Get conversation history
    getHistory() {
        return this.conversationHistory.filter(msg => msg.role !== 'system');
    }
    // Clear conversation history
    clearHistory() {
        this.conversationHistory = this.conversationHistory.filter(msg => msg.role === 'system');
        this.context = []; // Reset context
    }
    // Get database statistics
    async getStats() {
        return this.crudRepo.getStats();
    }
}
exports.OfflineDatabaseChatService = OfflineDatabaseChatService;
// ========================================
// USAGE EXAMPLE
// ========================================
async function startOfflineDatabaseChat() {
    const { connectDB } = await Promise.resolve().then(() => __importStar(require('./create-db')));
    try {
        console.log('[INFO] Checking Ollama setup...\\n');
        // Check Ollama setup first
        const setup = await checkOllamaSetup();
        if (!setup.running) {
            console.log('[ERROR] Ollama is not running!');
            console.log('\n[INFO] Setup Instructions:');
            setup.instructions.forEach(instruction => {
                console.log(`   ${instruction}`);
            });
            console.log('\n[INFO] Ollama is NOT a web server — it\'s a desktop app that runs locally!');
            console.log('[INFO] Once you start "ollama serve", it runs at http://localhost:11434');
            return;
        }
        if (!setup.modelsAvailable) {
            console.log('[WARN] Required models not installed!');
            console.log('\n[INFO] Run these commands:');
            setup.instructions.forEach(instruction => {
                console.log(`   ${instruction}`);
            });
            return;
        }
        console.log('âœ… Ollama setup is complete!\n');
        // Initialize database and repositories
        const dbInstance = connectDB();
        // Create embeddings service
        const embeddingsService = new embeddings_service_1.EmbeddingsService('nomic-embed-text');
        // Create repositories
        const crudRepo = new crud_repo_1.CrudRepository(dbInstance, embeddingsService);
        const searchRepo = new search_repo_1.SearchRepository(dbInstance);
        // Check if database has documents
        const stats = crudRepo.getStats();
        if (stats.documents === 0) {
            console.log('âš ï¸ Database is empty. Please add some documents first.');
            return;
        }
        console.log('[INFO] Connected to database with ' + stats.documents + ' documents');
        // Initialize offline chat service
        const chatService = new OfflineDatabaseChatService(searchRepo, crudRepo);
        console.log('[OK] Offline chat is ready!');
        // Start console interface (reuse existing one)
        const { ConsoleChatInterface } = await Promise.resolve().then(() => __importStar(require('./chat-interface')));
        const chatInterface = new ConsoleChatInterface(chatService);
        await chatInterface.start();
    }
    catch (error) {
        console.error('âŒ Failed to start offline chat:', error);
    }
}
// Run if this is the main module
if (require.main === module) {
    startOfflineDatabaseChat().catch(console.error);
}
//# sourceMappingURL=offline-chat.js.map