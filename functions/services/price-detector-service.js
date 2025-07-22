// ===== PRICE DETECTOR SERVICE - VERSIONE AGGIORNATA CON SUPPORTO DOLLARI =====
// functions/services/price-detector-service.js
// Servizio universale per rilevare prezzi multipli con gestione intelligente

const cheerio = require('cheerio');

class PriceDetectorService {
    constructor() {
        // ✅ MIGLIORATO: Pattern regex con DOLLARI prioritari per LightInTheBox
        this.universalPricePatterns = [
            // ✅ DOLLARI (priorità alta per siti come LightInTheBox)
            /\$\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            /(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*\$/g,
            /USD\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            /(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*USD/g,
            
            // Euro (pattern esistenti migliorati)
            /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*€/g,
            /EUR\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*EUR/g,
            
            // Sterline
            /£\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*£/g,
            /GBP\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
            
            // Pattern aggiuntivi per casi specifici
            /\$\s*(\d+[.,]\d+)/g,
            /(\d+[.,]\d+)\s*\$/g,
            /€\s*(\d+[.,]\d+)/g,
            /(\d+[.,]\d+)\s*€/g
        ];

        // Selettori CSS universali con priorità
        this.universalSelectors = [
            // Priorità 1: Prezzi attuali/scontati
            '.price-current', '.current-price', '.sale-price', '.final-price',
            '.price-sale', '.price-now', '.price-active',
            '[class*="current"][class*="price"]',
            '[class*="sale"][class*="price"]',
            '[class*="final"][class*="price"]',
            
            // Priorità 2: Prezzi principali (filtrati)
            '.price:not(.price-compare):not(.price-regular):not(.price-was)',
            '.product-price:not(.was-price):not(.compare-price)',
            '[data-price]:not([data-compare-price])',
            '.product__price',
            '.main-price',
            
            // Priorità 3: Selettori Shopify
            '.money', '.price-item:not(.price-item--regular)',
            '[data-current-price]', '[data-sale-price]',
            
            // Priorità 4: Selettori Zalando/specifici
            '[data-testid*="price"]', '[data-testid^="pdp-price"]',
            '[data-testid="current-price"]',
            
            // Priorità 5: Selettori generici
            '[class*="price"]', '[id*="price"]', '.cost', '.amount'
        ];

        // ✅ MIGLIORATO: Pattern JSON con supporto dollari
        this.jsonPatterns = [
            // Shopify
            /"current_price":(\d+)/g,
            /"price":(\d+)/g,
            /"amount":(\d+)/g,
            /window\.product.*?"price":(\d+)/g,
            
            // WooCommerce / WordPress
            /"price":"([^"]*\d+[.,]\d{2}[^"]*)"/g,
            /"regular_price":"([^"]*\d+[.,]\d{2}[^"]*)"/g,
            /"sale_price":"([^"]*\d+[.,]\d{2}[^"]*)"/g,
            
            // Magento
            /"finalPrice":([0-9.]+)/g,
            /"regular_price":([0-9.]+)/g,
            
            // ✅ NUOVO: Pattern specifici per LightInTheBox e siti dollari
            /"price":\s*"?\$?(\d+\.?\d{0,2})"?/g,
            /"current_price":\s*"?\$?(\d+\.?\d{0,2})"?/g,
            /"sale_price":\s*"?\$?(\d+\.?\d{0,2})"?/g,
            /"final_price":\s*"?\$?(\d+\.?\d{0,2})"?/g,
            
            // Pattern generici
            /"currentPrice":"([^"]*\d+[.,]\d{2}[^"]*)"/g,
            /"salePrice":"([^"]*\d+[.,]\d{2}[^"]*)"/g
        ];

        // Parole chiave per filtrare rumore
        this.excludeKeywords = [
            'shipping', 'spedizione', 'delivery', 'consegna',
            'tax', 'tassa', 'iva', 'vat', 'total', 'totale',
            'minimum', 'minimo', 'maximum', 'massimo',
            'from', 'da', 'starting', 'a partire',
            'save', 'risparmia', 'discount', 'sconto',
            'was', 'era', 'before', 'prima',
            'related', 'correlati', 'suggested', 'suggeriti',
            'recommend', 'raccomandato', 'brother', 'similar',
            'bundle', 'pacchetto', 'combo'
        ];
    }

    /**
     * METODO PRINCIPALE: Rileva prezzi multipli in modo intelligente
     */
    async detectMultiplePrices(htmlContent, url = null) {
        try {
            console.log(`🔍 DEBUG: Iniziando rilevamento prezzi per: ${url || 'URL non specificato'}`);
            
            // ✅ CONTROLLO PRELIMINARE HTML VUOTO
            if (!htmlContent || htmlContent.trim().length < 1000) {
                console.log('⚠️ HTML troppo corto o vuoto, possibile sito JavaScript-heavy');
                
                if (url) {
                    return await this.detectPricesFromUrlPattern(url);
                }
                
                return {
                    status: 'insufficient_content',
                    detectedPrices: [],
                    detectionErrors: ['HTML content too short or empty']
                };
            }
            
            const $ = cheerio.load(htmlContent);
            const detectedPrices = [];
            
            // STEP 1: Identifica sezione prodotto principale
            const productSection = this.identifyProductSection($);
            
            // ✅ STEP 2: NUOVO - Cerca prezzi in TITLE e META DESCRIPTION (priorità massima)
            const titleMetaPrices = this.extractPricesFromTitleAndMeta($);
            detectedPrices.push(...titleMetaPrices);
            console.log(`📊 DEBUG: Trovati ${titleMetaPrices.length} prezzi da title/meta`);
            
            // STEP 3: Cerca prezzi nei JSON (alta priority)
            const jsonPrices = this.extractJsonPrices(htmlContent, $);
            detectedPrices.push(...jsonPrices);
            console.log(`📊 DEBUG: Trovati ${jsonPrices.length} prezzi da JSON`);
            
            // STEP 4: Cerca prezzi con selettori CSS nella sezione prodotto
            const cssPrices = this.extractCssPrices(productSection, $);
            detectedPrices.push(...cssPrices);
            console.log(`📊 DEBUG: Trovati ${cssPrices.length} prezzi da CSS`);
            
            // STEP 5: Deduplicazione e ranking intelligente
            const finalPrices = this.intelligentDeduplicationAndRanking(detectedPrices);
            
            console.log(`💰 DEBUG: Pattern prezzi finali: ${finalPrices.length}`);
            finalPrices.forEach((price, index) => {
                console.log(`   ${index + 1}. ${price.value} (confidence: ${price.confidence.toFixed(2)}, source: ${price.source})`);
            });

            return this.formatResult(finalPrices);

        } catch (error) {
            console.error('❌ Errore rilevamento prezzi:', error);
            return {
                status: 'error',
                detectedPrices: [],
                detectionErrors: [error.message]
            };
        }
    }

    /**
     * ✅ NUOVO: Estrae prezzi da TITLE e META DESCRIPTION (priorità massima)
     */
    extractPricesFromTitleAndMeta($) {
        const prices = [];
        const seenValues = new Set();
        
        try {
            // Estrai prezzo dal TITLE
            const title = $('title').text() || '';
            console.log(`📋 DEBUG: Title trovato: "${title.substring(0, 100)}..."`);
            
            // Estrai prezzo dalla META DESCRIPTION  
            const metaDesc = $('meta[name="description"]').attr('content') || '';
            console.log(`📋 DEBUG: Meta description: "${metaDesc.substring(0, 100)}..."`);
            
            const textSources = [
                { text: title, source: 'title', confidence: 0.95 },
                { text: metaDesc, source: 'meta_description', confidence: 0.90 }
            ];
            
            textSources.forEach(({text, source, confidence}) => {
                if (!text) return;
                
                for (const pattern of this.universalPricePatterns) {
                    pattern.lastIndex = 0;
                    let match;
                    
                    while ((match = pattern.exec(text)) !== null) {
                        const fullMatch = match[0];
                        const numericPart = match[1];
                        
                        if (numericPart) {
                            const numericValue = this.parseNumericValue(numericPart);
                            
                            if (this.isValidPriceValue(numericValue)) {
                                const key = numericValue.toFixed(2);
                                
                                if (!seenValues.has(key)) {
                                    seenValues.add(key);
                                    
                                    prices.push({
                                        value: fullMatch.trim(),
                                        numericValue: numericValue,
                                        cssSelector: source === 'title' ? 'title' : 'meta[name="description"]',
                                        confidence: confidence,
                                        source: source,
                                        priority: 0, // Priorità massima
                                        parentClasses: [],
                                        elementText: text.substring(0, 150),
                                        isStrikethrough: false,
                                        context: {
                                            nearbyText: `Estratto da ${source}`,
                                            isProminent: true
                                        }
                                    });
                                    
                                    console.log(`💰 DEBUG: Prezzo trovato in ${source}: ${fullMatch} (${numericValue})`);
                                }
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Errore estrazione prezzi da title/meta:', error);
        }
        
        return prices;
    }

    /**
     * Identifica la sezione prodotto principale
     */
    identifyProductSection($) {
        const productSectionSelectors = [
            '#product', '.product-main', '.product-details', '.product-info',
            '.product-page', '.product-content',
            '[class*="product"]:not([class*="recom"]):not([class*="related"]):not([class*="similar"])',
            '.main-content', 'main', '#main'
        ];
        
        for (const selector of productSectionSelectors) {
            const section = $(selector);
            if (section.length > 0) {
                console.log(`📍 DEBUG: Sezione prodotto identificata: ${selector}`);
                return section.first();
            }
        }
        
        console.log('⚠️ DEBUG: Usando body come sezione prodotto');
        return $('body');
    }

    /**
     * Estrae prezzi dai dati JSON embedded
     */
  extractJsonPrices(htmlContent, $ = null){
    // ✅ AGGIUNGI QUESTO DEBUG ALL'INIZIO
    console.log(`🧪 DEBUG: extractJsonPrices chiamato, htmlContent length: ${htmlContent.length}`);
    console.log(`🧪 DEBUG: Numero pattern JSON da testare: ${this.jsonPatterns.length}`);
    
    const prices = [];
    const seenValues = new Set();
    
    // ✅ Se $ non è passato, crea cheerio instance
    if (!$) {
        const cheerio = require('cheerio');
        $ = cheerio.load(htmlContent);
    }

    let totalMatches = 0;
    let totalProcessed = 0;

    for (const pattern of this.jsonPatterns) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(htmlContent)) !== null) {
            totalMatches++;
            if (match[1]) {
                try {
                    const rawValue = match[1];
                    let finalPrice = null;
                    let conversionType = 'standard';
                    
                    if (/^\d+$/.test(rawValue)) {
                        const numericValue = parseInt(rawValue);
                        
                        if (numericValue >= 50 && numericValue <= 5000000) {
                            // Logica intelligente per distinguere centesimi vs euro/dollari
                            if (numericValue > 1000) {
                                // > 1000: probabilmente centesimi (es: 29800 → $298)
                                finalPrice = numericValue / 100;
                                conversionType = 'centesimi';
                            } else {
                                // <= 1000: probabilmente dollari/euro (es: 298 → $298)
                                finalPrice = numericValue;
                                conversionType = 'currency';
                            }
                        }
                    } else {
                        // Formato già con decimali o con simbolo dollaro
                        const cleanValue = rawValue.replace(/[\$€£]/, '').replace(/[^\d.,]/g, '').replace(',', '.');
                        const numericValue = parseFloat(cleanValue);
                        if (numericValue >= 0.50 && numericValue <= 50000) {
                            finalPrice = numericValue;
                            conversionType = 'formatted';
                        }
                    }
                    
                    if (finalPrice && !seenValues.has(finalPrice.toFixed(2))) {
                        seenValues.add(finalPrice.toFixed(2));
                        totalProcessed++;
                        
                        // ✅ AGGIUNGI QUESTO DEBUG PRIMA DELLA CORRELAZIONE
                        console.log(`🧪 DEBUG: Prezzo JSON ${totalProcessed}: ${finalPrice} (raw: ${rawValue})`);
                        console.log(`🧪 DEBUG: Chiamando correlatePriceToElement per prezzo ${finalPrice}`);
                        
                        // ✅ MIGLIORATO: Determina simbolo valuta dal contesto
                        let currencySymbol = '$'; // Default per LightInTheBox
                        if (rawValue.includes('€') || rawValue.includes('EUR')) {
                            currencySymbol = '€';
                        } else if (rawValue.includes('£') || rawValue.includes('GBP')) {
                            currencySymbol = '£';
                        }
                        
                        const correlatedElement = this.correlatePriceToElement(finalPrice, $);
                        
                        // ✅ AGGIUNGI QUESTO DEBUG DOPO LA CORRELAZIONE
                        console.log(`🧪 DEBUG: correlatePriceToElement ha restituito: ${correlatedElement ? 'ELEMENTO TROVATO' : 'NULL'}`);
                        if (correlatedElement) {
                            const foundSelector = this.generateCssSelector(correlatedElement, $);
                            console.log(`🧪 DEBUG: CSS Selector trovato: "${foundSelector}"`);
                        }
                        
                        const priceData = {
                            value: `${currencySymbol}${finalPrice.toFixed(2)}`,
                            numericValue: finalPrice,
                            source: 'json',
                            conversionType: conversionType,
                            jsonPattern: rawValue,  // Pattern JSON originale
                            confidence: 0.85
                        };

                        if (correlatedElement) {
                            // ✅ USA GERARCHIA ESISTENTE per elemento correlato
                            priceData.cssSelector = this.generateCssSelector(correlatedElement, $);
                            priceData.parentClasses = this.getParentClasses(correlatedElement, $);
                            priceData.elementText = correlatedElement.text().substring(0, 100);
                            priceData.context = {
                                nearbyText: this.getNearbyText(correlatedElement, $),
                                isProminent: this.isElementProminent(correlatedElement, $)
                            };
                            priceData.source = 'json-correlated';
                            
                            // ✅ AGGIUNGI QUESTO DEBUG PER IL RISULTATO FINALE
                            console.log(`🧪 DEBUG: Prezzo ${finalPrice} → CORRELATO con "${priceData.cssSelector}"`);
                        } else {
                            // ✅ FALLBACK migliorato se non trova correlazione
                            priceData.cssSelector = `[data-json-fallback="${finalPrice.toFixed(2)}"]`;
                            priceData.parentClasses = [];
                            priceData.elementText = `JSON: ${rawValue} → ${finalPrice}`;
                            priceData.context = { nearbyText: 'Estratto da JSON', isProminent: true };
                            
                            // ✅ AGGIUNGI QUESTO DEBUG PER IL FALLBACK
                            console.log(`🧪 DEBUG: Prezzo ${finalPrice} → FALLBACK selector "[data-json-fallback="${finalPrice.toFixed(2)}"]"`);
                        }

                        prices.push(priceData);
                    }
                    
                } catch (e) {
                    // JSON non valido, ignora
                }
            }
        }
    }

    // ✅ AGGIUNGI QUESTO DEBUG ALLA FINE
    console.log(`🧪 DEBUG: extractJsonPrices completato:`);
    console.log(`   - Total matches: ${totalMatches}`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Final prices: ${prices.length}`);
    console.log(`   - Sources: ${prices.map(p => p.source).join(', ')}`);
    
    return prices;
}
    /**
 * ✅ NUOVO: Correlazione JSON → HTML
 * Trova l'elemento HTML che mostra visivamente il prezzo estratto dal JSON
 */
correlatePriceToElement(jsonPrice, $) {
    const priceString = jsonPrice.toFixed(2);
    
    // ✅ MANTIENE tutte le variazioni per flessibilità
    const variations = [
        priceString,                          // "176.00"
        priceString.replace('.', ','),        // "176,00" (formato italiano)
        `€${priceString}`,                   // "€176.00"
        `${priceString}€`,                   // "176.00€"
        `$${priceString}`,                   // "$176.00"
        `${priceString} €`,                  // "176.00 €"
        `€ ${priceString}`,                  // "€ 176.00"
        `${priceString.replace('.', ',')} €`, // "176,00 €"
        `€${priceString.replace('.', ',')}`,   // "€176,00"
        `${priceString.replace('.', ',')}€`,   // "176,00€"
        `${priceString.replace('.', ',')}&nbsp;€`, // "176,00&nbsp;€"
        `${priceString}&nbsp;€`,                   // "176.00&nbsp;€"
        `€&nbsp;${priceString.replace('.', ',')}`, // "€&nbsp;176,00"
        `${priceString.replace('.', ',')}\u00a0€`, // Unicode non-breaking space
        `${priceString.replace('.', ',')}\xa0€`,   // Alternative encoding
        // ✅ DOLLARI (per altri siti)
        `$${priceString}`, `${priceString}$`, `${priceString} $`, `$ ${priceString}`,
        // ✅ STERLINE
        `£${priceString}`, `${priceString}£`, `${priceString} £`, `£ ${priceString}`,
    ];

    console.log(`🔗 Cercando correlazione HTML per prezzo JSON: ${priceString}`);
    
    // ✅ OTTIMIZZAZIONE 1: Set per evitare duplicati
    const processedElements = new Set();
    const foundElements = [];
    
    // ✅ OTTIMIZZAZIONE 2: Selettori prioritari in ordine di importanza
    const searchSelectors = [
        // Priorità 1: Selettori specifici per prezzi
        'span[class*="price"]', 'div[class*="price"]', 
        'span[class*="money"]', 'div[class*="money"]',
        'span[class*="cost"]', 'div[class*="cost"]',
        
        // Priorità 2: Zalando specifici
        '.voFjEy', 'span.voFjEy', 
        
        // Priorità 3: Altri specifici
        '[data-testid*="price"]', '[class*="amount"]',
        
        // Priorità 4: Generici (limitati)
        'span', 'div', 'p', 'strong'
    ];
    
    let totalChecked = 0;
    const MAX_ELEMENTS = 100; // ✅ LIMITA per evitare timeout
    
    for (const selector of searchSelectors) {
        if (totalChecked >= MAX_ELEMENTS) break;
        
        const elements = $(selector);
        const elementsArray = elements.toArray().slice(0, 20); // Max 20 per selector
        
        for (const element of elementsArray) {
            if (totalChecked >= MAX_ELEMENTS) break;
            
            const $element = $(element);
            
            // ✅ OTTIMIZZAZIONE 3: Deduplicazione per posizione DOM
            const elementKey = $element.get(0); // Riferimento DOM unico
            if (processedElements.has(elementKey)) continue;
            processedElements.add(elementKey);
            
            totalChecked++;
            
            const text = $element.text().trim();
            const html = $element.html() || '';
            
            // ✅ OTTIMIZZAZIONE 4: Skip veloce per elementi ovviamente non prezzo
            if (text.length > 100 || text.split(' ').length > 10) continue;
            if (this.isNoiseElement($element, text, $)) continue;
            
            // ✅ CHECK variazioni
            for (const variation of variations) {
                if (text.includes(variation) || html.includes(variation)) {
                    
                    const cssSelector = this.generateCssSelector($element, $);
                    
                    // ✅ OTTIMIZZAZIONE 5: Skip se già trovato questo selector
                    if (foundElements.some(f => f.cssSelector === cssSelector)) continue;
                    
                    const elementData = {
                        element: $element,
                        text: text,
                        html: html,
                        variation: variation,
                        cssSelector: cssSelector,
                        matchType: text.includes(variation) ? 'text' : 'html',
                        score: this.calculateElementScore($element, text, variation, $)
                    };
                    
                    foundElements.push(elementData);
                    
                    // ✅ OTTIMIZZAZIONE 6: Log solo per elementi con score alto
                    if (elementData.score >= 5) {
                        console.log(`✅ Elemento promettente (score ${elementData.score}): ${cssSelector} → "${text}"`);
                    }
                    
                    // ✅ OTTIMIZZAZIONE 7: Early exit per match perfetti
                    if (elementData.score >= 10) {
                        console.log(`🎯 Match perfetto trovato, interrompo ricerca`);
                        return $element;
                    }
                    
                    break; // Trovato match per questo elemento, passa al prossimo
                }
            }
        }
    }

    console.log(`🔍 Controllati ${totalChecked} elementi, trovati ${foundElements.length} candidati`);

    if (foundElements.length > 0) {
        // ✅ RANKING FINALE
        foundElements.sort((a, b) => b.score - a.score);
        
        console.log(`🏆 Top 3 candidati:`);
        foundElements.slice(0, 3).forEach((item, i) => {
            console.log(`   ${i + 1}. Score ${item.score}: ${item.cssSelector} → "${item.text}"`);
        });
        
        const bestElement = foundElements[0].element;
        console.log(`🎯 Elemento migliore selezionato: ${foundElements[0].cssSelector}`);
        return bestElement;
    }
    
    console.log(`❌ Nessuna correlazione HTML trovata per prezzo ${priceString}`);
    return null;
}
calculateElementScore($element, text, matchedVariation, $) {
    let score = 1; // Base score
    
    const classes = ($element.attr('class') || '').toLowerCase();
    const id = ($element.attr('id') || '').toLowerCase();
    const tagName = $element.prop('tagName')?.toLowerCase() || '';
    
    // ✅ BONUS PER CLASSI RILEVANTI
    if (classes.includes('price')) score += 4;
    if (classes.includes('money')) score += 4;
    if (classes.includes('cost')) score += 3;
    if (classes.includes('amount')) score += 3;
    if (classes.includes('current')) score += 2;
    if (classes.includes('sale')) score += 2;
    if (classes.includes('final')) score += 2;
    
    // ✅ BONUS SPECIFICI PER SITO (Zalando)
    if (classes.includes('vofjey')) score += 3;
    if (classes.includes('_4sa1ca')) score += 5; // Classe prezzo principale Zalando
    if (classes.includes('lystz1')) score += 2;
    if (classes.includes('govna')) score += 2;
    
    // ✅ BONUS PER POSIZIONE PROMINENTE
    if (this.isElementProminent && this.isElementProminent($element, $)) score += 3;
    
    // ✅ BONUS PER TESTO CORTO (prezzi singoli)
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 2) score += 3;
    if (wordCount <= 4) score += 1;
    
    // ✅ BONUS PER TAG APPROPRIATI
    if (tagName === 'span') score += 1;
    if (tagName === 'div') score += 0.5;
    
    // ✅ MALUS PER ELEMENTI PROBLEMATICI
    const priceMatches = (text.match(/[\d.,]+\s*[€$£]/g) || []).length;
    if (priceMatches > 1) score -= 3; // Probabilmente listing
    
    if (text.length > 50) score -= 2; // Troppo testo
    
    // Noise keywords
    const noiseKeywords = ['shipping', 'delivery', 'tax', 'total', 'recommend', 'related'];
    if (noiseKeywords.some(keyword => classes.includes(keyword) || text.toLowerCase().includes(keyword))) {
        score -= 5;
    }
    
    // ✅ BONUS PER TIPO DI MATCH
    if (matchedVariation.includes('€') && text.includes('€')) score += 1;
    if (matchedVariation.includes('$') && text.includes('$')) score += 1;
    if (matchedVariation.includes('£') && text.includes('£')) score += 1;
    
    return Math.max(0, score); // Non può essere negativo
}

isNoiseElement($element, text, $) {
    const classes = ($element.attr('class') || '').toLowerCase();
    const id = ($element.attr('id') || '').toLowerCase();
    
    // Esclude prodotti correlati/raccomandazioni
    const noiseKeywords = [
        'recommend', 'related', 'similar', 'cross-sell',
        'product-card', 'other-product', 'brother-price', 'suggestion',
        'bundle', 'combo', 'accessory', 'cart', 'footer', 'header',
        'navigation', 'menu', 'breadcrumb', 'pagination'
    ];
    
    for (const keyword of noiseKeywords) {
        if (classes.includes(keyword) || id.includes(keyword)) {
            return true;
        }
    }
    
    // Esclude se contiene troppe occorrenze dello stesso prezzo (listing)
    const priceOccurrences = (text.match(/[\$€£]\s*\d+/g) || []).length;
    if (priceOccurrences > 2) {
        return true;
    }
    
    // Esclude script/style tag
    const tagName = $element.prop('tagName').toLowerCase();
    if (['script', 'style', 'noscript'].includes(tagName)) {
        return true;
    }
    
    return false;
}
    /**
     * Estrae prezzi usando selettori CSS
     */
    extractCssPrices(productSection, $) {
        const foundPrices = [];
        const processedElements = new Set();

        this.universalSelectors.forEach((selector, priority) => {
            const elements = productSection.find(selector);
            
            elements.each((index, element) => {
                const $element = $(element);
                const text = $element.text().trim();
                const elementKey = text + $element.attr('class');
                
                // Evita duplicati
                if (processedElements.has(elementKey)) {
                    return;
                }
                processedElements.add(elementKey);
                
                // Filtro anti-rumore
                if (this.isNoiseElement($element, text, $)) {
                    return;
                }
                
                // Cerca prezzi nel testo
                for (const pattern of this.universalPricePatterns) {
                    pattern.lastIndex = 0;
                    const match = pattern.exec(text);
                    
                    if (match) {
                        const numericValue = this.parseNumericValue(match[1] || match[0]);
                        
                        if (this.isValidPriceValue(numericValue)) {
                            const confidence = this.calculateUniversalConfidence($element, text, numericValue, priority, $);
                            const cssSelector = this.generateCssSelector($element, $);
                            
                            foundPrices.push({
                                value: match[0],
                                numericValue: numericValue,
                                cssSelector: cssSelector,
                                confidence: confidence,
                                source: 'css',
                                priority: priority,
                                parentClasses: this.getParentClasses($element, $),
                                elementText: text.substring(0, 100),
                                isStrikethrough: this.isStrikethrough($element, $),
                                context: {
                                    nearbyText: this.getNearbyText($element, $),
                                    isProminent: this.isElementProminent($element, $)
                                }
                            });
                            
                            break; // Una volta trovato un prezzo, passa al prossimo elemento
                        }
                    }
                }
            });
        });

        return foundPrices;
    }

    /**
     * Parsing intelligente del valore numerico
     */
    parseNumericValue(rawMatch) {
        // Rimuovi simboli di valuta per il parsing
        const cleaned = rawMatch.replace(/[\$€£]/g, '');
        
        // Gestione intelligente dei separatori per migliaia
        if (cleaned.includes('.') && cleaned.includes(',')) {
            // Caso: 1.095,50 (formato italiano/tedesco)
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else if (cleaned.includes('.') && cleaned.split('.').length === 2 && cleaned.split('.')[1].length === 3) {
            // Caso: 1.095 (migliaia con punto)
            return parseFloat(cleaned.replace(/\./g, ''));
        } else if (cleaned.includes(',') && cleaned.split(',').length === 2 && cleaned.split(',')[1].length === 3) {
            // Caso: 1,095 (migliaia con virgola inglese)
            return parseFloat(cleaned.replace(/,/g, ''));
        } else {
            // Caso standard: usa replace normale
            return parseFloat(cleaned.replace(',', '.'));
        }
    }

    /**
     * Filtro anti-rumore migliorato
     */
    isNoiseElement($element, text, $) {
        const classes = $element.attr('class') || '';
        const id = $element.attr('id') || '';
        
        // Esclude prodotti correlati/raccomandazioni
        const noiseKeywords = [
            'recommend', 'related', 'similar', 'cross-sell',
            'product-card', 'other-product', 'brother-price', 'suggestion',
            'bundle', 'combo', 'accessory'
        ];
        
        for (const keyword of noiseKeywords) {
            if (classes.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword)) {
                return true;
            }
        }
        
        // Esclude elementi con troppi prezzi (listing)
        const priceCount = (text.match(/[\$€£]\s*\d+/g) || []).length;
        if (priceCount > 3) {
            return true;
        }
        
        // Esclude testi troppo lunghi
        if (text.length > 200) {
            return true;
        }
        
        // Esclude se contiene parole chiave sospette
        const lowerText = text.toLowerCase();
        for (const keyword of this.excludeKeywords) {
            if (lowerText.includes(keyword)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Calcolo confidence universale
     */
    calculateUniversalConfidence($element, text, numericValue, priority, $) {
        let confidence = 0.3; // Base
        
        const classes = ($element.attr('class') || '').toLowerCase();
        const tagName = $element.prop('tagName').toLowerCase();
        
        // Bonus per priorità selettore
        confidence += (5 - priority) * 0.10;
        
        // Bonus per classi semantiche
        if (classes.includes('current') || classes.includes('sale') || classes.includes('final')) {
            confidence += 0.25;
        }
        
        if (classes.includes('price') && !classes.includes('compare') && !classes.includes('was') && !classes.includes('card')) {
            confidence += 0.20;
        }
        
        // BONUS MAGGIORE per essere nella sezione prodotto principale
        const isInMainProduct = $element.closest('.product-main, .product-details, .product-info, .product-page, #product').length > 0;
        if (isInMainProduct) {
            confidence += 0.30;
        }
        
        // Bonus per tag semantici
        if (['span', 'strong', 'b', 'h1', 'h2'].includes(tagName)) {
            confidence += 0.10;
        }
        
        // Penalità per prezzi barrati
        if (this.isStrikethrough($element, $)) {
            confidence -= 0.40;
        }
        
        // PENALITÀ FORTE per prodotti correlati
        if (classes.includes('card') || classes.includes('brother') || classes.includes('related')) {
            confidence -= 0.50;
        }
        
        // Bonus per ratio prezzo/testo
        const priceRatio = numericValue.toString().length / text.length;
        if (priceRatio > 0.15) {
            confidence += 0.15;
        }
        
        // Bonus per prezzi ragionevoli
        if (numericValue >= 5 && numericValue <= 10000) {
            confidence += 0.10;
        }
        
        // Bonus extra per prezzi con migliaia (prodotti di valore)
        if (numericValue >= 1000) {
            confidence += 0.15;
        }
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Deduplicazione e ranking intelligente
     */
    intelligentDeduplicationAndRanking(allPrices) {
        // Raggruppa per valore numerico
        const priceGroups = {};
        allPrices.forEach(price => {
            const key = price.numericValue.toFixed(2);
            if (!priceGroups[key]) {
                priceGroups[key] = [];
            }
            priceGroups[key].push(price);
        });
        
        // Per ogni gruppo, seleziona il migliore
        const bestPrices = [];
        
        Object.entries(priceGroups).forEach(([value, prices]) => {
            // Ordina per confidence decrescente
            prices.sort((a, b) => {
                // ✅ NUOVO: Priorità extra per title/meta
                if (a.source === 'title' || a.source === 'meta_description') return -1;
                if (b.source === 'title' || b.source === 'meta_description') return 1;
                return b.confidence - a.confidence;
            });
            
            const bestPrice = prices[0];
        // ✅ MIGLIORATO: Merge selettori alternativi se stesso prezzo
        if (prices.length > 1) {
            bestPrice.alternativeSelectors = prices.slice(1).map(p => ({
                cssSelector: p.cssSelector,
                confidence: p.confidence,
                source: p.source,
                context: p.context?.nearbyText || ''
            }));
            
            // Bonus per essere in più elementi (più affidabile)
            bestPrice.confidence += Math.min(0.2, prices.length * 0.05);
            
            console.log(`🔗 Prezzo ${value} trovato in ${prices.length} elementi:`, 
                prices.map(p => p.cssSelector));
        }

        bestPrices.push(bestPrice);
        });
        
        // Ordina prezzi finali per confidence
        bestPrices.sort((a, b) => b.confidence - a.confidence);
        
        return bestPrices.slice(0, 10); // Massimo 10 prezzi
    }

    /**
     * ✅ NUOVO: Fallback per siti che caricano prezzi via JavaScript
     */
    async detectPricesFromUrlPattern(url) {
        console.log('🔍 Tentativo rilevazione prezzo da pattern URL...');
        
        try {
            // Pattern comuni per ID prodotto nei URL
            const productIdPatterns = [
                /\/p\/[^\/]*_p(\d+)\.html/,  // LightInTheBox: _p15473123.html
                /\/dp\/([A-Z0-9]{10})/,      // Amazon: /dp/B08N5WRWNW
                /\/item\/(\d+)\.html/,       // AliExpress
                /\/products\/(\d+)/,         // Shopify
            ];
            
            for (const pattern of productIdPatterns) {
                const match = url.match(pattern);
                if (match) {
                    console.log(`📋 Trovato product ID: ${match[1]}`);
                    
                    // Qui potresti implementare:
                    // 1. API call diretta (se disponibile)
                    // 2. Headless browser per questo specifico prodotto
                    // 3. Cache lookup da precedenti scraping
                    
                    break;
                }
            }
            
            return {
                status: 'javascript_required',
                detectedPrices: [],
                note: 'Sito richiede JavaScript per il caricamento prezzi',
                suggestion: 'Utilizzare Playwright/Puppeteer per siti come ' + new URL(url).hostname
            };
            
        } catch (error) {
            return {
                status: 'error',
                detectedPrices: [],
                detectionErrors: [error.message]
            };
        }
    }

    /**
     * Helper functions (rimangono uguali)
     */
    isValidPriceValue(numericValue) {
        return numericValue >= 0.50 && numericValue <= 50000 && 
               !isNaN(numericValue) && isFinite(numericValue);
    }

    isStrikethrough($element, $) {
        const tagName = $element.prop('tagName').toLowerCase();
        const classes = ($element.attr('class') || '').toLowerCase();
        
        return tagName === 's' || 
               classes.includes('strike') || 
               classes.includes('crossed') ||
               classes.includes('was') ||
               (classes.includes('regular') && classes.includes('compare'));
    }

    isElementProminent($element, $) {
        const tag = $element.prop('tagName').toLowerCase();
        const classes = ($element.attr('class') || '').toLowerCase();
        
        if (['h1', 'h2', 'h3', 'strong', 'b'].includes(tag)) {
            return true;
        }
        
        const prominentKeywords = [
            'main', 'primary', 'large', 'big', 'featured',
            'highlight', 'current', 'active', 'special'
        ];
        
        return prominentKeywords.some(keyword => classes.includes(keyword));
    }

generateCssSelector(element, $) {
    try {
        // ✅ Cache per evitare ricalcoli
        if (element._cachedSelector) return element._cachedSelector;
        
        const tagName = element.prop('tagName')?.toLowerCase();
        const id = element.attr('id');
        const classes = element.attr('class');
        
        let selector;
        
        // Se ha un ID unico, usalo
        if (id && $(`#${id}`).length === 1) {
            selector = `${tagName}#${id}`;
        } else if (classes) {
            const classList = classes.split(' ').filter(cls => cls.trim() !== '');
            
            // ✅ Per Zalando: mantieni le classi importanti
            if (classList.includes('voFjEy')) {
                const importantClasses = classList.filter(cls => 
                    cls === 'voFjEy' || 
                    cls.startsWith('_') ||  // Classi Zalando tipo _4sa1cA
                    cls.includes('price') || 
                    cls.includes('money') ||
                    cls.includes('cost')
                ).slice(0, 2); // Max 2 classi per performance
                
                if (importantClasses.length > 0) {
                    selector = `${tagName}.${importantClasses.join('.')}`;
                } else {
                    selector = `${tagName}.${classList[0]}`;
                }
            } else {
                // Per altri siti: usa le prime 2 classi più significative
                const significantClasses = classList.filter(cls => 
                    cls.includes('price') || 
                    cls.includes('money') || 
                    cls.includes('cost') || 
                    cls.includes('amount')
                ).slice(0, 2);
                
                if (significantClasses.length > 0) {
                    selector = `${tagName}.${significantClasses.join('.')}`;
                } else {
                    selector = `${tagName}.${classList.slice(0, 2).join('.')}`;
                }
            }
        } else {
            selector = tagName;
        }
        
        // ✅ Cache il risultato
        element._cachedSelector = selector;
        return selector;
        
    } catch (error) {
        console.error(`❌ Errore generazione CSS selector:`, error);
        return 'unknown';
    }
}

    getParentClasses($element, $) {
        const parentClasses = [];
        let current = $element.parent();
        
        for (let i = 0; i < 4 && current.length; i++) {
            const classes = current.attr('class');
            if (classes) {
                parentClasses.push(...classes.split(' ').filter(c => c.trim().length > 0));
            }
            current = current.parent();
        }
        
        return [...new Set(parentClasses)];
    }

    getNearbyText($element, $) {
        try {
            const siblings = $element.siblings();
            const parent = $element.parent();
            
            let context = '';
            
            siblings.each((i, sibling) => {
                const siblingText = $(sibling).text().trim();
                if (siblingText.length > 0 && siblingText.length < 50) {
                    context += siblingText + ' ';
                }
            });
            
            const parentText = parent.text().trim();
            if (parentText.length < 100) {
                context += parentText;
            }
            
            return context.trim().substring(0, 150);
        } catch (error) {
            return '';
        }
    }

/**
     * Formatta il risultato finale
     */
formatResult(prices) {
    if (prices.length === 0) {
        return {
            status: 'no_prices_detected',
            detectedPrices: [],
            detectionErrors: ['Nessun prezzo rilevato nella pagina']
        };
    }
    
    // ✅ AGGIUNGI position.index dopo l'ordinamento finale
    const pricesWithPosition = prices.map((price, index) => ({
        ...price,
        position: {
            depth: 0,
            index: index,  // ← Index progressivo nell'array ordinato
        }
    }));
    
    if (pricesWithPosition.length === 1) {
        return {
            status: 'single_price',
            detectedPrices: pricesWithPosition
        };
    }
    
    const uniqueValues = [...new Set(pricesWithPosition.map(p => p.numericValue))];
    
    if (uniqueValues.length === 1) {
        return {
            status: 'single_price',
            detectedPrices: pricesWithPosition,
            note: 'Più elementi con stesso prezzo, selezione automatica'
        };
    }
    
    return {
        status: 'multiple_prices',
        detectedPrices: pricesWithPosition,
        note: `${uniqueValues.length} prezzi diversi rilevati`
    };
}

    /**
     * Test di un CSS selector specifico
     */
    async testCssSelector(htmlContent, cssSelector, expectedPrice = null) {
        try {
            const $ = cheerio.load(htmlContent);
            const element = $(cssSelector);
            
            if (element.length === 0) {
                return {
                    success: false,
                    error: 'Selector non trova elementi'
                };
            }
            
            const text = element.text().trim();
            const prices = this.extractPricesFromText(text);
            
            if (prices.length === 0) {
                return {
                    success: false,
                    error: 'Nessun prezzo trovato nel selector'
                };
            }
            
            const foundPrice = prices[0];
            
            if (expectedPrice && Math.abs(foundPrice.numericValue - expectedPrice) > 0.01) {
                return {
                    success: false,
                    error: `Prezzo trovato (${foundPrice.numericValue}) diverso da atteso (${expectedPrice})`
                };
            }
            
            return {
                success: true,
                foundPrice: foundPrice,
                elementText: text
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Estrae prezzi da testo (legacy per compatibilità)
     */
    extractPricesFromText(text) {
        const prices = [];
        const seenValues = new Set();
        
        for (const pattern of this.universalPricePatterns) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const fullMatch = match[0];
                const numericPart = match[1];
                
                if (numericPart) {
                    const numericValue = this.parseNumericValue(numericPart);
                    
                    if (this.isValidPriceValue(numericValue)) {
                        const key = numericValue.toString();
                        
                        if (!seenValues.has(key)) {
                            seenValues.add(key);
                            prices.push({
                                value: fullMatch.trim(),
                                numericValue: numericValue
                            });
                        }
                    }
                }
            }
        }
        
        return prices;
    }

    /**
     * ✅ NUOVO: Test specifico per LightInTheBox pattern
     */
    testLightInTheBoxPatterns(htmlContent) {
        console.log('🧪 Test pattern LightInTheBox:');
        
        const testPatterns = [
            { name: 'Title $199.99', pattern: /a \$(\d+\.\d{2})/ },
            { name: 'Meta desc $199.99', pattern: /\$(\d+\.\d{2}) per/ },
            { name: 'Generic $XX.XX', pattern: /\$(\d+\.\d{2})/g },
            { name: 'Price in title tag', pattern: /<title[^>]*>.*?\$(\d+\.\d{2}).*?<\/title>/i },
            { name: 'Meta description', pattern: /<meta[^>]*name="description"[^>]*content="[^"]*\$(\d+\.\d{2})[^"]*"/i },
            { name: 'JSON price pattern', pattern: /"price":\s*"?\$?(\d+\.?\d{0,2})"?/g },
            { name: 'Data price attribute', pattern: /data-price="?\$?(\d+\.?\d{0,2})"?/gi }
        ];
        
        testPatterns.forEach(({name, pattern}) => {
            const matches = htmlContent.match(pattern);
            if (matches) {
                console.log(`✅ ${name}: Trovato ${matches.length > 1 ? matches.length + ' prezzi' : matches[1] || matches[0]}`);
            } else {
                console.log(`❌ ${name}: Nessun risultato`);
            }
        });
        
        return testPatterns;
    }

    /**
     * ✅ NUOVO: Metodo di debug per analizzare HTML problematici
     */
    debugAnalyzeHtml(htmlContent, url = null) {
        console.log(`🔧 DEBUG: Analisi dettagliata HTML per: ${url || 'URL non specificato'}`);
        
        try {
            const $ = cheerio.load(htmlContent);
            
            // Analisi generale
            console.log(`📊 Statistiche HTML:`);
            console.log(`   - Lunghezza totale: ${htmlContent.length} caratteri`);
            console.log(`   - Elementi totali: ${$('*').length}`);
            console.log(`   - Script tags: ${$('script').length}`);
            console.log(`   - Elementi con class*="price": ${$('[class*="price"]').length}`);
            console.log(`   - Elementi con id*="price": ${$('[id*="price"]').length}`);
            console.log(`   - Data-price attributes: ${$('[data-price]').length}`);
            
            // Analisi title e meta
            const title = $('title').text() || '';
            const metaDesc = $('meta[name="description"]').attr('content') || '';
            
            console.log(`📋 Contenuto meta:`);
            console.log(`   - Title: "${title.substring(0, 150)}..."`);
            console.log(`   - Meta desc: "${metaDesc.substring(0, 150)}..."`);
            
            // Test pattern specifici
            this.testLightInTheBoxPatterns(htmlContent);
            
            // Cerca tutti i numeri che potrebbero essere prezzi
            const allNumbers = htmlContent.match(/\d+[.,]\d{2}/g) || [];
            console.log(`🔢 Numeri con formato prezzo trovati: ${allNumbers.length}`);
            if (allNumbers.length > 0) {
                const uniqueNumbers = [...new Set(allNumbers)].slice(0, 10);
                console.log(`   Primi 10 numeri unici: ${uniqueNumbers.join(', ')}`);
            }
            
            return {
                htmlLength: htmlContent.length,
                totalElements: $('*').length,
                priceElements: $('[class*="price"]').length,
                dataPriceElements: $('[data-price]').length,
                title: title,
                metaDescription: metaDesc,
                potentialPriceNumbers: allNumbers.length,
                testResults: this.testLightInTheBoxPatterns(htmlContent)
            };
            
        } catch (error) {
            console.error('❌ Errore nell\'analisi debug:', error);
            return {
                error: error.message
            };
        }
    }

    /**
     * ✅ NUOVO: Metodo per forzare estrazione da title/meta (per test)
     */
    forceExtractFromTitleMeta(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const results = this.extractPricesFromTitleAndMeta($);
            
            console.log(`🎯 Estrazione forzata da title/meta:`);
            results.forEach((price, index) => {
                console.log(`   ${index + 1}. ${price.value} da ${price.source} (confidence: ${price.confidence})`);
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Errore estrazione forzata:', error);
            return [];
        }
    }
}

module.exports = { PriceDetectorService };