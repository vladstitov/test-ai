// ========================================
// OFFLINE LLM CHAT SERVICE USING OLLAMA WITH QDRANT
// ========================================

import { Ollama } from 'ollama';
import { QdrantRepository } from './qdrant.repo';
import { EmbeddingsService } from './embeddings.service';
import { getOllama } from './ollama-singleton';
import { buildQueryFromNaturalLanguage, QueryParams } from './query-creator';
import * as readline from 'readline';

// ========================================
// CHAT INTERFACES
// ========================================

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

// ========================================
// OFFLINE CHAT SERVICE FOR QDRANT
// ========================================

export class OfflineChatApp {
  private ollama: Ollama;
  private qdrantRepo: QdrantRepository;
  private embeddings: EmbeddingsService;
  private chatModel: string;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;

  constructor(
    qdrantRepo: QdrantRepository,
    embeddings: EmbeddingsService,
    chatModel: string = 'gemma3:4b'
  ) {
    this.ollama = getOllama();
    this.qdrantRepo = qdrantRepo;
    this.embeddings = embeddings;
    this.chatModel = chatModel;
    this.systemPrompt = `You are a helpful investment fund analyst assistant. 
You have access to a database of investment funds with their properties including:
- Fund name and aliases
- Vintage year
- Strategy and geography
- Fund size and target size
- Status and industries

When answering questions:
1. Use the search results provided to give accurate information
2. Cite specific funds when relevant
3. Be concise and factual
4. If the information is not in the search results, say so
5. Focus on the fund properties available in the database
6. Use plain text format without markdown formatting (no asterisks, bullets, or special symbols)`;
  }

  // ========================================
  // SEARCH FUNDS IN QDRANT
  // ========================================

  async searchFunds(query: string, topK: number = 5): Promise<any[]> {
    try {
      const results = await this.qdrantRepo.searchSimilar(query, topK);
      console.log(`\n[SEARCH] Found ${results.length} relevant funds`);
      return results;
    } catch (error) {
      console.error('[ERROR] Search failed:', error);
      return [];
    }
  }

