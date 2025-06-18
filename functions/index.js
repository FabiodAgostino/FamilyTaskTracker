// ====================================
// functions/index.js - Entry point principale pulito (Gen 1)
// ====================================

const functions = require("firebase-functions/v1");  // 🔧 IMPORTA ESPLICITAMENTE V1
const { initializeApp } = require("firebase-admin/app");

// Inizializzazione Firebase Admin
initializeApp();

// Import dei servizi modulari
const { unifiedNotificationService } = require('./services/notification-service');
const { scraperService } = require('./services/scraping-service');


// ====================================
// FUNZIONE PRINCIPALE - CONTROLLO UNIFICATO (GEN 1)
// ====================================

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
    .schedule('every 1 minutes')  // 🔧 CAMBIATO: ogni minuto per debug
    .timeZone('Europe/Rome')
    .onRun(async (context) => {
        console.log("🔄 Avvio controllo unificato notifiche famiglia...");
        
        try {
            await unifiedNotificationService.handleUnifiedCheck();
            console.log("✅ Controllo unificato completato con successo");
        } catch (error) {
            console.error("❌ Errore nel controllo unificato:", error);
        }
        
        return null;
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
      'http://localhost:3000',                           // Sviluppo
      'http://localhost:5173',                           // Vite dev server
      'https://familytasktracker-c2dfe.web.app',        // Firebase Hosting
      'https://familytasktracker-c2dfe.firebaseapp.com' // Firebase Hosting alternativo
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


// ====================================
// HEALTH CHECK (GEN 1)
// ====================================

/**
 * Health check per verificare lo stato delle funzioni
 */
exports.healthCheck = functions
    .region('europe-west1')
    .runWith({
        memory: '128MB',
        timeoutSeconds: 60
    })
    .pubsub
    .schedule('every 24 hours')
    .timeZone('Europe/Rome')
    .onRun(async (context) => {
        console.log("🏥 Health check del sistema...");
        
        try {
            const status = await unifiedNotificationService.getSystemStatus();
            console.log("✅ Sistema operativo:", status);
        } catch (error) {
            console.error("❌ Errore health check:", error);
        }
        
        return null;
    });

// ====================================
// EXPORTS PER FUTURE FUNZIONI
// ====================================

// Placeholder per future funzioni di scraping
// exports.scrapingFunction = require('./functions/scraping-functions');

console.log("📦 FamilyTaskTracker Functions inizializzate");