const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const nodemailer = require("nodemailer");

initializeApp();

// ================================
// FUNCTION UNIFICATA - OGNI 30 MINUTI
// ================================
exports.checkUpdatesUnified = onSchedule({
    schedule: "every 30 minutes", // Controllo base ogni 30 minuti
    timeZone: "Europe/Rome"
}, async (event) => {
    console.log("🔄 Controllo unificato notifiche famiglia...");
    
    const db = getFirestore();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Determina che tipo di controlli fare
    const shouldCheckFCM = true; // Sempre ogni 30 minuti
    const shouldCheckEmail = isEmailTime(currentHour, currentMinute); // Ogni 6 ore
    const shouldCheckReminders = shouldCheckEmail; // Stesso timing email
    
    console.log(`📊 Controlli programmati - FCM: ${shouldCheckFCM}, Email: ${shouldCheckEmail}, Reminder: ${shouldCheckReminders}`);
    
    try {
        // 1. CONTROLLO FCM (sempre)
        if (shouldCheckFCM) {
            await handleFCMNotifications(db, now);
        }
        
        // 2. CONTROLLO EMAIL (ogni 6 ore)
        if (shouldCheckEmail) {
            await handleEmailNotifications(db, now);
        }
        
        // 3. CONTROLLO REMINDER EVENTI (ogni 6 ore)
        if (shouldCheckReminders) {
            await handleEventReminders(db, now);
        }
        
    } catch (error) {
        console.error("❌ Errore nel sistema notifiche:", error);
    }
    
    return null;
});

// ================================
// LOGICA TIMING EMAIL (orari umani)
// ================================
function isEmailTime(hour, minute) {
    // Email inviate alle: 09:00, 12:00, 20:00
    // Con tolleranza di ±30 minuti per gli schedule
    const emailHours = [9, 12, 20];
    return emailHours.includes(hour) && minute <= 30;
}

// ================================
// 1. GESTIONE NOTIFICHE FCM
// ================================
async function handleFCMNotifications(db, now) {
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
            await sendFCMNotification({
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
    }
}

async function sendFCMNotification(summary) {
    try {
        const messaging = getMessaging();
        
        // Topic subscription per famiglia
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
    }
}

// ================================
// 2. GESTIONE EMAIL (ogni 6 ore)
// ================================
async function handleEmailNotifications(db, now) {
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
            await sendDailyEmail(summary, notesQuery.docs, shoppingQuery.docs, eventsQuery.docs);
        } else {
            console.log("📧 Nessun aggiornamento per email");
        }
        
    } catch (error) {
        console.error("❌ Errore email:", error);
    }
}

// ================================
// 3. GESTIONE REMINDER EVENTI (ogni 6 ore)
// ================================
async function handleEventReminders(db, now) {
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
            .where('reminderSent', '==', false) // Nuovo campo per evitare duplicati
            .get();
        
        console.log(`⏰ Trovati ${eventsQuery.size} eventi per reminder`);
        
        if (eventsQuery.size > 0) {
            await sendEventReminders(eventsQuery.docs);
            
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
    }
}

async function sendEventReminders(eventDocs) {
    try {
        // 1. Invio FCM per reminder
        await sendReminderFCM(eventDocs);
        
        // 2. Invio Email per reminder
        await sendReminderEmail(eventDocs);
        
    } catch (error) {
        console.error("❌ Errore invio reminder:", error);
    }
}

async function sendReminderFCM(eventDocs) {
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
    }
}

