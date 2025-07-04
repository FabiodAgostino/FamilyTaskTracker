// ====================================
// functions/services/email-service.js
// Gestione completa delle email con template HTML avanzati - VERSIONE MIGLIORATA
// CON GESTIONE DINAMICA DESTINATARI E TRACCIAMENTO INVIO
// ====================================

const nodemailer = require("nodemailer");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { getFirestore } = require("firebase-admin/firestore");

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
     * 🆕 Recupera tutti gli utenti con email dalla collezione users
     */
    async getAllUsers() {
        try {
            const db = getFirestore();
            const usersSnapshot = await db.collection('users').get();
            
            const users = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.email && userData.isActive !== false) {
                    users.push({
                        id: doc.id,
                        username: userData.username,
                        email: userData.email,
                        displayName: userData.displayName || userData.username,
                        role: userData.role || 'user'
                    });
                }
            });
            
            console.log(`📧 Trovati ${users.length} utenti attivi con email`);
            return users;
        } catch (error) {
            console.error('❌ Errore nel recupero utenti:', error);
            return [];
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
     * 🆕 Genera sezione HTML per le note con layout mobile-friendly
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
                    <div class="meta-tag meta-author">👤 ${noteData.createdBy}</div>
                    <div class="meta-tag meta-privacy ${noteData.isPublic ? 'public' : ''}">
                        ${noteData.isPublic ? '🌍 Pubblico' : '🔒 Privato'}
                    </div>
                </div>
            </div>`;
        }).join('');
        
        return `
        <div class="section">
            <div class="section-header">
                <div class="section-title">
                    📝 Nuove Note
                    <div class="section-count">${notesData.length}</div>
                </div>
            </div>
            ${notesHTML}
        </div>`;
    }

    /**
     * 🆕 Genera sezione HTML per la shopping list con layout mobile-friendly
     */
    generateShoppingSection(shoppingData) {
        if (!shoppingData || shoppingData.length === 0) return '';
        
        const shoppingHTML = shoppingData.map(item => {
            const itemData = item.data();
            
            const metaItems = [];
            
            // Autore
            metaItems.push(`<div class="meta-tag meta-author">👤 ${itemData.createdBy}</div>`);
            
            // Privacy
            metaItems.push(`<div class="meta-tag meta-privacy ${itemData.isPublic ? 'public' : ''}">
                ${itemData.isPublic ? '🌍 Pubblico' : '🔒 Privato'}
            </div>`);
            
            // Prezzo
            if (itemData.estimatedPrice) {
                metaItems.push(`<div class="meta-tag meta-price">€${itemData.estimatedPrice}</div>`);
            }
            
            // Link prodotto
            if (itemData.link) {
                metaItems.push(`<a href="${itemData.link}" class="item-link">🔗 Vedi prodotto</a>`);
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
                <div class="section-title">
                    🛒 Nuovi Articoli
                    <div class="section-count">${shoppingData.length}</div>
                </div>
            </div>
            ${shoppingHTML}
        </div>`;
    }

    /**
     * 🆕 Genera sezione HTML per gli eventi con layout mobile-friendly
     */
    generateEventsSection(eventsData) {
        if (!eventsData || eventsData.length === 0) return '';
        
        const eventsHTML = eventsData.map(event => {
            const eventData = event.data();
            const startDate = new Date(eventData.startDate.seconds * 1000);
            const endDate = new Date(eventData.endDate.seconds * 1000);
            
            const dateInfo = eventData.isAllDay ? 
                `📅 ${startDate.toLocaleDateString('it-IT')}` :
                `📅 ${startDate.toLocaleDateString('it-IT')} ${startDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})} - ${endDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}`;
            
            const metaItems = [];
            
            // Autore
            metaItems.push(`<div class="meta-tag meta-author">👤 ${eventData.createdBy}</div>`);
            
            // Privacy
            metaItems.push(`<div class="meta-tag meta-privacy ${eventData.isPublic ? 'public' : ''}">
                ${eventData.isPublic ? '🌍 Pubblico' : '🔒 Privato'}
            </div>`);
            
            return `
            <div class="item">
                <div class="item-title">${eventData.title || 'Evento senza titolo'}</div>
                <div class="item-content">${dateInfo}</div>
                ${eventData.description ? `<div class="item-content">${eventData.description}</div>` : ''}
                ${eventData.location ? `<div class="item-content">📍 ${eventData.location}</div>` : ''}
                
                <div class="item-meta">
                    ${metaItems.join('')}
                </div>
            </div>`;
        }).join('');
        
        return `
        <div class="section">
            <div class="section-header">
                <div class="section-title">
                    📅 Nuovi Eventi
                    <div class="section-count">${eventsData.length}</div>
                </div>
            </div>
            ${eventsHTML}
        </div>`;
    }


    /**
     * 🆕 Invia email di notifica per cambiamenti di prezzo
     */
    async sendPriceChangeEmail(changesData) {
        try {
            console.log("📧 Preparazione email prodotti aggiornati...");
            
            if (!this.transporter) {
                await this.initializeTransporter();
            }

            if (!changesData || changesData.length === 0) {
                console.log("📧 Nessun cambiamento di prodotti da notificare");
                return { success: true, messageId: null, reason: 'no_changes' };
            }

            // 🆕 Determina i destinatari basandosi sulla privacy degli shopping items
            const recipients = new Set();
            
            console.log(`📧 Analizzando destinatari per ${changesData.length} prodotti aggiornati...`);
            
            for (const change of changesData) {
                const itemData = change.itemData;
                
                console.log(`📧 Item: ${itemData.name} - Pubblico: ${itemData.isPublic} - Creato da: ${itemData.createdBy}`);
                
                if (itemData.isPublic) {
                    // Se è pubblico, aggiungi tutti gli utenti tranne il creatore
                    const allUsers = await this.getAllUsers();
                    for (const user of allUsers) {
                        if (user.username !== itemData.createdBy) {
                            recipients.add(user.email);
                            console.log(`  ✅ Aggiunto destinatario: ${user.email} (${user.username})`);
                        } else {
                            console.log(`  ⏩ Escluso creatore: ${user.username}`);
                        }
                    }
                } else {
                    // Se è privato, invia solo al creatore
                    const allUsers = await this.getAllUsers();
                    const creator = allUsers.find(user => user.username === itemData.createdBy);
                    if (creator) {
                        recipients.add(creator.email);
                        console.log(`  🔒 Item privato, destinatario: ${creator.email} (${creator.username})`);
                    }
                }
            }
            
            const recipientsList = Array.from(recipients);
            
            // Se non ci sono destinatari, esci
            if (recipientsList.length === 0) {
                console.log("📧 Nessun destinatario per notifiche prodotti (tutti item privati senza creatori validi)");
                return { success: true, messageId: null, reason: 'no_recipients' };
            }
            
            console.log(`📧 Invio notifica prodotti aggiornati a ${recipientsList.length} destinatari: ${recipientsList.join(', ')}`);
            
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

            // Conta i tipi di cambiamenti
            const priceChanges = changesData.filter(c => c.changes.priceChanged).length;
            const availabilityChanges = changesData.filter(c => c.changes.availabilityChanged).length;
            const totalChanges = changesData.length;

            // Genera contenuto HTML e testo
            const htmlContent = this.generatePriceChangeHTML(changesData, today, timeString, priceChanges, availabilityChanges);
            const textContent = this.generatePriceChangeTextFallback(changesData, today, timeString, priceChanges, availabilityChanges);
            
            const subjectLine = totalChanges === 1 
                ? `🏠 Family Tracker - 1 prodotto aggiornato`
                : `🏠 Family Tracker - ${totalChanges} prodotti aggiornati`;
            
            const mailOptions = {
                from: '"HomeTask Family Tracker" <familytrackersite@gmail.com>',
                to: recipientsList.join(', '),
                subject: subjectLine,
                html: htmlContent,
                text: textContent
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email prodotti aggiornati inviata con successo!');
            console.log('📧 Message ID:', info.messageId);
            console.log(`📧 Destinatari: ${recipientsList.length} (${recipientsList.join(', ')})`);
            
            return { 
                success: true, 
                messageId: info.messageId,
                recipients: recipientsList,
                totalChanges: totalChanges,
                priceChanges: priceChanges,
                availabilityChanges: availabilityChanges
            };
            
        } catch (error) {
            console.error('❌ Errore invio email prodotti aggiornati:', error.message);
            throw error;
        }
    }

    /**
     * 🆕 Genera il contenuto HTML per le notifiche di cambiamento prezzo
     */
    generatePriceChangeHTML(changesData, today, timeString, priceChanges, availabilityChanges) {
        const totalChanges = changesData.length;
        
        return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>HomeTask Family - Prodotti Aggiornati</title>
    <style>
        /* Reset e base */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            -webkit-text-size-adjust: 100%;
        }
        
        /* Container principale - più largo */
        .email-wrapper {
            width: 100%;
            background-color: #f8f9fa;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Header con gradiente uguale alle email base */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 32px 24px;
            text-align: center;
            color: white;
        }
        
        .header h1 {
            font-size: 26px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .header .date {
            font-size: 16px;
            opacity: 0.9;
        }
        
        /* Contenuto principale - più spazioso */
        .content {
            padding: 0;
        }
        
        /* Item dei cambiamenti - più ariosi */
        .change-item {
            padding: 32px 24px;
            border-bottom: 1px solid #f1f3f4;
        }
        
        .change-item:last-child {
            border-bottom: none;
        }
        
        .item-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 20px;
        }
        
        .item-image {
            width: 130px;
            height: 130px;
            border-radius: 8px;
            object-fit: cover;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            margin-right:20px;
        }
        
        .item-info {
            flex: 1;
        }
        
        .item-title {
            font-size: 18px;
            font-weight: 600;
            color: #212529;
            margin-bottom: 6px;
            line-height: 1.4;
        }
        
        .item-brand {
            font-size: 15px;
            color: #6c757d;
            margin-bottom: 12px;
        }
        
        /* Prezzo nella card principale */
        .item-price {
            margin-bottom: 16px;
        }
        
        .price-change {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        
        .price-old {
            color: #dc3545;
            text-decoration: line-through;
            font-size: 16px;
            font-weight: 500;
        }
        
        .price-new {
            color: #28a745;
            font-size: 18px;
            font-weight: 700;
        }
        
        .price-arrow {
            color: #6c757d;
            font-size: 16px;
            margin: 0 4px;
        }
        
        /* Cambiamenti - più grandi e spaziosi */
        .changes-list {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .change-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .change-row:last-child {
            border-bottom: none;
        }
        
        .change-label {
            font-size: 15px;
            color: #495057;
            font-weight: 500;
        }
        
        .change-value {
            font-size: 16px;
            font-weight: 600;
        }
        
        .availability-change {
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .availability-available {
            background: #d4edda;
            color: #155724;
        }
        
        .availability-unavailable {
            background: #f8d7da;
            color: #721c24;
        }
        
        /* Meta informazioni - più grandi */
        .item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .meta-tag {
            font-size: 13px;
            padding: 6px 12px;
            border-radius: 16px;
            font-weight: 500;
        }
        
        .meta-author {
            background: #e3f2fd;
            color: #1976d2;
        }
        
        .meta-privacy {
            background: #fff3e0;
            color: #f57c00;
        }
        
        .meta-privacy.public {
            background: #e8f5e8;
            color: #2e7d32;
        }
        
        .item-link {
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
        }
        
        /* Footer - più spazioso */
        .footer {
            padding: 32px 24px;
            text-align: center;
            background: #f8f9fa;
        }
        
        .footer-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 16px;
        }
        
        .footer-text {
            font-size: 14px;
            color: #6c757d;
            line-height: 1.5;
        }
            .ii a[href] {
    color: white;
}
        
        /* Responsive */
        @media (max-width: 600px) {
            .email-wrapper { padding: 12px; }
            .header { padding: 28px 20px; }
            .change-item, .footer { padding: 24px 20px; }
            .item-header { flex-direction: column; align-items: flex-start; }
            .item-image { align-self: center; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <!-- Header semplificato -->
            <div class="header">
                <h1>🏠 Prodotti Aggiornati</h1>
                <div class="date">${today} • ${timeString}</div>
            </div>

            <!-- Contenuto diretto senza riepilogo -->
            <div class="content">
                ${this.generatePriceChangeItems(changesData)}
            </div>

            <!-- Footer -->
            <div class="footer">
                <a href="https://familytasktracker-c2dfe.web.app" class="footer-button">
                    🛒 Vedi Shopping List
                </a>
                <div class="footer-text">
                    Notifica automatica sui prodotti aggiornati<br>
                    HomeTask Family Tracker
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * 🆕 Genera HTML per i singoli item con cambiamenti - Prezzo nella card principale
     */
    generatePriceChangeItems(changesData) {
        return changesData.map(change => {
            const itemData = change.itemData;
            const changes = change.changes;
            const newData = change.newData;
            
            // Solo cambiamenti di disponibilità nella changes-list
            const availabilityChangesHTML = [];
            
            if (changes.availabilityChanged) {
                const availabilityClass = changes.newAvailability ? 'availability-available' : 'availability-unavailable';
                const availabilityText = changes.newAvailability ? '✅ Disponibile' : '❌ Non Disponibile';
                
                availabilityChangesHTML.push(`
                <div class="change-row">
                    <div class="change-label">Disponibilità</div>
                    <div class="availability-change ${availabilityClass}">
                        ${availabilityText}
                    </div>
                </div>`);
            }
            
            // Prezzo per la card principale
            let priceHTML = '';
            if (changes.priceChanged) {
                priceHTML = `
                <div class="item-price">
                    <div class="price-change">
                        <span class="price-old">€${changes.oldPrice}</span>
                        <span class="price-arrow">→</span>
                        <span class="price-new">€${changes.newPrice}</span>
                    </div>
                </div>`;
            }
            
            const metaItems = [];
            
            // Autore
            metaItems.push(`<div class="meta-tag meta-author">👤 ${itemData.createdBy}</div>`);
            
            // Privacy
            metaItems.push(`<div class="meta-tag meta-privacy ${itemData.isPublic ? 'public' : ''}">
                ${itemData.isPublic ? '🌍 Pubblico' : '🔒 Privato'}
            </div>`);
            
            // Link prodotto
            if (itemData.link) {
                metaItems.push(`<a href="${itemData.link}" class="item-link">🔗 Vedi prodotto</a>`);
            }
            
            return `
            <div class="change-item">
                <div class="item-header">
                    ${itemData.imageUrl ? `<img src="${itemData.imageUrl}" alt="${itemData.name}" class="item-image" onerror="this.style.display='none'">` : ''}
                    <div class="item-info">
                        <div class="item-title">${itemData.name}</div>
                        ${itemData.brandName ? `<div class="item-brand">${itemData.brandName}</div>` : ''}
                        ${priceHTML}
                    </div>
                </div>
                
                ${availabilityChangesHTML.length > 0 ? `
                <div class="changes-list">
                    ${availabilityChangesHTML.join('')}
                </div>` : ''}
                
                <div class="item-meta">
                    ${metaItems.join('')}
                </div>
            </div>`;
        }).join('');
    }

    /**
     * 🆕 Genera versione di testo semplice per prodotti aggiornati
     */
    generatePriceChangeTextFallback(changesData, today, timeString, priceChanges, availabilityChanges) {
        let content = `🏠 PRODOTTI AGGIORNATI - HOMETASK FAMILY\n${today} • ${timeString}\n\n`;
        
        content += `📋 LISTA PRODOTTI AGGIORNATI\n`;
        content += `${'='.repeat(40)}\n\n`;
        
        changesData.forEach((change, index) => {
            const itemData = change.itemData;
            const changes = change.changes;
            
            content += `${index + 1}. ${itemData.name}\n`;
            
            if (itemData.brandName) {
                content += `   🏷️ ${itemData.brandName}\n`;
            }
            
            if (changes.priceChanged) {
                content += `   Prezzo: €${changes.oldPrice} → €${changes.newPrice}\n`;
            }
            
            if (changes.availabilityChanged) {
                const availabilityText = changes.newAvailability ? 'Disponibile' : 'Non Disponibile';
                content += `   Disponibilità: ${availabilityText}\n`;
            }
            
            content += `   👤 ${itemData.createdBy} • ${itemData.isPublic ? '🌍 Pubblico' : '🔒 Privato'}\n`;
            
            if (itemData.link) {
                content += `   🔗 ${itemData.link}\n`;
            }
            
            content += `\n`;
        });
        
        content += `🛒 Vedi Shopping List: https://fabiodagostino.github.io/FamilyTaskTracker/#/shopping\n\n`;
        content += `---\nNotifica automatica sui prodotti aggiornati\nHomeTask Family Tracker`;
        
        return content;
    }
}

// Export singleton instance
const emailService = new EmailService();
module.exports = { emailService };