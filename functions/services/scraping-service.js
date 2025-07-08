const { WebScraper } = require('./web-scraper');
const { DeepSeekClient } = require('./deepseek-client');
const { ContentExtractor } = require('./content-extractor');
const { getFirestore } = require('firebase-admin/firestore');
class ScrapingService {

    constructor() {
        this.db = getFirestore();
        
        // ✅ Configura Firestore per ignorare undefined
        this.db.settings({
            ignoreUndefinedProperties: true
        });
}

    logFinalResultWithPrices(result, processingTime) {
    const status = result.success ? '✅' : '❌';
    const mode = result.mode || 'unknown';
    const site = result.site || 'unknown';
    
    console.log(`${status} Final result [${mode}] for ${site}:`);
    console.log(`   Product: ${result.name}`);
    console.log(`   Brand: ${result.brandName || 'N/A'}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Processing time: ${processingTime}ms`);
    
    // 🔴 Logging prezzi multipli
    if (result.priceDetectionResult) {
        const priceInfo = result.priceDetectionResult;
        console.log(`   💰 Price detection: ${priceInfo.status}`);
        console.log(`   💰 Detected prices: ${priceInfo.detectedPrices.length}`);
        
        if (priceInfo.selectedPrice) {
            console.log(`   💰 Selected price: ${priceInfo.selectedPrice.value}`);
        }
        
        if (priceInfo.needsSelection) {
            console.log(`   ⚠️ Needs user price selection`);
        }
    } else if (result.estimatedPrice) {
        console.log(`   💰 Price: ${result.estimatedPrice}`);
    } else {
        console.log(`   💸 No price detected`);
    }
    
    if (result.error) {
        console.log(`   Error: ${typeof result.error === 'object' ? result.error.message : result.error}`);
    }
}


