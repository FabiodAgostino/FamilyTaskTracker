// ====================================
// functions/services/reminder-service.js
// Gestione completa dei promemoria con Cloud Tasks
// ====================================

const { CloudTasksClient } = require('@google-cloud/tasks');
const { getFirestore } = require("firebase-admin/firestore");
const admin = require('firebase-admin');

class ReminderService {
    constructor() {
        this.tasksClient = new CloudTasksClient();
        this.projectId = process.env.GCLOUD_PROJECT || 'familytasktracker-dev';
        this.location = 'europe-west1';
        this.queueName = 'queue';
    }

    /**
     * Entry point principale - gestisce tutte le richieste
     */
     async handleRequest(req) {
        const { domain } = req.body;
        console.log("DOMINIO: "+domain);
        // Capitalizza la prima lettera (se ti serve gestire 'reminder' o 'calendar' minuscoli)
        const capDomain = domain.charAt(0).toUpperCase() + domain.slice(1);

        const supported = ['Reminder','Calendar'];
        if (!supported.includes(capDomain)) {
        throw new Error(`Dominio non supportato: ${domain}. Valori ammessi: ${supported.join(', ')}`);
        }

        const methodName = `handleRequest${capDomain}`;

        if (typeof this[methodName] !== 'function') {
        throw new Error(`Dominio non supportato: ${domain}`);
        }

        // Invoca in automatico handleRequestReminder o handleRequestCalendar
        return await this[methodName](req);
    }

    async handleRequestReminder(req) {
         const { action, reminderId, reminderData, taskId } = req.body;

        console.log(`🎯 Reminder Task Service - Action: ${action}, ID: ${reminderId}`);

        switch (action) {
            case 'create':
                return await this.createReminder(reminderData);
            
            case 'update':
                return await this.updateReminder(reminderId, reminderData);
            
            case 'delete':
                return await this.deleteReminder(taskId);
            
            case 'executeReminderEvent':
                return await this.executeReminder(reminderId);
            
            default:
                throw new Error(`Action non supportata: ${action}`);
        }
    }
    async handleRequestCalendar(req) {
         const { action, eventId, eventData,taskId } = req.body;

        console.log(`🎯 Calendar Task Service - Action: ${action}, ID: ${eventId}`);

        switch (action) {
            case 'create':
                return await this.createCalendarEventReminder(eventData);
            
            case 'update':
                return await this.updateCalendarEventReminder(eventId, eventData);
            
            case 'delete':
                return await this.deleteCalendarEventReminder(taskId);
            
            case 'executeCalendarEvent':
                return await this.executeCalendarEventReminder(eventId);
            
            default:
                throw new Error(`Action non supportata: ${action}`);
        }
    }
    /**
     * Crea un nuovo promemoria e il relativo Cloud Task
     */
    async createReminder(reminderData) {
        try {
            console.log('📝 Creazione nuovo promemoria...');

            const db = getFirestore();
            const reminderRef = db.collection('reminders').doc(reminderData.id);
            let taskId = null;
            if (reminderData.isActive && new Date(reminderData.scheduledTime) > new Date()) {
                taskId = await this.createCloudTask(reminderData.id, reminderData.scheduledTime);
                
                // 3. Aggiorna il promemoria con l'ID del task
                await reminderRef.update({
                    cloudTaskId: taskId
                });
                
                console.log(`✅ Cloud Task creato: ${taskId}`);
            }

            return {
                success: true,
                reminderId: reminderData.id,
                taskId: taskId,
                message: 'Promemoria creato con successo'
            };

        } catch (error) {
            console.error('❌ Errore creazione promemoria:', error);
            throw error;
        }
    }

