// ========================================
// OFFLINE CHAT WITH OLLAMA - DEEPSEEK MODEL
// ========================================

import { Ollama } from 'ollama';
import { getOllama } from './ollama-singleton';
import * as readline from 'readline';

// ========================================
// CHAT INTERFACES
// ========================================

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

// ========================================
// OFFLINE CHAT SERVICE
// ========================================

export class OfflineChat {
  private ollama: Ollama;
  private chatModel: string;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;

  constructor(chatModel: string = 'deepseek-r1:32b', systemPrompt?: string) {
    this.ollama = getOllama();
    this.chatModel = chatModel;
    this.systemPrompt = systemPrompt || 
      `You are a helpful AI assistant. Provide clear, accurate, and concise responses.`;
  }

  // ========================================
  // CHAT WITH OLLAMA
  // ========================================

  async chat(userMessage: string, includeHistory: boolean = true): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Build messages for Ollama
      const messages: any[] = [
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

  // ========================================
  // SET SYSTEM PROMPT
  // ========================================

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    console.log('[INFO] System prompt updated');
  }
}

// ========================================
// INTERACTIVE CHAT LOOP
// ========================================

async function interactiveChatLoop(chatService: OfflineChat) {
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
    console.log('[INFO] Initializing Offline Chat with DeepSeek...');

    // Initialize chat service with deepseek-r1:32b
    const chatService = new OfflineChat('deepseek-r1:32b');

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