  // ========================================
  // GENERATE CONTEXT FROM SEARCH RESULTS
  // ========================================

  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return 'No relevant funds found in the database.';
    }

    let context = 'Relevant funds from database:\n\n';
    
    results.forEach((fund, idx) => {
      context += `${idx + 1}. ${fund.title || fund.name}\n`;
      if (fund.content) {
        context += `${fund.content}\n`;
      } else {
        if (fund.strategy) context += `   Strategy: ${fund.strategy}\n`;
        if (fund.geography) context += `   Geography: ${fund.geography}\n`;
        if (fund.vintage) context += `   Vintage: ${fund.vintage}\n`;
        if (fund.fundSize) context += `   Fund Size: ${fund.fundSize}\n`;
        if (fund.status) context += `   Status: ${fund.status}\n`;
        if (fund.industries?.length) context += `   Industries: ${fund.industries.join(', ')}\n`;
      }
      context += `   Relevance Score: ${(fund.distance * 100).toFixed(1)}%\n\n`;
    });

    return context;
  }

  // ========================================
  // CHAT WITH CONTEXT
  // ========================================

  async chat(userMessage: string, includeHistory: boolean = true, useAIQueryBuilder: boolean = false): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // 0. Use AI to parse query if enabled
      let aiQuery: QueryParams | null = null;
      if (useAIQueryBuilder) {
        aiQuery = await buildQueryFromNaturalLanguage(userMessage, this.chatModel);
      }

      // 1. Check if this is a duplicate detection query
      const isDuplicateQuery = /duplicate|same name|repeated|multiple funds with/i.test(userMessage);
      let statsInfo = '';
      
      if (isDuplicateQuery) {
        console.log('[INFO] Finding duplicate funds...');
        const duplicates = await this.qdrantRepo.findDuplicatesByField('name');
        if (duplicates.length > 0) {
          statsInfo += `\nFound ${duplicates.length} duplicate fund names:\n`;
          duplicates.forEach(dup => {
            statsInfo += `\n"${dup.value}" - ${dup.count} funds:\n`;
            dup.funds.forEach(fund => {
              statsInfo += `  - ${fund.title || fund.name}`;
              if (fund.vintage) statsInfo += ` (${fund.vintage})`;
              if (fund.geography) statsInfo += ` - ${fund.geography}`;
              statsInfo += `\n`;
            });
          });
          console.log(`[INFO] Found ${duplicates.length} duplicate names`);
        } else {
          statsInfo += '\nNo duplicate fund names found.\n';
          console.log('[INFO] No duplicates found');
        }
      }

      // 2. Check if this is a list query (use AI if enabled, otherwise regex)
      const isListQuery = aiQuery?.action === 'list' || /list all|show all|what are all|all available/i.test(userMessage);
      
      if (isListQuery) {
        const listField = aiQuery?.field || (
          /geograph/i.test(userMessage) ? 'geography' :
          /strateg/i.test(userMessage) ? 'strategy' :
          /industr/i.test(userMessage) ? 'industries' : null
        );
        
        if (listField === 'geography') {
          const geographies = await this.qdrantRepo.getDistinctValues('geography');
          statsInfo += `\nAll geographies in database (${geographies.length}):\n${geographies.join(', ')}\n`;
          console.log(`[INFO] Found ${geographies.length} unique geographies`);
        } else if (listField === 'strategy') {
          const strategies = await this.qdrantRepo.getDistinctValues('strategy');
          statsInfo += `\nAll strategies in database (${strategies.length}):\n${strategies.join(', ')}\n`;
          console.log(`[INFO] Found ${strategies.length} unique strategies`);
        } else if (listField === 'industries') {
          const industries = await this.qdrantRepo.getDistinctValues('industries');
          statsInfo += `\nAll industries in database:\n${industries.join(', ')}\n`;
          console.log(`[INFO] Found ${industries.length} unique industries`);
        }
      }
      
      // 3. Check if this is a count/stats query
      const isCountQuery = /how many|total|count|number of/i.test(userMessage);
      
      if (isCountQuery) {
        const stats = await this.qdrantRepo.getStats();
        statsInfo += `\nTotal funds in database: ${stats.documents}\n`;
        console.log(`[INFO] Total funds: ${stats.documents}`);
        
        // Check for specific geography/field filters
        const geographyMatch = userMessage.match(/in\s+(\w+(?:\s+\w+)*)/i);
        if (geographyMatch) {
          const geography = geographyMatch[1];
          const count = await this.qdrantRepo.countByField('geography', geography);
          statsInfo += `Funds in ${geography}: ${count}\n`;
          console.log(`[INFO] Funds in ${geography}: ${count}`);
        }
        
        const strategyMatch = userMessage.match(/(?:with|strategy)\s+(\w+(?:\s+\w+)*)/i);
        if (strategyMatch && !geographyMatch) {
          const strategy = strategyMatch[1];
          const count = await this.qdrantRepo.countByField('strategy', strategy);
          statsInfo += `Funds with ${strategy} strategy: ${count}\n`;
          console.log(`[INFO] Funds with ${strategy}: ${count}`);
        }
      }

      // 4. Search for relevant funds (skip if we already have all info from count/list/duplicate query)
      console.log(`\n[USER] ${userMessage}`);
      let searchResults: any[] = [];
      
      // Use AI query if available, otherwise use regex patterns
      let topK = 5;
      let sortByField: string | undefined;
      let filterField: string | undefined;
      let filterValue: string | undefined;
      
      if (aiQuery) {
        topK = aiQuery.limit || 5;
        sortByField = aiQuery.sortBy;
        filterField = aiQuery.field;
        filterValue = aiQuery.value;
      } else {
        // Fallback: regex-based parsing
        const needsMoreResults = /show|list|all|top \d+/i.test(userMessage);
        const topKMatch = userMessage.match(/top (\d+)/i);
        topK = topKMatch ? parseInt(topKMatch[1]) : (needsMoreResults ? 20 : 5);
        
        const sortByFundSize = /by fundsize|by fund size|largest|biggest/i.test(userMessage);
        if (sortByFundSize) sortByField = 'fundSize';
        
        const geographyMatch = userMessage.match(/in\s+(\w+(?:\s+\w+)*)/i);
        if (geographyMatch) {
          filterField = 'geography';
          filterValue = geographyMatch[1];
        }
      }
      
      if (!isCountQuery && !isDuplicateQuery || statsInfo === '') {
        if (sortByField) {
          console.log(`[INFO] Fetching top ${topK} funds by ${sortByField}${filterValue ? ` in ${filterValue}` : ''}`);
          searchResults = await this.qdrantRepo.getTopByField(sortByField, topK, filterField, filterValue);
        } else if (filterField && filterValue) {
          searchResults = await this.qdrantRepo.searchWithFilter(userMessage, topK, filterField, filterValue);
        } else {
          searchResults = await this.searchFunds(userMessage, topK);
        }
      }

      // 3. Build context from search results
      const context = statsInfo + (searchResults.length > 0 ? this.formatSearchResults(searchResults) : '');

      // 3. Build messages for Ollama
      const messages: any[] = [
        { role: 'system', content: this.systemPrompt }
      ];

      // Add conversation history if requested
      if (includeHistory) {
        this.conversationHistory.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Add context and user message
      messages.push({
        role: 'user',
        content: `Context from database:\n${context}\n\nUser question: ${userMessage}`
      });

      // 4. Get response from Ollama
      console.log(`[OLLAMA] Generating response with ${this.chatModel}...`);
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: messages,
        stream: false
      });

      const assistantMessage = response.message.content;

      // 5. Update conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        searchResults
      });

      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date()
      });

      const responseTime = Date.now() - startTime;

      // 6. Extract sources
      const sources = searchResults.map(r => r.title || r.name);

      console.log(`\n[ASSISTANT] ${assistantMessage}`);
      console.log(`\n[INFO] Response time: ${responseTime}ms`);

      return {
        message: assistantMessage,
        searchResults,
        sources,
        confidence: searchResults.length > 0 ? searchResults[0].distance : 0,
        model: this.chatModel,
        responseTime
      };

    } catch (error) {
      console.error('[ERROR] Chat failed:', error);
      throw error;
    }
  }

  // ========================================
  // RESET CONVERSATION
  // ========================================

  resetConversation(): void {
    this.conversationHistory = [];
    console.log('[INFO] Conversation history cleared');
  }

  // ========================================
  // GET CONVERSATION HISTORY
  // ========================================

  getHistory(): ChatMessage[] {
    return this.conversationHistory;
  }
}