    /**
     * Scraping completo con aggiornamento automatico Firestore
     */
    async ScrapingAndRefine(url, options = {}) {
        console.log(`🚀 Starting scraping pipeline with multiple price detection for: ${url}`);
        const startTime = Date.now();
        
        const {
            updateFirestore = true,
            collectionName = 'shopping_items',
            returnUpdatedDoc = true
        } = options;

        const scraper = new WebScraper({
            useRealHeaders: true,
            enableDelays: true,
            maxRetries: 1
        });

        let finalResult;

        try {
            // STEP 1: Scraping principale
            console.log('🌐 Tentativo di scraping...');
            
            const scrapingResult = await scraper.scrapeComplete(url, {
                useNavigation: false,
                fallbackToAggressive: true
            });
            const detectedPrices = scrapingResult.content.detectedPrices;

            if (scrapingResult.success) {
                console.log('✅ Scraping completato, analizzando prezzi...');
                
               

                
                console.log(`💰 Rilevati ${detectedPrices.length} prezzi nella pagina`);
                
                // 🔴 STEP 3: NUOVO - Decisione su come procedere
                if (detectedPrices.length === 0) {
                    // Nessun prezzo trovato - procedura normale con DeepSeek
                    console.log('❌ Nessun prezzo rilevato, usando DeepSeek per analisi completa...');
                    finalResult = await this.processWithDeepSeek(scrapingResult, url);
                    finalResult.priceDetectionResult = {
                        detectedPrices: [],
                        status: 'no_prices_detected',
                        needsSelection: false
                    };
                    
                } else if (detectedPrices.length === 1) {
                    // Un solo prezzo - selezione automatica + DeepSeek per altri dati
                    console.log('✅ Un solo prezzo rilevato, procedura automatica...');
                    const singlePrice = detectedPrices[0];
                    
                    // Usa DeepSeek ma senza fargli estrarre il prezzo
                    finalResult = await this.processWithDeepSeekNoPriceExtraction(scrapingResult, url);
                    
                    // Sovrascrivi con il prezzo rilevato automaticamente
                    finalResult.estimatedPrice = singlePrice.numericValue;
                    finalResult.priceDetectionResult = {
                        detectedPrices: detectedPrices,
                        status: 'single_price',
                        needsSelection: false,
                        selectedPrice: singlePrice
                    };
                    
                } else {
                    // Prezzi multipli - NO DeepSeek, necessita selezione utente
                    console.log(`⚠️ ${detectedPrices.length} prezzi rilevati, necessita selezione utente`);
                    
                    // Estrai solo metadati base con DeepSeek (senza prezzo)
                    finalResult = await this.processWithDeepSeekNoPriceExtraction(scrapingResult, url);
                    
                    // Non impostare estimatedPrice, sarà impostato quando l'utente seleziona
                    finalResult.estimatedPrice = null;
                    finalResult.priceDetectionResult = {
                        detectedPrices: detectedPrices,
                        status: 'multiple_prices',
                        needsSelection: true
                    };
                }
                
                console.log(`✅ Scraping completato con successo in ${Date.now() - startTime}ms`);
                
            } else {
                throw new Error(`Scraping fallito: ${scrapingResult.error}`);
            }
            
        } catch (scrapingError) {
            // STEP 4: Fallback completo - DeepSeek con URL (logica esistente)
            console.log('❌ Scraping fallito, usando fallback URL con DeepSeek...');
            console.log(`Errore: ${scrapingError.message}`);
            
            try {
                const urlFallbackResult = await DeepSeekClient.callDeepSeekWithRetry(
                    url, 
                    false, // modalità URL
                    url,
                    1
                );
                
                const urlInfo = ContentExtractor.extractInfoFromUrl(url);
                finalResult = {
                    ...urlFallbackResult,
                    ...urlInfo,
                    fallbackReason: scrapingError.message,
                    processingTime: Date.now() - startTime,
                    priceDetectionResult: {
                        detectedPrices: [],
                        status: 'fallback_mode',
                        needsSelection: false
                    }
                };
                
                console.log(`⚠️ Fallback URL completato in ${Date.now() - startTime}ms`);
                
            } catch (deepseekError) {
                console.error('❌ Anche DeepSeek fallback è fallito:', deepseekError.message);
                
                finalResult = createManualFallback(url, scrapingError.message, deepseekError.message);
                finalResult.processingTime = Date.now() - startTime;
                finalResult.priceDetectionResult = {
                    detectedPrices: [],
                    status: 'error',
                    needsSelection: false
                };
            }
        }

        // STEP 5: Post-processing finale
        finalResult = postProcessResult(finalResult, url);
        
        // 🔴 STEP 6: NUOVO - Aggiornamento Firestore con nuova struttura
        let updatedDocument = null;
        if (updateFirestore) {
            try {
                updatedDocument = await this.updateFirestoreDocumentWithPrices(url, finalResult, collectionName);
                console.log(`📝 Documento Firestore aggiornato: ${updatedDocument.id}`);
            } catch (firestoreError) {
                console.error('❌ Errore aggiornamento Firestore:', firestoreError.message);
                finalResult.firestoreError = firestoreError.message;
            }
        }
        
        // STEP 7: Logging finale
        this.logFinalResultWithPrices(finalResult, Date.now() - startTime);

        return {
            scrapingResult: finalResult,
            firestoreDocument: returnUpdatedDoc ? updatedDocument : null,
            success: true,
            processingTimeMs: Date.now() - startTime
        };
    }


    /**
     * 🆕 Processa con DeepSeek ma escludendo estrazione prezzo
     */
    async processWithDeepSeekNoPriceExtraction(scrapingResult, url) {
        const modifiedPrompt = `Sei un estrattore JSON esperto. Il tuo compito è analizzare contenuti HTML di pagine prodotto e restituire solo JSON valido senza commenti, markdown o testo aggiuntivo.

Per questa pagina prodotto, estrai queste informazioni in formato JSON (ESCLUDI IL PREZZO):
- name (string): il nome/titolo del prodotto
- brandName (string): il nome del brand con iniziali maiuscole  
- site (string): il nome del sito web (es: "Amazon", "eBay", "AliExpress")
- url (string): l'URL completo della pagina
- imageUrl (string): URL dell'immagine principale del prodotto (solo se presente e valido)
- category (string): categoria del prodotto (es: "Elettronica", "Casa", "Abbigliamento")

IMPORTANTE: NON estrarre il prezzo, sarà gestito separatamente.

Regole:
1. Restituisci SOLO JSON valido, niente altro
2. Se un campo non è disponibile, usa stringa vuota ""
3. Il nome deve essere il titolo principale del prodotto`;

        try {
            // Usa il sistema DeepSeek esistente ma con prompt modificato
            const conversationId = DeepSeekClient.generateConversationId(url);
            await DeepSeekClient.initializeConversation(conversationId, url);
            
            const result = await DeepSeekClient.analyzeHtmlWithContext(
                conversationId,
                scrapingResult.content.text,
                url
            );
            
            return result;
            
        } catch (error) {
            console.error('❌ Errore DeepSeek no-price:', error);
            
            // Fallback con estrazione manuale base
            const urlInfo = ContentExtractor.extractInfoFromUrl(url);
            return {
                ...urlInfo,
                error: error.message,
                mode: 'manual_extraction',
                timestamp: new Date().toISOString(),
                success: false
            };
        }
    }

