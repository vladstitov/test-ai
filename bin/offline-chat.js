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
const crud_repo_1 = require("./crud.repo");
const search_repo_1 = require("./search.repo");
const embeddings_service_1 = require("./embeddings.service");
const ollama_singleton_1 = require("./ollama-singleton");
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
        const ollama = (0, ollama_singleton_1.getOllama)();
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
            instructions.push('✅ Ollama is ready to use!');
        }
    }
    catch (error) {
        instructions.push(' Download Ollama from: https://ollama.ai');
        instructions.push('Start Ollama: ollama serve');
        instructions.push(' Install models:');
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
        this.ollama = (0, ollama_singleton_1.getOllama)();
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
            console.error('❌ Error generating offline embedding:', error);
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
            console.log(`📥 Installing embedding model: ${this.embeddingModel}`);
            await this.ollama.pull({ model: this.embeddingModel });
            console.log(`✅ Successfully installed ${this.embeddingModel}`);
            return true;
        }
        catch (error) {
            console.error('❌ Failed to install embedding model:', error);
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
        this.ollama = (0, ollama_singleton_1.getOllama)();
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
- When users ask about "strategies", "what strategies do you have", "list strategies", etc., you should respond with the available strategies from the database.
- When users ask about "geographies", "what geographies do you have", "list geographies", etc., you should respond with the available geographies from the database.
- When users ask for documents tied to a specific strategy or geography, search for those specifically where applicable.
- You have access to documents with metadata including strategy and geography fields

You are running completely offline with no internet access.`
        });
    }
    // Main chat method - handles user queries offline
    async chat(userMessage) {
        const startTime = Date.now();
        try {
            console.log(`💬 User: ${userMessage}`);
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });
            // Check for specific category document requests
            const lowerMessage = userMessage.toLowerCase();
            // Removed special-case Cloud category branch; rely on general handling
            // Step 1: Generate embedding for the user's question (offline)
            console.log('🔍 Searching database with offline embeddings...');
            const queryEmbedding = await this.embeddingService.generateEmbedding(userMessage);
            // Step 2: Search for relevant documents
            const searchResults = this.searchRepo.searchSimilar(queryEmbedding, 5);
            // Step 3: Also try text search for better coverage
            const textResults = this.searchRepo.searchByText(userMessage, 3);
            // Step 4: Combine and deduplicate results
            const allResults = this.combineSearchResults(searchResults, textResults);
            console.log(`📊 Found ${allResults.length} relevant documents`);
            // Step 5: Prepare context for LLM
            const context = this.prepareContext(allResults);
            // Step 6: Classify intent (strategies/geographies/other) via LLM before enrichment
            let enhancedContext = context;
            try {
                const intent = await this.classifyIntent(userMessage);
                if (intent === 'strategies') {
                    const strategies = this.crudRepo.getStrategies();
                    const info = `\nAVAILABLE STRATEGIES IN DATABASE:\n${strategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nTotal strategies: ${strategies.length}\n`;
                    enhancedContext = info + '\n' + context;
                }
                else if (intent === 'geographies') {
                    const geos = this.crudRepo.getGeographies();
                    const info = `\nAVAILABLE GEOGRAPHIES IN DATABASE:\n${geos.join(', ')}` + `\n\nTotal geographies: ${geos.length}\n`;
                    enhancedContext = info + '\n' + enhancedContext;
                }
            }
            catch { }
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
            console.error('❌ Offline chat error:', error);
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
            console.error('❌ Ollama generation error:', error);
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
            console.log('📥 Installing required models for offline chat...');
            // Install chat model
            console.log(`Installing chat model: ${this.chatModel}`);
            await this.ollama.pull({ model: this.chatModel });
            // Install embedding model
            await this.embeddingService.installEmbeddingModel();
            console.log('✅ All models installed successfully!');
            return true;
        }
        catch (error) {
            console.error('❌ Failed to install models:', error);
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
            console.error('❌ Failed to list models:', error);
            return [];
        }
    }
    // Switch to different model
    switchModel(newModel) {
        this.chatModel = newModel;
        this.context = []; // Reset context when switching models
        console.log(`🔄 Switched to model: ${newModel}`);
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
// LLM-assisted intent classifier attached to the service prototype
OfflineDatabaseChatService.classifyIntent = async function (message) {
    try {
        const sys = [
            'You are a precise intent classifier.',
            'Decide if the user asks specifically about listing strategies or geographies.',
            'Respond with one word only: strategies, geographies, or other.'
        ].join('\n');
        const response = await this.ollama.chat({
            model: this.chatModel,
            messages: [
                { role: 'system', content: sys },
                { role: 'user', content: message }
            ],
            options: { temperature: 0 }
        });
        const text = (response?.message?.content || '').trim().toLowerCase();
        if (text.includes('strateg'))
            return 'strategies';
        if (text.includes('geograph'))
            return 'geographies';
        return 'other';
    }
    catch {
        const lower = String(message || '').toLowerCase();
        if (/\bstrateg(y|ies)\b/.test(lower) || lower.includes('strategy') || lower.includes('strategies'))
            return 'strategies';
        if (/\bgeograph(y|ies)\b/.test(lower) || lower.includes('geography') || lower.includes('geographies'))
            return 'geographies';
        return 'other';
    }
};
// ========================================
// USAGE EXAMPLE
// ========================================
async function startOfflineDatabaseChat() {
    const { connectDB } = await Promise.resolve().then(() => __importStar(require('./sqlite-connector')));
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
            console.log('\n[INFO] Ollama is NOT a web server � it\'s a desktop app that runs locally!');
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
        console.log('✅ Ollama setup is complete!\n');
        // Initialize database and repositories
        const dbInstance = await connectDB();
        // Create embeddings service
        const embeddingsService = new embeddings_service_1.EmbeddingsService();
        // Create repositories
        const crudRepo = new crud_repo_1.CrudRepository(dbInstance, embeddingsService);
        const searchRepo = new search_repo_1.SearchRepository(dbInstance);
        // Check if database has documents
        const stats = crudRepo.getStats();
        if (stats.documents === 0) {
            console.log('⚠️ Database is empty. Please add some documents first.');
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
        console.error('❌ Failed to start offline chat:', error);
    }
}
// Run if this is the main module
if (require.main === module) {
    startOfflineDatabaseChat().catch(console.error);
}
//# sourceMappingURL=offline-chat.js.map