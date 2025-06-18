/**
 * DeepSeek API Client - Gestione chiamate a DeepSeek (VERSIONE CORRETTA)
 */

const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

class DeepSeekClient {

  /**
   * Recupera API key da Secret Manager o da variabile d'ambiente diretta
   */
  static async getApiKeyFromSecret() {
    try {
      const apiKeyVar = process.env.DEEPSEEK_API_KEY;
      
      // NUOVO: Se la variabile inizia con "sk-", è già l'API key diretta
      if (apiKeyVar && apiKeyVar.startsWith('sk-')) {
        console.log('🔑 Usando API key diretta da variabile');
        console.log(`✅ API key trovata (lunghezza: ${apiKeyVar.length})`);
        console.log(`🔍 Primi caratteri: ${apiKeyVar.substring(0, 10)}...`);
        return apiKeyVar;
      }
      
      // Altrimenti, usa Secret Manager come prima
      console.log('🔑 Recuperando API key da Secret Manager...');
      const [version] = await client.accessSecretVersion({ name: apiKeyVar });
      const payload = version.payload.data.toString('utf8');
      
      // CORREZIONE: Non rimuovere i trattini dall'API key!
      const cleanKey = payload
        .trim()                    // Rimuovi spazi iniziali/finali
        .replace(/\s+/g, '')       // Rimuovi tutti gli spazi
        .replace(/[\r\n\t]/g, ''); // Rimuovi solo newline e tab
      
      console.log(`✅ API key recuperata (lunghezza: ${cleanKey.length})`);
      console.log(`🔍 Primi caratteri: ${cleanKey.substring(0, 10)}...`);
      
      return cleanKey;
      
    } catch (error) {
      console.error('❌ Errore nel recupero API key:', error.message);
      throw new Error(`Impossibile recuperare API key: ${error.message}`);
    }
  }

  /**
   * Genera prompt per analisi HTML
   */
  static generateHtmlPrompt(data) {
    return `
Analizza il testo completo di una pagina prodotto e estrai le seguenti informazioni in formato JSON:

- nameProduct (string): il nome/titolo del prodotto (NON informazioni di spedizione o policy)
- nameBrand (string): il nome del brand con iniziali maiuscole
- price (string): il prezzo PRINCIPALE del prodotto (ignora costi di spedizione, soglie gratuite, etc.)
- site (string): il dominio del sito  
- imageUrl (string): URL di un'immagine del prodotto se presente
- category (string): categoria del prodotto

IMPORTANTE per il prezzo:
- Cerca il prezzo del PRODOTTO, non costi di spedizione
- Ignora frasi come "spedizione gratuita oltre X€", "reso gratuito oltre X€"
- Se ci sono più prezzi, scegli quello più prominente/principale
- Se c'è uno sconto, prendi il prezzo scontato
- Se non trovi prezzi, imposta come null

IMPORTANTE per le immagini:
- Cerca URL di immagini del prodotto principale
- Ignora loghi, icone, banner
- Preferisci immagini con alta risoluzione

Categorie standard: Vestiti, Accessori, Beauty, Articoli, Cibo, Arredi

TESTO PAGINA:
${data}`;
  }

  /**
   * Genera prompt per analisi URL
   */
  static generateUrlPrompt(url) {
    return `
Analizza questo URL di un prodotto e crea un JSON con le seguenti informazioni deducendole dall'URL stesso:

- nameProduct (string): ricava il nome del prodotto dall'URL (Senza nome brand), rimuovendo caratteri speciali e codici
- nameBrand (string): Il nome del brand con iniziali maiuscole (se riconoscibile dall'URL)
- price (string): null (non disponibile dall'URL)
- site (string): il dominio del sito
- imageUrl (string): "" (vuoto)
- category (string): dedici la categoria dal dominio o dal path dell'URL

Categorie standard: Vestiti, Accessori, Beauty, Articoli, Cibo, Arredi

Esempi di deduzione:
- Se riconosci il brand dall'URL assegnagli una categoria appropriata
- Se l'URL contiene brand di moda (nike, adidas, zara, etc.) → categoria "Vestiti" 
- Se l'URL contiene brand beauty (chanel, dior, etc.) → categoria "Beauty"
- Se l'URL contiene "home", "furniture" → categoria "Arredi"
- Se l'URL contiene "food", "eat" → categoria "Cibo"

URL: ${url}`;
  }

