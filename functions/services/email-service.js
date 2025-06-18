// ====================================
// functions/services/email-service.js
// Gestione completa delle email con template HTML avanzati - VERSIONE SICURA
// ====================================

const nodemailer = require("nodemailer");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class EmailService {
    constructor() {
        this.transporter = null;
        this.secretClient = new SecretManagerServiceClient();
    }

    /**
     * Recupera la password Gmail da Secret Manager
     */
    async getGmailPassword() {
        try {
            const gmailSecretPath = process.env.GMAIL_SECRET_PATH;
            
            // Se la variabile inizia con "ndil", è già la password diretta (fallback)
            if (gmailSecretPath && gmailSecretPath.startsWith('ndil')) {
                console.log('🔑 Usando password Gmail diretta da variabile d\'ambiente...');
                return gmailSecretPath;
            }
            
            // Altrimenti, usa Secret Manager
            console.log('🔑 Recuperando password Gmail da Secret Manager...');
            const [version] = await this.secretClient.accessSecretVersion({ 
                name: gmailSecretPath || process.env.GMAIL_APP_PASSWORD 
            });
            
            const password = version.payload.data.toString('utf8').trim();
            console.log('✅ Password Gmail recuperata da Secret Manager');
            
            return password;
            
        } catch (error) {
            console.error('❌ Errore nel recupero password Gmail:', error.message);
            // Fallback alla password hardcoded se Secret Manager fallisce
            console.log('🔄 Fallback alla password hardcoded...');
            return 'bcbn yssz culf kamf';
        }
    }

    /**
     * Inizializza il transporter Nodemailer con Gmail
     */
    async initializeTransporter() {
        const gmailPassword = await this.getGmailPassword();
        // Se il transporter esiste già, non crearne uno nuovo
        if (this.transporter) {
            console.log("✅ Transporter già inizializzato, riutilizzo quello esistente");
            return;
        }
        
        try {
            
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'familytrackersite@gmail.com',
                    pass: gmailPassword
                }
            });
            
            // Verifica la connessione
            await this.transporter.verify();
            console.log("✅ Email service inizializzato correttamente con Secret Manager");
            
        } catch (error) {
            console.error("❌ Errore inizializzazione email service:", error);
            // Se fallisce, assicurati che transporter sia null
            this.transporter = null;
            throw error;
        }
    }

    /**
     * Invia email giornaliera con aggiornamenti famiglia
     */
    async sendDailyEmail(summary, notesData = [], shoppingData = [], eventsData = []) {
        try {
            console.log("📧 Preparazione email giornaliera...");
            
            // Assicurati che il transporter sia inizializzato
            if (!this.transporter) {
                await this.initializeTransporter();
            }
            
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

            // Genera contenuto HTML e testo
            const htmlContent = this.generateEmailHTML(summary, notesData, shoppingData, eventsData, today, timeString);
            const textContent = this.generatePlainTextFallback(summary, notesData, shoppingData, eventsData, today, timeString);
            
            const totalUpdates = summary.notes + summary.shopping + summary.events;
            const subjectLine = totalUpdates === 1 
                ? `🏠 Family Tracker - 1 nuovo aggiornamento`
                : `🏠 Family Tracker - ${totalUpdates} nuovi aggiornamenti`;
            
            const mailOptions = {
                from: '"HomeTask Family Tracker" <familytrackersite@gmail.com>',
                to: 'f94dagos@gmail.com',
                subject: subjectLine,
                html: htmlContent,
                text: textContent
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email giornaliera inviata con successo!');
            console.log('📧 Message ID:', info.messageId);
            
            return { success: true, messageId: info.messageId };
            
        } catch (error) {
            console.error('❌ Errore invio email giornaliera:', error.message);
            throw error;
        }
    }

    /**
     * Invia email di reminder per eventi programmati
     */
    async sendReminderEmail(eventDocs) {
        try {
            console.log("📧 Preparazione email reminder eventi...");
            
            if (!this.transporter) {
                await this.initializeTransporter();
            }
            
            const today = new Date().toLocaleDateString('it-IT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let emailContent = `🏠 REMINDER EVENTI FAMIGLIA - ${today}\n\n⏰ EVENTI PROGRAMMATI PER DOMANI:\n\n`;
            
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
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email reminder inviata:', info.messageId);
            
            return { success: true, messageId: info.messageId };
            
        } catch (error) {
            console.error('❌ Errore email reminder:', error);
            throw error;
        }
    }

    /**
     * Chiude il transporter e rilascia le risorse
     */
    async closeTransporter() {
        if (this.transporter) {
            console.log("🔄 Chiudendo transporter email...");
            this.transporter.close();
            this.transporter = null;
            console.log("✅ Transporter chiuso correttamente");
        }
    }

    /**
     * Verifica lo stato del servizio email
     */
    async getEmailStatus() {
        try {
            if (!this.transporter) {
                await this.initializeTransporter();
            }
            
            await this.transporter.verify();
            return 'operational';
            
        } catch (error) {
            console.error("❌ Email service non operativo:", error);
            return 'error';
        }
    }

    /**
     * Genera il contenuto HTML dell'email con template avanzato
     */
    generateEmailHTML(summary, notesData, shoppingData, eventsData, today, timeString) {
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
        
        /* Container principale */
        .email-container {
            width: 100% !important;
            max-width: 800px;
            margin: 0 auto;
            background: #FFFFFF;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        /* Header */
        .header {
            background: linear-gradient(135deg, #E07A5F 0%, #D16850 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
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
        }
        
        /* Summary */
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
        }
        
        .summary-item.notes { border-left-color: #8B5CF6; color: #8B5CF6; }
        .summary-item.shopping { border-left-color: #10B981; color: #10B981; }
        .summary-item.events { border-left-color: #F59E0B; color: #F59E0B; }
        
        .summary-number {
            font-size: 48px;
            font-weight: 900;
            color: #1A202C;
            margin-bottom: 8px;
        }
        
        .summary-label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        
        /* Content */
        .content {
            padding: 50px 30px;
        }
        
        .section {
            margin-bottom: 50px;
            background: #FAFAFA;
            border-radius: 20px;
            padding: 30px;
            border: 2px solid #E2E8F0;
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
        }
        
        /* Items */
        .item {
            background: white;
            border: 2px solid #E2E8F0;
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
        }
        
        .item-title {
            font-weight: 700;
            color: #1A202C;
            font-size: 20px;
            margin-bottom: 12px;
        }
        
        .item-content {
            color: #718096;
            font-size: 16px;
            margin: 15px 0;
        }
        
        .item-author {
            color: #A0AEC0;
            font-size: 14px;
            margin-top: 15px;
        }
        
        /* Footer */
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
        }
        
        .footer-text {
            color: #718096;
            font-size: 14px;
        }
        
        /* Empty state */
        .empty-state {
            text-align: center;
            padding: 80px 30px;
            color: #A0AEC0;
        }
        
        .empty-state-icon {
            font-size: 80px;
            margin-bottom: 25px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .summary-grid { flex-direction: column; }
            .summary-item { min-width: auto; max-width: none; }
            .section-header { flex-direction: column; align-items: flex-start; }
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
            ${this.generateNotesSection(notesData)}
            ${this.generateShoppingSection(shoppingData)}
            ${this.generateEventsSection(eventsData)}
            
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

    /**
     * Genera sezione HTML per le note
     */
    generateNotesSection(notesData) {
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
                <div class="item-title">${noteData.title || 'Nota senza titolo'}</div>
                ${preview ? `<div class="item-content">${preview}</div>` : ''}
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

    /**
     * Genera sezione HTML per la shopping list
     */
    generateShoppingSection(shoppingData) {
        if (!shoppingData || shoppingData.length === 0) return '';
        
        const shoppingHTML = shoppingData.map(item => {
            const itemData = item.data();
            
            return `
            <div class="item">
                <div class="item-title">${itemData.name || 'Articolo senza nome'}</div>
                ${itemData.notes ? `<div class="item-content">${itemData.notes}</div>` : ''}
                ${itemData.estimatedPrice ? `<div class="item-content">💰 €${itemData.estimatedPrice}</div>` : ''}
                ${itemData.category ? `<div class="item-content">🏷️ ${itemData.category}</div>` : ''}
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

    /**
     * Genera sezione HTML per gli eventi
     */
    generateEventsSection(eventsData) {
        if (!eventsData || eventsData.length === 0) return '';
        
        const eventsHTML = eventsData.map(event => {
            const eventData = event.data();
            const startDate = new Date(eventData.startDate.seconds * 1000);
            const endDate = new Date(eventData.endDate.seconds * 1000);
            
            const dateInfo = eventData.isAllDay ? 
                startDate.toLocaleDateString('it-IT') :
                `${startDate.toLocaleDateString('it-IT')} ${startDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})} - ${endDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}`;
            
            return `
            <div class="item">
                <div class="item-title">${eventData.title || 'Evento senza titolo'}</div>
                <div class="item-content">📅 ${dateInfo}</div>
                ${eventData.description ? `<div class="item-content">${eventData.description}</div>` : ''}
                ${eventData.location ? `<div class="item-content">📍 ${eventData.location}</div>` : ''}
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

    /**
     * Genera versione di testo semplice come fallback
     */
    generatePlainTextFallback(summary, notesData, shoppingData, eventsData, today, timeString) {
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
}

// Export singleton instance
const emailService = new EmailService();
module.exports = { emailService };