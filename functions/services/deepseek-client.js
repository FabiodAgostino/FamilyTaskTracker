/**
 * DeepSeek API Client - Ottimizzato per Context Caching
 * 
 * Questa versione sfrutta il context caching automatico di DeepSeek per:
 * - Ridurre drasticamente i costi (fino al 90% di risparmio)
 * - Mantenere il contesto della conversazione senza riinviare il prompt completo
 * - Ridurre la latenza delle risposte successive
 */

const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

class DeepSeekClient {
  // Cache statica per mantenere le conversazioni attive
  static conversationCache = new Map();
  static SYSTEM_PROMPT = `Sei un estrattore JSON esperto. Il tuo compito è analizzare contenuti HTML di pagine prodotto e restituire solo JSON valido senza commenti, markdown o testo aggiuntivo.

Per ogni pagina prodotto, estrai queste informazioni in formato JSON:
- name (string): il nome/titolo del prodotto (NON informazioni di spedizione, policy o brand)
- brandName (string): il nome del brand con iniziali maiuscole
- estimatedPrice (string): il prezzo PRINCIPALE del prodotto (ignora costi di spedizione, soglie gratuite, etc.)
- site (string): il nome del sito web (es: "Amazon", "eBay", "AliExpress")
- url (string): l'URL completo della pagina
- imageUrl (string): URL dell'immagine principale del prodotto (solo se presente e valido)
- category (string): categoria del prodotto (es: "Elettronica", "Casa", "Abbigliamento")

Regole importanti:
1. Restituisci SOLO JSON valido, niente altro
2. Se un campo non è disponibile, usa stringa vuota "" o null
3. Per il prezzo, cerca il valore più prominente/principale
4. Ignora prezzi di spedizione, offerte multiple, sconti
5. Il nome deve essere il titolo principale del prodotto, non descrizioni tecniche lunghe`;

  /**
   * Recupera API key da Secret Manager o da variabile d'ambiente diretta
   */
  static async getApiKeyFromSecret() {
    try {
      const apiKeyVar = process.env.DEEPSEEK_API_KEY;
      
      // Se la variabile inizia con "sk-", è già l'API key diretta
      if (apiKeyVar && apiKeyVar.startsWith('sk-')) {
        console.log('🔑 Usando API key diretta da variabile');
        console.log(`✅ API key trovata (lunghezza: ${apiKeyVar.length})`);
        console.log(`🔍 Primi caratteri: ${apiKeyVar.substring(0, 10)}...`);
        return apiKeyVar;
      }
      
      // Altrimenti, usa Secret Manager
      console.log('🔑 Recuperando API key da Secret Manager...');
      const [version] = await client.accessSecretVersion({ name: apiKeyVar });
      const payload = version.payload.data.toString('utf8');
      
      const cleanKey = payload
        .trim()                    
        .replace(/\s+/g, '')       
        .replace(/[\r\n\t]/g, ''); 
      
      console.log(`✅ API key recuperata (lunghezza: ${cleanKey.length})`);
      console.log(`🔍 Primi caratteri: ${cleanKey.substring(0, 10)}...`);
      
      return cleanKey;
      
    } catch (error) {
      console.error('❌ Errore nel recupero API key:', error.message);
      throw new Error(`Impossibile recuperare API key: ${error.message}`);
    }
  }

  /**
   * Genera un ID univoco per la sessione di conversazione
   * Questo aiuta a mantenere separate le diverse sessioni di scraping
   */
  static generateConversationId(originalUrl = null) {
    const timestamp = Date.now();
    const urlHash = originalUrl ? 
      originalUrl.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : 
      'generic';
    return `conv_${urlHash}_${timestamp}`;
  }

