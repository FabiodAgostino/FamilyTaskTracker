// ====================================
// functions/realtime-notifications.js
// Sistema di notifiche real-time EFFICIENTE con single function
// ====================================

const functions = require("firebase-functions/v1");  // 🔧 IMPORTA ESPLICITAMENTE V1
const { getFirestore } = require("firebase-admin/firestore");
const admin = require('firebase-admin');
const axios = require('axios');
// Assicurati che sia inizializzato
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Collezioni monitorate per le notifiche
 */
const MONITORED_COLLECTIONS = ['shopping_items', 'notes', 'calendar_events', 'reminders'];


/**
 * Servizio per gestire le notifiche real-time
 */
class EfficientRealtimeNotificationService {
    
    /**
     * Determina se la collection è monitorata
     */
    isMonitoredCollection(documentPath) {
        return MONITORED_COLLECTIONS.some(collection => 
            documentPath.startsWith(collection)
        );
    }
    
    /**
     * Estrae il nome della collection dal path
     */
    extractCollectionName(documentPath) {
        const segments = documentPath.split('/');
        return segments[0]; // Prima parte del path è la collection
    }
    
    /**
     * Determina se l'operazione dovrebbe inviare notifiche
     */
    shouldSendNotification(change, collectionName) {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        
        // Caso 1: Documento eliminato - no notifica
        if (before && !after) {
            console.log(`🗑️ Documento eliminato in ${collectionName} - no notifica`);
            return false;
        }
        
        // Caso 2: Nuovo documento creato
        if (!before && after) {
            const isPublic = after.isPublic === true;
            console.log(`🆕 Nuovo documento in ${collectionName} - pubblico: ${isPublic}`);

            if (collectionName === 'shopping_items') {
                const hasValidName = after.name && after.name.trim() !== '';
                console.log(`🆕 Nuovo shopping item - pubblico: ${isPublic}, nome valido: ${hasValidName} (${after.name})`);
                return isPublic && hasValidName;
            }


            return isPublic;
        }
        
        // Caso 3: Documento aggiornato
        if (before && after) {
            // Invia notifica se:
            // - Era privato e ora è pubblico
            // - Era pubblico e viene modificato in modo significativo
            const becamePublic = before.isPublic === false && after.isPublic === true;
            const publicContentChanged = before.isPublic === true && after.isPublic === true && 
                this.hasSignificantChanges(before, after, collectionName);
            
            const shouldNotify = becamePublic || publicContentChanged;
            console.log(`🔄 Documento aggiornato in ${collectionName} - becamePublic: ${becamePublic}, contentChanged: ${publicContentChanged}`);
            return shouldNotify;
        }
        
        return false;
    }
    
    /**
     * Determina se ci sono modifiche significative al contenuto basato sui modelli reali
     */
    hasSignificantChanges(before, after, collection) {
        switch (collection) {
            case 'shopping_items':
                return before.name !== after.name || 
                       before.category !== after.category ||
                       before.completed !== after.completed ||
                       before.priority !== after.priority ||
                       before.estimatedPrice !== after.estimatedPrice ||
                       before.available !== after.available;
            
            case 'notes':
                return before.title !== after.title || 
                       before.content !== after.content ||
                       before.isPinned !== after.isPinned ||
                       (before.tags || []).join(',') !== (after.tags || []).join(',');
            
            case 'calendar_events':
                return before.title !== after.title || 
                       before.description !== after.description ||
                       before.startDate?.seconds !== after.startDate?.seconds ||
                       before.endDate?.seconds !== after.endDate?.seconds ||
                       before.eventType !== after.eventType ||
                       before.isAllDay !== after.isAllDay ||
                       before.location !== after.location;
            case 'reminders':
                    return before.title !== after.title || 
                        before.message !== after.message ||
                        before.scheduledTime?.seconds !== after.scheduledTime?.seconds ||
                        before.isActive !== after.isActive ||
                        before.priority !== after.priority ||
                        before.reminderType !== after.reminderType ||
                        before.isRecurring !== after.isRecurring;
            
            default:
                return true; // Considera sempre significativo per collezioni sconosciute
        }
    }
    
