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
   * ✅ NUOVO: Estrae tutti i link immagine dall'HTML
   */
  static extractAllImageUrls(html) {
    console.log('🖼️ Estraendo tutti i link immagine...');
    
    const imageUrls = new Set(); // Usa Set per evitare duplicati
    
    // Pattern per diverse fonti di immagini
    const imagePatterns = [
      // 1. Tag img con src
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      
      // 2. Tag img con data-src (lazy loading)
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
      
      // 3. Background-image in style
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      
      // 4. Data attributes per immagini
      /data-[^=]*image[^=]*=["']([^"']+)["']/gi,
      /data-[^=]*photo[^=]*=["']([^"']+)["']/gi,
      /data-[^=]*picture[^=]*=["']([^"']+)["']/gi,
      
      // 5. Srcset per immagini responsive
      /srcset=["']([^"']+)["']/gi,
      
      // 6. JSON con URL immagini
      /"image":\s*"([^"]+)"/gi,
      /"imageUrl":\s*"([^"]+)"/gi,
      /"photo":\s*"([^"]+)"/gi,
      /"picture":\s*"([^"]+)"/gi,
      /"thumbnail":\s*"([^"]+)"/gi,
      
      // 7. Attributi specifici e-commerce
      /data-product-image=["']([^"']+)["']/gi,
      /data-zoom-image=["']([^"']+)["']/gi,
      /data-large-image=["']([^"']+)["']/gi,
      
      // 8. Pattern per CDN comuni
      /https?:\/\/[^"\s]*(?:cdn|images?|media|static)[^"\s]*\.(?:jpg|jpeg|png|webp|gif)/gi,
      
      // 9. Pattern generici per URL immagini
      /https?:\/\/[^"\s]*\.(?:jpg|jpeg|png|webp|gif)/gi
    ];
    
    imagePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let imageUrl = match[1];
        
        // ✅ FIXED: Controllo sicurezza prima di fare split
        if (!imageUrl || typeof imageUrl !== 'string') {
          continue; // Salta questo match se l'URL non è valido
        }
        
        // Pulisci l'URL
        imageUrl = imageUrl.split(',')[0].split(' ')[0].trim(); // Per srcset multipli
        
        // Filtra URL validi
        if (this.isValidImageUrl(imageUrl)) {
          imageUrls.add(imageUrl);
        }
      }
    });
    
    // Converti in array e ordina per rilevanza
    const sortedImages = Array.from(imageUrls).sort((a, b) => {
      return this.calculateImageRelevanceScore(b) - this.calculateImageRelevanceScore(a);
    });
    
    console.log(`🖼️ Trovati ${sortedImages.length} link immagine`);
    if (sortedImages.length > 0) {
      console.log(`🏆 Top 3 immagini: ${sortedImages.slice(0, 3).join(', ')}`);
    }
    
    return sortedImages;
  }

  /**
   * ✅ FIXED: Valida se un URL è una immagine valida
   */
  static isValidImageUrl(url) {
    if (!url || typeof url !== 'string' || url.length === 0) return false;
    
    // Deve essere un URL valido
    try {
      const urlObj = new URL(url, 'https://example.com'); // Permetti URL relativi
      
      // Filtra immagini non desiderate
      const unwantedPatterns = [
        /favicon/i,
        /logo/i,
        /icon/i,
        /sprite/i,
        /placeholder/i,
        /1x1\.gif/i,
        /loading\.gif/i,
        /\.svg$/i,  // Spesso loghi
        /data:image/i, // Data URLs troppo lunghi
        /base64/i
      ];
      
      if (unwantedPatterns.some(pattern => pattern.test(url))) {
        return false;
      }
      
      // Deve avere estensione immagine o essere da CDN
      const hasImageExt = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
      const isCDN = /cdn|images?|media|static|assets/i.test(url);
      
      return hasImageExt || isCDN;
      
    } catch {
      return false;
    }
  }

  /**
   * ✅ NUOVO: Calcola score di rilevanza per un'immagine
   */
  static calculateImageRelevanceScore(url) {
    let score = 0;
    
    // Bonus per parole chiave indicative di immagini prodotto
    const productKeywords = [
      /product/i, /item/i, /detail/i, /main/i, /primary/i,
      /large/i, /big/i, /zoom/i, /full/i, /hero/i,
      /gallery/i, /photo/i, /picture/i
    ];
    
    productKeywords.forEach(keyword => {
      if (keyword.test(url)) score += 10;
    });
    
    // Bonus per CDN di qualità
    const qualityCDNs = [
      /amazonaws\.com/i, /cloudfront/i, /akamai/i,
      /fastly/i, /cloudflare/i, /imgix/i
    ];
    
    qualityCDNs.forEach(cdn => {
      if (cdn.test(url)) score += 5;
    });
    
    // Malus per parole che indicano immagini secondarie
    const secondaryKeywords = [
      /thumb/i, /small/i, /mini/i, /avatar/i,
      /badge/i, /tag/i, /label/i
    ];
    
    secondaryKeywords.forEach(keyword => {
      if (keyword.test(url)) score -= 5;
    });
    
    // Bonus per dimensioni nell'URL (indicano immagini grandi)
    const sizeMatch = url.match(/(\d{3,4})[x×](\d{3,4})/);
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      if (width >= 500 && height >= 500) score += 15;
      else if (width >= 300 && height >= 300) score += 10;
    }
    
    return score;
  }

  /**
   * ✅ FIXED: Estrae tutto il testo con limite 1500 caratteri e immagini prioritarie
   */
  static extractAllText(html) {
    console.log('📝 Estraendo testo (max 1500 chars) con immagini prioritarie...');
    
    // ✅ PRIMO: Estrai tutte le immagini DALL'HTML ORIGINALE con error handling
    let allImages = [];
    try {
      allImages = this.extractAllImageUrls(html);
    } catch (imageError) {
      console.error('❌ Errore estrazione immagini:', imageError.message);
      allImages = []; // Continua senza immagini
    }
    
    // ✅ SECONDO: Estrai prezzi JSON DALL'HTML ORIGINALE con error handling  
    let jsonPriceData = null;
    try {
      jsonPriceData = this.extractPriceFromJSON(html);
    } catch (priceError) {
      console.error('❌ Errore estrazione prezzi JSON:', priceError.message);
      jsonPriceData = null; // Continua senza prezzi JSON
    }
    
    // ✅ TERZO: Pulisci completamente l'HTML per ottenere solo testo
    let textOnly = '';
    try {
      textOnly = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, ' ')  // Rimuovi TUTTI i tag HTML
        .replace(/\s+/g, ' ')      // Normalizza spazi multipli
        .trim();
    } catch (textError) {
      console.error('❌ Errore pulizia HTML:', textError.message);
      textOnly = 'Errore nella pulizia del testo HTML';
    }
    
    // ✅ QUARTO: Costruisci le sezioni prioritarie
    let imageSection = '';
    if (allImages.length > 0) {
      // Prendi le migliori 5 immagini per non esagerare con la lunghezza
      const topImages = allImages.slice(0, 2);
      imageSection = `IMMAGINI PRODOTTO: ${topImages.join(' | ')} | `;
      console.log(`🖼️ ${topImages.length} immagini aggiunte come prioritarie`);
    }
    
    let priceSection = '';
    if (jsonPriceData) {
      priceSection = `PREZZI JSON: ${jsonPriceData} | `;
      console.log(`💰 Prezzi estratti da JSON: ${jsonPriceData}`);
    }
    
    // ✅ QUINTO: Calcola spazio disponibile per il testo pulito
    const priorityContent = imageSection + priceSection;
    const maxTextLength = 1500 - priorityContent.length;
    
    console.log(`📊 Spazi allocati:`);
    console.log(`   - Immagini: ${imageSection.length} chars`);
    console.log(`   - Prezzi: ${priceSection.length} chars`);
    console.log(`   - Spazio per testo pulito: ${maxTextLength} chars`);
    console.log(`   - Testo originale: ${textOnly.length} chars`);
    
    // ✅ SESTO: Tronca il testo pulito se necessario
    if (maxTextLength > 0 && textOnly.length > maxTextLength) {
      console.log(`⚠️ Testo pulito troppo lungo (${textOnly.length} chars), troncando a ${maxTextLength}...`);
      textOnly = textOnly.substring(0, maxTextLength) + '...';
    } else if (maxTextLength <= 0) {
      console.log(`⚠️ Nessuno spazio rimasto per il testo (priorità = ${priorityContent.length} chars)`);
      textOnly = ''; // Nessuno spazio per il testo
    }
    
    // ✅ SETTIMO: Componi risultato finale SOLO CON TESTO PULITO E IMMAGINI
    const finalText = priorityContent + textOnly;
    
    console.log(`✅ Testo finale PULITO: ${finalText.length}/1500 caratteri`);
    console.log(`📋 Preview: ${finalText.substring(0, 200)}...`);
    
    // ✅ Controllo finale sicurezza
    if (finalText.length > 1500) {
      console.log(`⚠️ ATTENZIONE: Testo supera 1500 caratteri (${finalText.length}), troncando...`);
      return finalText.substring(0, 1500);
    }
    
    return finalText;
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
      let name = '';
      
      // Pattern comuni negli URL e-commerce
      if (pathname.includes('/p/') || pathname.includes('/product/')) {
        const parts = pathname.split('/');
        const productIndex = parts.findIndex(part => part === 'p' || part === 'product');
        
        if (productIndex !== -1 && productIndex + 1 < parts.length) {
          name = parts[productIndex + 1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\.[^.]*$/, '') // Rimuovi estensioni
            .trim();
        }
      } else {
        // Fallback: ultimo segmento del path
        name = pathname.split('/').pop()
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
        name: name || 'Prodotto sconosciuto',
        brandName: brand,
        site: hostname,
        category: category
      };
      
    } catch (error) {
      console.error('❌ Errore estrazione da URL:', error.message);
      return {
        name: 'Errore parsing URL',
        brandName: '',
        site: 'N/A',
        category: 'Articoli'
      };
    }
  }
}

module.exports = {
  ContentExtractor
};