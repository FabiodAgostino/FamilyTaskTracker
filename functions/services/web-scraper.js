/**
 * Web Scraper - Classe principale per scraping
 */

const axios = require('axios');
const { HeadersManager } = require('./headers-manager');
const { ContentExtractor } = require('./content-extractor');
const { PriceDetectorService } = require('./price-detector-service');

class WebScraper {
  constructor(options = {}) {
    this.sessionCount = 0;
    this.useRealHeaders = options.useRealHeaders !== false; // Default true
    this.enableDelays = options.enableDelays !== false;     // Default true
    this.maxRetries = options.maxRetries || 1;              // Default 1 tentativo
    this.priceDetector = new PriceDetectorService();
  }

  /**
   * Scraping con un solo tentativo ottimizzato
   */
  async scrapeSingleAttempt(url, referer = null) {
    try {
      console.log(`🔄 Single attempt scraping: ${url}`);
      
      // Delay umano se abilitato
      if (this.enableDelays) {
        const delay = HeadersManager.getHumanDelay();
        console.log(`⏱️ Waiting ${Math.round(delay/1000)}s (human-like delay)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
       url = HeadersManager.preprocessEURParams(url);
      // Ottieni header ottimali
      const headers = HeadersManager.getOptimalHeaders(url, referer, this.useRealHeaders);
      
      // Log header per debug
      if (process.env.NODE_ENV !== 'production') {
        HeadersManager.logHeaders(headers, url);
      }

      const response = await axios.get(url, {
        headers: headers,
        timeout: 25000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        },
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        decompress: true,
        // Opzioni aggiuntive per stabilità
        responseType: 'text',
        responseEncoding: 'utf8'
      });

      // Validazione risposta
      if (response.status === 200 && response.data && response.data.length > 100) {
        console.log(`✅ Scraping success! Content length: ${response.data.length}`);
        
        // Analisi tipo di pagina
        const isJSHeavy = ContentExtractor.detectJavaScriptHeavyPage(response.data);
        if (isJSHeavy) {
          console.log('⚠️ Detected JavaScript-heavy page - content might be incomplete');
        }
       
        // Pulizia HTML
        const cleanedHtml = ContentExtractor.cleanHtml(response.data);
        
        return {
          success: true,
          html: cleanedHtml,
          originalLength: response.data.length,
          cleanedLength: cleanedHtml.length,
          isJSHeavy: isJSHeavy,
          headers: response.headers,
          status: response.status,
          raw: response.data
        };
      }

      throw new Error(`Invalid response: status ${response.status}, length: ${response.data?.length || 0}`);
      
    } catch (error) {
      const status = error.response?.status;
      console.log(`❌ Scraping failed: ${status || 'Network'} - ${error.message}`);
      
      // Analisi errore specifico
      this.analyzeError(error, url);
      
      return {
        success: false,
        error: error.message,
        status: status,
        code: error.code,
        url: url
      };
    }
  }

  /**
   * Analizza il tipo di errore per debugging
   */
  analyzeError(error, url) {
    const status = error.response?.status;
    const hostname = new URL(url).hostname;
    
    if (status === 403) {
      console.log('🛡️ Likely blocked by anti-bot protection');
      console.log(`💡 Suggestion: Try different headers or add delays for ${hostname}`);
      
    } else if (status === 429) {
      console.log('🐌 Rate limited - too many requests');
      console.log(`💡 Suggestion: Increase delays between requests for ${hostname}`);
      
    } else if (status === 404) {
      console.log('📄 Page not found - URL might be incorrect');
      
    } else if (status === 503 || status === 502) {
      console.log('🔧 Server temporarily unavailable');
      
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.log('🌐 Network/timeout issue - server might be slow or blocking');
      
    } else if (error.code === 'ENOTFOUND') {
      console.log('🌍 DNS resolution failed - check URL');
      
    } else {
      console.log(`❓ Unknown error type: ${error.code || 'UNKNOWN'}`);
    }
  }

  /**
   * Scraping con navigazione realistica (opzionale)
   */
  async scrapeWithNavigation(url) {
    try {
      console.log('🚶‍♂️ Starting realistic navigation...');
      
      const navigationChain = HeadersManager.getNavigationChain(url);
      console.log(`📍 Navigation chain: ${navigationChain.length} steps`);
      
      let referer = null;
      
      // Simula navigazione attraverso la chain
      for (let i = 0; i < navigationChain.length - 1; i++) {
        const currentUrl = navigationChain[i];
        const nextUrl = navigationChain[i + 1];
        
        console.log(`🔗 Step ${i + 1}: ${new URL(currentUrl).hostname}`);
        
        if (this.enableDelays && i > 0) {
          const delay = HeadersManager.getHumanDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        referer = currentUrl;
      }
      
      // Scraping finale con referer della navigazione
      return await this.scrapeSingleAttempt(url, referer);
      
    } catch (error) {
      console.log('❌ Navigation failed, falling back to direct scraping');
      return await this.scrapeSingleAttempt(url);
    }
  }

 logLargeContent(raw, chunkSize = 200000) {
   let content = raw
        // Rimuovi JavaScript (sicuramente non contiene prezzi visibili)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
        
        // Rimuovi CSS (sicuramente non contiene prezzi visibili)  
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '[STYLE_REMOVED]')
        
        // Rimuovi commenti HTML
        .replace(/<!--[\s\S]*?-->/g, '[COMMENT_REMOVED]')
        
        // Rimuovi link tag (CSS external)
        .replace(/<link\b[^>]*>/gi, '[LINK_REMOVED]')
        
        // Rimuovi meta tag non essenziali (mantieni solo description e title-related)
        .replace(/<meta\b(?![^>]*(?:name="description"|property="og:|name="title"))[^>]*>/gi, '[META_REMOVED]')
        
        // Rimuovi SVG nascosti (spesso sono solo icone)
        .replace(/<svg[^>]*class="[^"]*hidden[^"]*"[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '[HIDDEN_SVG_REMOVED]')
        .replace(/<svg[^>]*style="[^"]*display:\s*none[^"]*"[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '[HIDDEN_SVG_REMOVED]')
        
        // Collassa spazi multipli e normalizza
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s\s+/g, ' ')
        .trim();
    if (content.length <= chunkSize) {
        console.log(content);
        return;
    }
    
    const chunks = Math.ceil(content.length / chunkSize);
    console.log(`📄 Documento diviso in ${chunks} parti (${content.length} chars totali)`);
    
    for (let i = 0; i < content.length; i += chunkSize) {
        const chunkNum = Math.floor(i / chunkSize) + 1;
        const chunk = content.substring(i, i + chunkSize);
        console.log(`[PARTE ${chunkNum}/${chunks}]`, chunk);
    }
}

  /**
   * Estrae contenuto completo da HTML
   */
  async extractContent(html, url,raw) {
    try {
      // Estrazione testo completo
      const allText = ContentExtractor.extractAllText(html);
     if(raw) {
      console.warn("RAW AVAILABLE!");
      // this.logLargeContent(raw);
    }
      const detectedPrices = await this.priceDetector.detectMultiplePrices(
                    raw, // ← USA .text come nel vecchio codice
                    undefined
                );
      return {
        text: allText,
        detectedPrices: detectedPrices,
        length: allText.length
      };
      
    } catch (error) {
      console.error('❌ Errore estrazione contenuto:', error.message);
      return {
        text: html.substring(0, 20000), // Fallback: primi 10k caratteri
        detectedPrices: [],
        length: html.length,
        error: error.message
      };
    }
  }

  /**
   * Pipeline completa di scraping
   */
  async scrapeComplete(url, options = {}) {
    const useNavigation = options.useNavigation || false;
    const fallbackToAggressive = options.fallbackToAggressive !== false;
    
    console.log(`🚀 Starting complete scraping pipeline for: ${url}`);
    
    // Step 1: Scraping
    const scrapingResult = useNavigation ? 
      await this.scrapeWithNavigation(url) : 
      await this.scrapeSingleAttempt(url);
    
    if (!scrapingResult.success) {
      return {
        success: false,
        step: 'scraping',
        error: scrapingResult.error,
        url: url
      };
    }
    
    // Step 2: Estrazione contenuto
    const content = await this.extractContent(scrapingResult.html, url, scrapingResult.raw);
    
    // Step 3: Preparazione risultato
    const result = {
      success: true,
      url: url,
      content: {
        text: content.text,
        detectedPrices: content.detectedPrices,
        length: content.length
      },
      metadata: {
        originalLength: scrapingResult.originalLength,
        cleanedLength: scrapingResult.cleanedLength,
        isJSHeavy: scrapingResult.isJSHeavy,
        contentType: scrapingResult.headers?.['content-type'],
        useNavigation: useNavigation,
        timestamp: new Date().toISOString()
      }
    };
    
    // Step 4: Fallback aggressivo se richiesto
    if (fallbackToAggressive && content.aggressivePrice) {
      result.aggressivePrice = content.aggressivePrice;
      console.log(`💰 Aggressive price extraction found: ${content.aggressivePrice}`);
    }
    
    console.log(`✅ Complete scraping pipeline finished successfully`);
    
    return result;
  }

  /**
   * Statistiche della sessione
   */
  getSessionStats() {
    return {
      sessionCount: this.sessionCount,
      useRealHeaders: this.useRealHeaders,
      enableDelays: this.enableDelays,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Reset configurazione
   */
  configure(options) {
    if (typeof options.useRealHeaders === 'boolean') {
      this.useRealHeaders = options.useRealHeaders;
    }
    if (typeof options.enableDelays === 'boolean') {
      this.enableDelays = options.enableDelays;
    }
    if (typeof options.maxRetries === 'number') {
      this.maxRetries = options.maxRetries;
    }
    
    console.log('⚙️ Scraper reconfigured:', this.getSessionStats());
  }
}

module.exports = {
  WebScraper
};