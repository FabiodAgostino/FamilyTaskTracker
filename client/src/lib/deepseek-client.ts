// ==============================================================================
// DEEPSEEK CLIENT FRONTEND - Categorizzazione Prodotti
// ==============================================================================

interface ProductItem {
  text: string;
  category?: string;
}

interface CategoryInfo {
  name: string;
  description: string;
}

interface CategorizationResult {
  productText: string;
  suggestedCategory: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekCategorizationClient {
  private static readonly API_ENDPOINT = 'https://api.deepseek.com/chat/completions';
  private static readonly MODEL = 'deepseek-chat';
  private static readonly TIMEOUT = 30000; // 30 secondi

  /**
   * Categorizza automaticamente una lista di prodotti usando DeepSeek Reasoner
   */
  static async categorizeProducts(
    items: ProductItem[], 
    categories: CategoryInfo[]
  ): Promise<CategorizationResult[]> {
            
    try {
      // Validazione input
      this.validateInput(items, categories);

      // Filtra solo prodotti senza categoria valida
      const uncategorizedItems = items.filter(item => 
        !item.category || 
        item.category === 'Altro' || 
        item.category.trim() === ''
      );

      if (uncategorizedItems.length === 0) {
                return [];
      }

      
      // Crea il prompt per DeepSeek
      const prompt = this.createCategorizationPrompt(uncategorizedItems, categories);
      
      // Chiama DeepSeek API
      const response = await this.callDeepSeekAPI(prompt);
      // Parsa e valida la risposta
      const results = this.parseCategorizationResponse(response);
      
            return results;

    } catch (error) {
      console.error('❌ Errore durante categorizzazione AI:', error);
      throw this.createDetailedError(error);
    }
  }

  /**
   * Valida l'input prima di procedere
   */
  private static validateInput(items: ProductItem[], categories: CategoryInfo[]): void {
    if (!items || items.length === 0) {
      throw new Error('Lista prodotti vuota');
    }

    if (!categories || categories.length === 0) {
      throw new Error('Lista categorie vuota');
    }

    // Verifica API key
    const apiKey = import.meta.env.VITE_DEEPSEEK_KEY;
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('API key DeepSeek mancante o invalida');
    }

    // Verifica che i prodotti abbiano almeno il campo text
    const invalidItems = items.filter(item => !item.text || item.text.trim() === '');
    if (invalidItems.length > 0) {
      throw new Error(`${invalidItems.length} prodotti hanno testo vuoto`);
    }
  }

  /**
   * Crea il prompt ottimizzato per DeepSeek Reasoner
   */
  private static createCategorizationPrompt(
    items: ProductItem[], 
    categories: CategoryInfo[]
  ): string {
    const categoriesDescription = categories
      .map(cat => `- ${cat.name}: ${cat.description}`)
      .join('\n');

    const productsToAnalyze = items
      .map((item, index) => `${index + 1}. "${item.text}"`)
      .join('\n');

    return `Sei un esperto di categorizzazione prodotti per supermercati. Il tuo compito è assegnare la categoria più appropriata a ciascun prodotto.

CATEGORIE DISPONIBILI:
${categoriesDescription}

PRODOTTI DA CATEGORIZZARE:
${productsToAnalyze}

ISTRUZIONI:
1. Analizza attentamente ogni prodotto
2. Assegna la categoria più specifica e appropriata
3. Se un prodotto non si adatta a nessuna categoria specifica, usa "Altro"
4. Considera sinonimi, varianti e marchi comuni
5. Per prodotti ambigui, scegli la categoria più probabile

FORMATO RISPOSTA:
Rispondi SOLO con un array JSON valido, senza commenti o spiegazioni:
[
  {"productText": "nome esatto del prodotto", "suggestedCategory": "nome categoria"},
  {"productText": "altro prodotto", "suggestedCategory": "altra categoria"}
]

IMPORTANTE: 
- Usa ESATTAMENTE i nomi delle categorie fornite
- Usa ESATTAMENTE il testo dei prodotti come fornito
- Non aggiungere commenti o testo extra
- Il JSON deve essere valido e parsabile`;
  }

