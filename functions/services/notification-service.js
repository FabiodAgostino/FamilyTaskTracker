// ====================================
// functions/services/notification-service.js
// Gestione completa delle notifiche FCM, Email e Reminder
// AGGIORNATO per integrarsi con il nuovo sistema di gestione destinatari
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
        const shouldCheckEmail = this.isEmailTime(currentHour, currentMinute); // Ogni 6 ore per aggiornamenti
        const shouldCheckReminders = true; // 🆕 SEMPRE ogni 30 minuti per reminder eventi
        
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
     * 🔄 MODIFICATO: Gestisce le notifiche FCM considerando tutti gli item (privacy gestita lato client)
     */
    async handleFCMNotifications(db, now) {
        console.log("📱 Controllo notifiche FCM...");
        
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        
        try {
            // 🆕 Query per TUTTI gli item recenti (non solo pubblici)
            // Il filtering per privacy sarà gestito lato client/app
            const [notesQuery, shoppingQuery, eventsQuery] = await Promise.all([
                db.collection('notes')
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get(),
                db.collection('shopping_items')
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get(),
                db.collection('calendar_events')
                    .where('createdAt', '>', thirtyMinutesAgo)
                    .get()
            ]);
            
            // 🆕 Filtra per contare solo gli item pubblici per il messaggio FCM
            const publicNotes = notesQuery.docs.filter(doc => doc.data().isPublic).length;
            const publicShopping = shoppingQuery.docs.filter(doc => doc.data().isPublic).length;
            const publicEvents = eventsQuery.docs.filter(doc => doc.data().isPublic).length;
            
            const totalPublicUpdates = publicNotes + publicShopping + publicEvents;
            const totalAllUpdates = notesQuery.size + shoppingQuery.size + eventsQuery.size;
            
            console.log(`📱 Aggiornamenti trovati: ${totalAllUpdates} totali, ${totalPublicUpdates} pubblici`);
            
            if (totalPublicUpdates > 0) {
                console.log(`📱 Invio FCM per ${totalPublicUpdates} aggiornamenti pubblici`);
                await this.sendFCMNotification({
                    notes: publicNotes,
                    shopping: publicShopping,
                    events: publicEvents,
                    total: totalPublicUpdates
                });
            } else {
                console.log("📱 Nessun aggiornamento pubblico per FCM");
            }
            
        } catch (error) {
            console.error("❌ Errore FCM:", error);
            throw error;
        }
    }

    /**
     * ✅ FIXED: Invia notifica FCM con payload corretto (senza icon nel notification)
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
            
            // ✅ FIXED: Payload FCM corretto senza icon nel notification
            const message = {
                notification: {
                    title: title,
                    body: body
                    // ❌ RIMOSSO: icon field non supportato qui
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
                        defaultVibrateTimings: true,
                        // ✅ ICON per Android va qui
                        icon: 'ic_notification',
                        color: '#2196F3'
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
                        // ✅ ICON per Web va qui
                        icon: '/icon-192x192.png',
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
     * 🔄 MODIFICATO: Gestisce le notifiche email ogni 6 ore - lascia che email service gestisca privacy
     */
    async handleEmailNotifications(db, now) {
        console.log("📧 Controllo notifiche email...");
        
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        
        try {
            // 🆕 Query per TUTTI gli item delle ultime 6 ore (non solo pubblici)
            // L'email service gestirà internamente privacy e destinatari
            const [notesQuery, shoppingQuery, eventsQuery] = await Promise.all([
                db.collection('notes')
                    .where('createdAt', '>', sixHoursAgo)
                    .get(),
                db.collection('shopping_items')
                    .where('createdAt', '>', sixHoursAgo)
                    .get(),
                db.collection('calendar_events')
                    .where('createdAt', '>', sixHoursAgo)
                    .get()
            ]);
            
            // 🆕 Summary iniziale con tutti gli item (l'email service filtrerà)
            const initialSummary = {
                notes: notesQuery.size,
                shopping: shoppingQuery.size,
                events: eventsQuery.size
            };
            
            const totalUpdates = initialSummary.notes + initialSummary.shopping + initialSummary.events;
            
            if (totalUpdates > 0) {
                console.log(`📧 Processando ${totalUpdates} aggiornamenti ultime 6 ore (email service gestirà filtering)`);
                
                // 🆕 L'email service ora gestisce:
                // - Filtering per flag "send" 
                // - Determinazione destinatari basata su privacy
                // - Aggiornamento automatico flag "send"
                const emailResult = await emailService.sendDailyEmail(
                    initialSummary, 
                    notesQuery.docs, 
                    shoppingQuery.docs, 
                    eventsQuery.docs
                );
                
                if (emailResult.success) {
                    if (emailResult.messageId) {
                        console.log(`✅ Email inviata a ${emailResult.recipients?.length || 0} destinatari`);
                        console.log(`📧 Aggiornamenti effettivi: ${emailResult.totalUpdates || 0}`);
                    } else {
                        console.log(`📧 Email non inviata: ${emailResult.reason || 'motivo sconosciuto'}`);
                    }
                }
                
            } else {
                console.log("📧 Nessun aggiornamento nelle ultime 6 ore");
            }
            
        } catch (error) {
            console.error("❌ Errore email:", error);
            throw error;
        }
    }

    /**
     * 🔄 MODIFICATO: Gestisce i reminder includendo TUTTI gli eventi (privacy gestita da email service)
     */
     async handleEventReminders(db, now) {
        console.log("⏰ Controllo reminder eventi (ogni 30 minuti)...");
        
        // Calcola finestra temporale per eventi che iniziano tra 23-25 ore
        const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        
        try {
            // 🆕 Query per eventi nelle prossime 24h CHE NON HANNO ANCORA RICEVUTO REMINDER
            const eventsQuery = await db.collection('calendar_events')
                .where('startDate', '>=', twentyThreeHoursFromNow)
                .where('startDate', '<=', twentyFiveHoursFromNow)
                .where('reminderSent', '==', false) // 🔑 CHIAVE: solo eventi senza reminder
                .get();
            
            const eventDocs = eventsQuery.docs;
            
            if (eventDocs.length > 0) {
                console.log(`⏰ Trovati ${eventDocs.length} eventi che necessitano reminder nelle prossime 24h`);
                
                // Elabora ogni evento individualmente
                for (const eventDoc of eventDocs) {
                    const eventData = eventDoc.data();
                    const eventId = eventDoc.id;
                    const startDate = new Date(eventData.startDate.seconds * 1000);
                    const hoursUntilEvent = Math.round((startDate.getTime() - now.getTime()) / (1000 * 60 * 60));
                    
                    console.log(`⏰ Processando evento: "${eventData.title}" - tra ${hoursUntilEvent}h`);
                    
                    try {
                        // 1. Invia FCM per eventi pubblici
                        if (eventData.isPublic) {
                            console.log(`📱 Invio FCM reminder per evento pubblico: ${eventData.title}`);
                            await this.sendReminderFCM([eventDoc]);
                        }
                        
                        // 2. Invia Email (gestisce pubblici e privati)
                        console.log(`📧 Invio email reminder per evento: ${eventData.title}`);
                        const emailResult = await emailService.sendReminderEmail([eventDoc]);
                        
                        // 3. 🆕 AGGIORNA FLAG reminderSent = true
                        await eventDoc.ref.update({
                            reminderSent: true,
                            reminderSentAt: now // Timestamp per debug/audit
                        });
                        
                        console.log(`✅ Reminder completato per evento: ${eventData.title}`);
                        console.log(`📧 Email result: ${emailResult.success ? 'SUCCESS' : 'FAILED'}`);
                        
                        if (emailResult.success && emailResult.recipients) {
                            console.log(`📧 Destinatari: ${emailResult.recipients.join(', ')}`);
                        }
                        
                    } catch (eventError) {
                        console.error(`❌ Errore reminder per evento ${eventData.title}:`, eventError);
                        // Non bloccare gli altri eventi in caso di errore su uno specifico
                        continue;
                    }
                }
                
                console.log(`✅ Completato processing di ${eventDocs.length} reminder eventi`);
                
            } else {
                console.log("⏰ Nessun evento nelle prossime 24h che necessita reminder");
            }
            
        } catch (error) {
            console.error("❌ Errore generale gestione reminder:", error);
            throw error;
        }
    }

    /**
     * 🔄 AGGIORNATO: Logging migliorato per FCM reminder
     */
    async sendReminderFCM(eventDocs) {
        try {
            const messaging = getMessaging();
            
            for (const eventDoc of eventDocs) {
                const eventData = eventDoc.data();
                const startDate = new Date(eventData.startDate.seconds * 1000);
                const hoursUntilEvent = Math.round((startDate.getTime() - Date.now()) / (1000 * 60 * 60));
                
                const message = {
                    notification: {
                        title: "⏰ Reminder Evento",
                        body: `"${eventData.title}" è previsto tra ${hoursUntilEvent} ore`
                    },
                    data: {
                        click_action: 'https://familytasktracker-c2dfe.web.app',
                        type: 'event-reminder',
                        eventId: eventDoc.id,
                        hoursUntil: hoursUntilEvent.toString()
                    },
                    topic: 'family-updates',
                    android: {
                        notification: {
                            channelId: 'event-reminders',
                            priority: 'high',
                            defaultSound: true,
                            icon: 'ic_notification',
                            color: '#FF9800'
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
                            requireInteraction: true,
                            tag: 'event-reminder'
                        }
                    }
                };
                
                await messaging.send(message);
                console.log(`✅ FCM reminder inviato per evento: ${eventData.title} (tra ${hoursUntilEvent}h)`);
            }
            
        } catch (error) {
            console.error('❌ Errore FCM reminder:', error);
            throw error;
        }
    }
    /**
     * Inizializza l'email service
     */
    async initializeEmailService() {
        try {
            await emailService.initializeTransporter();
            console.log("✅ Email service inizializzato nel notification service");
        } catch (error) {
            console.error("❌ Errore inizializzazione email service:", error);
            throw error;
        }
    }

    /**
     * 🆕 Metodo di utilità per testare il nuovo sistema di destinatari
     */
    async testEmailRecipients() {
        try {
            console.log("🧪 Test sistema destinatari email...");
            
            const users = await emailService.getAllUsers();
            console.log(`👥 Utenti trovati: ${users.length}`);
            users.forEach(user => {
                console.log(`  - ${user.username} (${user.email}) - ${user.role}`);
            });
            
            return {
                success: true,
                usersCount: users.length,
                users: users
            };
            
        } catch (error) {
            console.error("❌ Errore test destinatari:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🆕 METODO DI UTILITÀ: Reset flag reminder per test/debug
     */
    async resetReminderFlags(eventIds = null) {
        try {
            const db = getFirestore();
            
            let query = db.collection('calendar_events');
            
            if (eventIds) {
                // Reset solo eventi specifici
                for (const eventId of eventIds) {
                    await db.collection('calendar_events').doc(eventId).update({
                        reminderSent: false,
                        reminderSentAt: null
                    });
                }
                console.log(`🔄 Reset reminder flags per ${eventIds.length} eventi specifici`);
            } else {
                // Reset TUTTI gli eventi (pericoloso, solo per debug)
                const allEvents = await query.get();
                const batch = db.batch();
                
                allEvents.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        reminderSent: false,
                        reminderSentAt: null
                    });
                });
                
                await batch.commit();
                console.log(`🔄 Reset reminder flags per TUTTI i ${allEvents.size} eventi`);
            }
            
        } catch (error) {
            console.error('❌ Errore reset reminder flags:', error);
            throw error;
        }
    }

    /**
     * 🆕 METODO DI UTILITÀ: Status reminder eventi
     */
    async getReminderStatus() {
        try {
            const db = getFirestore();
            const now = new Date();
            
            // Eventi futuri
            const futureEvents = await db.collection('calendar_events')
                .where('startDate', '>', now)
                .get();
            
            // Eventi con reminder già inviato
            const reminderSentEvents = await db.collection('calendar_events')
                .where('reminderSent', '==', true)
                .where('startDate', '>', now)
                .get();
            
            // Eventi nelle prossime 24h senza reminder
            const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const pendingReminders = await db.collection('calendar_events')
                .where('startDate', '>=', now)
                .where('startDate', '<=', twentyFourHoursFromNow)
                .where('reminderSent', '==', false)
                .get();
            
            return {
                timestamp: now.toISOString(),
                futureEvents: futureEvents.size,
                remindersSent: reminderSentEvents.size,
                pendingReminders: pendingReminders.size,
                pendingEvents: pendingReminders.docs.map(doc => ({
                    id: doc.id,
                    title: doc.data().title,
                    startDate: new Date(doc.data().startDate.seconds * 1000).toISOString(),
                    hoursUntil: Math.round((doc.data().startDate.seconds * 1000 - now.getTime()) / (1000 * 60 * 60))
                }))
            };
            
        } catch (error) {
            console.error('❌ Errore status reminder:', error);
            return { error: error.message };
        }
    }

    /**
     * 🔄 AGGIORNATO: Restituisce lo stato del sistema per health check
     */
    async getSystemStatus() {
        try {
            const db = getFirestore();
            const messaging = getMessaging();
            
            // Test connessione database
            await db.collection('_health').limit(1).get();
            
            // 🆕 Test del nuovo sistema utenti
            const usersTest = await this.testEmailRecipients();
            
            const status = {
                timestamp: new Date().toISOString(),
                database: 'operational',
                messaging: 'operational',
                email: await emailService.getEmailStatus(),
                userSystem: usersTest.success ? 'operational' : 'error',
                userCount: usersTest.usersCount || 0,
                version: '3.0.0',  // 🆕 Version bump per nuovo sistema destinatari
                features: {
                    dynamicRecipients: true,
                    sendTracking: true,
                    privacyFiltering: true
                }
            };
            
            return status;
            
        } catch (error) {
            console.error("❌ Errore status check:", error);
            return {
                timestamp: new Date().toISOString(),
                database: 'error',
                messaging: 'error',
                email: 'error',
                userSystem: 'error',
                error: error.message,
                version: '3.0.0'
            };
        }
    }

    /**
     * 🆕 Metodo per forzare l'invio di test email (utile per debug)
     */
    async sendTestEmail() {
        try {
            console.log("🧪 Invio email di test...");
            
            const db = getFirestore();
            const now = new Date();
            
            // Prende alcuni item recenti per test
            const [notesQuery, shoppingQuery, eventsQuery] = await Promise.all([
                db.collection('notes').limit(2).get(),
                db.collection('shopping_items').limit(2).get(),
                db.collection('calendar_events').limit(2).get()
            ]);
            
            const summary = {
                notes: notesQuery.size,
                shopping: shoppingQuery.size,  
                events: eventsQuery.size
            };
            
            const result = await emailService.sendDailyEmail(
                summary,
                notesQuery.docs,
                shoppingQuery.docs, 
                eventsQuery.docs
            );
            
            console.log("✅ Email di test completata:", result);
            return result;
            
        } catch (error) {
            console.error("❌ Errore email di test:", error);
            throw error;
        }
    }
}

// Export singleton instance
const unifiedNotificationService = new UnifiedNotificationService();
module.exports = { unifiedNotificationService };