async function sendReminderEmail(eventDocs) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'familytrackersite@gmail.com',
                pass: 'ndil hxrt xgsy wqgd'
            }
        });
        
        const today = new Date().toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        let emailContent = `
🏠 REMINDER EVENTI FAMIGLIA - ${today}

⏰ EVENTI PROGRAMMATI PER DOMANI:

`;
        
        eventDocs.forEach(eventDoc => {
            const eventData = eventDoc.data();
            const startDate = new Date(eventData.startDate.seconds * 1000);
            const timeStr = eventData.isAllDay ? 'Tutto il giorno' : 
                startDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'});
            
            emailContent += `📅 "${eventData.title}"\n`;
            emailContent += `   ⏰ ${timeStr}\n`;
            if (eventData.location) emailContent += `   📍 ${eventData.location}\n`;
            if (eventData.description) emailContent += `   📝 ${eventData.description}\n`;
            emailContent += `   👤 Creato da: ${eventData.createdBy}\n\n`;
        });
        
        emailContent += `🔗 Vai all'app: https://familytasktracker-c2dfe.web.app\n\n`;
        emailContent += `---\nReminder automatico dal sistema HomeTask Family Tracker`;
        
        const mailOptions = {
            from: '"HomeTask Family Tracker" <familytrackersite@gmail.com>',
            to: 'f94dagos@gmail.com',
            subject: `⏰ Reminder: ${eventDocs.length} eventi programmati per domani`,
            text: emailContent
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email reminder inviata:', info.messageId);
        
    } catch (error) {
        console.error('❌ Errore email reminder:', error);
    }
}

// ================================
// 4. FUNZIONE EMAIL ESISTENTE
// ================================
async function sendDailyEmail(summary, notesData = [], shoppingData = [], eventsData = []) {
    try {
        console.log("📧 Configurazione Gmail con App Password...");
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'familytrackersite@gmail.com',
                pass: 'ndil hxrt xgsy wqgd'
            }
        });
        
        await transporter.verify();
        console.log("✅ Connessione Gmail verificata!");
        
        const today = new Date().toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeString = new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Costruisce il contenuto HTML professionale
        const htmlContent = generateEmailHTML(summary, notesData, shoppingData, eventsData, today, timeString);
        
        const totalUpdates = summary.notes + summary.shopping + summary.events;
        const subjectLine = totalUpdates === 1 
            ? `🏠 Family Tracker - 1 nuovo aggiornamento`
            : `🏠 Family Tracker - ${totalUpdates} nuovi aggiornamenti`;
        
        const mailOptions = {
            from: '"HomeTask Family Tracker" <familytrackersite@gmail.com>',
            to: 'f94dagos@gmail.com',
            subject: subjectLine,
            html: htmlContent,
            text: generatePlainTextFallback(summary, notesData, shoppingData, eventsData, today, timeString)
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email inviata con successo!');
        console.log('📧 Message ID:', info.messageId);
        
    } catch (error) {
        console.error('❌ Errore invio email:', error.message);
        throw error;
    }
}

function generatePlainTextFallback(summary, notesData, shoppingData, eventsData, today, timeString) {
    let content = `🏠 HOMETASK FAMILY - ${today} ${timeString}\n\n`;
    content += `📊 RIEPILOGO:\n`;
    content += `📝 ${summary.notes} nuove note\n`;
    content += `🛒 ${summary.shopping} nuovi articoli\n`;
    content += `📅 ${summary.events} nuovi eventi\n\n`;
    
    if (notesData && notesData.length > 0) {
        content += `📝 NUOVE NOTE (${notesData.length}):\n`;
        notesData.forEach(note => {
            const noteData = note.data();
            content += `  • "${noteData.title}" (da ${noteData.createdBy})\n`;
        });
        content += '\n';
    }
    
    if (shoppingData && shoppingData.length > 0) {
        content += `🛒 NUOVI ARTICOLI (${shoppingData.length}):\n`;
        shoppingData.forEach(item => {
            const itemData = item.data();
            content += `  • "${itemData.name}"`;
            if (itemData.estimatedPrice) content += ` - €${itemData.estimatedPrice}`;
            content += ` (da ${itemData.createdBy})\n`;
        });
        content += '\n';
    }
    
    if (eventsData && eventsData.length > 0) {
        content += `📅 NUOVI EVENTI (${eventsData.length}):\n`;
        eventsData.forEach(event => {
            const eventData = event.data();
            const startDate = new Date(eventData.startDate.seconds * 1000);
            content += `  • "${eventData.title}" - ${startDate.toLocaleDateString('it-IT')} (da ${eventData.createdBy})\n`;
        });
        content += '\n';
    }
    
    content += `🔗 Vai all'app: https://familytasktracker-c2dfe.web.app\n\n`;
    content += `---\nEmail automatica inviata dal sistema HomeTask Family Tracker`;
    
    return content;
}

