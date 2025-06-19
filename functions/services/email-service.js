// ====================================
// functions/services/email-service.js
// Gestione completa delle email con template HTML avanzati - VERSIONE MIGLIORATA
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
            return ' ';
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
     * Filtra gli articoli shopping rimuovendo quelli senza nome
     */
    filterValidShoppingItems(shoppingData) {
        if (!shoppingData || !Array.isArray(shoppingData)) return [];
        
        return shoppingData.filter(item => {
            const itemData = item.data();
            return itemData && itemData.name && itemData.name.trim() !== '';
        });
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

            // Filtra gli articoli shopping validi
            const validShoppingData = this.filterValidShoppingItems(shoppingData);
            console.log(`🛒 Articoli shopping: ${shoppingData.length} totali, ${validShoppingData.length} validi`);

            // Aggiorna il summary per riflettere solo gli articoli validi
            const updatedSummary = {
                ...summary,
                shopping: validShoppingData.length
            };

            // Genera contenuto HTML e testo
            const htmlContent = this.generateEmailHTML(updatedSummary, notesData, validShoppingData, eventsData, today, timeString);
            const textContent = this.generatePlainTextFallback(updatedSummary, notesData, validShoppingData, eventsData, today, timeString);
            
            const totalUpdates = updatedSummary.notes + updatedSummary.shopping + updatedSummary.events;
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
     * Genera il contenuto HTML dell'email con template avanzato migliorato
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
        /* Reset CSS per compatibilità email */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background-color: #f5f7fa;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        
        /* Container principale */
        .email-wrapper {
            width: 100%;
            background-color: #f5f7fa;
            padding: 20px 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        /* Header moderno */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 32px 24px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9));
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .header h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .header .date {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 500;
        }
        
        /* Sezione riassuntiva moderna */
        .summary-section {
            padding: 32px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-bottom: 1px solid #e2e8f0;
        }
        
        .summary-title {
            text-align: center;
            font-size: 20px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 24px;
        }
        
        .summary-grid {
            display: flex;
            gap: 16px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .summary-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 20px 16px;
            text-align: center;
            flex: 1;
            min-width: 100px;
            max-width: 140px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }
        
        .summary-card:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
        }
        
        .summary-icon {
            font-size: 28px;
            margin-bottom: 12px;
            display: block;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
        }
        
        .summary-number {
            font-size: 36px;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 6px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .summary-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        
        .summary-card.notes .summary-number { 
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .summary-card.shopping .summary-number { 
            background: linear-gradient(135deg, #10b981, #059669);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .summary-card.events .summary-number { 
            background: linear-gradient(135deg, #f59e0b, #d97706);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* Contenuto principale */
        .content {
            padding: 32px 24px;
        }
        
        .section {
            margin-bottom: 32px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid #475569;
        }
        
        .section:last-child {
            margin-bottom: 0;
        }
        
        .section-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #475569;
        }
        
        .section-title {
            flex: 1;
            font-size: 20px;
            font-weight: 600;
            color: #ffffff;
        }
        
        .section-count {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 20px;
            min-width: 28px;
            text-align: center;
        }
        
        /* Elementi individuali */
        .item {
            background: #2d3748;
            border: 1px solid #4a5568;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 16px;
            transition: box-shadow 0.2s ease;
        }
        
        .item:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .item:last-child {
            margin-bottom: 0;
        }
        
        .item-title {
            font-size: 16px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .item-content {
            color: #ffffff;
            font-size: 14px;
            margin: 8px 0;
        }
        
        .item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #4a5568;
        }
        
        .item-author {
            color: #a0aec0;
            font-size: 13px;
            font-weight: 500;
        }
        
        .item-price {
            background: #065f46;
            color: #10b981;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
        }
        
        .item-category {
            background: #1e3a8a;
            color: #60a5fa;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
        }
        
        .item-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            font-size: 13px;
        }
        
        .item-link:hover {
            text-decoration: underline;
        }
        
        /* Footer */
        .footer {
            background: #f8fafc;
            padding: 32px 24px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 20px;
            transition: transform 0.2s ease;
        }
        
        .footer-button:hover {
            transform: translateY(-1px);
        }
        
        .footer-text {
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
        }
        
        /* Empty state */
        .empty-state {
            text-align: center;
            padding: 64px 24px;
            color: #64748b;
        }
        
        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.7;
        }
        
        .empty-state h3 {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .empty-state p {
            font-size: 14px;
        }
        
        /* Responsive */
        @media (max-width: 640px) {
            .email-wrapper { padding: 10px; }
            .email-container { border-radius: 8px; }
            .header { padding: 24px 20px; }
            .summary-section, .content, .footer { padding: 24px 20px; }
            .summary-grid { 
                gap: 12px;
                justify-content: center;
            }
            .summary-card { 
                min-width: 90px;
                max-width: 110px;
                padding: 16px 12px;
            }
            .summary-icon { font-size: 24px; margin-bottom: 8px; }
            .summary-number { font-size: 28px; }
            .summary-label { font-size: 11px; }
            .section { padding: 20px 16px; margin-bottom: 24px; }
            .section-header { 
                flex-direction: row; 
                align-items: center; 
                gap: 12px; 
                margin-bottom: 16px;
                padding-bottom: 12px;
            }
            .section-title { font-size: 18px; }
            .section-count { 
                font-size: 12px; 
                padding: 4px 10px; 
                min-width: 24px;
            }
            .item { 
                padding: 16px; 
                margin-bottom: 12px;
                border-radius: 8px;
            }
            .item-title { 
                font-size: 15px; 
                line-height: 1.4;
                margin-bottom: 6px;
            }
            .item-content { font-size: 13px; margin: 6px 0; }
            .item-meta { 
                flex-direction: column; 
                align-items: flex-start; 
                gap: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }
            .item-author { font-size: 12px; }
            .item-price, .item-category { 
                font-size: 12px; 
                padding: 3px 6px;
            }
            .item-link { font-size: 12px; }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            body { background-color: #0f172a; }
            .email-wrapper { background-color: #0f172a; }
            .email-container { background: #1e293b; }
            .footer { background: #334155; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <!-- Header -->
            <div class="header">
                <div class="header-content">
                    <h1>🏠 HomeTask Family</h1>
                    <div class="date">${today} • ${timeString}</div>
                </div>
            </div>

            <!-- Summary -->
            <div class="summary-section">
                <div class="summary-title">📊 Riepilogo Aggiornamenti</div>
                <div class="summary-grid">
                    <div class="summary-card notes">
                        <span class="summary-icon">📝</span>
                        <div class="summary-number">${summary.notes}</div>
                        <div class="summary-label">Note</div>
                    </div>
                    <div class="summary-card shopping">
                        <span class="summary-icon">🛒</span>
                        <div class="summary-number">${summary.shopping}</div>
                        <div class="summary-label">Shopping</div>
                    </div>
                    <div class="summary-card events">
                        <span class="summary-icon">📅</span>
                        <div class="summary-number">${summary.events}</div>
                        <div class="summary-label">Eventi</div>
                    </div>
                </div>
            </div>

            <!-- Content -->
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
            
            const preview = noteData.content ? 
                (noteData.content.length > 120 ? noteData.content.substring(0, 120) + '...' : noteData.content) : '';
            
            return `
            <div class="item">
                <div class="item-title">${noteData.title || 'Nota senza titolo'}</div>
                ${preview ? `<div class="item-content">${preview}</div>` : ''}
                <div class="item-meta">
                    <span class="item-author">👤 ${noteData.createdBy}</span>
                </div>
            </div>`;
        }).join('');
        
        return `
        <div class="section">
            <div class="section-header">
                <div class="section-title">Nuove Note</div>
                <div class="section-count">${notesData.length}</div>
            </div>
            ${notesHTML}
        </div>`;
    }

    /**
     * Genera sezione HTML per la shopping list (solo articoli validi)
     */
    generateShoppingSection(shoppingData) {
        if (!shoppingData || shoppingData.length === 0) return '';
        
        const shoppingHTML = shoppingData.map(item => {
            const itemData = item.data();
            
            const metaItems = [];
            metaItems.push(`<span class="item-author">👤 ${itemData.createdBy}</span>`);
            
            if (itemData.estimatedPrice) {
                metaItems.push(`<span class="item-price">€${itemData.estimatedPrice}</span>`);
            }
            
            if (itemData.category) {
                metaItems.push(`<span class="item-category">${itemData.category}</span>`);
            }
            
            if (itemData.link) {
                metaItems.push(`<a href="${itemData.link}" class="item-link">🔗 Link prodotto</a>`);
            }
            
            return `
            <div class="item">
                <div class="item-title">${itemData.name}</div>
                ${itemData.notes ? `<div class="item-content">${itemData.notes}</div>` : ''}
                <div class="item-meta">
                    ${metaItems.join('')}
                </div>
            </div>`;
        }).join('');
        
        return `
        <div class="section">
            <div class="section-header">
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
                <div class="item-meta">
                    <span class="item-author">👤 ${eventData.createdBy}</span>
                </div>
            </div>`;
        }).join('');
        
        return `
        <div class="section">
            <div class="section-header">
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