  /**
   * Chiamata principale a DeepSeek API
   */
  static async callDeepSeek(data, isHtml = true, originalUrl = null) {
    try {
      const apiKey = await this.getApiKeyFromSecret();
      
      // Validazione API key
      if (!apiKey || apiKey.length < 10) {
        throw new Error('API key non valida o troppo corta');
      }

      const prompt = isHtml ? 
        this.generateHtmlPrompt(data) : 
        this.generateUrlPrompt(data);

      const payload = {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'Sei un estrattore JSON esperto. Restituisci solo JSON valido senza commenti, markdown o testo aggiuntivo.' 
          },
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.1, // Bassa temperature per risultati più consistenti
        max_tokens: 1000  // Limite per evitare risposte troppo lunghe
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'User-Agent': 'DeepSeek-Client/1.0'
      };
      
      console.log(`🤖 Chiamando DeepSeek API (modalità: ${isHtml ? 'HTML' : 'URL'})...`);
      
      const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
        headers: headers,
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      console.log(`📡 DeepSeek status: ${response.status}`);
      
      if (response.status !== 200) {
        console.error('❌ DeepSeek error response:', response.data);
        throw new Error(`DeepSeek API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      const text = response.data.choices[0].message.content;
      console.log('✅ DeepSeek response ricevuta');
      console.log(`📝 Response preview: ${text.substring(0, 100)}...`);
      
      // Pulisci la risposta se contiene markdown o altri formati
      const cleanText = text
        .replace(/```json|```/g, '')  // Rimuovi markdown
        .replace(/^[^{]*({.*})[^}]*$/s, '$1')  // Estrai solo il JSON
        .trim();
      
      let parsedResult;
      try {
        parsedResult = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('❌ Errore parsing JSON:', parseError.message);
        console.error('📝 Testo da parsare:', cleanText);
        throw new Error(`Impossibile parsare JSON: ${parseError.message}`);
      }
      
      // Aggiungi metadati di debug
      parsedResult.scraping = isHtml ? 
        (data.length > 500 ? data.substring(0, 500) + '...' : data) : 
        `URL fallback: ${data}`;
      parsedResult.mode = isHtml ? 'html_analysis' : 'url_fallback';
      parsedResult.url = originalUrl;
      parsedResult.timestamp = new Date().toISOString();
      
      // Validazione campi obbligatori
      this.validateResult(parsedResult);
      
      console.log('✅ JSON parsed and validated successfully');
      
      return parsedResult;
      
    } catch (err) {
      console.error('❌ Errore DeepSeek completo:', err.message);
      return this.createFallbackResult(data, isHtml, originalUrl, err.message);
    }
  }

  /**
   * Valida il risultato di DeepSeek
   */
  static validateResult(result) {
    const requiredFields = ['nameProduct', 'nameBrand', 'price', 'site', 'imageUrl', 'category'];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        console.warn(`⚠️ Campo mancante: ${field}`);
        result[field] = this.getDefaultValue(field);
      }
    }
    
    // Validazioni specifiche
    if (!result.site || result.site === 'N/A') {
      if (result.url) {
        try {
          result.site = new URL(result.url).hostname;
        } catch {}
      }
    }
    
    // Normalizza brand
    if (result.nameBrand && typeof result.nameBrand === 'string') {
      result.nameBrand = result.nameBrand
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  /**
   * Restituisce valore di default per campo mancante
   */
  static getDefaultValue(field) {
    const defaults = {
      nameProduct: 'Prodotto sconosciuto',
      nameBrand: '',
      price: null,
      site: 'N/A',
      imageUrl: '',
      category: 'Articoli'
    };
    
    return defaults[field] || null;
  }

  /**
   * Crea risultato di fallback quando DeepSeek fallisce
   */
  static createFallbackResult(data, isHtml, originalUrl, errorMessage) {
    console.log('🔄 Creando risultato di fallback...');
    
    try {
      if (originalUrl) {
        const urlObj = new URL(originalUrl);
        
        return {
          nameProduct: urlObj.pathname.split('/').pop().replace(/[-_]/g, ' ') || 'Prodotto sconosciuto',
          nameBrand: '',
          price: null,
          site: urlObj.hostname,
          url: originalUrl,
          imageUrl: '',
          category: 'Articoli',
          error: `DeepSeek fallito: ${errorMessage}`,
          scraping: isHtml ? (data.length > 200 ? data.substring(0, 200) + '...' : data) : `URL fallback: ${data}`,
          mode: 'manual_fallback',
          timestamp: new Date().toISOString()
        };
      }
      
    } catch (fallbackErr) {
      console.error('❌ Anche il fallback manuale è fallito:', fallbackErr.message);
    }
    
    // Fallback finale
    return {
      nameProduct: 'Errore parsing',
      nameBrand: '',
      price: null,
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
   * Retry logica per DeepSeek
   */
  static async callDeepSeekWithRetry(data, isHtml = true, originalUrl = null, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 DeepSeek attempt ${attempt}/${maxRetries}`);
        
        const result = await this.callDeepSeek(data, isHtml, originalUrl);
        
        // Se non c'è errore, ritorna il risultato
        if (!result.error) {
          return result;
        }
        
        // Se c'è errore ma è l'ultimo tentativo, ritorna comunque
        if (attempt === maxRetries) {
          return result;
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

module.exports = {
  DeepSeekClient
};