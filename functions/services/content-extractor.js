/**
 * Content Extractor - Estrazione intelligente di contenuti e prezzi
 */

class ContentExtractor {

  /**
   * Rileva se una pagina è JavaScript-heavy
   */
  static detectJavaScriptHeavyPage(html) {
    const jsIndicators = [
      /__NEXT_DATA__/i,           // Next.js
      /window\.__INITIAL_STATE__/i, // Redux
      /window\.digitalData/i,      // Analytics
      /<div id="root"><\/div>/i,   // React
      /<div id="app"><\/div>/i,    // Vue
      /window\.asos/i,             // ASOS specific
      /data-reactroot/i,           // React
      /ng-app/i,                   // Angular
      /window\.zalando/i           // Zalando specific
    ];
    
    const scriptTags = (html.match(/<script/gi) || []).length;
    const hasJsIndicators = jsIndicators.some(pattern => pattern.test(html));
    
    // Se ci sono molti script tag O indicatori JS, probabilmente è JS-heavy
    return scriptTags > 10 || hasJsIndicators;
  }

  /**
   * Pulisce l'HTML rimuovendo elementi non necessari
   */
  static cleanHtml(html) {
    let cleanHtml = html;

    // Rimuovi elementi non necessari
    const elementsToRemove = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      /<link[^>]*>/gi,
      /<meta[^>]*>/gi,
      /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<!--[\s\S]*?-->/g
    ];

    elementsToRemove.forEach(regex => {
      cleanHtml = cleanHtml.replace(regex, '');
    });

    // Rimuovi header/footer/nav
    const structuralElements = [
      /<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi,
      /<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi,
      /<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi
    ];

    structuralElements.forEach(regex => {
      cleanHtml = cleanHtml.replace(regex, '');
    });

