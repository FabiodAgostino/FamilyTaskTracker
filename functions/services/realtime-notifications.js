// ====================================
// functions/realtime-notifications.js
// Sistema di notifiche real-time con trigger Firestore
// ====================================

const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

/**
 * Servizio per gestire le notifiche real-time
 */
class RealtimeNotificationService {
    
    /**
     * Determina se l'operazione dovrebbe inviare notifiche
     */
    shouldSendNotification(change, context) {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        
        // Caso 1: Nuovo documento creato
        if (!before && after) {
            return after.isPublic === true;
        }
        
        // Caso 2: Documento aggiornato
        if (before && after) {
            // Invia notifica se:
            // - Era privato e ora è pubblico
            // - Era pubblico e viene modificato in modo significativo
            const becamePublic = before.isPublic === false && after.isPublic === true;
            const publicContentChanged = before.isPublic === true && after.isPublic === true && 
                this.hasSignificantChanges(before, after, context.params.collection);
            
            return becamePublic || publicContentChanged;
        }
        
        return false;
    }
    
    /**
     * Determina se ci sono modifiche significative al contenuto
     */
    hasSignificantChanges(before, after, collection) {
        switch (collection) {
            case 'shopping_items':
                return before.name !== after.name || 
                       before.category !== after.category ||
                       before.completed !== after.completed;
            
            case 'notes':
                return before.title !== after.title || 
                       before.content !== after.content ||
                       (before.tags || []).join(',') !== (after.tags || []).join(',');
            
            case 'calendar_events':
                return before.title !== after.title || 
                       before.description !== after.description ||
                       before.startDate?.seconds !== after.startDate?.seconds ||
                       before.endDate?.seconds !== after.endDate?.seconds;
            
            default:
                return true; // Considera sempre significativo per collezioni sconosciute
        }
    }
    
    /**
     * Recupera tutti i token FCM attivi escludendo l'autore
     */
    async getTargetTokens(excludeUsername = null) {
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
                
                // Escludi admin e l'autore della modifica
                if (tokenData.username === 'admin' || tokenData.username === excludeUsername) {
                    continue;
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
            
            console.log(`🎯 Token validi trovati: ${validTokens.length} (escluso: ${excludeUsername || 'nessuno'})`);
            return validTokens;
            
        } catch (error) {
            console.error('❌ Errore recupero token FCM:', error);
            return [];
        }
    }
    
    /**
     * Genera il contenuto della notifica basato sul tipo di elemento
     */
    generateNotificationContent(data, collection, operationType) {
        let title, body, emoji;
        
        switch (collection) {
            case 'shopping_items':
                emoji = '🛒';
                if (operationType === 'created') {
                    title = `${emoji} Nuovo Articolo`;
                    body = `"${data.name}" aggiunto alla lista spesa`;
                } else {
                    title = `${emoji} Articolo Aggiornato`;
                    body = `"${data.name}" è stato modificato`;
                }
                break;
                
            case 'notes':
                emoji = '📝';
                if (operationType === 'created') {
                    title = `${emoji} Nuova Nota`;
                    body = `"${data.title || 'Nota senza titolo'}" aggiunta`;
                } else {
                    title = `${emoji} Nota Aggiornata`;
                    body = `"${data.title || 'Nota senza titolo'}" è stata modificata`;
                }
                break;
                
            case 'calendar_events':
                emoji = '📅';
                if (operationType === 'created') {
                    title = `${emoji} Nuovo Evento`;
                    body = `"${data.title}" programmato`;
                } else {
                    title = `${emoji} Evento Aggiornato`;
                    body = `"${data.title}" è stato modificato`;
                }
                break;
                
            default:
                title = '🏠 Aggiornamento Famiglia';
                body = 'Un elemento è stato modificato';
        }
        
        return { title, body, emoji };
    }
    
