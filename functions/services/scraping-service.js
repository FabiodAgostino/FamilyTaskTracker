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
    
    // resto del codice...
}

    /**
     * Scraping completo con aggiornamento automatico Firestore
     */
    async ScrapingAndRefine(url, options = {}) {
        console.log(`🚀 Starting scraping pipeline for: ${url}`);
        const startTime = Date.now();
        
        // Opzioni configurabili
        const {
            updateFirestore = true,      // Aggiorna automaticamente Firestore
            collectionName = 'shopping_items',  // Nome collezione
            returnUpdatedDoc = true      // Ritorna il documento aggiornato
        } = options;

        // Inizializza scraper con configurazione ottimale
        const scraper = new WebScraper({
            useRealHeaders: true,
            enableDelays: true,
            maxRetries: 1
        });

        let finalResult;

        try {
            // STEP 1: Tentativo di scraping principale
            console.log('🌐 Tentativo di scraping...');
            
            const scrapingResult = await scraper.scrapeComplete(url, {
                useNavigation: false,
                fallbackToAggressive: true
            });
            
            if (scrapingResult.success) {
                // STEP 2: Analisi con DeepSeek
                console.log('🤖 Analizzando contenuto con DeepSeek...');
                
                const analysisResult = await DeepSeekClient.callDeepSeekWithRetry(
                    scrapingResult.content.text, 
                    true, // modalità HTML
                    url,
                    2     // max 2 retry
                );
                
                // STEP 3: Verifica qualità risultato
                finalResult = enhanceResult(analysisResult, scrapingResult);
                
                console.log(`✅ Scraping completato con successo in ${Date.now() - startTime}ms`);
                
            } else {
                throw new Error(`Scraping fallito: ${scrapingResult.error}`);
            }
            
        } catch (scrapingError) {
            // STEP 4: Fallback completo - DeepSeek con URL
            console.log('❌ Scraping fallito, usando fallback URL con DeepSeek...');
            console.log(`Errore: ${scrapingError.message}`);
            
            try {
                const urlFallbackResult = await DeepSeekClient.callDeepSeekWithRetry(
                    url, 
                    false, // modalità URL
                    url,
                    1      // solo 1 retry per fallback
                );
                
                // Arricchisci con info dall'URL
                const urlInfo = ContentExtractor.extractInfoFromUrl(url);
                finalResult = {
                    ...urlFallbackResult,
                    ...urlInfo,
                    fallbackReason: scrapingError.message,
                    processingTime: Date.now() - startTime
                };
                
                console.log(`⚠️ Fallback URL completato in ${Date.now() - startTime}ms`);
                
            } catch (deepseekError) {
                // STEP 5: Fallback manuale finale
                console.error('❌ Anche DeepSeek fallback è fallito:', deepseekError.message);
                
                finalResult = createManualFallback(url, scrapingError.message, deepseekError.message);
                finalResult.processingTime = Date.now() - startTime;
                
                console.log(`🔧 Fallback manuale in ${Date.now() - startTime}ms`);
            }
        }

        // STEP 6: Post-processing e validazione finale
        finalResult = postProcessResult(finalResult, url);
        
        // STEP 7: Aggiornamento Firestore (se abilitato)
        let updatedDocument = null;
        if (updateFirestore) {
            try {
                updatedDocument = await this.updateFirestoreDocument(url, finalResult, collectionName);
                console.log(`📝 Documento Firestore aggiornato: ${updatedDocument.id}`);
            } catch (firestoreError) {
                console.error('❌ Errore aggiornamento Firestore:', firestoreError.message);
                // Non bloccare la risposta per errori Firestore
                finalResult.firestoreError = firestoreError.message;
            }
        }
        
        // STEP 8: Logging finale per monitoring
        logFinalResult(finalResult, Date.now() - startTime);

        // STEP 9: Risposta
        return {
            scrapingResult: finalResult,
            firestoreDocument: returnUpdatedDoc ? updatedDocument : null,
            success: true,
            processingTimeMs: Date.now() - startTime
        };
    }

    /**
     * Aggiorna il documento Firestore con i risultati del scraping
     */
    async updateFirestoreDocument(url, scrapingResult, collectionName = 'shopping_items') {
        try {
            console.log(`🔍 Cercando documento con URL: ${url}`);
            
            // Cerca il documento con questo URL
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
            
            // Prepara i dati di aggiornamento
            const updateData = {
                // Campi estratti dal scraping
                name: scrapingResult.nameProduct || existingData.name,
                brand: scrapingResult.nameBrand || existingData.brand,
                estimatedPrice: scrapingResult.price || existingData.estimatedPrice,
                category: scrapingResult.category || existingData.category,
                imageUrl: scrapingResult.imageUrl || existingData.imageUrl,
                
                // Metadati scraping
                scrapingData: {
                    lastScraped: new Date(),
                    scrapingMode: scrapingResult.mode,
                    scrapingSuccess: scrapingResult.success || false,
                    processingTime: scrapingResult.processingTime,
                    errors: scrapingResult.error || null
                },
                
                // Aggiorna timestamp
                updatedAt: new Date()
            };

            // Aggiorna il documento
            await docRef.update(updateData);
            
            // Ritorna il documento aggiornato
            const updatedDoc = await docRef.get();
            return {
                id: updatedDoc.id,
                data: updatedDoc.data()
            };
            
        } catch (error) {
            console.error('❌ Errore in updateFirestoreDocument:', error);
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
            price: null,
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
            nameProduct: 'Errore completo',
            nameBrand: '',
            price: null,
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

/**
 * Post-processing finale del risultato
 */
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
    if (result.nameBrand && typeof result.nameBrand === 'string') {
        result.nameBrand = result.nameBrand.trim();
    }
    
    // Normalizza prezzo
    if (result.price && typeof result.price === 'string') {
        result.price = result.price.trim();
        // Se è "null" string, convertilo a null
        if (result.price.toLowerCase() === 'null' || result.price === 'N/A') {
            result.price = null;
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
 * Logging per monitoring e debugging
 */
function logFinalResult(result, processingTime) {
    const status = result.success ? '✅' : '❌';
    const mode = result.mode || 'unknown';
    const site = result.site || 'unknown';
    const hasPrice = result.price ? '💰' : '💸';
    
    console.log(`${status} Final result [${mode}] for ${site}:`);
    console.log(`   Product: ${result.nameProduct}`);
    console.log(`   Brand: ${result.nameBrand || 'N/A'}`);
    console.log(`   ${hasPrice} Price: ${result.price || 'N/A'}`);
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
            reportMetric('has_price', result.price ? 1 : 0);
        } catch (e) {
            // Ignore metric errors
        }
    }
}

// Export singleton instance
const scraperService = new ScrapingService();
module.exports = { scraperService };