    /**
     * 🎯 BUSINESS LOGIC: Recupera token FCM con logica corretta per admin/users
     */
    async getTargetTokens(authorUsername) {
        try {
            const db = getFirestore();
            const tokensRef = db.collection('fcm-tokens');
            
            // Query per token attivi e non scaduti
            const snapshot = await tokensRef
                .where('isActive', '==', true)
                .where('expiresAt', '>', new Date())
                .get();
            
            const validTokens = [];
            
            for (const doc of snapshot.docs) {
                const tokenData = doc.data();
                
                // 🔧 LOGICA BUSINESS:
                if (authorUsername === 'admin') {
                    // Admin inserisce → Notifica a tutti TRANNE se stesso
                    if (tokenData.username === 'admin') {
                        continue; // Escludi admin stesso
                    }
                } else {
                    // Utente normale inserisce → Notifica a tutti TRANNE se stesso e admin
                    if (tokenData.username === 'admin' || tokenData.username === authorUsername) {
                        continue; // Escludi admin e autore
                    }
                }
                
                // Verifica validità token
                if (tokenData.token && tokenData.username) {
                    validTokens.push({
                        token: tokenData.token,
                        username: tokenData.username,
                        deviceType: tokenData.deviceType || 'unknown'
                    });
                }
            }
            
            console.log(`🎯 Token validi: ${validTokens.length} | Autore: ${authorUsername} | Logica: ${authorUsername === 'admin' ? 'Admin mode' : 'User mode'}`);
            return validTokens;
            
        } catch (error) {
            console.error('❌ Errore recupero token FCM:', error);
            return [];
        }
    }
    
    /**
     * Genera icone corrette basate su piattaforma e hosting
     */
    getIconPaths() {
        // Usa sempre GitHub Pages path per le Cloud Functions
        const basePath = 'https://fabiodagostino.github.io/FamilyTaskTracker/icons';
        
        return {
            icon: `${basePath}/icon-192x192.png`,      // Standard per web/android
            iconIOS: `${basePath}/iconios.png`,        // Specifico per iOS
            badge: `${basePath}/badge.png`             // Badge per notifiche
        };
    }
    