    return cleanHtml;
  }

  /**
   * Estrae tutto il testo visibile con ricerca prezzi nei JSON
   */
  static extractAllText(html) {
    console.log('📝 Estraendo tutto il testo dalla pagina...');
    
    // Prima controlla se ci sono indicatori di prezzi nascosti in JSON
    const jsonPriceData = this.extractPriceFromJSON(html);
    
    // Rimuovi solo script, style e commenti (mantieni tutto il resto)
    let textOnly = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')  // Rimuovi tutti i tag HTML
      .replace(/\s+/g, ' ')      // Normalizza spazi multipli
      .trim();
    
    // Se abbiamo trovato prezzi nei JSON, aggiungili al testo
    if (jsonPriceData) {
      textOnly = `PREZZI TROVATI NEI DATI JSON: ${jsonPriceData} | ` + textOnly;
      console.log(`💰 Prezzi estratti da JSON: ${jsonPriceData}`);
    }
    
    // Limita la lunghezza per evitare token limit (circa 15-20k caratteri)
    if (textOnly.length > 20000) {
      console.log(`⚠️ Testo troppo lungo (${textOnly.length} chars), troncando...`);
      textOnly = textOnly.substring(0, 20000) + '...';
    }
    
    console.log(`✅ Testo estratto: ${textOnly.length} caratteri`);
    console.log(`📋 Preview: ${textOnly.substring(0, 300)}...`);
    
    return textOnly;
  }

  /**
   * Estrai prezzi da dati JSON embedded (common in SPA)
   */
  static extractPriceFromJSON(html) {
    const prices = [];
    
    // Pattern per trovare JSON con prezzi
    const jsonPatterns = [
      /__NEXT_DATA__\s*=\s*({.*?})/s,
      /window\.__INITIAL_STATE__\s*=\s*({.*?})/s,
      /window\.digitalData\s*=\s*({.*?})/s,
      /window\.zalando\s*=\s*({.*?})/s,
      /"price":\s*{\s*"current":\s*{\s*"value":\s*([0-9.]+)/g,
      /"price":\s*"([^"]*\d+[.,]\d{2}[^"]*)"/g,
      /"currentPrice":\s*"([^"]*\d+[.,]\d{2}[^"]*)"/g,
      /"amount":\s*([0-9.]+)/g,
      /"finalPrice":\s*"([^"]*\d+[.,]\d{2}[^"]*)"/g,
      /"salePrice":\s*"([^"]*\d+[.,]\d{2}[^"]*)"/g
    ];
    
    jsonPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          // Se è un oggetto JSON completo, prova a parsarlo
          if (match[1].startsWith('{')) {
            try {
              const jsonObj = JSON.parse(match[1]);
              const foundPrices = this.searchPricesInObject(jsonObj);
              prices.push(...foundPrices);
            } catch (e) {
              // JSON invalido, ignora
            }
          } else {
            // È già un valore di prezzo
            prices.push(match[1]);
          }
        }
      }
    });
    
    // Cerca anche pattern di prezzo direttamente nel testo HTML
    const pricePatterns = [
      /data-price="([^"]*\d+[.,]\d{2}[^"]*)"/gi,
      /data-testid="[^"]*price[^"]*"[^>]*>([^<]*\d+[.,]\d{2}[^<]*)</gi,
      /class="[^"]*price[^"]*"[^>]*>([^<]*\d+[.,]\d{2}[^<]*)</gi,
      /price["\s]*:\s*["\s]*([^"]*\d+[.,]\d{2}[^"]*)/gi,
      /"current[Pp]rice"["\s]*:\s*["\s]*([^"]*\d+[.,]\d{2}[^"]*)/gi,
      /"finalPrice"["\s]*:\s*["\s]*([^"]*\d+[.,]\d{2}[^"]*)/gi
    ];
    
    pricePatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const priceMatch = match.match(/(\d+[.,]\d{2}.*?€|€.*?\d+[.,]\d{2}|\$\d+[.,]\d{2}|£\d+[.,]\d{2})/);
          if (priceMatch) {
            prices.push(priceMatch[1]);
          }
        });
      }
    });
    
    // Rimuovi duplicati e filtra prezzi validi
    const uniquePrices = [...new Set(prices)].filter(price => {
      if (!price || price.length === 0 || !/\d/.test(price)) return false;
      
      // Filtra prezzi troppo bassi (probabilmente non prodotti)
      const numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (numericPrice < 1 || numericPrice > 50000) return false;
      
      return true;
    });
    
    return uniquePrices.length > 0 ? uniquePrices.join(', ') : null;
  }

  /**
   * Cerca prezzi ricorsivamente in un oggetto JSON
   */
  static searchPricesInObject(obj, depth = 0) {
    if (depth > 5) return []; // Evita ricorsione infinita
    
    const prices = [];
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        // Chiavi che potrebbero contenere prezzi
        const priceKeys = /price|cost|amount|value|euro|dollar|pound|prezzo|costo|finale|sale/i;
        
        if (priceKeys.test(key)) {
          if (typeof value === 'string' && /\d+[.,]\d{2}/.test(value)) {
            prices.push(value);
          } else if (typeof value === 'number' && value > 1 && value < 50000) {
            // Aggiungi simbolo valuta se manca
            const priceString = value % 1 === 0 ? `${value},00 €` : `${value.toFixed(2).replace('.', ',')} €`;
            prices.push(priceString);
          }
        }
        
        // Ricorsione su oggetti annidati
        if (typeof value === 'object') {
          prices.push(...this.searchPricesInObject(value, depth + 1));
        }
      }
    }
    
    return prices;
  }

  /**
   * Estrazione aggressiva di prezzi come fallback
   */
  static extractPricesAggressively(html) {
    console.log('🔍 Estrazione aggressiva prezzi...');
    
    const prices = [];
    
    // Pattern super-aggressivi per prezzi
    const aggressivePatterns = [
      // Prezzi con Euro
      /\b(\d{1,4}[.,]\d{2}\s*€)/g,
      /(€\s*\d{1,4}[.,]?\d{0,2})/g,
      
      // Prezzi in attributi HTML
      /data-[^"]*price[^"]*="([^"]*\d+[.,]\d{2}[^"]*)"/gi,
      /price[^"]*="([^"]*\d+[.,]\d{2}[^"]*)"/gi,
      
      // Prezzi in classi CSS
      /class="[^"]*price[^"]*"[^>]*>([^<]*\d+[.,]\d{2}[^<]*)</gi,
      
      // Prezzi in JSON inline
      /"price"[^}]*(\d+[.,]\d{2})/gi,
      /"currentPrice"[^}]*(\d+[.,]\d{2})/gi,
      /"finalPrice"[^}]*(\d+[.,]\d{2})/gi,
      
      // Prezzi in testo semplice (con contesto)
      /prezzo[:\s]*(\d+[.,]\d{2}[^a-zA-Z]*€?)/gi,
      /costo[:\s]*(\d+[.,]\d{2}[^a-zA-Z]*€?)/gi
    ];
    
    aggressivePatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Estrai solo la parte numerica + valuta
          const priceMatch = match.match(/(\d+[.,]\d{2}.*?€|€.*?\d+[.,]\d{2})/);
          if (priceMatch) {
            prices.push(priceMatch[1].trim());
          }
        });
      }
    });
    
    // Filtra e deduplicala
    const validPrices = [...new Set(prices)].filter(price => {
      const numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
      return numericPrice >= 5 && numericPrice <= 10000; // Range realistico prodotti
    });
    
    console.log(`🔍 Trovati ${validPrices.length} prezzi: ${validPrices.join(', ')}`);
    
    return validPrices.length > 0 ? validPrices[0] : null; // Restituisci il primo
  }

  /**
   * Estrai informazioni da URL come fallback
   */
  static extractInfoFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const hostname = urlObj.hostname;
      
      // Estrai nome prodotto dal path
      let productName = '';
      
      // Pattern comuni negli URL e-commerce
      if (pathname.includes('/p/') || pathname.includes('/product/')) {
        const parts = pathname.split('/');
        const productIndex = parts.findIndex(part => part === 'p' || part === 'product');
        
        if (productIndex !== -1 && productIndex + 1 < parts.length) {
          productName = parts[productIndex + 1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\.[^.]*$/, '') // Rimuovi estensioni
            .trim();
        }
      } else {
        // Fallback: ultimo segmento del path
        productName = pathname.split('/').pop()
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .replace(/\.[^.]*$/, '')
          .trim();
      }
      
      // Determina brand dal hostname o path
      let brand = '';
      const knownBrands = {
        'zalando': 'Zalando',
        'asos': 'ASOS', 
        'amazon': 'Amazon',
        'nike': 'Nike',
        'adidas': 'Adidas',
        'zara': 'Zara',
        'hm': 'H&M'
      };
      
      for (const [key, value] of Object.entries(knownBrands)) {
        if (hostname.includes(key) || pathname.toLowerCase().includes(key)) {
          brand = value;
          break;
        }
      }
      
      // Determina categoria
      let category = 'Articoli';
      const categoryKeywords = {
        'Vestiti': ['abbigliamento', 'vestiti', 'maglietta', 'camicia', 'pantalone', 'giacca'],
        'Accessori': ['borsa', 'scarpe', 'cappello', 'occhiali', 'orologio', 'cintura'],
        'Beauty': ['profumo', 'makeup', 'cosmetico', 'beauty', 'skincare'],
        'Cibo': ['food', 'cibo', 'alimentare', 'drink'],
        'Arredi': ['casa', 'arredo', 'furniture', 'home']
      };
      
      const fullUrl = url.toLowerCase();
      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => fullUrl.includes(keyword))) {
          category = cat;
          break;
        }
      }
      
      return {
        nameProduct: productName || 'Prodotto sconosciuto',
        nameBrand: brand,
        site: hostname,
        category: category
      };
      
    } catch (error) {
      console.error('❌ Errore estrazione da URL:', error.message);
      return {
        nameProduct: 'Errore parsing URL',
        nameBrand: '',
        site: 'N/A',
        category: 'Articoli'
      };
    }
  }
}

module.exports = {
  ContentExtractor
};