// ========================================
// INTERACTIVE CHAT LOOP
// ========================================

async function interactiveChatLoop(chatService: OfflineChatApp) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let useAIQueryBuilder = false;
  
  console.log('\n========================================');
  console.log('OFFLINE FUND CHAT - QDRANT');
  console.log('========================================');
  console.log('Type your questions about investment funds.');
  console.log('Commands: /reset - clear history, /ai - toggle AI query builder, /exit - quit');
  console.log(`AI Query Builder: ${useAIQueryBuilder ? 'ENABLED' : 'DISABLED'}\n`);

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

      if (userInput === '/ai') {
        useAIQueryBuilder = !useAIQueryBuilder;
        console.log(`[INFO] AI Query Builder: ${useAIQueryBuilder ? 'ENABLED' : 'DISABLED'}`);
        askQuestion();
        return;
      }

      try {
        await chatService.chat(userInput, true, useAIQueryBuilder);
        console.log('\n');
        askQuestion();
      } catch (error) {
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
    console.log('[INFO] Initializing Offline Chat with Qdrant...');

    // Initialize embeddings service
    const embeddings = new EmbeddingsService();

    // Initialize Qdrant repository
    const qdrantRepo = new QdrantRepository('funds', embeddings, 768);
    await qdrantRepo.ensureCollection();

    // Get collection stats
    const stats = await qdrantRepo.getStats();
    console.log(`[INFO] Funds collection: ${stats.documents} documents`);

    if (stats.documents === 0) {
      console.warn('[WARN] No funds found in Qdrant. Run load:funds first!');
      process.exit(1);
    }

    // Initialize chat service
    const chatService = new OfflineChatApp(qdrantRepo, embeddings);

    // Start interactive chat
    await interactiveChatLoop(chatService);

  } catch (error) {
    console.error('[FATAL] Failed to start chat:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