    /**
     * Genera il contenuto della notifica basato sui modelli reali
     */
    generateNotificationContent(data, collection, operationType, authorUsername) {
        let title, body, emoji;
        
        // Determina chi ha fatto l'azione per personalizzare il messaggio
        const authorLabel = authorUsername === 'admin' ? 'Admin' : authorUsername;
        
        switch (collection) {
            case 'shopping_items':
                emoji = '🛒';
                const itemName = data.name || 'Nuovo articolo';
                if (operationType === 'created') {
                    title = `${emoji} Nuovo Articolo`;
                    body = `${authorLabel} ha aggiunto "${itemName}" alla shopping list`;
                } else {
                    title = `${emoji} Articolo Aggiornato`;
                    body = `${authorLabel} ha modificato "${itemName}"`;
                    if (data.completed) {
                        body += ' (completato)';
                    }
                }
                break;
                
            case 'notes':
                emoji = '📝';
                const noteTitle = data.title || 'Nota senza titolo';
                
                if (operationType === 'created') {
                    title = `${emoji} Nuova Nota`;
                    body = `${authorLabel} ha scritto: "${noteTitle}"`;
                } else {
                    title = `${emoji} Nota Aggiornata`;
                    body = `${authorLabel} ha modificato "${noteTitle}"`;
                    if (data.isPinned) {
                        body += ' (fissata)';
                    }
                }
                break;
                
            case 'calendar_events':
                emoji = '📅';
                const eventTitle = data.title || 'Nuovo evento';
                if (operationType === 'created') {
                    title = `${emoji} Nuovo Evento`;
                    body = `${authorLabel} ha programmato "${eventTitle}"`;
                } else {
                    title = `${emoji} Evento Aggiornato`;
                    body = `${authorLabel} ha modificato "${eventTitle}"`;
                }
                
                // Aggiungi info data se disponibile
                if (data.startDate) {
                    try {
                        const startDate = new Date(data.startDate.seconds * 1000);
                        const dateStr = startDate.toLocaleDateString('it-IT', { 
                            day: 'numeric', 
                            month: 'short' 
                        });
                        body += ` (${dateStr})`;
                    } catch (e) {
                        // Ignora errori di parsing data
                    }
                }
                break;

            case 'reminders':
                emoji = '⏰';
                const reminderTitle = data.title || 'Nuovo promemoria';
                
                if (operationType === 'created') {
                    title = `${emoji} Nuovo Promemoria`;
                    body = `${authorLabel} ha creato: "${reminderTitle}"`;
                    
                    // Aggiungi info timing se disponibile
                    if (data.scheduledTime) {
                        try {
                            const scheduledDate = new Date(data.scheduledTime.seconds * 1000);
                            const dateStr = scheduledDate.toLocaleDateString('it-IT', { 
                                day: 'numeric', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            body += ` (${dateStr})`;
                        } catch (e) {
                            // Ignora errori di parsing data
                        }
                    }
                } else {
                    title = `${emoji} Promemoria Aggiornato`;
                    body = `${authorLabel} ha modificato "${reminderTitle}"`;
                    
                    if (data.priority === 'high') {
                        body += ' (priorità alta)';
                    }
                    if (data.isRecurring) {
                        body += ' (ricorrente)';
                    }
                }
                break;
                
            default:
                title = '🏠 Aggiornamento Famiglia';
                body = `${authorLabel} ha modificato un elemento`;
        }
        
        return { title, body, emoji };
    }
    
    /**
     * Invia notifiche FCM a tutti i token validi con gestione icone corrette
     */
    /**
 * Invia notifiche push in tempo reale a tutti i token validi.
 * Usa sendEachForMulticast() (max 500 token per chiamata).
 */
async sendRealtimeNotifications(
  data,
  collection,
  operationType,
  authorUsername
) {
  try {
    console.log(`📱 Avvio notifiche real‑time per ${collection} (${operationType}) da ${authorUsername}`);

    /* 1. Recupera i token destinatari (escludendo l'autore) */
    const targetTokens = await this.getTargetTokens(authorUsername);
    if (targetTokens.length === 0) {
      console.log('📱 Nessun token valido per l’invio');
      return { success: true, sent: 0 };
    }

    /* 2. Costruisci titolo e corpo della notifica */
    const { title, body } = this.generateNotificationContent(
      data,
      collection,
      operationType,
      authorUsername
    );

    /* 3. Icone e payload comuni */
    const iconPaths = this.getIconPaths();
    const basePayload = {
      notification: { title, body },
      data: {
        type: 'realtime-update',
        collection,
        operationType,
        authorUsername,
        timestamp: Date.now().toString(),
        click_action: 'https://fabiodagostino.github.io/FamilyTaskTracker/'
      },
      android: {
        notification: {
          channelId: 'family-updates',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          icon: 'ic_notification',
          color: '#2196F3'
        }
      },
      apns: {
        payload: { aps: { badge: 1, sound: 'default' } }
      },
      webpush: {
        notification: {
          icon: iconPaths.icon,
          badge: iconPaths.badge,
          requireInteraction: false,
          tag: 'realtime-update',
          renotify: true
        }
      }
    };

    /* 4. Invio a blocchi da 500 con sendEachForMulticast() */
    const messaging = admin.messaging();
    const BATCH_SIZE = 500;
    let totalSent = 0;

    for (let i = 0; i < targetTokens.length; i += BATCH_SIZE) {
      const batch = targetTokens.slice(i, i + BATCH_SIZE);
      const tokens = batch.map(t => t.token); // array di stringhe

      /* Messaggio multicast */
      const multicastMessage = {
        ...basePayload,
        tokens
      };

      try {
        const res = await messaging.sendEachForMulticast(multicastMessage);
        totalSent += res.successCount;

        console.log(
          `📱 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ` +
          `${res.successCount}/${tokens.length} inviate`
        );

        /* Gestione token non validi */
        if (res.failureCount > 0) {
          await this.handleFailedTokens(res.responses, batch);
        }
      } catch (err) {
        console.error(`❌ Errore batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
      }
    }

    console.log(`✅ Notifiche real‑time inviate: ${totalSent}/${targetTokens.length}`);
    console.log(`📨 Contenuto: "${title}" - "${body}"`);

    return {
      success: true,
      sent: totalSent,
      total: targetTokens.length,
      title,
      body,
      collection,
      operationType,
      authorUsername
    };
  } catch (error) {
    console.error('❌ Errore invio notifiche real‑time:', error);
    return { success: false, error: error.message, sent: 0 };
  }
}


/**
 * 🆕 Gestisce l'integrazione automatica con Cloud Tasks per i promemoria
 */
async handleReminderCloudTaskIntegration(change, context) {
    try {
        const documentId = context.params.documentId;
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        
        console.log(`🔔 Gestione Cloud Task per promemoria: ${documentId}`);
        
        // Skip se è solo un update di cloudTaskId (per evitare loop)
        if (before && after && 
            before.cloudTaskId !== after.cloudTaskId && 
            JSON.stringify({...before, cloudTaskId: null, updatedAt: null}) === 
            JSON.stringify({...after, cloudTaskId: null, updatedAt: null})) {
            console.log('⏭️ Skip: solo aggiornamento cloudTaskId');
            return;
        }
        
        const projectId = process.env.GCLOUD_PROJECT;
        const functionUrl = `https://europe-west1-${projectId}.cloudfunctions.net/manageReminders`;
        
        // Caso 1: Nuovo promemoria creato
        if (!before && after) {
            console.log(`📝 Nuovo promemoria creato: ${after.title}`);
            
            if (after.isActive && after.scheduledTime && !after.cloudTaskId) {
                const scheduledTime = new Date(after.scheduledTime.seconds * 1000);
                
                if (scheduledTime > new Date()) {
                    console.log(`⏰ Creazione Cloud Task per: ${after.title}`);
                    
                    const payload = {
                        action: 'create',
                        reminderData: {
                            id: documentId,
                            ...after,
                            scheduledTime: scheduledTime
                        }
                    };
                    
                    await axios.post(functionUrl, payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });
                    
                    console.log(`✅ Cloud Task request inviata per: ${documentId}`);
                }
            }
        }
        
        // Caso 2: Promemoria aggiornato
        if (before && after) {
            const taskRelevantFieldsChanged = 
                before.scheduledTime?.seconds !== after.scheduledTime?.seconds ||
                before.isActive !== after.isActive ||
                before.title !== after.title ||
                before.message !== after.message;
            
            if (taskRelevantFieldsChanged) {
                console.log(`🔧 Aggiornamento Cloud Task per: ${after.title}`);
                
                const payload = {
                    action: 'update',
                    reminderId: documentId,
                    reminderData: {
                        id: documentId,
                        ...after,
                        scheduledTime: new Date(after.scheduledTime.seconds * 1000)
                    }
                };
                
                await axios.post(functionUrl, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                });
                
                console.log(`✅ Cloud Task update request inviata per: ${documentId}`);
            }
        }
        
        // Caso 3: Promemoria eliminato
        if (before && !after) {
            console.log(`🗑️ Promemoria eliminato: ${before.title}`);
            
            const payload = {
                action: 'delete',
                reminderId: documentId
            };
            
            await axios.post(functionUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`✅ Cloud Task delete request inviata per: ${documentId}`);
        }
        
    } catch (error) {
        console.error('❌ Errore gestione Cloud Task promemoria:', error);
        // Non far fallire le notifiche per errori Cloud Tasks
    }
}
    
    /**
     * Gestisce i token FCM falliti rimuovendoli dal database
     */
    async handleFailedTokens(responses, tokenBatch) {
        try {
            const db = getFirestore();
            const tokensToRemove = [];
            
            responses.forEach((response, index) => {
                if (!response.success) {
                    const error = response.error;
                    
                    // Rimuovi token solo per errori definitivi
                    if (error?.code === 'messaging/registration-token-not-registered' ||
                        error?.code === 'messaging/invalid-registration-token') {
                        tokensToRemove.push(tokenBatch[index]);
                    }
                }
            });
            
            // Rimuovi token non validi in batch
            if (tokensToRemove.length > 0) {
                const batch = db.batch();
                
                for (const tokenInfo of tokensToRemove) {
                    const tokenQuery = await db.collection('fcm-tokens')
                        .where('token', '==', tokenInfo.token)
                        .where('username', '==', tokenInfo.username)
                        .get();
                    
                    tokenQuery.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                }
                
                await batch.commit();
                console.log(`🧹 Rimossi ${tokensToRemove.length} token non validi`);
            }
            
        } catch (error) {
            console.error('❌ Errore gestione token falliti:', error);
        }
    }
}

// Istanza singleton del servizio
const realtimeService = new EfficientRealtimeNotificationService();

/**
 * 🚀 SINGLE EFFICIENT TRIGGER - Gestisce tutte le collezioni monitorate
 */
exports.onDocumentChange = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 60
    })
    .firestore
    .document('{collection}/{documentId}')
    .onWrite(async (change, context) => {
        const collectionName = context.params.collection;
        const documentId = context.params.documentId;
        
        console.log(`🔔 Trigger attivato: ${collectionName}/${documentId}`);
        
        // Controlla se la collection è monitorata
        if (!realtimeService.isMonitoredCollection(collectionName)) {
            console.log(`⏭️ Collection ${collectionName} non monitorata - skip`);
            return null;
        }
         if (collectionName === 'reminders') {
            await realtimeService.handleReminderCloudTaskIntegration(change, context);
        }
        // Controlla se dovrebbe inviare notifiche
        if (!realtimeService.shouldSendNotification(change, collectionName)) {
            console.log(`⏭️ Notifica non necessaria per ${collectionName}/${documentId}`);
            return null;
        }
        
        const data = change.after.data();
        const operationType = !change.before.exists ? 'created' : 'updated';
        const authorUsername = data.createdBy || 'unknown';
        
        console.log(`📨 Invio notifiche per ${collectionName}/${documentId} - Autore: ${authorUsername}`);
        
        await realtimeService.sendRealtimeNotifications(
            data,
            collectionName,
            operationType,
            authorUsername
        );

       
        
        return null;
    });




    

/**
 * 🧪 Funzione di test per il sistema real-time
 */
exports.testRealtimeNotifications = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 60
    })
    .https
    .onCall(async (data, context) => {
        // Verifica autenticazione
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Devi essere autenticato');
        }
        
        const { collection, title, testUsername } = data;
        
        if (!collection || !title) {
            throw new functions.https.HttpsError('invalid-argument', 'collection e title sono richiesti');
        }
        
        if (!MONITORED_COLLECTIONS.includes(collection)) {
            throw new functions.https.HttpsError('invalid-argument', `Collection deve essere una di: ${MONITORED_COLLECTIONS.join(', ')}`);
        }
        
        console.log(`🧪 Test notifica real-time per ${collection}`);
        
        // Prepara dati test basati sulla collection
        let testData = {
            createdBy: testUsername || context.auth.token.username,
            isPublic: true
        };
        
        switch (collection) {
            case 'shopping_items':
                testData = {
                    ...testData,
                    name: title,
                    category: 'Test',
                    link: 'https://example.com',
                    priority: 'medium',
                    completed: false,
                    available: true
                };
                break;
                
            case 'notes':
                testData = {
                    ...testData,
                    title: title,
                    content: 'Contenuto di test per notifica real-time',
                    tags: ['test'],
                    isPinned: false,
                    color: '#F3F4F6'
                };
                break;
                
            case 'calendar_events':
                testData = {
                    ...testData,
                    title: title,
                    description: 'Evento di test per notifica real-time',
                    startDate: { seconds: Math.floor(Date.now() / 1000) },
                    endDate: { seconds: Math.floor((Date.now() + 3600000) / 1000) },
                    eventType: 'family',
                    isAllDay: false,
                    location: 'Test Location'
                };
                break;
        }
        
        const result = await realtimeService.sendRealtimeNotifications(
            testData,
            collection,
            'created',
            testData.createdBy
        );
        
        return {
            success: result.success,
            message: `Test completato: ${result.sent}/${result.total} notifiche inviate`,
            details: result
        };
    });

/**
 * 📊 Stato del sistema notifiche
 */
exports.getNotificationStatus = functions
    .region('europe-west1')
    .runWith({
        memory: '128MB',
        timeoutSeconds: 30
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Autenticazione richiesta');
        }
        
        try {
            // Recupera stato token FCM
            const tokens = await realtimeService.getTargetTokens();
            const tokensByDevice = tokens.reduce((acc, token) => {
                acc[token.deviceType] = (acc[token.deviceType] || 0) + 1;
                return acc;
            }, {});
            
            const tokensByUser = tokens.reduce((acc, token) => {
                acc[token.username] = (acc[token.username] || 0) + 1;
                return acc;
            }, {});
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                status: {
                    totalTokens: tokens.length,
                    tokensByDevice: tokensByDevice,
                    tokensByUser: tokensByUser,
                    activeUsers: [...new Set(tokens.map(t => t.username))].length,
                    monitoredCollections: MONITORED_COLLECTIONS,
                    lastCheck: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ Errore nel recupero stato notifiche:', error);
            
            throw new functions.https.HttpsError(
                'internal',
                `Errore nel recupero stato: ${error.message}`
            );
        }
    });