    /**
     * 🆕 Processa con DeepSeek normale (per retrocompatibilità)
     */
    async processWithDeepSeek(scrapingResult, url) {
        return await DeepSeekClient.callDeepSeekWithRetry(
            scrapingResult.content.text, 
            true,
            url,
            2
        );
    }

    /**
     * Aggiorna il documento Firestore con i risultati del scraping
     */
     async updateFirestoreDocumentWithPrices(url, scrapingResult, collectionName = 'shopping_items') {
        try {
            console.log(`🔍 Cercando documento con URL: ${url}`);
            
            const querySnapshot = await this.db
                .collection(collectionName)
                .where('link', '==', url)
                .limit(1)
                .get();

            if (querySnapshot.empty) {
                console.log(`⚠️ Nessun documento trovato con URL: ${url}`);
                return null;
            }

            const docRef = querySnapshot.docs[0].ref;
            const existingData = querySnapshot.docs[0].data();
            
            // Prepara i dati base
            const updateData = {
                name: scrapingResult.name || existingData.name,
                brandName: scrapingResult.brandName || existingData.brandName,
                category: scrapingResult.category || existingData.category,
                imageUrl: scrapingResult.imageUrl || existingData.imageUrl,
                scrapingText: scrapingResult.scraping,
                
                // Metadati scraping
                scrapingData: {
                    lastScraped: new Date(),
                    scrapingMode: scrapingResult.mode,
                    scrapingSuccess: scrapingResult.success || false,
                    processingTime: scrapingResult.processingTime,
                    errors: scrapingResult.error || null
                },
                
                updatedAt: new Date()
            };

            // 🔴 GESTIONE PREZZI MULTIPLI
            const priceDetection = scrapingResult.priceDetectionResult;
            
            if (priceDetection) {
                if (priceDetection.status === 'single_price' && priceDetection.selectedPrice) {
                    // Un solo prezzo - aggiorna direttamente
                    updateData.estimatedPrice = priceDetection.selectedPrice.numericValue;
                    updateData.priceSelection = {
                        status: 'single_price',
                        detectedPrices: priceDetection.detectedPrices,
                        selectedPriceIndex: 0,
                        selectedCssSelector: priceDetection.selectedPrice.cssSelector,
                        selectionTimestamp: new Date(),
                        lastDetectionAttempt: new Date()
                    };
                    updateData.needsPriceSelection = false;
                    
                } else if (priceDetection.status === 'multiple_prices') {
                    // Prezzi multipli - necessita selezione
                    updateData.priceSelection = {
                        status: 'needs_selection',
                        detectedPrices: priceDetection.detectedPrices,
                        lastDetectionAttempt: new Date()
                    };
                    updateData.needsPriceSelection = true;
                    // Non aggiornare estimatedPrice
                    
                } else if (priceDetection.status === 'no_prices_detected') {
                    // Nessun prezzo rilevato - usa DeepSeek result se disponibile
                    if (scrapingResult.estimatedPrice) {
                        updateData.estimatedPrice = scrapingResult.estimatedPrice;
                    }
                    updateData.priceSelection = {
                        status: 'error',
                        detectedPrices: [],
                        detectionErrors: ['Nessun prezzo rilevato durante lo scraping'],
                        lastDetectionAttempt: new Date()
                    };
                    updateData.needsPriceSelection = false;
                }
            } else {
                // Fallback ai vecchi dati di prezzo
                if (scrapingResult.estimatedPrice) {
                    updateData.estimatedPrice = scrapingResult.estimatedPrice;
                }
                updateData.needsPriceSelection = false;
            }

            // Aggiorna il documento
            await docRef.update(updateData);
            
            // Ritorna il documento aggiornato
            const updatedDoc = await docRef.get();
            return {
                id: updatedDoc.id,
                data: updatedDoc.data()
            };
            
        } catch (error) {
            console.error('❌ Errore in updateFirestoreDocumentWithPrices:', error);
            throw error;
        }
    }