  /**
   * Effettua la chiamata all'API DeepSeek
   */
  private static async callDeepSeekAPI(prompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_DEEPSEEK_KEY;
    
    const payload = {
      model: this.MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Bassa temperatura per risultati più consistenti
      max_tokens: 2000,
      stream: false
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'FamilyTaskTracker-Categorization/1.0'
    };

        
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data: DeepSeekResponse = await response.json();
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Risposta DeepSeek vuota o malformata');
      }

            return content;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error === 'AbortError') {
        throw new Error('Timeout: DeepSeek non ha risposto entro 30 secondi');
      }
      
      throw error;
    }
  }

  /**
   * Parsa e valida la risposta JSON di DeepSeek
   */
  private static parseCategorizationResponse(response: string): CategorizationResult[] {
        
    try {
      // Pulisce la risposta da eventuali caratteri extra
      let cleanedResponse = response.trim();
      
      // Rimuove eventuali markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Trova il primo array JSON valido
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Nessun array JSON trovato nella risposta');
      }

      const jsonString = jsonMatch[0];
      const parsed: CategorizationResult[] = JSON.parse(jsonString);

      // Validazione struttura
      if (!Array.isArray(parsed)) {
        throw new Error('La risposta non è un array');
      }

      // Validazione elementi
      const validResults = parsed.filter(item => {
        const isValid = item && 
          typeof item.productText === 'string' && 
          typeof item.suggestedCategory === 'string' &&
          item.productText.trim() !== '' &&
          item.suggestedCategory.trim() !== '';
        
        if (!isValid) {
          console.warn('⚠️ Elemento invalido ignorato:', item);
        }
        
        return isValid;
      });

            return validResults;

    } catch (error) {
      console.error('❌ Errore parsing JSON:', error);
      console.error('📝 Risposta originale:', response.substring(0, 500) + '...');
      throw new Error(`Errore parsing risposta: ${error}`);
    }
  }

  /**
   * Crea un errore dettagliato con informazioni utili per il debug
   */
  private static createDetailedError(originalError: any): Error {
    let message = 'Errore categorizzazione AI';
    
    if (originalError.message) {
      message = originalError.message;
    }

    // Aggiungi contesto specifico per errori comuni
    if (message.includes('401') || message.includes('Unauthorized')) {
      message = 'API key DeepSeek invalida o scaduta';
    } else if (message.includes('429') || message.includes('rate limit')) {
      message = 'Limite di rate raggiunto. Riprova tra qualche minuto';
    } else if (message.includes('timeout') || message.includes('network')) {
      message = 'Errore di connessione. Verifica la tua connessione internet';
    } else if (message.includes('JSON') || message.includes('parse')) {
      message = 'DeepSeek ha restituito una risposta malformata. Riprova';
    }

    const detailedError = new Error(message);
    detailedError.name = 'DeepSeekCategorizationError';
    
    // Mantieni stack trace originale se disponibile
    if (originalError.stack) {
      detailedError.stack = originalError.stack;
    }

    return detailedError;
  }

  /**
   * Metodo di utilità per testare la connessione DeepSeek
   */
  static async testConnection(): Promise<boolean> {
    try {
      const testItems = [{ text: 'mela' }];
      const testCategories = [{ name: 'Ortofrutta', description: 'Frutta e verdura' }];
      
      await this.categorizeProducts(testItems, testCategories);
      return true;
    } catch (error) {
      console.error('❌ Test connessione DeepSeek fallito:', error);
      return false;
    }
  }

  /**
   * Ottieni informazioni sulla configurazione
   */
  static getConfig(): object {
    return {
      apiEndpoint: this.API_ENDPOINT,
      model: this.MODEL,
      timeout: this.TIMEOUT,
      hasApiKey: !!import.meta.env.VITE_DEEPSEEK_KEY,
      apiKeyValid: import.meta.env.VITE_DEEPSEEK_KEY?.startsWith('sk-') || false
    };
  }
}