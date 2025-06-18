// ====================================
// functions/services/notification-service.js
// Gestione completa delle notifiche FCM, Email e Reminder
// ====================================

const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { emailService } = require('./email-service');

class UnifiedNotificationService {
    
    /**
     * Gestisce il controllo unificato delle notifiche
     */
    async handleUnifiedCheck() {
        const db = getFirestore();
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Determina che tipo di controlli fare
        const shouldCheckFCM = true; // Sempre ogni 30 minuti
        const shouldCheckEmail = this.isEmailTime(currentHour, currentMinute); // Ogni 6 ore
        const shouldCheckReminders = shouldCheckEmail; // Stesso timing email
        
        console.log(`📊 Controlli programmati - FCM: ${shouldCheckFCM}, Email: ${shouldCheckEmail}, Reminder: ${shouldCheckReminders}`);
        
        // Esegui i controlli necessari
        if (shouldCheckFCM) {
            await this.handleFCMNotifications(db, now);
        }
        
        if (shouldCheckEmail) {
            await this.handleEmailNotifications(db, now);
        }
        
        if (shouldCheckReminders) {
            await this.handleEventReminders(db, now);
        }
    }

    /**
     * Determina se è il momento giusto per inviare email (orari umani)
     */
    isEmailTime(hour, minute) {
        // Email inviate alle: 09:00, 12:00, 20:00
        // Con tolleranza di ±30 minuti per gli schedule
        const emailHours = [9, 12, 20];
        return emailHours.includes(hour) && minute <= 30;
    }

    /**
     * Gestisce le notifiche FCM per aggiornamenti recenti
     */
    async handleFCMNotifications(db, now) {
        console.log("📱 Controllo notifiche FCM...");
        
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        
        try {
            // Query per le novità degli ultimi 30 minuti
            const [notesQuery, shoppingQuery, eventsQuery] = await Promise.all([
                db.collection('notes')
                    .where('isPublic', '==', true)
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get(),
                db.collection('shopping_items')
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get(),
                db.collection('calendar_events')
                    .where('isPublic', '==', true)
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get()
            ]);
            
            const totalUpdates = notesQuery.size + shoppingQuery.size + eventsQuery.size;
            
            if (totalUpdates > 0) {
                console.log(`📱 Invio FCM per ${totalUpdates} aggiornamenti`);
                await this.sendFCMNotification({
                    notes: notesQuery.size,
                    shopping: shoppingQuery.size,
                    events: eventsQuery.size,
                    total: totalUpdates
                });
            } else {
                console.log("📱 Nessun aggiornamento per FCM");
            }
            
        } catch (error) {
            console.error("❌ Errore FCM:", error);
            throw error;
        }
    }