// NOTA: La funzione generateEmailHTML va aggiunta qui con il nuovo template che hai approvato

function generateEmailHTML(summary, notesData, shoppingData, eventsData, today, timeString) {
    const totalUpdates = summary.notes + summary.shopping + summary.events;
    
    return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>HomeTask Family - Aggiornamenti</title>
    <style>
        /* Reset & Base */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2D3748;
            background-color: #F7FAFC;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        
        /* Container principale - Responsive */
        .email-container {
            width: 100% !important;
            max-width: 800px;
            margin: 0 auto;
            background: #FFFFFF;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        /* Header migliorato */
        .header {
            background: linear-gradient(135deg, #E07A5F 0%, #D16850 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20px;
            background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.1) 50%);
        }
        
        .header h1 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 12px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .header .subtitle {
            font-size: 18px;
            opacity: 0.95;
            font-weight: 500;
            letter-spacing: 0.5px;
        }
        
        /* Summary Cards - Completamente ridisegnato */
        .summary {
            background: linear-gradient(135deg, #F8FAFC 0%, #EDF2F7 100%);
            padding: 40px 30px;
            border-bottom: 3px solid #E2E8F0;
        }
        
        .summary-title {
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 30px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .summary-grid {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .summary-item {
            background: white;
            padding: 30px 25px;
            border-radius: 16px;
            text-align: center;
            border-left: 6px solid;
            flex: 1;
            min-width: 200px;
            max-width: 250px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .summary-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        
        .summary-item::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            opacity: 0.1;
            background: currentColor;
            transform: translate(20px, -20px);
        }
        
        .summary-item.notes { 
            border-left-color: #8B5CF6;
            color: #8B5CF6;
        }
        .summary-item.shopping { 
            border-left-color: #10B981;
            color: #10B981;
        }
        .summary-item.events { 
            border-left-color: #F59E0B;
            color: #F59E0B;
        }
        
        .summary-number {
            font-size: 48px;
            font-weight: 900;
            color: #1A202C;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
        }
        
        .summary-label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            position: relative;
            z-index: 2;
        }
        
        /* Content area */
        .content {
            padding: 50px 30px;
        }
        
        /* Sections migliorato */
        .section {
            margin-bottom: 50px;
            background: #FAFAFA;
            border-radius: 20px;
            padding: 30px;
            border: 2px solid #E2E8F0;
        }
        
        .section:last-child {
            margin-bottom: 0;
        }
        
        .section-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #E2E8F0;
        }
        
        .section-icon {
            font-size: 24px;
            width: 50px;
            height: 50px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .section-icon.notes { background: linear-gradient(135deg, #8B5CF6, #7C3AED); }
        .section-icon.shopping { background: linear-gradient(135deg, #10B981, #059669); }
        .section-icon.events { background: linear-gradient(135deg, #F59E0B, #D97706); }
        
        .section-title {
            font-size: 24px;
            font-weight: 700;
            color: #1A202C;
            flex: 1;
        }
        
        .section-count {
            background: linear-gradient(135deg, #E07A5F, #D16850);
            color: white;
            font-size: 14px;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(224, 122, 95, 0.3);
        }
        
        /* Items migliorato */
        .item {
            background: white;
            border: 2px solid #E2E8F0;
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .item:last-child {
            margin-bottom: 0;
        }
        
        .item:hover {
            border-color: #E07A5F;
            box-shadow: 0 8px 30px rgba(224, 122, 95, 0.15);
            transform: translateX(5px);
        }
        
        .item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(135deg, #E07A5F, #D16850);
            transform: scaleY(0);
            transition: transform 0.3s ease;
        }
        
        .item:hover::before {
            transform: scaleY(1);
        }
        
        .item-title {
            font-weight: 700;
            color: #1A202C;
            font-size: 20px;
            line-height: 1.4;
            margin-bottom: 12px;
        }
        
        .item-content {
            color: #718096;
            font-size: 16px;
            line-height: 1.6;
            margin: 15px 0;
        }
        
        .item-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin: 15px 0;
        }
        
        .meta-badge {
            background: #EDF2F7;
            color: #4A5568;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #E2E8F0;
        }
        
        .meta-badge.priority-high { 
            background: linear-gradient(135deg, #FED7D7, #FEB2B2); 
            color: #C53030; 
            border-color: #FEB2B2;
        }
        .meta-badge.priority-medium { 
            background: linear-gradient(135deg, #FEEBC8, #FBD38D); 
            color: #DD6B20; 
            border-color: #FBD38D;
        }
        .meta-badge.priority-low { 
            background: linear-gradient(135deg, #C6F6D5, #9AE6B4); 
            color: #2F855A; 
            border-color: #9AE6B4;
        }
        .meta-badge.price { 
            background: linear-gradient(135deg, #BEE3F8, #90CDF4); 
            color: #2B6CB0; 
            border-color: #90CDF4;
        }
        .meta-badge.pinned { 
            background: linear-gradient(135deg, #FEFCBF, #FAF089); 
            color: #B7791F; 
            border-color: #FAF089;
        }
        .meta-badge.public { 
            background: linear-gradient(135deg, #C6F6D5, #9AE6B4); 
            color: #22543D; 
            border-color: #9AE6B4;
        }
        
        .item-author {
            color: #A0AEC0;
            font-size: 14px;
            margin-top: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
        }
        
        .date-info {
            background: linear-gradient(135deg, #EBF8FF, #BEE3F8);
            color: #2B6CB0;
            padding: 15px 20px;
            border-radius: 12px;
            font-size: 15px;
            margin: 15px 0;
            border-left: 4px solid #3182CE;
            font-weight: 600;
        }
        
        /* Footer migliorato */
        .footer {
            background: linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%);
            padding: 40px 30px;
            text-align: center;
            border-top: 3px solid #E2E8F0;
        }
        
        .footer-button {
            display: inline-block;
            background: linear-gradient(135deg, #E07A5F 0%, #D16850 100%);
            color: white;
            padding: 18px 36px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 25px;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(224, 122, 95, 0.3);
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .footer-button:hover {
            background: linear-gradient(135deg, #D16850 0%, #B85A47 100%);
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(224, 122, 95, 0.4);
        }
        
        .footer-text {
            color: #718096;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .empty-state {
            text-align: center;
            padding: 80px 30px;
            color: #A0AEC0;
        }
        
        .empty-state-icon {
            font-size: 80px;
            margin-bottom: 25px;
        }
        
        .empty-state h3 {
            font-size: 24px;
            color: #4A5568;
            margin-bottom: 10px;
        }
        
        .empty-state p {
            font-size: 16px;
            color: #718096;
        }
        
        /* RESPONSIVE DESIGN - Mobile First */
        @media (max-width: 768px) {
            .email-container {
                margin: 0;
                box-shadow: none;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 28px;
            }
            
            .header .subtitle {
                font-size: 16px;
            }
            
            .summary {
                padding: 30px 20px;
            }
            
            .summary-grid {
                flex-direction: column;
                gap: 15px;
            }
            
            .summary-item {
                min-width: auto;
                max-width: none;
                padding: 25px 20px;
            }
            
            .summary-number {
                font-size: 42px;
            }
            
            .content {
                padding: 30px 20px;
            }
            
            .section {
                padding: 25px 20px;
                margin-bottom: 30px;
            }
            
            .section-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            
            .section-title {
                font-size: 20px;
            }
            
            .item {
                padding: 20px;
            }
            
            .item-title {
                font-size: 18px;
            }
            
            .footer {
                padding: 30px 20px;
            }
            
            .footer-button {
                padding: 15px 30px;
                font-size: 14px;
            }
        }
        
        /* Desktop large */
        @media (min-width: 1200px) {
            .email-container {
                max-width: 900px;
            }
            
            .summary-item {
                min-width: 220px;
                max-width: 280px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1>🏠 HomeTask Family</h1>
            <div class="subtitle">${today} • ${timeString}</div>
        </div>

        <!-- Summary -->
        <div class="summary">
            <div class="summary-title">📊 Riepilogo Aggiornamenti</div>
            <div class="summary-grid">
                <div class="summary-item notes">
                    <div class="summary-number">${summary.notes}</div>
                    <div class="summary-label">Note</div>
                </div>
                <div class="summary-item shopping">
                    <div class="summary-number">${summary.shopping}</div>
                    <div class="summary-label">Shopping</div>
                </div>
                <div class="summary-item events">
                    <div class="summary-number">${summary.events}</div>
                    <div class="summary-label">Eventi</div>
                </div>
            </div>
        </div>

        <div class="content">
            ${generateNotesSection(notesData)}
            ${generateShoppingSection(shoppingData)}
            ${generateEventsSection(eventsData)}
            
            ${totalUpdates === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">😴</div>
                <h3>Tutto tranquillo!</h3>
                <p>Nessun nuovo aggiornamento in famiglia oggi.</p>
            </div>
            ` : ''}
        </div>

        <!-- Footer -->
        <div class="footer">
            <a href="https://familytasktracker-c2dfe.web.app" class="footer-button">
                🚀 Apri HomeTask
            </a>
            <div class="footer-text">
                Email automatica dal sistema HomeTask Family Tracker<br>
                Gestisci le tue preferenze nell'app
            </div>
        </div>
    </div>
</body>
</html>`;
}

function generateNotesSection(notesData) {
    if (!notesData || notesData.length === 0) return '';
    
    const notesHTML = notesData.map(note => {
        const noteData = note.data();
        const badges = [];
        
        if (noteData.isPinned) badges.push('<span class="meta-badge pinned">📌 Pinnata</span>');
        if (noteData.isPublic) badges.push('<span class="meta-badge public">🌍 Pubblica</span>');
        if (noteData.tags && noteData.tags.length > 0) {
            noteData.tags.slice(0, 3).forEach(tag => {
                badges.push(`<span class="meta-badge">#${tag}</span>`);
            });
        }
        
        const preview = noteData.content ? 
            (noteData.content.length > 120 ? noteData.content.substring(0, 120) + '...' : noteData.content) : '';
        
        return `
        <div class="item">
            <div class="item-header">
                <div class="item-title">${noteData.title || 'Nota senza titolo'}</div>
            </div>
            ${preview ? `<div class="item-content">${preview}</div>` : ''}
            <div class="item-meta">
                ${badges.join('')}
            </div>
            <div class="item-author">👤 ${noteData.createdBy}</div>
        </div>`;
    }).join('');
    
    return `
    <div class="section">
        <div class="section-header">
            <div class="section-icon notes">📝</div>
            <div class="section-title">Nuove Note</div>
            <div class="section-count">${notesData.length}</div>
        </div>
        ${notesHTML}
    </div>`;
}

function generateShoppingSection(shoppingData) {
    if (!shoppingData || shoppingData.length === 0) return '';
    
    const shoppingHTML = shoppingData.map(item => {
        const itemData = item.data();
        const badges = [];
        
        if (itemData.priority) {
            badges.push(`<span class="meta-badge priority-${itemData.priority}">⚡ ${itemData.priority.toUpperCase()}</span>`);
        }
        if (itemData.estimatedPrice) {
            badges.push(`<span class="meta-badge price">💰 €${itemData.estimatedPrice}</span>`);
        }
        if (itemData.category) {
            badges.push(`<span class="meta-badge">🏷️ ${itemData.category}</span>`);
        }
        
        return `
        <div class="item">
            <div class="item-header">
                <div class="item-title">${itemData.name || 'Articolo senza nome'}</div>
            </div>
            ${itemData.notes ? `<div class="item-content">${itemData.notes}</div>` : ''}
            <div class="item-meta">
                ${badges.join('')}
            </div>
            ${itemData.link ? `<div class="item-content"><a href="${itemData.link}" style="color: #E07A5F;">🔗 Link prodotto</a></div>` : ''}
            <div class="item-author">👤 ${itemData.createdBy}</div>
        </div>`;
    }).join('');
    
    return `
    <div class="section">
        <div class="section-header">
            <div class="section-icon shopping">🛒</div>
            <div class="section-title">Nuovi Articoli</div>
            <div class="section-count">${shoppingData.length}</div>
        </div>
        ${shoppingHTML}
    </div>`;
}

function generateEventsSection(eventsData) {
    if (!eventsData || eventsData.length === 0) return '';
    
    const eventsHTML = eventsData.map(event => {
        const eventData = event.data();
        const startDate = new Date(eventData.startDate.seconds * 1000);
        const endDate = new Date(eventData.endDate.seconds * 1000);
        const badges = [];
        
        if (eventData.eventType) {
            const typeIcons = { personal: '👤', family: '👪', work: '💼', appointment: '📅', reminder: '⏰' };
            badges.push(`<span class="meta-badge">${typeIcons[eventData.eventType] || '📅'} ${eventData.eventType}</span>`);
        }
        if (eventData.isAllDay) badges.push('<span class="meta-badge">🌅 Tutto il giorno</span>');
        if (eventData.isPublic) badges.push('<span class="meta-badge public">🌍 Pubblico</span>');
        if (eventData.location) badges.push(`<span class="meta-badge">📍 ${eventData.location}</span>`);
        
        const dateInfo = eventData.isAllDay ? 
            startDate.toLocaleDateString('it-IT') :
            `${startDate.toLocaleDateString('it-IT')} ${startDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})} - ${endDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}`;
        
        return `
        <div class="item">
            <div class="item-header">
                <div class="item-title">${eventData.title || 'Evento senza titolo'}</div>
            </div>
            <div class="date-info">📅 ${dateInfo}</div>
            ${eventData.description ? `<div class="item-content">${eventData.description}</div>` : ''}
            <div class="item-meta">
                ${badges.join('')}
            </div>
            ${eventData.attendees && eventData.attendees.length > 0 ? 
                `<div class="item-content">👥 Partecipanti: ${eventData.attendees.join(', ')}</div>` : ''}
            <div class="item-author">👤 ${eventData.createdBy}</div>
        </div>`;
    }).join('');
    
    return `
    <div class="section">
        <div class="section-header">
            <div class="section-icon events">📅</div>
            <div class="section-title">Nuovi Eventi</div>
            <div class="section-count">${eventsData.length}</div>
        </div>
        ${eventsHTML}
    </div>`;
}

function generatePlainTextFallback(summary, notesData, shoppingData, eventsData, today, timeString) {
    let content = `🏠 HOMETASK FAMILY - ${today} ${timeString}\n\n`;
    content += `📊 RIEPILOGO:\n`;
    content += `📝 ${summary.notes} nuove note\n`;
    content += `🛒 ${summary.shopping} nuovi articoli\n`;
    content += `📅 ${summary.events} nuovi eventi\n\n`;
    
    if (notesData && notesData.length > 0) {
        content += `📝 NUOVE NOTE (${notesData.length}):\n`;
        notesData.forEach(note => {
            const noteData = note.data();
            content += `  • "${noteData.title}" (da ${noteData.createdBy})\n`;
        });
        content += '\n';
    }
    
    if (shoppingData && shoppingData.length > 0) {
        content += `🛒 NUOVI ARTICOLI (${shoppingData.length}):\n`;
        shoppingData.forEach(item => {
            const itemData = item.data();
            content += `  • "${itemData.name}"`;
            if (itemData.estimatedPrice) content += ` - €${itemData.estimatedPrice}`;
            content += ` (da ${itemData.createdBy})\n`;
        });
        content += '\n';
    }
    
    if (eventsData && eventsData.length > 0) {
        content += `📅 NUOVI EVENTI (${eventsData.length}):\n`;
        eventsData.forEach(event => {
            const eventData = event.data();
            const startDate = new Date(eventData.startDate.seconds * 1000);
            content += `  • "${eventData.title}" - ${startDate.toLocaleDateString('it-IT')} (da ${eventData.createdBy})\n`;
        });
        content += '\n';
    }
    
    content += `🔗 Vai all'app: https://familytasktracker-c2dfe.web.app\n\n`;
    content += `---\nEmail automatica inviata dal sistema HomeTask Family Tracker`;
    
    return content;
}