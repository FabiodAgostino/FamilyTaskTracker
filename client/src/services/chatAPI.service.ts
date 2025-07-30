// src/components/chat/services/chatAPI.service.ts

import { Message } from "@/lib/models/chat.types";


// Interfaccia per i messaggi OpenAI
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Interfaccia per la risposta di OpenAI
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Configurazione del servizio
interface ChatServiceConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export class ChatAPIService {
  private readonly apiEndpoint = 'https://api.openai.com/v1/chat/completions';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private systemPrompt: string;
  
  // Cronologia dei messaggi per il context window
  private openAIHistory: OpenAIMessage[] = [];
  
  constructor(config: ChatServiceConfig = {}, username:string) {
    // Configurazione sicura della chiave API
    this.apiKey = config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    this.model = config.model || 'gpt-4.1-nano';
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.7;
    this.systemPrompt = config.systemPrompt || 'Sei un assistente AI utile, ti chiami Garibaldi, amichevole, familiare e usi le emoji e ogni tanto (una volta su 3 circa) mi chiami per nome: '+username;
    
    if (!this.apiKey) {
      console.error('⚠️ ATTENZIONE: Chiave API OpenAI mancante!');
      console.log('📝 Configura OPENAI_API_KEY nelle variabili d\'ambiente');
    }

    // Inizializza con il prompt di sistema
    this.initializeSystemPrompt();
  }

  /**
   * 🚀 METODO PRINCIPALE: Invia messaggio e riceve risposta
   */
  async sendMessage(message: Message): Promise<Message> {
    this.validateApiKey();
    
    try {
      // Aggiungi il messaggio dell'utente al context
      this.addUserMessageToContext(message);
      console.log(`🧠 Context: ${this.openAIHistory.length} messaggi, ~${this.estimateTokens()} token`);
      console.log(this.openAIHistory)
      // Chiamata all'API OpenAI
      const response = await this.callOpenAI();
      console.log(response)
      const aiResponseText = this.extractResponseText(response);
      
      // Crea il messaggio di risposta dell'AI
      const aiMessage: Message = {
        id: this.generateId(),
        text: aiResponseText,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };
      
      // Aggiungi la risposta dell'AI al context
      this.addAssistantMessageToContext(aiMessage);
      
      return aiMessage;
      
    } catch (error) {
      console.error('❌ Errore nell\'invio del messaggio:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 🔧 UTILITY: Ottieni statistiche del context
   */
  getContextStats(): {
    messageCount: number;
    estimatedTokens: number;
    maxTokens: number;
    utilization: string;
  } {
    const tokens = this.estimateTokens();
    const maxContextTokens = 1_000_000; // 1M token per GPT-4.1 nano
    
    return {
      messageCount: this.openAIHistory.length,
      estimatedTokens: tokens,
      maxTokens: maxContextTokens,
      utilization: `${((tokens / maxContextTokens) * 100).toFixed(2)}%`
    };
  }

  /**
   * 🔧 UTILITY: Pulisci il context (mantieni solo sistema)
   */
  clearContext(): void {
    this.openAIHistory = this.openAIHistory.slice(0, 1); // Mantieni solo il sistema
  }

  /**
   * 🔧 UTILITY: Cambia il prompt di sistema
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    this.openAIHistory[0] = {
      role: 'system',
      content: prompt
    };
    console.log('⚙️ Prompt di sistema aggiornato');
  }

  /**
   * 🔧 UTILITY: Ottieni la cronologia in formato Message[]
   */
  getConversationHistory(): Message[] {
    const messages: Message[] = [];
    
    // Salta il primo messaggio (sistema) e processa il resto
    for (let i = 1; i < this.openAIHistory.length; i++) {
      const msg = this.openAIHistory[i];
      
      // Salta i messaggi di conferma automatici
      if (msg.content.startsWith('✅')) continue;
      
      messages.push({
        id: this.generateId(),
        text: msg.content,
        isUser: msg.role === 'user',
        timestamp: new Date(),
        isVoice: false
      });
    }
    
    return messages;
  }

  // ==================== METODI PRIVATI ====================

  private initializeSystemPrompt(): void {
    this.openAIHistory = [{
      role: 'system',
      content: this.systemPrompt
    }];
  }

  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error('🔑 Chiave API OpenAI non configurata. Imposta OPENAI_API_KEY nelle variabili d\'ambiente.');
    }
  }

  private addUserMessageToContext(message: Message): void {
    this.openAIHistory.push({
      role: 'user',
      content: message.text
    });
  }

  private addAssistantMessageToContext(message: Message): void {
    this.openAIHistory.push({
      role: 'assistant',
      content: message.text
    });
  }

  private async callOpenAI(): Promise<OpenAIResponse> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.openAIHistory, // 🎯 CONTEXT COMPLETO - fino a 1M token!
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  private extractResponseText(response: OpenAIResponse): string {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Nessuna risposta ricevuta da OpenAI');
    }
    return response.choices[0].message.content.trim();
  }

  private handleApiError(error: any): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('401')) {
        return new Error('🔑 Chiave API non valida. Verifica la tua chiave OpenAI.');
      } else if (message.includes('429')) {
        return new Error('⏱️ Limite di rate raggiunto. Riprova tra qualche momento.');
      } else if (message.includes('insufficient_quota')) {
        return new Error('💳 Quota API esaurita. Verifica il tuo account OpenAI.');
      } else if (message.includes('context_length_exceeded')) {
        return new Error('📏 Context troppo lungo. Pulisci la cronologia con clearContext().');
      }
    }
    
    return new Error(`❌ Errore del servizio chat: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
  }


  private estimateTokens(): number {
    const allText = this.openAIHistory
      .map(msg => msg.content)
      .join(' ');
    
    // Stima: ~4 caratteri per token (approssimazione per testi misti)
    return Math.ceil(allText.length / 4);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 🏭 Factory per creare istanze del servizio con configurazioni diverse
 */
export const createChatService = (username:string, config?: ChatServiceConfig): ChatAPIService => {
  return new ChatAPIService(config, username);
};