    /**
     * Metodo per scraping senza aggiornamento Firestore (se preferisci gestirlo nel frontend)
     */
    async scrapingOnly(url) {
        return await this.ScrapingAndRefine(url, { 
            updateFirestore: false,
            returnUpdatedDoc: false 
        });
    }

    /**
     * Aggiornamento manuale del documento (per chiamate esterne)
     */
    async updateShoppingItem(url, scrapingData, collectionName = 'shopping_items') {
        return await this.updateFirestoreDocument(url, scrapingData, collectionName);
    }
}

/**
 * Arricchisce il risultato con metadati del scraping
 */
function enhanceResult(analysisResult, scrapingResult) {
    return {
        ...analysisResult,
        metadata: {
            ...analysisResult.metadata,
            scrapingSuccess: true,
            originalContentLength: scrapingResult.metadata.originalLength,
            cleanedContentLength: scrapingResult.metadata.cleanedLength,
            isJavaScriptHeavy: scrapingResult.metadata.isJSHeavy,
            contentType: scrapingResult.metadata.contentType,
            aggressivePrice: scrapingResult.aggressivePrice || null
        }
    };
}

/**
 * Crea fallback manuale quando tutto fallisce
 */
function createManualFallback(url, scrapingError, deepseekError) {
    try {
        const urlObj = new URL(url);
        const urlInfo = ContentExtractor.extractInfoFromUrl(url);
        
        return {
            ...urlInfo,
            estimatedPrice: null,
            url: url,
            imageUrl: '',
            error: {
                scraping: scrapingError,
                deepseek: deepseekError,
                message: 'Tutti i tentativi falliti, utilizzando dati URL'
            },
            mode: 'manual_fallback',
            timestamp: new Date().toISOString(),
            success: false
        };
        
    } catch (urlError) {
        return {
            name: 'Errore completo',
            brandName: '',
            estimatedPrice: null,
            site: 'N/A',
            url: url,
            imageUrl: '',
            category: 'N/A',
            error: {
                scraping: scrapingError,
                deepseek: deepseekError,
                url: urlError.message,
                message: 'Errore totale in tutti i sistemi'
            },
            mode: 'total_failure',
            timestamp: new Date().toISOString(),
            success: false
        };
    }
}