    /**
     * Invia notifiche FCM a tutti i token validi
     */
    async sendRealtimeNotifications(data, collection, operationType, authorUsername) {
        try {
            console.log(`📱 Avvio notifiche real-time per ${collection} (${operationType})`);
            
            // Recupera token target escludendo l'autore
            const targetTokens = await this.getTargetTokens(authorUsername);
            
            if (targetTokens.length === 0) {
                console.log('📱 Nessun token valido per l\'invio');
                return { success: true, sent: 0 };
            }
            
            // Genera contenuto notifica
            const { title, body } = this.generateNotificationContent(data, collection, operationType);
            
            // Prepara il messaggio FCM
            const baseMessage = {
                notification: {
                    title,
                    body
                },
                data: {
                    type: 'realtime-update',
                    collection,
                    operationType,
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
                    payload: {
                        aps: {
                            badge: 1,
                            sound: 'default'
                        }
                    }
                },
                webpush: {
                    notification: {
                        icon: '/icon-192x192.png',
                        badge: '/badge-72x72.png',
                        requireInteraction: false,
                        tag: 'realtime-update'
                    }
                }
            };
            
            // Invia in batch (FCM supporta max 500 token per richiesta)
            const messaging = getMessaging();
            let totalSent = 0;
            const batchSize = 500;
            
            for (let i = 0; i < targetTokens.length; i += batchSize) {
                const batch = targetTokens.slice(i, i + batchSize);
                const tokens = batch.map(t => t.token);
                
                try {
                    const response = await messaging.sendMulticast({
                        ...baseMessage,
                        tokens
                    });
                    
                    totalSent += response.successCount;
                    
                    console.log(`📱 Batch ${Math.floor(i/batchSize) + 1}: ${response.successCount}/${tokens.length} inviate`);
                    
                    // Gestisci token non validi
                    if (response.failureCount > 0) {
                        await this.handleFailedTokens(response.responses, batch);
                    }
                    
                } catch (batchError) {
                    console.error(`❌ Errore batch ${Math.floor(i/batchSize) + 1}:`, batchError);
                }
            }
            
            console.log(`✅ Notifiche real-time inviate: ${totalSent}/${targetTokens.length}`);
            
            return {
                success: true,
                sent: totalSent,
                total: targetTokens.length,
                title,
                body
            };
            
        } catch (error) {
            console.error('❌ Errore invio notifiche real-time:', error);
            return {
                success: false,
                error: error.message,
                sent: 0
            };
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
const realtimeService = new RealtimeNotificationService();

/**
 * Trigger per shopping_items
 */
exports.onShoppingItemChange = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 60
    })
    .firestore
    .document('shopping_items/{itemId}')
    .onWrite(async (change, context) => {
        console.log(`🛒 Trigger shopping_items: ${context.params.itemId}`);
        
        if (!realtimeService.shouldSendNotification(change, context)) {
            console.log('🛒 Notifica non necessaria');
            return null;
        }
        
        const data = change.after.data();
        const operationType = !change.before.exists ? 'created' : 'updated';
        
        await realtimeService.sendRealtimeNotifications(
            data,
            'shopping_items',
            operationType,
            data.createdBy
        );
        
        return null;
    });

/**
 * Trigger per notes
 */
exports.onNoteChange = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 60
    })
    .firestore
    .document('notes/{noteId}')
    .onWrite(async (change, context) => {
        console.log(`📝 Trigger notes: ${context.params.noteId}`);
        
        if (!realtimeService.shouldSendNotification(change, context)) {
            console.log('📝 Notifica non necessaria');
            return null;
        }
        
        const data = change.after.data();
        const operationType = !change.before.exists ? 'created' : 'updated';
        
        await realtimeService.sendRealtimeNotifications(
            data,
            'notes',
            operationType,
            data.createdBy
        );
        
        return null;
    });

/**
 * Trigger per calendar_events
 */
exports.onCalendarEventChange = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 60
    })
    .firestore
    .document('calendar_events/{eventId}')
    .onWrite(async (change, context) => {
        console.log(`📅 Trigger calendar_events: ${context.params.eventId}`);
        
        if (!realtimeService.shouldSendNotification(change, context)) {
            console.log('📅 Notifica non necessaria');
            return null;
        }
        
        const data = change.after.data();
        const operationType = !change.before.exists ? 'created' : 'updated';
        
        await realtimeService.sendRealtimeNotifications(
            data,
            'calendar_events',
            operationType,
            data.createdBy
        );
        
        return null;
    });

/**
 * Funzione di utilità per testare il sistema real-time
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
        
        console.log(`🧪 Test notifica real-time per ${collection}`);
        
        const testData = {
            title: title,
            name: title, // Per shopping_items
            content: 'Contenuto di test per notifica real-time',
            createdBy: testUsername || context.auth.token.username
        };
        
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

// Esporta il servizio per poterlo usare in altri file
module.exports = { realtimeService };