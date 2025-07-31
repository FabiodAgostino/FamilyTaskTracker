// ====================================
// functions/index.js - Entry point principale pulito (Gen 1)
// ====================================

const functions = require("firebase-functions/v1");  // 🔧 IMPORTA ESPLICITAMENTE V1
const admin = require('firebase-admin');
const { reminderService } = require('./services/reminder-service');
// Assicurati che sia inizializzato
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}


// Import dei servizi modulari
const { scraperService } = require('./services/scraping-service');
const { priceMonitorService } = require('./services/price-monitor-service');
const {getTtsCharacterCount, USAGE_THRESHOLD} = require('./services/big-query');
const {
    onDocumentChange,
    testRealtimeNotifications,
    getNotificationStatus
} = require('./services/realtime-notifications');

exports.onDocumentChange = onDocumentChange;


exports.scheduledPriceMonitoring = functions
    .region('europe-west1')  // Regione europea per migliori performance
    .runWith({
        timeoutSeconds: 540,  // 9 minuti timeout (il job può durare parecchio)
        memory: '1GB'         // Memoria aumentata per elaborazioni complesse
    })
    .pubsub
     .schedule('30 18 * * *')   // Cron: ogni giorno alle 9:00 AM
    .timeZone('Europe/Rome') // Fuso orario italiano
    .onRun(async (context) => {
        const startTime = Date.now();
        
        console.log('🌅 ===== AVVIO JOB SCHEDULATO MONITORAGGIO PREZZI =====');
        console.log(`🕘 Orario esecuzione: ${new Date().toLocaleString('it-IT')}`);
        console.log(`🆔 Job ID: ${context.eventId}`);
        console.log(`📅 Timestamp: ${context.timestamp}`);
        
        try {
            // Esegui il monitoraggio completo
            const result = await priceMonitorService.runDailyPriceMonitoring();
            
            const duration = Date.now() - startTime;
            const durationFormatted = Math.round(duration / 1000);
            
            if (result.changesSummary && result.changesSummary.length > 0) {
                console.log('💰 Dettagli cambiamenti:');
                result.changesSummary.forEach((change, index) => {
                    const item = change.itemData || change;
                    console.log(`  ${index + 1}. ${item.name}`);
                    if (change.changes?.priceChanged) {
                        console.log(`     💰 Prezzo: ${change.changes.oldPrice} → ${change.changes.newPrice}`);
                    }
                    if (change.changes?.availabilityChanged) {
                        console.log(`     📦 Disponibilità: ${change.changes.oldAvailability} → ${change.changes.newAvailability}`);
                    }
                });
            }
            
            console.log(`📊 Report salvato con Job ID: ${result.jobId}`);
            console.log('🎉 ===== JOB COMPLETATO CON SUCCESSO =====');
            
            // Ritorna risultato per Cloud Functions logging
            return {
                success: true,
                jobId: result.jobId,
                duration: durationFormatted,
                monitored: result.monitored,
                changes: result.changes,
                emailSent: result.emailData?.sent || false,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const durationFormatted = Math.round(duration / 1000);
            
            // Anche in caso di errore, ritorna informazioni utili
            return {
                success: false,
                error: error.message,
                duration: durationFormatted,
                jobId: context.eventId,
                timestamp: new Date().toISOString()
            };
        }
    });


exports.manageReminders = functions
    .region('europe-west1')
    .runWith({
        memory: '512MB',
        timeoutSeconds: 300
    })
    .https
    .onRequest(async (req, res) => {
        try {
            const result = await reminderService.handleRequest(req);
            res.status(200).json(result);
        } catch (error) {
            console.error('❌ Errore manageReminders:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });


// ====================================
// SCRAPING AUTOMATICO 🆕
// ====================================

// Alternativa con CORS più sicuro per produzione
exports.onShoppingItemCreated = functions
  .region('europe-west1')
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540
  })
  .https.onRequest(async (req, res) => {
    
    // ✅ CORS CONFIGURABILE PER AMBIENTE
    const allowedOrigins = [
      'http://localhost:3000',      // ✅ HTTP per sviluppo locale
      'https://localhost:3000',     // ✅ HTTPS per sviluppo locale
      'http://127.0.0.1:3000',      // ✅ HTTP con IP
      'https://127.0.0.1:3000',     // ✅ HTTPS con IP
      'https://fabiodagostino.github.io'  // ✅ Produzione
    ];

    const origin = req.get('Origin');
    const isAllowedOrigin = allowedOrigins.includes(origin) || !origin; // Nessun origin per richieste server-to-server

    // Imposta CORS headers
    if (isAllowedOrigin && origin) {
      res.set('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      res.set('Access-Control-Allow-Origin', '*'); // Per richieste dirette senza browser
    }
    
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Access-Control-Allow-Credentials', 'true');

    // Gestione preflight
    if (req.method === 'OPTIONS') {
      console.log(`🌐 CORS preflight from origin: ${origin}`);
      res.status(204).send('');
      return;
    }

    // Blocca origini non autorizzate in produzione
    if (origin && !isAllowedOrigin && process.env.NODE_ENV === 'production') {
      console.log(`🚫 Blocked request from unauthorized origin: ${origin}`);
      return res.status(403).json({ 
        error: 'Origin not allowed',
        success: false 
      });
    }

    // Verifica metodo
    if (req.method !== 'POST') {
      console.log(`❌ Method not allowed: ${req.method}`);
      return res.status(405).json({ 
        error: 'Method not allowed. Use POST.',
        success: false 
      });
    }

    const { url, updateFirestore = true, collectionName = 'shopping_items' } = req.body;
    
    if (!url || !url.startsWith('http')) {
      console.log(`❌ Invalid URL provided: ${url}`);
      return res.status(400).json({ 
        error: 'È richiesto un URL valido nel body della richiesta.',
        success: false 
      });
    }

    try {
      console.log(`🔗 Ricevuta richiesta di scraping da ${origin}: ${url}`);
      
      const result = await scraperService.ScrapingAndRefine(url, {
        updateFirestore,
        collectionName,
        returnUpdatedDoc: true
      });
      
      console.log(`✅ Scraping completato con successo per: ${url}`);
      
      return res
        .status(200)
        .set('Content-Type', 'application/json; charset=utf-8')
        .json({
          success: true,
          data: result.scrapingResult,
          firestoreDocument: result.firestoreDocument,
          processingTimeMs: result.processingTimeMs,
          timestamp: new Date().toISOString()
        });
        
    } catch (err) {
      console.error(`❌ Errore in onShoppingItemCreated:`, err);
      return res
        .status(500)
        .json({ 
          error: err.message || 'Errore interno del server',
          success: false,
          timestamp: new Date().toISOString()
        });
    }
  });





exports.textToSpeech = functions
  .region('europe-west1')
  .runWith({
    memory: '256MB',
    timeoutSeconds: 60
  })
  .https.onRequest(async (req, res) => {
    
    // ✅ CORS CONFIGURABILE PER AMBIENTE
    const allowedOrigins = [
      'http://localhost:3000',      // ✅ HTTP per sviluppo locale
      'https://localhost:3000',     // ✅ HTTPS per sviluppo locale
      'http://127.0.0.1:3000',      // ✅ HTTP con IP
      'https://127.0.0.1:3000',     // ✅ HTTPS con IP
      'https://fabiodagostino.github.io'  // ✅ Produzione
    ];

    const origin = req.get('Origin');
    const isAllowedOrigin = allowedOrigins.includes(origin) || !origin; // Nessun origin per richieste server-to-server

    // Imposta CORS headers
    if (isAllowedOrigin && origin) {
      res.set('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      res.set('Access-Control-Allow-Origin', '*'); // Per richieste dirette senza browser
    }
    
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Access-Control-Allow-Credentials', 'true');

    // Gestione preflight
    if (req.method === 'OPTIONS') {
      console.log(`🌐 CORS preflight from origin: ${origin}`);
      res.status(204).send('');
      return;
    }

    // Blocca origini non autorizzate in produzione
    if (origin && !isAllowedOrigin && process.env.NODE_ENV === 'production') {
      console.log(`🚫 Blocked request from unauthorized origin: ${origin}`);
      return res.status(403).json({ 
        error: 'Origin not allowed',
        success: false 
      });
    }

    // Verifica metodo
    if (req.method !== 'POST') {
      console.log(`❌ Method not allowed: ${req.method}`);
      return res.status(405).json({ 
        error: 'Method not allowed. Use POST.',
        success: false 
      });
    }
    const { text } = req.body;
    
    // Validazione input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.log(`❌ TTS: Invalid text provided`);
      return res.status(400).json({ 
        error: 'È richiesto un testo valido nel campo "text".',
        success: false 
      });
    }

    if (text.length > 5000) {
      console.log(`❌ TTS: Text too long: ${text.length} characters`);
      return res.status(400).json({ 
        error: 'Il testo non può superare i 5000 caratteri.',
        success: false 
      });
    }

    try {
      console.log(`🔊 TTS: Richiesta sintesi vocale da ${origin}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
       const currentUsage = await getTtsCharacterCount();
        console.log(`📈 Utilizzo attuale TTS: ${currentUsage} / ${FREE_TIER_LIMIT} caratteri.`);

        if (currentUsage >= FREE_TIER_LIMIT * USAGE_THRESHOLD) {
          console.log(`🚫 Quota Free Tier quasi esaurita. Utilizzo: ${currentUsage}. Blocco la richiesta.`);
          // Invece di un errore, puoi tornare 'false' come richiesto
          return res.status(200).json({ 
            success: false,
            error: 'Free tier monthly limit reached.',
            reason: 'QUOTA_EXCEEDED'
          });
        }
      // Lazy import per ottimizzare cold start
      const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
      const ttsClient = new TextToSpeechClient();

      const request = {
        input: { text: text.trim() },
        voice: {
          languageCode: 'it-IT',
          name: 'it-IT-Chirp3-HD-Orus',  
          ssmlGender: 'MALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0.0,
          volumeGainDb: 0.0
        }
      };

      console.log(`🎙️ TTS: Avvio sintesi con voce ${request.voice.name}`);
      
      // Esegui la sintesi
      const [response] = await ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('Nessun contenuto audio ricevuto dall\'API');
      }

      console.log(`✅ TTS: Sintesi completata con successo`);
      
      return res
        .status(200)
        .set('Content-Type', 'application/json; charset=utf-8')
        .json({
          success: true,
          audioContent: response.audioContent.toString('base64'),
          metadata: {
            voice: 'it-IT-Standard-C (Maschile)',
            languageCode: 'it-IT',
            audioEncoding: 'MP3',
            textLength: text.length,
            estimatedCost: 'Free Tier'
          },
          timestamp: new Date().toISOString()
        });
        
    } catch (error) {
      console.error(`❌ TTS: Errore nella sintesi vocale:`, error);
      
      // Gestione errori specifici dell'API Google
      let errorMessage = 'Errore interno nella sintesi vocale';
      let statusCode = 500;
      
      if (error.code === 3) {
        errorMessage = 'Testo non valido o troppo lungo';
        statusCode = 400;
      } else if (error.code === 7) {
        errorMessage = 'API Key non valida o quota esaurita';
        statusCode = 401;
      } else if (error.code === 8) {
        errorMessage = 'Limite di utilizzo superato';
        statusCode = 429;
      }
      
      return res
        .status(statusCode)
        .json({ 
          error: errorMessage,
          details: error.message,
          success: false,
          timestamp: new Date().toISOString()
        });
    }
  });






exports.debugCssSelector = functions
    .region('europe-west1')
    .runWith({
        memory: '512MB',
        timeoutSeconds: 300
    })
    .https
    .onRequest(async (req, res) => {
    
    // Handle preflight OPTIONS request
    const startTime = Date.now();
    
    try {
        console.log(`🔍 Debug CSS Selector endpoint chiamato - Metodo: ${req.method}`);
        
        // ✅ ESTRAI URL dal request (GET query param o POST body)
        let testUrl = null;
        
        if (req.method === 'GET') {
            testUrl = req.query.url;
        } else if (req.method === 'POST') {
            testUrl = req.body?.url;
        }
        
        // ✅ URL di default per test rapido
        if (!testUrl) {
            testUrl = "https://maisonroel.com/products/helena-black?variant=51190186737930";
            console.log(`⚠️ Nessun URL fornito, uso URL di default: ${testUrl}`);
        }
        
        // ✅ VALIDAZIONE URL
        if (!testUrl.startsWith('http')) {
            return res.status(400).json({
                success: false,
                error: 'URL non valido. Deve iniziare con http:// o https://',
                providedUrl: testUrl,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🎯 Testando URL: ${testUrl}`);
        
        // ✅ STEP 1: Trova il documento nel database
        console.log('🔍 Step 1: Ricerca documento per URL...');
        const existingDoc = await priceMonitorService.findDocumentByUrl(testUrl);
        
        if (!existingDoc) {
            console.log(`❌ Documento non trovato per URL: ${testUrl}`);
            return res.status(404).json({
                success: false,
                error: `Nessun documento trovato nel database per questo URL`,
                url: testUrl,
                suggestion: "Assicurati che l'URL sia stato aggiunto al sistema e sia esattamente uguale a quello salvato",
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime
            });
        }
        
        const itemData = existingDoc.data();
        const documentId = existingDoc.id;
        
        console.log(`✅ Documento trovato: ${documentId} - ${itemData.name}`);
        
        // ✅ STEP 2: Verifica che l'item abbia i dati necessari per il debug
        if (!itemData.priceSelection || !itemData.priceSelection.selectedCssSelector) {
            console.log(`⚠️ Item senza priceSelection valida`);
            return res.status(400).json({
                success: false,
                error: "L'item non ha una selezione CSS valida per il debug",
                itemId: documentId,
                itemName: itemData.name,
                hasPriceSelection: !!itemData.priceSelection,
                hasSelectedCssSelector: !!itemData.priceSelection?.selectedCssSelector,
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime
            });
        }
        
        // ✅ STEP 3: Esegui il debug CSS selector SEMPLIFICATO
        console.log('\n🔬 Avvio debug CSS selector...');
        
        let debugResult;
        try {
            // Prova prima il metodo originale se esiste
            if (typeof priceMonitorService.debugCssSelectorMismatch === 'function') {
                debugResult = await priceMonitorService.debugCssSelectorMismatch(testUrl, itemData);
            } else {
                // Fallback a debug semplificato
                debugResult = await performSimpleDebug(testUrl, itemData);
            }
        } catch (debugError) {
            console.error('❌ Errore nel debug:', debugError);
            debugResult = {
                success: false,
                error: debugError.message,
                exactMatch: false,
                detectedPrices: 0,
                analysis: {
                    hasExactMatch: false,
                    hasSimilarSelectors: false,
                    hasNumericMatch: false,
                    elementExists: false
                }
            };
        }
        
        // ✅ STEP 4: Prepara risposta dettagliata
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            
            // Info dell'item testato
            item: {
                id: documentId,
                name: itemData.name,
                category: itemData.category || 'Senza categoria',
                estimatedPrice: itemData.estimatedPrice,
                link: testUrl,
                createdBy: itemData.createdBy,
                completed: itemData.completed
            },
            
            // Info CSS selector salvato
            savedCssSelector: {
                selector: itemData.priceSelection.selectedCssSelector,
                selectedPriceIndex: itemData.priceSelection.selectedPriceIndex || 0,
                selectionTimestamp: itemData.priceSelection.selectionTimestamp,
                status: itemData.priceSelection.status,
                hasAlternativeSelectors: !!(itemData.priceSelection.detectedPrices?.[0]?.alternativeSelectors?.length)
            },
            
            // Risultati del debug
            debug: debugResult,
            
            // ✅ NUOVO: Sommario esecutivo CORRETTO
            summary: {
                problemFound: !debugResult.exactMatch,
                canBeFixed: debugResult.analysis?.hasSimilarSelectors || debugResult.analysis?.hasNumericMatch || false,
                recommendation: generateRecommendationSafe(debugResult),
                confidence: calculateConfidenceLevelSafe(debugResult)
            }
        };
        
        // ✅ Log del risultato
        console.log('\n📊 RISULTATO DEBUG ENDPOINT:');
        console.log(`   ✅ Success: ${response.success}`);
        console.log(`   🎯 Exact Match: ${debugResult.exactMatch || false}`);
        console.log(`   📊 Detected Prices: ${debugResult.detectedPrices || 0}`);
        console.log(`   ⏱️ Duration: ${response.duration}ms`);
        
        // ✅ RITORNA RISPOSTA
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Errore nell\'endpoint debug CSS selector:', error);
        
        const errorResponse = {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
        
        return res.status(500).json(errorResponse);
    }
});



function generateRecommendationSafe(debugResult) {
    try {
        if (!debugResult || debugResult.success === false) {
            return "❌ Errore durante il debug. Controlla i log per dettagli.";
        }
        
        if (debugResult.exactMatch) {
            return "✅ Il CSS selector funziona correttamente. Nessuna azione richiesta.";
        }
        
        const analysis = debugResult.analysis || {};
        
        if (analysis.elementExists && !analysis.hasExactMatch) {
            return "🔧 Il selector esiste nell'HTML ma non contiene prezzi. Potrebbe essere necessario un selector più specifico per l'elemento figlio contenente il prezzo.";
        }
        
        if (analysis.hasSimilarSelectors) {
            return "🎯 Trovati selettori simili. Il sistema può auto-aggiornare il selector durante il monitoraggio.";
        }
        
        if (analysis.hasNumericMatch) {
            return "💰 Trovato prezzo simile con selector diverso. Il sistema può utilizzare il match numerico come fallback.";
        }
        
        if (debugResult.detectedPrices > 0) {
            return "⚠️ Prezzi rilevati nella pagina ma nessun match per il selector. Potrebbe essere necessario riselezionare il prezzo corretto.";
        }
        
        return "❌ Nessun prezzo rilevato nella pagina. Il sito potrebbe essere cambiato significativamente o richiedere JavaScript.";
    } catch (error) {
        console.error('❌ Errore in generateRecommendationSafe:', error);
        return "❌ Errore durante la generazione della raccomandazione.";
    }
}

/**
 * 📊 Calcola livello di confidenza SICURO (senza errori undefined)
 */
function calculateConfidenceLevelSafe(debugResult) {
    try {
        if (!debugResult || debugResult.success === false) return "NONE";
        
        if (debugResult.exactMatch) return "HIGH";
        
        const analysis = debugResult.analysis || {};
        
        if (analysis.hasSimilarSelectors && analysis.hasNumericMatch) return "HIGH";
        if (analysis.hasSimilarSelectors || analysis.hasNumericMatch) return "MEDIUM";
        if (debugResult.detectedPrices > 0) return "LOW";
        
        return "NONE";
    } catch (error) {
        console.error('❌ Errore in calculateConfidenceLevelSafe:', error);
        return "NONE";
    }
}

/**
 * 🔍 Debug semplificato SICURO (fallback se debugCssSelectorMismatch non esiste)
 */
async function performSimpleDebug(testUrl, itemData) {
    try {
        const { WebScraper } = require('./services/web-scraper');
        const { PriceDetectorService } = require('./services/price-detector-service');
        
        const scraper = new WebScraper({
            useRealHeaders: true,
            enableDelays: false,
            maxRetries: 1
        });
        
        const priceDetector = new PriceDetectorService();
        
        // Scraping
        const scrapingResult = await scraper.scrapeComplete(testUrl, {
            useNavigation: false,
            fallbackToAggressive: true
        });
        
        if (!scrapingResult.success) {
            return {
                success: false,
                error: `Scraping fallito: ${scrapingResult.error}`,
                exactMatch: false,
                detectedPrices: 0
            };
        }
        
        // Rilevamento prezzi
        const detectionResult = await priceDetector.detectMultiplePrices(scrapingResult.html || scrapingResult.content.text);
        
        const savedSelector = itemData.priceSelection.selectedCssSelector;
        const currentPrice = itemData.estimatedPrice;
        
        let exactMatch = false;
        let hasNumericMatch = false;
        
        if (detectionResult.detectedPrices && detectionResult.detectedPrices.length > 0) {
            // Check exact match
            exactMatch = detectionResult.detectedPrices.some(price => 
                price.cssSelector === savedSelector
            );
            
            // Check numeric match (±5%)
            const tolerance = currentPrice * 0.05;
            hasNumericMatch = detectionResult.detectedPrices.some(price => 
                Math.abs(price.numericValue - currentPrice) <= tolerance
            );
        }
        
        return {
            success: true,
            savedSelector: savedSelector,
            exactMatch: exactMatch,
            detectedPrices: detectionResult.detectedPrices?.length || 0,
            htmlLength: scrapingResult.content.text.length,
            analysis: {
                hasExactMatch: exactMatch,
                hasSimilarSelectors: false, // Semplificato
                hasNumericMatch: hasNumericMatch,
                elementExists: true // Assume true per semplicità
            }
        };
        
    } catch (error) {
        console.error('❌ Errore in performSimpleDebug:', error);
        return {
            success: false,
            error: error.message,
            exactMatch: false,
            detectedPrices: 0,
            analysis: {
                hasExactMatch: false,
                hasSimilarSelectors: false,
                hasNumericMatch: false,
                elementExists: false
            }
        };
    }
}

console.log("📦 FamilyTaskTracker Functions inizializzate");