  /**
   * Inizializza una nuova conversazione con il system prompt
   * Questa funzione viene chiamata solo una volta per sessione
   */
  static async initializeConversation(conversationId, originalUrl = null) {
    console.log(`🚀 Inizializzando conversazione: ${conversationId}`);
    
    try {
      const apiKey = await this.getApiKeyFromSecret();
      
      const payload = {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: this.SYSTEM_PROMPT
          },
          { 
            role: 'user', 
            content: `Ciao! Sono pronto per analizzare contenuti HTML di pagine prodotto. Invia il primo HTML da analizzare.${originalUrl ? ` URL di riferimento: ${originalUrl}` : ''}`
          }
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 500  // Risposta breve per l'inizializzazione
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'User-Agent': 'DeepSeek-Client/2.0-ContextOptimized'
      };
      
      console.log(`🤖 Inizializzando sessione DeepSeek con context caching...`);
      
      const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
        headers: headers,
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      if (response.status !== 200) {
        console.error('❌ DeepSeek error durante inizializzazione:', response.data);
        throw new Error(`DeepSeek API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      // Salva la conversazione inizializzata nella cache
      const conversation = {
        id: conversationId,
        messages: payload.messages.concat([{
          role: 'assistant',
          content: response.data.choices[0].message.content
        }]),
        createdAt: new Date().toISOString(),
        originalUrl: originalUrl
      };

      this.conversationCache.set(conversationId, conversation);
      
      // Log delle metriche di caching
      const usage = response.data.usage;
      if (usage) {
        console.log(`📊 Token usage inizializzazione:
          - Input: ${usage.prompt_tokens}
          - Output: ${usage.completion_tokens}
          - Cache hits: ${usage.prompt_cache_hit_tokens || 0}
          - Cache miss: ${usage.prompt_cache_miss_tokens || 0}`);
      }

      console.log(`✅ Conversazione ${conversationId} inizializzata con successo`);
      return conversationId;
      
    } catch (error) {
      console.error(`❌ Errore inizializzazione conversazione: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analizza HTML utilizzando una conversazione esistente
   * Sfrutta il context caching per ridurre drasticamente i costi
   */
  static async analyzeHtmlWithContext(conversationId, htmlContent, originalUrl = null) {
    console.log(`🔍 Analizzando HTML con conversazione: ${conversationId}`);
    
    try {
      const conversation = this.conversationCache.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversazione ${conversationId} non trovata. Inizializza prima la conversazione.`);
      }

      const apiKey = await this.getApiKeyFromSecret();
      
      // Prepara il nuovo messaggio mantenendo tutto il contesto precedente
      const newUserMessage = {
        role: 'user',
        content: `Analizza questo contenuto HTML della pagina prodotto${originalUrl ? ` (URL: ${originalUrl})` : ''}:

${htmlContent.length > 1500 ? htmlContent.substring(0, 1500) + '\n\n[CONTENUTO TRONCATO - CONTINUA...]' : htmlContent}`
      };

      // Aggiungi il nuovo messaggio alla conversazione esistente
      const updatedMessages = [...conversation.messages, newUserMessage];

      const payload = {
        model: 'deepseek-chat',
        messages: updatedMessages,
        stream: false,
        temperature: 0.1,
        max_tokens: 1000
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'User-Agent': 'DeepSeek-Client/2.0-ContextOptimized'
      };
      
      console.log(`🤖 Chiamando DeepSeek con context caching (messaggio ${updatedMessages.length})...`);
      
      const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
        headers: headers,
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      if (response.status !== 200) {
        console.error('❌ DeepSeek error response:', response.data);
        throw new Error(`DeepSeek API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      const assistantMessage = response.data.choices[0].message.content;
      
      // Aggiorna la conversazione in cache
      conversation.messages.push(newUserMessage);
      conversation.messages.push({
        role: 'assistant',
        content: assistantMessage
      });
      conversation.lastUsed = new Date().toISOString();

      // Log delle metriche di caching - qui vedremo i benefici!
      const usage = response.data.usage;
      if (usage) {
        const cacheHitRate = usage.prompt_cache_hit_tokens / (usage.prompt_cache_hit_tokens + usage.prompt_cache_miss_tokens) * 100;
        console.log(`📊 Context Caching Metrics:
          - Total input tokens: ${usage.prompt_tokens}
          - Cache HIT tokens: ${usage.prompt_cache_hit_tokens || 0} (💰 $0.014/1M)
          - Cache MISS tokens: ${usage.prompt_cache_miss_tokens || 0} (💸 $0.14/1M)
          - Cache hit rate: ${cacheHitRate.toFixed(1)}%
          - Output tokens: ${usage.completion_tokens}
          - 💰 Estimated savings vs no cache: ${((usage.prompt_cache_hit_tokens || 0) * 0.126 / 1000000).toFixed(4)}$`);
      }

      console.log('✅ Analisi HTML completata');
      console.log(`📝 Response preview: ${assistantMessage.substring(0, 100)}...`);
      
      // Pulisci la risposta e parsifica JSON
      const cleanText = assistantMessage
        .replace(/```json|```/g, '')  
        .replace(/^[^{]*({.*})[^}]*$/s, '$1')  
        .trim();
      
      let parsedResult;
      try {
        parsedResult = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('❌ Errore parsing JSON:', parseError.message);
        console.error('📝 Testo da parsare:', cleanText);
        throw new Error(`Impossibile parsare JSON: ${parseError.message}`);
      }
      console.log("ImageUrl:" + parsedResult.imageUrl);
      // Aggiungi metadati
      parsedResult.scraping = htmlContent.length > 1500 ? 
        htmlContent.substring(0, 1500) + '...' : htmlContent;
      parsedResult.mode = 'context_cached';
      parsedResult.conversationId = conversationId;
      parsedResult.cacheMetrics = usage ? {
        hitTokens: usage.prompt_cache_hit_tokens || 0,
        missTokens: usage.prompt_cache_miss_tokens || 0,
        hitRate: usage.prompt_cache_hit_tokens ? 
          (usage.prompt_cache_hit_tokens / (usage.prompt_cache_hit_tokens + usage.prompt_cache_miss_tokens) * 100).toFixed(1) + '%' : '0%'
      } : null;
      parsedResult.timestamp = new Date().toISOString();
      
      return parsedResult;
      
    } catch (error) {
      console.error('❌ Errore nell\'analisi HTML con context:', error.message);
      throw error;
    }
  }

  /**
   * Analizza HTML - Metodo principale che gestisce automaticamente le conversazioni
   * Se conversationId non è fornito, crea una nuova conversazione
   */
  static async analyzeHtml(htmlContent, originalUrl = null, conversationId = null) {
    try {
      // Se non abbiamo un conversationId, ne creiamo uno nuovo
      if (!conversationId) {
        conversationId = this.generateConversationId(originalUrl);
        await this.initializeConversation(conversationId, originalUrl);
      }

      // Usa la conversazione esistente per analizzare l'HTML
      return await this.analyzeHtmlWithContext(conversationId, htmlContent, originalUrl);
      
    } catch (error) {
      console.error('❌ Errore nell\'analisi HTML:', error.message);
      
      // Fallback al metodo legacy se il context caching fallisce
      return this.createFallbackResult(htmlContent, true, originalUrl, error.message);
    }
  }

  /**
   * Pulisce conversazioni vecchie per evitare accumulo di memoria
   * Mantiene solo le conversazioni degli ultimi 60 minuti
   */
  static cleanupOldConversations() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    for (const [id, conversation] of this.conversationCache.entries()) {
      const lastUsed = new Date(conversation.lastUsed || conversation.createdAt);
      if (lastUsed < oneHourAgo) {
        console.log(`🧹 Rimuovendo conversazione scaduta: ${id}`);
        this.conversationCache.delete(id);
      }
    }
  }

  /**
   * Ottieni statistiche sulla cache delle conversazioni
   */
  static getCacheStats() {
    this.cleanupOldConversations(); // Pulisci prima di ottenere le stats
    
    return {
      activeConversations: this.conversationCache.size,
      conversations: Array.from(this.conversationCache.entries()).map(([id, conv]) => ({
        id: id,
        messageCount: conv.messages.length,
        createdAt: conv.createdAt,
        lastUsed: conv.lastUsed || conv.createdAt,
        originalUrl: conv.originalUrl
      }))
    };
  }

  /**
   * Metodo legacy per compatibilità - NON usa context caching
   * Deprecato: usa analyzeHtml invece
   */
  static async callDeepSeek(data, isHtml = true, originalUrl = null) {
    console.log('⚠️  Usando metodo legacy callDeepSeek - considera di usare analyzeHtml per benefici del context caching');
    
    try {
      const apiKey = await this.getApiKeyFromSecret();
      
      const prompt = isHtml ? 
        `${this.SYSTEM_PROMPT}\n\nAnalizza questo contenuto HTML della pagina prodotto:\n\n${data}` :
        `${this.SYSTEM_PROMPT}\n\nAnalizza questa URL di prodotto: ${data}`;

      const payload = {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 1000
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'User-Agent': 'DeepSeek-Client/1.0-Legacy'
      };
      
      console.log(`🤖 Chiamando DeepSeek API (modalità legacy: ${isHtml ? 'HTML' : 'URL'})...`);
      
      const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
        headers: headers,
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      if (response.status !== 200) {
        console.error('❌ DeepSeek error response:', response.data);
        throw new Error(`DeepSeek API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      const text = response.data.choices[0].message.content;
      console.log('✅ DeepSeek response ricevuta (legacy)');
      
      const cleanText = text
        .replace(/```json|```/g, '')
        .replace(/^[^{]*({.*})[^}]*$/s, '$1')
        .trim();
      
      let parsedResult = JSON.parse(cleanText);
      
      parsedResult.scraping = isHtml ? 
        (data.length > 1000 ? data.substring(0, 1000) + '...' : data) : 
        `URL fallback: ${data}`;
      parsedResult.mode = isHtml ? 'html_legacy' : 'url_legacy';
      parsedResult.timestamp = new Date().toISOString();
      
      return parsedResult;
      
    } catch (error) {
      console.error('❌ Errore DeepSeek legacy:', error.message);
      return this.createFallbackResult(data, isHtml, originalUrl, error.message);
    }
  }

  /**
   * Crea risultato di fallback in caso di errore
   */
  static createFallbackResult(data, isHtml = true, originalUrl = null, errorMessage = '') {
    console.log('🔄 Creando risultato di fallback...');
    
    try {
      // Tentativi di estrazione manuale
      let name = 'Prodotto non identificato';
      let price = null;
      let brand = '';
      
      if (isHtml && typeof data === 'string') {
        // Estrazione nome basilare
        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                          data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (titleMatch) {
          name = titleMatch[1].trim().substring(0, 100);
        }
        
        // Estrazione prezzo basilare
        const priceRegex = /[\$€£¥]?[\d,]+\.?\d*|\d+[,.]?\d*\s*[\$€£¥]/g;
        const priceMatches = data.match(priceRegex);
        if (priceMatches && priceMatches.length > 0) {
          price = priceMatches[0];
        }
        
        return {
          name: name,
          brandName: brand,
          estimatedPrice: price,
          site: originalUrl ? new URL(originalUrl).hostname : 'N/A',
          url: originalUrl || 'N/A',
          imageUrl: '',
          category: 'N/A',
          error: `Fallback utilizzato: ${errorMessage}`,
          scraping: data.length > 1500 ? data.substring(0, 1500) + '...' : data,
          mode: 'manual_fallback',
          timestamp: new Date().toISOString()
        };
      }
      
    } catch (fallbackErr) {
      console.error('❌ Anche il fallback manuale è fallito:', fallbackErr.message);
    }
    
    // Fallback finale
    return {
      name: 'Errore parsing',
      brandName: '',
      estimatedPrice: null,
      site: 'N/A',
      url: originalUrl || 'N/A',
      imageUrl: '',
      category: 'N/A',
      error: `Errore completo: ${errorMessage}`,
      scraping: data || 'N/A',
      mode: 'error',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Retry logica con supporto context caching
   */
  static async callDeepSeekWithRetry(data, isHtml = true, originalUrl = null, maxRetries = 2, conversationId = null) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 DeepSeek attempt ${attempt}/${maxRetries}`);
        
        // Usa il nuovo metodo con context caching se disponibile
        if (isHtml) {
          const result = await this.analyzeHtml(data, originalUrl, conversationId);
          
          if (!result.error) {
            return result;
          }
          
          if (attempt === maxRetries) {
            return result;
          }
        } else {
          // Per URL, usa ancora il metodo legacy
          const result = await this.callDeepSeek(data, isHtml, originalUrl);
          
          if (!result.error) {
            return result;
          }
          
          if (attempt === maxRetries) {
            return result;
          }
        }
        
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          return this.createFallbackResult(data, isHtml, originalUrl, error.message);
        }
        
        // Delay prima del retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

// Cleanup automatico ogni 30 minuti
setInterval(() => {
  DeepSeekClient.cleanupOldConversations();
}, 30 * 60 * 1000);

module.exports = {
  DeepSeekClient
};