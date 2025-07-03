// ====================================
// functions/index.js - Entry point principale pulito (Gen 1)
// ====================================

const functions = require("firebase-functions/v1");  // 🔧 IMPORTA ESPLICITAMENTE V1
const admin = require('firebase-admin');

// Assicurati che sia inizializzato
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}


// Import dei servizi modulari
const { unifiedNotificationService } = require('./services/notification-service');
const { scraperService } = require('./services/scraping-service');
const { priceMonitorService } = require('./services/price-monitor-service');
const {
    onDocumentChange,
    testRealtimeNotifications,
    getNotificationStatus
} = require('./services/realtime-notifications');

exports.onDocumentChange = onDocumentChange;

/**
 * Funzione unificata che gestisce tutte le notifiche ogni 30 minuti
 * - FCM notifications (sempre)
 * - Email notifications (ogni 6 ore)
 * - Event reminders (ogni 6 ore)
 */
exports.checkUpdatesUnified = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 540
    })
    .pubsub
    .schedule('every 30 minutes')  // 🔧 CAMBIATO: ogni minuto per debug
    .timeZone('Europe/Rome')
    .onRun(async (context) => {
        console.log("🔄 Avvio controllo unificato notifiche famiglia...");
        
        try {
            await unifiedNotificationService.initializeEmailService();
            await unifiedNotificationService.handleUnifiedCheck();
            console.log("✅ Controllo unificato completato con successo");
        } catch (error) {
            console.error("❌ Errore nel controllo unificato:", error);
        }
        
        return null;
    });

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
            // Inizializza il servizio di monitoraggio
            
            console.log('🔧 Inizializzazione servizio monitoraggio prezzi...');
            
            // Esegui il monitoraggio completo
            const result = await priceMonitorService.runDailyPriceMonitoring();
            
            const duration = Date.now() - startTime;
            const durationFormatted = Math.round(duration / 1000);
            
            // Log risultati dettagliati
            console.log('📊 ===== RISULTATI JOB MONITORAGGIO PREZZI =====');
            console.log(`✅ Successo: ${result.success}`);
            console.log(`⏱️ Durata totale: ${durationFormatted}s`);
            console.log(`📦 Item monitorati: ${result.monitored || 0}`);
            console.log(`💰 Cambiamenti rilevati: ${result.changes || 0}`);
            console.log(`📧 Email inviate: ${result.emailData?.sent ? 'Sì' : 'No'}`);
            
            if (result.emailData?.sent) {
                console.log(`📧 Destinatari email: ${result.emailData.recipientCount}`);
                console.log(`📧 Recipients: ${result.emailData.recipients?.join(', ')}`);
                console.log(`📧 Message ID: ${result.emailData.messageId}`);
            }
            
            if (result.stats) {
                console.log('📈 Statistiche dettagliate:');
                console.log(`  • Totali: ${result.stats.total}`);
                console.log(`  • Processati: ${result.stats.processed}`);
                console.log(`  • Completati (saltati): ${result.stats.completed}`);
                console.log(`  • Prezzi cambiati: ${result.stats.priceChanged}`);
                console.log(`  • Disponibilità cambiate: ${result.stats.availabilityChanged}`);
                console.log(`  • Errori: ${result.stats.errors}`);
                console.log(`  • Chiamate DeepSeek: ${result.stats.deepseekCalls}`);
                console.log(`  • Scritture DB: ${result.stats.dbWrites}`);
            }
            
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
            
            console.error('❌ ===== ERRORE JOB MONITORAGGIO PREZZI =====');
            console.error(`❌ Errore: ${error.message}`);
            console.error(`⏱️ Durata prima dell'errore: ${durationFormatted}s`);
            console.error(`🆔 Job ID: ${context.eventId}`);
            console.error('📋 Stack trace:', error.stack);
            
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
      'http://localhost:3000',
      'https://fabiodagostino.github.io',                         
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

console.log("📦 FamilyTaskTracker Functions inizializzate");