function postProcessResult(result, url) {
    // Assicura campi minimi
    if (!result.site && url) {
        try {
            result.site = new URL(url).hostname;
        } catch {}
    }
    
    if (!result.url) {
        result.url = url;
    }
    
    // Normalizza brand
    if (result.brandName && typeof result.brandName === 'string') {
        result.brandName = result.brandName.trim();
    }
    
    // ✅ MIGLIORATO: Rimuovi il brand dal nome del prodotto con strategia multi-approccio
    if (result.name && result.name && 
        typeof result.name === 'string' && 
        typeof result.brandName === 'string') {
        
        const brandName = result.brandName.trim();
        let productName = result.name.trim();
        
        if (brandName.length > 0) {
            console.log(`🔍 Controllo rimozione brand "${brandName}" da "${productName}"`);
            
            let cleanedName = productName;
            
            // ✅ STRATEGIA 1: Rimozione esatta (case-insensitive) con word boundaries
            const exactRegex = new RegExp(`\\b${escapeRegExp(brandName)}\\b`, 'gi');
            let testClean = productName.replace(exactRegex, '').replace(/\s+/g, ' ').trim();
            
            if (testClean !== productName && testClean.length > 0) {
                cleanedName = testClean;
            } else {
                // ✅ STRATEGIA 2: Rimozione dall'inizio (es. "Nike Air Max" → "Air Max")
                const startRegex = new RegExp(`^${escapeRegExp(brandName)}\\s*[\\s\\-\\|\\:]*\\s*`, 'gi');
                testClean = productName.replace(startRegex, '').trim();
                
                if (testClean !== productName && testClean.length > 0) {
                    cleanedName = testClean;
                } else {
                    // ✅ STRATEGIA 3: Rimozione dalla fine (es. "Air Max Nike" → "Air Max")
                    const endRegex = new RegExp(`\\s*[\\s\\-\\|\\:]*\\s*${escapeRegExp(brandName)}$`, 'gi');
                    testClean = productName.replace(endRegex, '').trim();
                    
                    if (testClean !== productName && testClean.length > 0) {
                        cleanedName = testClean;
                    } else {
                        // ✅ STRATEGIA 4: Prova con variazioni del brand (NIKE, nike, Nike)
                        const brandVariations = [
                            brandName.toLowerCase(),
                            brandName.toUpperCase(),
                            brandName.charAt(0).toUpperCase() + brandName.slice(1).toLowerCase()
                        ];
                        
                        for (const variation of brandVariations) {
                            if (variation !== brandName) { // Evita duplicati
                                const variationRegex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
                                testClean = productName.replace(variationRegex, '').replace(/\s+/g, ' ').trim();
                                
                                if (testClean !== productName && testClean.length > 0) {
                                    cleanedName = testClean;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // ✅ VALIDAZIONE FINALE: Il risultato deve essere sensato
            if (cleanedName !== productName && cleanedName.length >= 3 && /[a-zA-Z]/.test(cleanedName)) {
                // Pulizia finale: rimuovi caratteri strani dall'inizio/fine
                cleanedName = cleanedName
                    .replace(/^[\s\-\|:]+/, '')  // Caratteri strani dall'inizio
                    .replace(/[\s\-\|:]+$/, '')  // Caratteri strani dalla fine
                    .replace(/\s+/g, ' ')        // Normalizza spazi multipli
                    .trim();
                
                if (cleanedName.length >= 3) {
                    console.log(`✅ Brand "${brandName}" rimosso dal prodotto. Prima: "${productName}" → Dopo: "${cleanedName}"`);
                    result.name = cleanedName;
                } else {
                    console.log(`⚠️ Rimozione brand scartata: risultato troppo corto ("${cleanedName}")`);
                }
            } else {
                console.log(`ℹ️ Brand "${brandName}" non trovato o già assente in "${productName}"`);
            }
        }
    }
    
    // Normalizza prezzo
    if (result.estimatedPrice && typeof result.estimatedPrice === 'string') {
        result.estimatedPrice = result.estimatedPrice.trim();
        // Se è "null" string, convertilo a null
        if (result.estimatedPrice.toLowerCase() === 'null' || result.estimatedPrice === 'N/A') {
            result.estimatedPrice = null;
        }
    }
    
    // Aggiungi flag di successo
    if (!('success' in result)) {
        result.success = !result.error;
    }
    
    // Aggiungi timestamp se mancante
    if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
    }
    
    return result;
}

/**
 * ✅ UTILITY: Escape caratteri speciali per regex
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Logging per monitoring e debugging
 */
function logFinalResult(result, processingTime) {
    const status = result.success ? '✅' : '❌';
    const mode = result.mode || 'unknown';
    const site = result.site || 'unknown';
    const hasPrice = result.estimatedPrice ? '💰' : '💸';
    
    console.log(`${status} Final result [${mode}] for ${site}:`);
    console.log(`   Product: ${result.name}`);
    console.log(`   Brand: ${result.brandName || 'N/A'}`);
    console.log(`   ${hasPrice} Price: ${result.estimatedPrice || 'N/A'}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Processing time: ${processingTime}ms`);
    
    if (result.error) {
        console.log(`   Error: ${typeof result.error === 'object' ? result.error.message : result.error}`);
    }
    
    // Metrics per monitoring (se disponibile)
    if (typeof reportMetric === 'function') {
        try {
            reportMetric('scraping_success', result.success ? 1 : 0);
            reportMetric('processing_time_ms', processingTime);
            reportMetric('has_price', result.estimatedPrice ? 1 : 0);
        } catch (e) {
            // Ignore metric errors
        }
    }
}

// Export singleton instance
const scraperService = new ScrapingService();
module.exports = { scraperService };