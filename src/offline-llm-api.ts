// ========================================
// OFFLINE LLM API INTERFACE
// ========================================
// Simple JavaScript interface for offline LLM and database communication

import { connectDB } from './create-db';
import { CrudRepository } from './crud.repo';
import { SearchRepository } from './search.repo';
import { EmbeddingsService } from './embeddings.service';
import { OfflineDatabaseChatService } from './offline-chat';

// ========================================
// OFFLINE LLM API CLASS
// ========================================

export class OfflineLLMAPI {
  private crudRepo: CrudRepository;
  private searchRepo: SearchRepository;
  private chatService?: OfflineDatabaseChatService;

  constructor() {
    // Initialize database and repositories
    const dbInstance = connectDB();
    
    // Create embeddings service
    const embeddingsService = new EmbeddingsService('nomic-embed-text');
    
    // Create repositories
    this.crudRepo = new CrudRepository(dbInstance, embeddingsService);
    this.searchRepo = new SearchRepository(dbInstance);
  }

  // Initialize offline chat (requires Ollama)
  async initialize(): Promise<boolean> {
    try {
      this.chatService = new OfflineDatabaseChatService(this.searchRepo, this.crudRepo);
      
      // Check if Ollama is available
      const availability = await this.chatService.checkAvailability();
      if (!availability.ollama || !availability.chatModel || !availability.embeddingModel) {
        console.error('âŒ Ollama is not ready');
        console.log('ðŸ’¡ Run: ollama serve');
        console.log('ðŸ’¡ Install models: ollama pull gemma3:4b && ollama pull nomic-embed-text');
        return false;
      }
      
      console.log('âœ… Offline LLM API initialized');
      return true;
    } catch (error) {
      console.error('âŒ Failed to initialize offline chat:', error);
      return false;
    }
  }

  // Main chat method
  async chat(message: string): Promise<{
    success: boolean;
    response?: string;
    sources?: string[];
    confidence?: number;
    model?: string;
    responseTime?: number;
    error?: string;
  }> {
    try {
      if (!this.chatService) {
        return {
          success: false,
          error: 'Chat service not initialized. Call initialize() first.'
        };
      }

      const result = await this.chatService.chat(message);
      
      return {
        success: true,
        response: result.message,
        sources: result.sources,
        confidence: result.confidence,
        model: result.model,
        responseTime: result.responseTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Search database for similar documents
  async searchDatabase(query: string, limit: number = 5): Promise<{
    success: boolean;
    results?: any[];
    error?: string;
  }> {
    try {
      if (!this.chatService) {
        return {
          success: false,
          error: 'Chat service not initialized. Call initialize() first.'
        };
      }

      // Generate embedding for search using the embeddings service
      const embeddingsService = new EmbeddingsService('nomic-embed-text');
      const embedding = await embeddingsService.generateEmbedding(query);
      const results = this.searchRepo.searchSimilar(embedding, limit);
      
      return {
        success: true,
        results
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Add document to database
  async addDocument(title: string, content: string): Promise<{
    success: boolean;
    documentId?: number;
    error?: string;
  }> {
    try {
      if (!this.chatService) {
        return {
          success: false,
          error: 'Chat service not initialized. Call initialize() first.'
        };
      }

      // Generate embedding for the document (now handled internally by insertDocument)
      const documentId = await this.crudRepo.insertDocument(title, content);
      
      return {
        success: true,
        documentId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      const stats = this.crudRepo.getStats();
      return {
        success: true,
        stats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get conversation history
  getHistory(): any[] {
    if (!this.chatService) {
      return [];
    }
    return this.chatService.getHistory();
  }

  // Clear conversation history
  clearHistory(): boolean {
    if (!this.chatService) {
      return false;
    }
    this.chatService.clearHistory();
    return true;
  }

  // Check if service is ready
  isReady(): boolean {
    return !!this.chatService;
  }

  // Get all available categories
  async getCategories(): Promise<{
    success: boolean;
    categories?: string[];
    error?: string;
  }> {
    try {
      const categories = this.crudRepo.getAllCategories();
      return {
        success: true,
        categories
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get all available tags
  async getTags(): Promise<{
    success: boolean;
    tags?: string[];
    error?: string;
  }> {
    try {
      const tags = this.crudRepo.getAllTags();
      return {
        success: true,
        tags
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get documents by category
  async getDocumentsByCategory(category: string): Promise<{
    success: boolean;
    documents?: any[];
    error?: string;
  }> {
    try {
      const documents = this.crudRepo.getDocumentsByCategory(category);
      return {
        success: true,
        documents
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// ========================================
// USAGE EXAMPLE
// ========================================

export async function demonstrateOfflineLLMAPI(): Promise<void> {
  console.log('ðŸš€ Offline LLM API Demo\n');
  
  const api = new OfflineLLMAPI();
  
  try {
    // Initialize the API
    console.log('ðŸ”§ Initializing offline LLM API...');
    const initialized = await api.initialize();
    
    if (!initialized) {
      console.log('âŒ Failed to initialize. Please make sure Ollama is running.');
      return;
    }

    // Get database stats
    const statsResult = await api.getStats();
    if (statsResult.success) {
      console.log('ðŸ“Š Database stats:', statsResult.stats);
    }

    // Get all categories
    console.log('\nðŸ“‚ Available categories:');
    const categoriesResult = await api.getCategories();
    if (categoriesResult.success && categoriesResult.categories) {
      if (categoriesResult.categories.length > 0) {
        categoriesResult.categories.forEach((category, i) => {
          console.log(`   ${i + 1}. ${category}`);
        });
      } else {
        console.log('   No categories found');
      }
    } else {
      console.log('âŒ Categories error:', categoriesResult.error);
    }

    // Get all tags
    console.log('\nðŸ·ï¸  Available tags:');
    const tagsResult = await api.getTags();
    if (tagsResult.success && tagsResult.tags) {
      if (tagsResult.tags.length > 0) {
        console.log(`   ${tagsResult.tags.join(', ')}`);
      } else {
        console.log('   No tags found');
      }
    } else {
      console.log('âŒ Tags error:', tagsResult.error);
    }

    // Example chat
    console.log('\nðŸ’¬ Chat example:');
    const chatResult = await api.chat('What documents do you have about machine learning?');
    
    if (chatResult.success) {
      console.log('ðŸ¤– Response:', chatResult.response);
      console.log('ðŸ“š Sources:', chatResult.sources);
      console.log('ðŸŽ¯ Confidence:', chatResult.confidence);
      console.log('âš¡ Response time:', chatResult.responseTime + 'ms');
    } else {
      console.log('âŒ Chat error:', chatResult.error);
    }

    // Example search
    console.log('\nðŸ” Search example:');
    const searchResult = await api.searchDatabase('artificial intelligence', 3);
    
    if (searchResult.success) {
      console.log('ðŸ“„ Found', searchResult.results?.length, 'documents');
      searchResult.results?.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.title} (similarity: ${doc.similarity?.toFixed(3)})`);
      });
    } else {
      console.log('âŒ Search error:', searchResult.error);
    }

    // Example add document
    console.log('\nðŸ“ Adding document example:');
    const addResult = await api.addDocument(
      'API Documentation', 
      'This is documentation for the Offline LLM API, showing how to use it for chat and search.'
    );
    
    if (addResult.success) {
      console.log('âœ… Document added with ID:', addResult.documentId);
    } else {
      console.log('âŒ Add document error:', addResult.error);
    }

  } catch (error) {
    console.error('âŒ Demo failed:', error);
  }
}

// Run demo if executed directly
if (require.main === module) {
  demonstrateOfflineLLMAPI().catch(console.error);
}