    /**
     * Invia notifica FCM con sommario aggiornamenti
     */
    async sendFCMNotification(summary) {
        try {
            const messaging = getMessaging();
            const topic = 'family-updates';
            
            let title, body;
            
            if (summary.total === 1) {
                // Messaggio specifico per singolo aggiornamento
                if (summary.notes > 0) {
                    title = "📝 Nuova Nota";
                    body = "Una nuova nota è stata aggiunta alla famiglia";
                } else if (summary.shopping > 0) {
                    title = "🛒 Nuovo Articolo";
                    body = "Un nuovo articolo è stato aggiunto alla lista spesa";
                } else if (summary.events > 0) {
                    title = "📅 Nuovo Evento";
                    body = "Un nuovo evento è stato programmato";
                }
            } else {
                // Messaggio generico per aggiornamenti multipli
                title = `🏠 ${summary.total} Aggiornamenti Famiglia`;
                body = `${summary.notes} note, ${summary.shopping} articoli, ${summary.events} eventi`;
            }
            
            const message = {
                notification: {
                    title: title,
                    body: body,
                    icon: '/icon-192x192.png'
                },
                data: {
                    click_action: 'https://familytasktracker-c2dfe.web.app',
                    notes: summary.notes.toString(),
                    shopping: summary.shopping.toString(),
                    events: summary.events.toString()
                },
                topic: topic,
                android: {
                    notification: {
                        channelId: 'family-updates',
                        priority: 'high',
                        defaultSound: true,
                        defaultVibrateTimings: true
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            badge: summary.total,
                            sound: 'default'
                        }
                    }
                },
                webpush: {
                    notification: {
                        badge: '/badge-72x72.png',
                        requireInteraction: false,
                        renotify: false,
                        tag: 'family-update'
                    }
                }
            };
            
            const response = await messaging.send(message);
            console.log('✅ FCM inviato con successo:', response);
            
        } catch (error) {
            console.error('❌ Errore invio FCM:', error.message);
            throw error;
        }
    }

    /**
     * Gestisce le notifiche email ogni 6 ore
     */
    async handleEmailNotifications(db, now) {
        console.log("📧 Controllo notifiche email...");
        
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        
        try {
            // Query per le novità delle ultime 6 ore
            const [notesQuery, shoppingQuery, eventsQuery] = await Promise.all([
                db.collection('notes')
                    .where('isPublic', '==', true)
                    .where('createdAt', '>', sixHoursAgo)
                    .get(),
                db.collection('shopping_items')
                    .where('createdAt', '>', sixHoursAgo)
                    .get(),
                db.collection('calendar_events')
                    .where('isPublic', '==', true)
                    .where('createdAt', '>', sixHoursAgo)
                    .get()
            ]);
            
            const summary = {
                notes: notesQuery.size,
                shopping: shoppingQuery.size,
                events: eventsQuery.size
            };
            
            const totalUpdates = summary.notes + summary.shopping + summary.events;
            
            if (totalUpdates > 0) {
                console.log(`📧 Invio email per ${totalUpdates} aggiornamenti ultime 6 ore`);
                await emailService.sendDailyEmail(summary, notesQuery.docs, shoppingQuery.docs, eventsQuery.docs);
            } else {
                console.log("📧 Nessun aggiornamento per email");
            }
            
        } catch (error) {
            console.error("❌ Errore email:", error);
            throw error;
        }
    }

    /**
     * Gestisce i reminder per eventi programmati
     */
    async handleEventReminders(db, now) {
        console.log("⏰ Controllo reminder eventi...");
        
        try {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            
            // Query eventi nelle prossime 24-48 ore che non hanno reminder inviato
            const eventsQuery = await db.collection('calendar_events')
                .where('isPublic', '==', true)
                .where('startDate', '>=', tomorrow)
                .where('startDate', '<', dayAfterTomorrow)
                .where('reminderSent', '==', false) // Campo per evitare duplicati
                .get();
            
            console.log(`⏰ Trovati ${eventsQuery.size} eventi per reminder`);
            
            if (eventsQuery.size > 0) {
                await this.sendEventReminders(eventsQuery.docs);
                
                // Marca eventi come "reminder inviato"
                const batch = db.batch();
                eventsQuery.docs.forEach(doc => {
                    batch.update(doc.ref, { reminderSent: true });
                });
                await batch.commit();
                
                console.log(`✅ Reminder inviati e marcati per ${eventsQuery.size} eventi`);
            }
            
        } catch (error) {
            console.error("❌ Errore reminder eventi:", error);
            throw error;
        }
    }

    /**
     * Invia reminder per eventi programmati (FCM + Email)
     */
    async sendEventReminders(eventDocs) {
        try {
            // 1. Invio FCM per reminder
            await this.sendReminderFCM(eventDocs);
            
            // 2. Invio Email per reminder
            await emailService.sendReminderEmail(eventDocs);
            
        } catch (error) {
            console.error("❌ Errore invio reminder:", error);
            throw error;
        }
    }

    /**
     * Invia notifiche FCM per reminder eventi
     */
    async sendReminderFCM(eventDocs) {
        try {
            const messaging = getMessaging();
            
            for (const eventDoc of eventDocs) {
                const eventData = eventDoc.data();
                const startDate = new Date(eventData.startDate.seconds * 1000);
                
                const message = {
                    notification: {
                        title: "⏰ Reminder Evento",
                        body: `"${eventData.title}" è previsto per domani alle ${startDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}`,
                        icon: '/icon-192x192.png'
                    },
                    data: {
                        click_action: 'https://familytasktracker-c2dfe.web.app',
                        type: 'event-reminder',
                        eventId: eventDoc.id
                    },
                    topic: 'family-updates',
                    android: {
                        notification: {
                            channelId: 'event-reminders',
                            priority: 'high',
                            defaultSound: true
                        }
                    }
                };
                
                await messaging.send(message);
                console.log(`✅ FCM reminder inviato per evento: ${eventData.title}`);
            }
            
        } catch (error) {
            console.error('❌ Errore FCM reminder:', error);
            throw error;
        }
    }

    /**
     * Restituisce lo stato del sistema per health check
     */
    async getSystemStatus() {
        try {
            const db = getFirestore();
            const messaging = getMessaging();
            
            // Test connessione database
            await db.collection('_health').limit(1).get();
            
            const status = {
                timestamp: new Date().toISOString(),
                database: 'operational',
                messaging: 'operational',
                email: await emailService.getEmailStatus(),
                version: '2.0.0'
            };
            
            return status;
            
        } catch (error) {
            console.error("❌ Errore status check:", error);
            return {
                timestamp: new Date().toISOString(),
                database: 'error',
                messaging: 'error',
                email: 'error',
                error: error.message
            };
        }
    }
}

// Export singleton instance
const unifiedNotificationService = new UnifiedNotificationService();
module.exports = { unifiedNotificationService };