    /**
     * Aggiorna un promemoria esistente
     */
    async updateReminder(reminderId, updateData) {
        try {
            console.log(`🔄 Aggiornamento promemoria: ${reminderId}`);
            
            const db = getFirestore();
            const reminderRef = db.collection('reminders').doc(reminderId);
            const reminderDoc = await reminderRef.get();

            if (!reminderDoc.exists) {
                throw new Error('Promemoria non trovato');
            }

            const currentData = reminderDoc.data();

            // 1. Se ha un Cloud Task esistente, cancellalo
            if (currentData.cloudTaskId) {
                await this.deleteCloudTask(currentData.cloudTaskId);
                console.log(`🗑️ Cloud Task precedente cancellato: ${currentData.cloudTaskId}`);
            }

            // 3. Crea nuovo Cloud Task se necessario
            let newTaskId = null;
            const newScheduledTime = updateData.scheduledTime || currentData.scheduledTime;
            const isActive = updateData.isActive !== undefined ? updateData.isActive : currentData.isActive;
            const isSnooze = updateData.snoozeUntil !== null && updateData.snoozeUntil !==undefined;
            if ((isSnooze && new Date(updateData.snoozeUntil) > new Date())) {
                newTaskId = await this.createCloudTask(reminderId, updateData.snoozeUntil);
                
                await reminderRef.update({
                    cloudTaskId: newTaskId
                });
                
                console.log(`✅ Nuovo Cloud Task creato (posticipato): ${newTaskId}`);
            }
            else
            {
            if ((isActive && new Date(newScheduledTime) > new Date())) {
                newTaskId = await this.createCloudTask(reminderId, newScheduledTime);
                
                await reminderRef.update({
                    cloudTaskId: newTaskId
                });
                
                console.log(`✅ Nuovo Cloud Task creato: ${newTaskId}`);
            }
            }
            return {
                success: true,
                reminderId: reminderId,
                taskId: newTaskId,
                message: 'Promemoria aggiornato con successo'
            };

        } catch (error) {
            console.error('❌ Errore aggiornamento promemoria:', error);
            throw error;
        }
    }

    /**
     * Elimina (disattiva) un promemoria
     */
    async deleteReminder(cloudTaskId) {
        try {
            console.log(`🗑️ Eliminazione promemoria: ${cloudTaskId}`);
            
        

            // 1. Cancella il Cloud Task se esiste
            if (cloudTaskId) {
                await this.deleteCloudTask(cloudTaskId);
                console.log(`🗑️ Cloud Task cancellato: ${cloudTaskId}`);
            }

            return {
                success: true,
                reminderId: cloudTaskId,
                message: 'Promemoria eliminato con successo'
            };

        } catch (error) {
            console.error('❌ Errore eliminazione promemoria:', error);
            throw error;
        }
    }

    /**
     * Esegue un promemoria (chiamato dal Cloud Task)
     */
    async executeReminder(reminderId) {
        try {
            console.log(`⏰ Esecuzione promemoria: ${reminderId}`);
            
            const db = getFirestore();
            const reminderRef = db.collection('reminders').doc(reminderId);
            const reminderDoc = await reminderRef.get();

            if (!reminderDoc.exists) {
                throw new Error('Promemoria non trovato');
            }

            const reminderData = reminderDoc.data();

            // 1. Verifica che il promemoria sia ancora attivo
            if (!reminderData.isActive) {
                console.log('⏭️ Promemoria non più attivo, skip');
                return { success: true, message: 'Promemoria non attivo' };
            }

            // 2. Invia le notifiche
            await this.sendReminderNotifications(reminderId, reminderData);

            // 3. Aggiorna il promemoria come eseguito
            await reminderRef.update({
                notificationSent: true,
                notificationSentAt: new Date(),
                completedAt: new Date(),
                lastTriggered: new Date(),
                triggerCount: (reminderData.triggerCount || 0) + 1,
                cloudTaskId: null, // Clear task ID after execution
                updatedAt: new Date()
            });

            // 4. Gestisci ricorrenza se necessario
            if (reminderData.isRecurring && reminderData.recurrencePattern) {
                await this.handleRecurrence(reminderId, reminderData);
            } else {
                // Se non ricorrente, disattiva dopo l'esecuzione
                await reminderRef.update({
                    isActive: false
                });
            }

            return {
                success: true,
                reminderId: reminderId,
                message: 'Promemoria eseguito con successo'
            };

        } catch (error) {
            console.error('❌ Errore esecuzione promemoria:', error);
            throw error;
        }
    }

