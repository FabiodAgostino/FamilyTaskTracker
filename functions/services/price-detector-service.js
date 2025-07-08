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
            const jsonPrices = this.extractJsonPrices(htmlContent);
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
    extractJsonPrices(htmlContent) {
        const prices = [];
        const seenValues = new Set();

        for (const pattern of this.jsonPatterns) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(htmlContent)) !== null) {
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
                            
                            // ✅ MIGLIORATO: Determina simbolo valuta dal contesto
                            let currencySymbol = '$'; // Default per LightInTheBox
                            if (rawValue.includes('€') || rawValue.includes('EUR')) {
                                currencySymbol = '€';
                            } else if (rawValue.includes('£') || rawValue.includes('GBP')) {
                                currencySymbol = '£';
                            }
                            
                            prices.push({
                                value: `${currencySymbol}${finalPrice.toFixed(2)}`,
                                numericValue: finalPrice,
                                cssSelector: '[data-json-price]',
                                confidence: 0.85,
                                source: 'json',
                                conversionType: conversionType,
                                parentClasses: [],
                                elementText: `JSON: ${rawValue} → ${currencySymbol}${finalPrice.toFixed(2)}`,
                                context: { nearbyText: '', isProminent: true }
                            });
                        }
                        
                    } catch (e) {
                        // JSON non valido, ignora
                    }
                }
            }
        }

        return prices;
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
            
            // Bonus per essere in più elementi (più affidabile)
            if (prices.length > 1) {
                bestPrice.confidence += Math.min(0.2, prices.length * 0.05);
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

    generateCssSelector($element, $) {
        const tagName = $element.prop('tagName').toLowerCase();
        const id = $element.attr('id');
        const classes = $element.attr('class');
        
        if (id) {
            return `#${id}`;
        }
        
        if (classes) {
            const classArray = classes.split(' ').filter(c => c.trim().length > 0);
            const relevantClasses = classArray.filter(c => 
                c.includes('price') || c.includes('money') || c.includes('current') || c.includes('sale')
            );
            
            if (relevantClasses.length > 0) {
                return `${tagName}.${relevantClasses.slice(0, 2).join('.')}`;
            }
            
            if (classArray.length > 0) {
                return `${tagName}.${classArray.slice(0, 2).join('.')}`;
            }
        }
        
        return tagName;
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
        
        if (prices.length === 1) {
            return {
                status: 'single_price',
                detectedPrices: prices,
                selectedPrice: prices[0]
            };
        }
        
        // Verifica se tutti i prezzi sono uguali (deduplicazione by value)
        const uniqueValues = [...new Set(prices.map(p => p.numericValue))];
        
        if (uniqueValues.length === 1) {
            return {
                status: 'single_price',
                detectedPrices: prices,
                selectedPrice: prices[0],
                note: 'Più elementi con stesso prezzo, selezione automatica'
            };
        }
        
        return {
            status: 'multiple_prices',
            detectedPrices: prices,
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