    /**
     * Crea un Cloud Task per l'esecuzione programmata
     */
    async createCloudTask(reminderId, scheduledTime) {
        try {
            const queuePath = this.tasksClient.queuePath(
                this.projectId,
                this.location,
                this.queueName
            );

            // URL della stessa funzione ma con action=execute
            const functionUrl = `https://${this.location}-${this.projectId}.cloudfunctions.net/manageReminders`;

            const payload = JSON.stringify({
                action: 'executeReminderEvent',
                reminderId: reminderId
            });

           const date = new Date(scheduledTime);
            // azzera secondi e millisecondi
            date.setSeconds(0, 0);

            // infine costruisci il task usando i secondi UNIX precisi e nanos a zero
            const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: functionUrl,
                body: Buffer.from(payload).toString('base64'),
                headers: {
                'Content-Type': 'application/json',
                },
            },
            scheduleTime: {
                seconds: Math.floor(date.getTime() / 1000),
                nanos: 0,
            },
            };
            // Genera un nome univoco per il task
            const taskId = `reminder-${reminderId}-${Date.now()}`;
            const taskPath = this.tasksClient.taskPath(
                this.projectId,
                this.location,
                this.queueName,
                taskId
            );

            task.name = taskPath;

            const [response] = await this.tasksClient.createTask({
                parent: queuePath,
                task: task,
                domain:"Reminder"
            });

            console.log(`✅ Cloud Task creato: ${response.name}`);
            return taskId;

        } catch (error) {
            console.error('❌ Errore creazione Cloud Task:', error);
            throw error;
        }
    }

    /**
     * Cancella un Cloud Task esistente
     */
    async deleteCloudTask(taskId) {
        try {
            const taskPath = this.tasksClient.taskPath(
                this.projectId,
                this.location,
                this.queueName,
                taskId
            );

            await this.tasksClient.deleteTask({ name: taskPath });
            console.log(`✅ Cloud Task cancellato: ${taskId}`);

        } catch (error) {
            // Non fallire se il task non esiste più
            if (error.code === 5) { // NOT_FOUND
                console.log(`⚠️ Cloud Task già cancellato o non trovato: ${taskId}`);
            } else {
                console.error('❌ Errore cancellazione Cloud Task:', error);
                throw error;
            }
        }
    }

    /**
     * Invia le notifiche del promemoria
     */
    async sendReminderNotifications(reminderId, reminderData) {
        try {
            console.log('📨 Invio notifiche promemoria...');

            // 1. Determina i destinatari
            const recipients = await this.getReminderRecipients(reminderData);

            if (recipients.length === 0) {
                console.log('📭 Nessun destinatario per il promemoria');
                return;
            }

            // 2. Prepara il messaggio
            const notificationTitle = `⏰ Promemoria`;
            const notificationBody = reminderData.title;

            // 3. Invia notifiche FCM
            await this.sendFCMNotifications(recipients, notificationTitle, notificationBody, reminderData);

            console.log(`✅ Notifiche inviate a ${recipients.length} destinatari`);

        } catch (error) {
            console.error('❌ Errore invio notifiche:', error);
            // Non far fallire l'esecuzione per errori di notifica
        }
    }

    /**
     * Determina i destinatari del promemoria
     */
    async getReminderRecipients(reminderData) {
        try {
            const db = getFirestore();
            const tokens = [];

            // Se è pubblico/familiare, invia a tutti
            if (reminderData.isPublic && reminderData.reminderType === 'family') {
                const tokensSnapshot = await db.collection('fcm-tokens')
                    .where('isActive', '==', true)
                    .where('expiresAt', '>', new Date())
                    .get();

                tokensSnapshot.forEach(doc => {
                    const tokenData = doc.data();
                    // Escludi il creatore se vuoi
                   if (tokenData.username !== 'admin') {
                        tokens.push(tokenData.token);
                    }
                });
            } else {
                // Se è personale, invia solo al creatore
                const tokensSnapshot = await db.collection('fcm-tokens')
                    .where('isActive', '==', true)
                    .where('expiresAt', '>', new Date())
                    .where('username', '==', reminderData.createdBy)
                    .get();

                tokensSnapshot.forEach(doc => {
                    tokens.push(doc.data().token);
                });
            }

            return tokens;

        } catch (error) {
            console.error('❌ Errore recupero destinatari:', error);
            return [];
        }
    }

    /**
     * Invia notifiche FCM
     */
    async sendFCMNotifications(tokens, title, body, reminderData) {
        try {
            if (tokens.length === 0) return;

            const messaging = admin.messaging();
            
            const message = {
                notification: { title, body },
                data: {
                    type: 'reminder',
                    reminderId: reminderData.id || 'unknown',
                    reminderType: reminderData.reminderType || 'personal',
                    priority: reminderData.priority || 'medium',
                    timestamp: Date.now().toString()
                },
                tokens: tokens
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`📨 FCM inviato: ${response.successCount}/${tokens.length}`);

        } catch (error) {
            console.error('❌ Errore FCM:', error);
        }
    }

    /**
     * Gestisce la ricorrenza creando il prossimo promemoria
     */
    async handleRecurrence(reminderId, reminderData) {
        try {
            console.log('🔄 Gestione ricorrenza...');

            // Calcola la prossima data di esecuzione
            const nextDate = this.calculateNextOccurrence(reminderData);

            if (!nextDate) {
                console.log('🔚 Ricorrenza terminata');
                return;
            }

            // Crea il nuovo promemoria per la prossima occorrenza
            const nextReminderData = {
                ...reminderData,
                scheduledTime: nextDate,
                notificationSent: false,
                triggerCount: 0,
                cloudTaskId: null,
                lastTriggered: null
            };

            // Rimuovi l'ID per crearne uno nuovo
            delete nextReminderData.id;

            const result = await this.createReminder(nextReminderData);
            console.log(`✅ Prossima occorrenza creata: ${result.reminderId}`);

        } catch (error) {
            console.error('❌ Errore gestione ricorrenza:', error);
        }
    }

    /**
     * Calcola la prossima data di occorrenza
     */
    calculateNextOccurrence(reminderData) {
        const pattern = reminderData.recurrencePattern;
        if (!pattern) return null;

        const lastTrigger = reminderData.lastTriggered || reminderData.scheduledTime;
        let nextDate = new Date(lastTrigger);

        switch (pattern.type) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + pattern.interval);
                break;
            
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + (7 * pattern.interval));
                break;
            
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + pattern.interval);
                break;
            
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + pattern.interval);
                break;
            
            default:
                return null;
        }

        // Verifica limiti di ricorrenza
        if (pattern.endDate && nextDate > new Date(pattern.endDate)) {
            return null;
        }

        if (pattern.maxOccurrences && reminderData.triggerCount >= pattern.maxOccurrences) {
            return null;
        }

        return nextDate;
    }

        /**
     * Crea un Cloud Task per un evento calendar
     */
    async createCalendarEventReminder(eventData) {
        try {
            console.log('📅 Creazione Cloud Task per evento calendar...');

            const db = getFirestore();
            const eventRef = db.collection('calendar_events').doc(eventData.id);
            let taskId = null;

            if (eventData.reminderMinutes && eventData.reminderTime && new Date(eventData.reminderTime) > new Date()) {
                taskId = await this.createCloudTaskForEvent(eventData.id, eventData.reminderTime);
                
                // Aggiorna l'evento con l'ID del task
                await eventRef.update({
                    cloudTaskId: taskId
                });
                
                console.log(`✅ Cloud Task creato per evento: ${taskId}`);
            }

            return {
                success: true,
                eventId: eventData.id,
                taskId: taskId,
                message: 'Cloud Task evento creato con successo'
            };

        } catch (error) {
            console.error('❌ Errore creazione Cloud Task evento:', error);
            throw error;
        }
    }

    /**
     * Aggiorna un Cloud Task per un evento calendar
     */
    async updateCalendarEventReminder(eventId, eventData) {
        try {
            console.log(`🔄 Aggiornamento Cloud Task per evento: ${eventId}`);
            
            const db = getFirestore();
            const eventRef = db.collection('calendar_events').doc(eventId);
            const eventDoc = await eventRef.get();

            if (!eventDoc.exists) {
                throw new Error('Evento non trovato');
            }

            const currentData = eventDoc.data();

            // 1. Se ha un Cloud Task esistente, cancellalo
            if (currentData.cloudTaskId) {
                await this.deleteCloudTask(currentData.cloudTaskId);
                console.log(`🗑️ Cloud Task precedente cancellato: ${currentData.cloudTaskId}`);
            }

            // 2. Crea nuovo Cloud Task se necessario
            let newTaskId = null;
            if (eventData.reminderMinutes && eventData.reminderTime && 
                !eventData.reminderSent && new Date(eventData.reminderTime) > new Date()) {
                
                newTaskId = await this.createCloudTaskForEvent(eventId, eventData.reminderTime);
                
                await eventRef.update({
                    cloudTaskId: newTaskId
                });
                
                console.log(`✅ Nuovo Cloud Task creato per evento: ${newTaskId}`);
            }

            return {
                success: true,
                eventId: eventId,
                taskId: newTaskId,
                message: 'Cloud Task evento aggiornato con successo'
            };

        } catch (error) {
            console.error('❌ Errore aggiornamento Cloud Task evento:', error);
            throw error;
        }
    }

    /**
     * Elimina un Cloud Task per un evento calendar
     */
    async deleteCalendarEventReminder(taskId) {
        try {
            console.log(`🗑️ Eliminazione Cloud Task evento: ${taskId}`);

            if (taskId) {
                await this.deleteCloudTask(taskId);
                console.log(`🗑️ Cloud Task evento cancellato: ${taskId}`);
            }

            return {
                success: true,
                taskId: taskId,
                message: 'Cloud Task evento eliminato con successo'
            };

        } catch (error) {
            console.error('❌ Errore eliminazione Cloud Task evento:', error);
            throw error;
        }
    }

    /**
     * Esegue la notifica per un evento calendar
     */
    async executeCalendarEventReminder(eventId) {
        try {
            console.log(`📅 Esecuzione notifica per evento: ${eventId}`);
            
            const db = getFirestore();
            const eventRef = db.collection('calendar_events').doc(eventId);
            const eventDoc = await eventRef.get();

            if (!eventDoc.exists) {
                throw new Error('Evento non trovato');
            }

            const eventData = eventDoc.data();

            // Verifica che la notifica non sia già stata inviata
            if (eventData.reminderSent) {
                console.log('⏭️ Notifica già inviata per questo evento, skip');
                return { success: true, message: 'Notifica già inviata' };
            }

            // Calcola il tempo rimanente all'evento
            const eventStartTime = new Date(eventData.startDate.seconds * 1000);
            const now = new Date();
            const hoursUntilEvent = Math.round((eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60));
            const minutesUntilEvent = Math.round((eventStartTime.getTime() - now.getTime()) / (1000 * 60));

            // Prepara il messaggio della notifica
            let timeMessage;
            if (hoursUntilEvent >= 24) {
                const days = Math.round(hoursUntilEvent / 24);
                timeMessage = `tra ${days} giorno${days > 1 ? 'i' : ''}`;
            } else if (hoursUntilEvent >= 1) {
                timeMessage = `tra ${hoursUntilEvent} or${hoursUntilEvent > 1 ? 'e' : 'a'}`;
            } else {
                timeMessage = `tra ${minutesUntilEvent} minut${minutesUntilEvent > 1 ? 'i' : 'o'}`;
            }

            const title = "📅 Promemoria Evento";
            const body = `"${eventData.title}" inizia ${timeMessage}`;

            // Invia le notifiche
            await this.sendEventNotifications(eventId, eventData, title, body);

            // Aggiorna l'evento come notificato
            await eventRef.update({
                reminderSent: true,
                reminderSentAt: new Date(),
                cloudTaskId: null,
                updatedAt: new Date()
            });

            console.log(`✅ Notifica evento inviata: ${eventData.title}`);

            return {
                success: true,
                eventId: eventId,
                message: 'Notifica evento inviata con successo'
            };

        } catch (error) {
            console.error('❌ Errore esecuzione notifica evento:', error);
            throw error;
        }
    }

    /**
     * Crea un Cloud Task specifico per eventi
     */
    async createCloudTaskForEvent(eventId, reminderTime) {
        try {
            const queuePath = this.tasksClient.queuePath(
                this.projectId,
                this.location,
                this.queueName
            );

            const functionUrl = `https://${this.location}-${this.projectId}.cloudfunctions.net/manageReminders`;

            const payload = JSON.stringify({
                domain: 'Calendar',
                action: 'executeCalendarEvent',
                eventId: eventId
            });

            const date = new Date(reminderTime);
            date.setSeconds(0, 0);

            const task = {
                httpRequest: {
                    httpMethod: 'POST',
                    url: functionUrl,
                    body: Buffer.from(payload).toString('base64'),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                scheduleTime: {
                    seconds: Math.floor(date.getTime() / 1000),
                    nanos: 0,
                },
            };

            const taskId = `event-${eventId}-${Date.now()}`;
            const taskPath = this.tasksClient.taskPath(
                this.projectId,
                this.location,
                this.queueName,
                taskId
            );

            task.name = taskPath;

            const [response] = await this.tasksClient.createTask({
                domain:'Calendar',
                parent: queuePath,
                task: task,
            });

            console.log(`✅ Cloud Task per evento creato: ${response.name}`);
            return taskId;

        } catch (error) {
            console.error('❌ Errore creazione Cloud Task per evento:', error);
            throw error;
        }
    }

    /**
     * Invia notifiche per un evento (FCM)
     */
    async sendEventNotifications(eventId, eventData, title, body) {
        try {
            // 1. Ottieni i token FCM per gli utenti autorizzati
            const tokens = await this.getEventRecipients(eventData);
            
            // 2. Invia notifica FCM
            if (tokens.length > 0) {
                await this.sendFCMNotifications(tokens, title, body, {
                    type: 'event-reminder',
                    eventId: eventId,
                    ...eventData
                });
            }
            
        } catch (error) {
            console.error('❌ Errore invio notifiche evento:', error);
            throw error;
        }
    }

    /**
     * Determina i destinatari delle notifiche per eventi
     */
    /**
 * Determina i destinatari delle notifiche per eventi
 */
    async getEventRecipients(eventData) {
        try {
            const db = getFirestore();
            const tokens = [];

            // Se è pubblico, invia a tutti (escluso admin) - STESSA LOGICA DEI PROMEMORIA
            if (eventData.isPublic) {
                const tokensSnapshot = await db.collection('fcm-tokens')
                    .where('isActive', '==', true)
                    .where('expiresAt', '>', new Date())
                    .get();

                tokensSnapshot.forEach(doc => {
                    const tokenData = doc.data();
                    // Escludi admin (stessa logica dei promemoria)
                    if (tokenData.username !== 'admin') {
                        tokens.push(tokenData.token);
                    }
                });
            } else {
                // Se è privato, invia solo al creatore - STESSA LOGICA DEI PROMEMORIA
                const tokensSnapshot = await db.collection('fcm-tokens')
                    .where('isActive', '==', true)
                    .where('expiresAt', '>', new Date())
                    .where('username', '==', eventData.createdBy)
                    .get();

                tokensSnapshot.forEach(doc => {
                    tokens.push(doc.data().token);
                });
            }

            return tokens;

        } catch (error) {
            console.error('❌ Errore recupero destinatari evento:', error);
            return [];
        }
    }
}

// Export singleton instance
const reminderService = new ReminderService();
module.exports = { reminderService };