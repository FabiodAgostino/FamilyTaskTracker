// ====================================
// functions/services/price-monitor-service.js  
// VERSIONE PULITA: Solo controllo prezzo, senza disponibilità e senza logica 0
// ====================================

const { getFirestore } = require('firebase-admin/firestore');
const { WebScraper } = require('./web-scraper');
const { DeepSeekClient } = require('./deepseek-client');
const { ContentExtractor } = require('./content-extractor');
const { emailService } = require('./email-service');

class PriceMonitorService {
    constructor() {
        this.db = getFirestore();
        this.conversationId = null;
        this.stats = {
            total: 0,
            processed: 0,
            completed: 0,         // Item completati saltati
            samePrice: 0,         // Prezzo presente e invariato, nessun aggiornamento DB
            priceChanged: 0,      // Solo questi aggiornano il DB
            deepseekCalls: 0,
            dbWrites: 0,          // Numero scritture effettive al DB
            errors: 0
        };
    }

    /**
     * 🧪 TEST FUNCTION: Monitoraggio singolo URL con aggiornamento Firestore
     */
    async testSingleUrlMonitoring(url, mockCurrentData = null) {
        console.log(`🧪 Test monitoraggio singolo URL: ${url}`);
        const startTime = Date.now();

        try {
            // Step 1: Cerca documento esistente per URL
            console.log('🔍 Step 1: Ricerca documento per URL...');
            const existingDoc = await this.findDocumentByUrl(url);
            
            if (!existingDoc) {
                console.log(`⚠️ Nessun documento trovato per URL: ${url}`);
                return {
                    success: false,
                    step: 'document_search',
                    error: `Nessun documento trovato per URL: ${url}`,
                    duration: Date.now() - startTime
                };
            }

            const documentId = existingDoc.id;
            const currentData = existingDoc.data();
            console.log(`✅ Documento trovato: ${documentId} (${currentData.name})`);

            // Usa dati reali se mockCurrentData non fornito
            if (!mockCurrentData) {
                mockCurrentData = currentData;
                console.log(`📋 Usando dati reali dal documento trovato`);
            }

            // Step 2: Scraping
            console.log('🌐 Step 2: Scraping...');
            const scraper = new WebScraper({
                useRealHeaders: true,
                enableDelays: false,
                maxRetries: 1
            });

            const scrapingResult = await scraper.scrapeComplete(url, {
                useNavigation: false,
                fallbackToAggressive: true
            });

            if (!scrapingResult.success) {
                return {
                    success: false,
                    step: 'scraping',
                    error: scrapingResult.error,
                    duration: Date.now() - startTime
                };
            }

            const newScrapingText = scrapingResult.content.text;
            console.log(`✅ Scraping completato: ${newScrapingText.length} caratteri`);

            // Step 3: ✅ CONTROLLO PREZZO (solo cifre)
            let priceInContent = true;
            let extractedPriceFromMock = null;
            
            if (mockCurrentData && mockCurrentData.estimatedPrice) {
                extractedPriceFromMock = this.extractNumberFromPrice(mockCurrentData.estimatedPrice);
                priceInContent = this.isPriceInContent(newScrapingText, extractedPriceFromMock);
                console.log(`💰 Prezzo ${extractedPriceFromMock} ${priceInContent ? 'trovato' : 'NON trovato'} nel nuovo contenuto`);
            }

            // Step 4: ✅ DECISIONE: Chiamare DeepSeek solo se prezzo non presente
            const needsDeepSeek = !priceInContent;
            
            if (!needsDeepSeek) {
                console.log(`✅ Prezzo presente → NESSUN aggiornamento necessario`);
                return {
                    success: true,
                    hasChanges: false,
                    reason: 'price_unchanged',
                    documentId: documentId,
                    documentUpdated: false,
                    duration: Date.now() - startTime,
                    analysis: {
                        priceInContent: true,
                        mockPrice: extractedPriceFromMock
                    }
                };
            }

            // Step 5: 🤖 ANALISI DEEPSEEK (necessaria)
            console.log(`🤖 Step 5: Analisi DeepSeek necessaria (prezzo=${!priceInContent ? 'ASSENTE' : 'presente'})`);
            
            if (!this.conversationId) {
                this.conversationId = await this.initializePriceMonitoringConversation();
            }

            const analysisResult = await this.analyzePriceWithDeepSeek(
                newScrapingText,
                url,
                mockCurrentData || this.createMockItemData(url)
            );

            if (!analysisResult) {
                return {
                    success: false,
                    step: 'deepseek_analysis',
                    error: 'Analisi DeepSeek fallita',
                    duration: Date.now() - startTime
                };
            }

            console.log(`✅ Analisi DeepSeek completata`);

            // Step 6: ✅ RILEVA CAMBIAMENTI REALI
            const changes = this.detectChanges(mockCurrentData, analysisResult);
            console.log(`🔄 Cambiamenti rilevati: ${changes.hasChanges ? 'SI' : 'NO'}`);

            // Debug dettagli cambiamenti
            if (changes.hasChanges) {
                console.log('📊 Dettagli cambiamenti:');
                if (changes.priceChanged) {
                    console.log(`  💰 Prezzo: ${changes.oldPrice} → ${changes.newPrice}`);
                }
            }

            // Step 7: 💾 AGGIORNAMENTO FIRESTORE (se necessario)
            let documentUpdated = false;
            let updateError = null;

            if (changes.hasChanges) {
                try {
                    console.log(`💾 Step 7: Aggiornamento documento Firestore...`);
                    
                    await this.updateItemWithChanges(documentId, mockCurrentData, changes, analysisResult, newScrapingText);
                    documentUpdated = true;
                    
                    console.log(`✅ Documento ${documentId} aggiornato con successo`);
                    
                } catch (updateErr) {
                    updateError = updateErr.message;
                    console.error(`❌ Errore aggiornamento documento:`, updateErr);
                }
            } else {
                console.log(`✅ Nessun cambiamento → Nessun aggiornamento Firestore necessario`);
            }

            // Step 8: 📧 INVIO EMAIL (se ci sono stati cambiamenti)
            let emailSent = false;
            let emailError = null;

            if (changes.hasChanges && documentUpdated) {
                try {
                    console.log(`📧 Step 8: Invio notifica email...`);
                    
                    const changeData = [{
                        itemId: documentId,
                        itemName: currentData.name,
                        itemData: mockCurrentData,
                        changes: changes,
                        newData: analysisResult,
                        timestamp: new Date()
                    }];
                    
                    const emailResult = await emailService.sendPriceChangeEmail(changeData);
                    emailSent = emailResult.success;
                    
                    console.log(`✅ Email cambiamento inviata: ${emailResult.messageId}`);
                    
                } catch (emailErr) {
                    emailError = emailErr.message;
                    console.error(`❌ Errore invio email:`, emailErr);
                }
            } else {
                console.log(`✅ Nessun cambiamento → Nessuna email necessaria`);
            }

            return {
                success: true,
                hasChanges: changes.hasChanges,
                reason: changes.hasChanges ? 'deepseek_detected_changes' : 'deepseek_no_changes',
                documentId: documentId,
                documentUpdated: documentUpdated,
                updateError: updateError,
                duration: Date.now() - startTime,
                changes: changes,
                analysisResult: analysisResult,
                newScrapingText: newScrapingText,
                emailSent: emailSent,
                emailError: emailError,
                documentInfo: {
                    id: documentId,
                    name: currentData.name,
                    category: currentData.category,
                    createdBy: currentData.createdBy
                },
                debugInfo: {
                    priceInContent: priceInContent,
                    mockPrice: extractedPriceFromMock,
                    deepSeekTriggered: needsDeepSeek
                }
            };

        } catch (error) {
            console.error(`❌ Errore test monitoraggio URL:`, error);
            return {
                success: false,
                step: 'unknown',
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * 🎯 FUNZIONE PRINCIPALE: Monitoraggio ottimizzato con logica corretta
     */
async runDailyPriceMonitoring() {
    console.log('🌅 Avvio monitoraggio prezzi con logica corretta...');
    const startTime = Date.now();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 📊 Statistiche per il report
    const reportData = {
        jobId: jobId,
        startTime: new Date(),
        endTime: null,
        duration: 0,
        success: false,
        
        // Statistiche prodotti
        stats: {
            total: 0,
            processed: 0,
            completed: 0,
            samePrice: 0,
            priceChanged: 0,
            deepseekCalls: 0,
            dbWrites: 0,
            errors: 0
        },
        
        // Dettagli email
        emailData: {
            sent: false,
            recipients: [],
            recipientCount: 0,
            messageId: null,
            error: null,
            totalChanges: 0,
            priceChanges: 0
        },
        
        // Lista cambiamenti dettagliata
        changesSummary: [],
        
        // Errori dettagliati
        errors: [],
        
        // Metadata
        environment: process.env.NODE_ENV || 'production',
        version: '1.0.0'
    };

    try {
        // Step 1: Recupera SOLO item attivi NON completati
        const activeItems = await this.getActiveNotCompletedItems();
        this.stats.total = activeItems.length;
        reportData.stats.total = activeItems.length;
        
        console.log(`📦 Trovati ${activeItems.length} item attivi NON completati da monitorare`);
        
        if (activeItems.length === 0) {
            reportData.success = true;
            reportData.endTime = new Date();
            reportData.duration = Date.now() - startTime;
            
            // Salva report per job vuoto
            await this.saveJobReport(reportData);
            
            return { 
                success: true, 
                monitored: 0, 
                changes: 0, 
                message: 'Nessun item attivo da monitorare',
                jobId: jobId,
                reportSaved: true
            };
        }

        // Step 2: Inizializza conversazione DeepSeek
        this.conversationId = await this.initializePriceMonitoringConversation();
        
        // Step 3: Monitora ogni item con logica ottimizzata
        const changesSummary = [];
        
        for (const item of activeItems) {
            try {
                const itemData = item.data();
                
                // Verifica che non sia completato
                if (itemData.completed === true) {
                    console.log(`⏩ Skip ${itemData.name}: item completato`);
                    this.stats.completed++;
                    reportData.stats.completed++;
                    continue;
                }
                
                console.log(`🔍 Monitoraggio item ${this.stats.processed + 1}/${activeItems.length}: ${itemData.name}`);
                
                const changes = await this.monitorSingleItemOptimized(item);
                
                if (changes) {
                    changesSummary.push(changes);
                    reportData.changesSummary.push({
                        itemId: item.id,
                        itemName: itemData.name,
                        changes: changes,
                        timestamp: new Date(),
                        category: itemData.category || 'Senza categoria'
                    });
                    console.log(`💰 Rilevati cambiamenti per: ${itemData.name}`);
                }
                
                this.stats.processed++;
                reportData.stats.processed++;
                
                // Delay tra le richieste
                if (this.stats.processed < activeItems.length) {
                    await this.humanDelay();
                }
                
            } catch (itemError) {
                console.error(`❌ Errore monitoraggio item ${item.id}:`, itemError.message);
                this.stats.errors++;
                reportData.stats.errors++;
                
                // Aggiungi errore al report
                reportData.errors.push({
                    itemId: item.id,
                    itemName: item.data()?.name || 'Nome non disponibile',
                    error: itemError.message,
                    timestamp: new Date(),
                    stack: itemError.stack
                });
            }
        }

        // Step 4: Invia notifiche se ci sono cambiamenti
        if (changesSummary.length > 0) {
            try {
                console.log('📧 Invio email di notifica cambiamenti...');
                const emailResult = await emailService.sendPriceChangeEmail(changesSummary);
                
                // Popola dati email nel report
                reportData.emailData = {
                    sent: emailResult.success,
                    recipients: emailResult.recipients || [],
                    recipientCount: emailResult.recipients?.length || 0,
                    messageId: emailResult.messageId,
                    error: emailResult.success ? null : 'Email non inviata',
                    totalChanges: emailResult.totalChanges || changesSummary.length,
                    priceChanges: emailResult.priceChanges || 0
                };
                
                console.log(`✅ Email inviata a ${reportData.emailData.recipientCount} destinatari`);
                
            } catch (emailError) {
                console.error('❌ Errore invio email:', emailError.message);
                reportData.emailData.error = emailError.message;
                reportData.errors.push({
                    type: 'email',
                    error: emailError.message,
                    timestamp: new Date(),
                    stack: emailError.stack
                });
            }
        } else {
            console.log('📧 Nessun cambiamento: email non necessaria');
            reportData.emailData.sent = false;
        }

        // Aggiorna statistiche finali dal this.stats
        reportData.stats = { ...this.stats };
        
        const duration = Date.now() - startTime;
        reportData.success = true;
        reportData.endTime = new Date();
        reportData.duration = duration;
        
        console.log(`✅ Monitoraggio completato in ${Math.round(duration/1000)}s`);
        
        // Step 5: 📊 SALVA REPORT SU FIRESTORE
        try {
            await this.saveJobReport(reportData);
            console.log(`📊 Report salvato su Firestore con ID: ${jobId}`);
        } catch (reportError) {
            console.error('❌ Errore salvataggio report:', reportError.message);
            // Non bloccare il job per errori di report
        }
        
        return {
            success: true,
            monitored: this.stats.processed,
            changes: changesSummary.length,
            duration: duration,
            changesSummary: changesSummary,
            stats: this.stats,
            jobId: jobId,
            reportSaved: true,
            emailData: reportData.emailData
        };

    } catch (error) {
        console.error('❌ Errore nel monitoraggio prezzi:', error);
        
        // Popola report con errore globale
        reportData.success = false;
        reportData.endTime = new Date();
        reportData.duration = Date.now() - startTime;
        reportData.stats = { ...this.stats };
        reportData.errors.push({
            type: 'global',
            error: error.message,
            timestamp: new Date(),
            stack: error.stack
        });
        
        // Tenta di salvare report anche in caso di errore
        try {
            await this.saveJobReport(reportData);
        } catch (reportError) {
            console.error('❌ Errore salvataggio report di errore:', reportError.message);
        }
        
        return {
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
            stats: this.stats,
            jobId: jobId,
            reportSaved: true
        };
    }
}

/**
 * 📊 Salva il report completo del job su Firestore
 */
async saveJobReport(reportData) {
    try {
        const db = require('firebase-admin').firestore();
        
        // Struttura del documento report
        const reportDocument = {
            // Identificatori
            jobId: reportData.jobId,
            jobType: 'price_monitoring',
            
            // Tempi
            startTime: reportData.startTime,
            endTime: reportData.endTime,
            duration: reportData.duration,
            durationFormatted: this.formatDuration(reportData.duration),
            
            // Stato generale
            success: reportData.success,
            
            // Statistiche principali
            stats: {
                totalItems: reportData.stats.total,
                processedItems: reportData.stats.processed,
                completedItems: reportData.stats.completed,
                unchangedItems: reportData.stats.samePrice,
                priceChangedItems: reportData.stats.priceChanged,
                deepseekCallsCount: reportData.stats.deepseekCalls,
                databaseWritesCount: reportData.stats.dbWrites,
                errorsCount: reportData.stats.errors
            },
            
            // Dati email dettagliati
            email: {
                sent: reportData.emailData.sent,
                recipients: reportData.emailData.recipients,
                recipientCount: reportData.emailData.recipientCount,
                messageId: reportData.emailData.messageId,
                error: reportData.emailData.error,
                changesNotified: {
                    total: reportData.emailData.totalChanges,
                    priceChanges: reportData.emailData.priceChanges
                }
            },
            
            // Riepilogo cambiamenti
            changes: {
                count: reportData.changesSummary.length,
                items: reportData.changesSummary.map(change => ({
                    itemId: change.itemId,
                    itemName: change.itemName,
                    category: change.category,
                    hasChanges: change.changes?.hasChanges || false,
                    priceChanged: change.changes?.priceChanged || false,
                    oldPrice: change.changes?.oldPrice,
                    newPrice: change.changes?.newPrice,
                    timestamp: change.timestamp
                }))
            },
            
            // Errori dettagliati
            errors: reportData.errors.map(error => ({
                type: error.type || 'unknown',
                itemId: error.itemId || null,
                itemName: error.itemName || null,
                message: error.error,
                timestamp: error.timestamp,
                // Stack trace solo per debug (opzionale)
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            })),
            
            // Metadata
            environment: reportData.environment,
            version: reportData.version,
            createdAt: new Date(),
            
            // Campi utili per query/filtri
            date: reportData.startTime.toISOString().split('T')[0], // YYYY-MM-DD
            hour: reportData.startTime.getHours(),
            dayOfWeek: reportData.startTime.getDay(), // 0 = domenica
            month: reportData.startTime.getMonth() + 1,
            year: reportData.startTime.getFullYear(),
            
            // Indicatori per dashboard
            hasErrors: reportData.errors.length > 0,
            hasChanges: reportData.changesSummary.length > 0,
            emailSent: reportData.emailData.sent,
            performance: this.calculatePerformanceMetrics(reportData)
        };
        
        // Salva nella collection price_monitoring_reports
        const docRef = await db.collection('price_monitoring_reports').add(reportDocument);
        
        console.log(`📊 Report salvato con successo: ${docRef.id}`);
        
        // Opzionale: pulisci vecchi report (mantieni ultimi 100)
        await this.cleanupOldReports();
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Errore salvataggio report:', error);
        throw error;
    }
}

/**
 * 📊 Calcola metriche di performance per il dashboard
 */
calculatePerformanceMetrics(reportData) {
    const stats = reportData.stats;
    const duration = reportData.duration;
    
    return {
        // Velocità di elaborazione (items/secondo)
        itemsPerSecond: stats.processed > 0 ? Math.round((stats.processed / (duration / 1000)) * 100) / 100 : 0,
        
        // Percentuale successo
        successRate: stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0,
        
        // Percentuale errori
        errorRate: stats.total > 0 ? Math.round((stats.errors / stats.total) * 100) : 0,
        
        // Percentuale cambiamenti
        changeRate: stats.processed > 0 ? Math.round((stats.priceChanged / stats.processed) * 100) : 0,
        
        // Efficienza (chiamate DB/items processati)
        dbEfficiency: stats.processed > 0 ? Math.round((stats.dbWrites / stats.processed) * 100) / 100 : 0,
        
        // Classificazione performance
        performanceClass: this.getPerformanceClass(duration, stats.processed, stats.errors)
    };
}

/**
 * 📊 Determina la classe di performance del job
 */
getPerformanceClass(duration, processed, errors) {
    const avgTimePerItem = processed > 0 ? duration / processed : 0;
    const errorPercentage = processed > 0 ? (errors / processed) * 100 : 0;
    
    if (errorPercentage > 20) return 'poor';
    if (avgTimePerItem > 30000) return 'slow'; // > 30s per item
    if (avgTimePerItem < 10000 && errorPercentage < 5) return 'excellent'; // < 10s per item, < 5% errori
    if (avgTimePerItem < 20000 && errorPercentage < 10) return 'good'; // < 20s per item, < 10% errori
    return 'average';
}

/**
 * 🗑️ Pulizia automatica vecchi report (mantieni ultimi 100)
 */
async cleanupOldReports() {
    try {
        const db = require('firebase-admin').firestore();
        
        // Conta i report esistenti
        const countSnapshot = await db.collection('price_monitoring_reports').count().get();
        const totalReports = countSnapshot.data().count;
        
        if (totalReports <= 100) {
            console.log(`📊 Report attuali: ${totalReports} (sotto il limite di 100)`);
            return;
        }
        
        // Elimina i report più vecchi
        const oldReportsSnapshot = await db.collection('price_monitoring_reports')
            .orderBy('createdAt', 'asc')
            .limit(totalReports - 100)
            .get();
        
        const batch = db.batch();
        oldReportsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`🗑️ Eliminati ${oldReportsSnapshot.size} report vecchi`);
        
    } catch (error) {
        console.error('❌ Errore pulizia report vecchi:', error);
        // Non bloccare per errori di pulizia
    }
}

/**
 * 🕐 Formatta la durata in formato leggibile
 */
formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * 📊 Metodo per ottenere statistiche aggregrate per dashboard
 */
async getReportsStats(days = 30) {
    try {
        const db = require('firebase-admin').firestore();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        
        const reportsSnapshot = await db.collection('price_monitoring_reports')
            .where('startTime', '>=', fromDate)
            .orderBy('startTime', 'desc')
            .get();
        
        const reports = reportsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Calcola statistiche aggregate
        const stats = {
            totalJobs: reports.length,
            successfulJobs: reports.filter(r => r.success).length,
            failedJobs: reports.filter(r => !r.success).length,
            totalItemsProcessed: reports.reduce((sum, r) => sum + (r.stats?.processedItems || 0), 0),
            totalChangesDetected: reports.reduce((sum, r) => sum + (r.changes?.count || 0), 0),
            totalEmailsSent: reports.filter(r => r.email?.sent).length,
            averageDuration: reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + (r.duration || 0), 0) / reports.length) : 0,
            lastJobTime: reports.length > 0 ? reports[0].startTime : null,
            performanceDistribution: {
                excellent: reports.filter(r => r.performance?.performanceClass === 'excellent').length,
                good: reports.filter(r => r.performance?.performanceClass === 'good').length,
                average: reports.filter(r => r.performance?.performanceClass === 'average').length,
                slow: reports.filter(r => r.performance?.performanceClass === 'slow').length,
                poor: reports.filter(r => r.performance?.performanceClass === 'poor').length
            }
        };
        
        return {
            success: true,
            stats: stats,
            recentReports: reports.slice(0, 10) // Ultimi 10 report
        };
        
    } catch (error) {
        console.error('❌ Errore recupero statistiche report:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

    /**
     * 🧠 LOGICA OTTIMIZZATA: Solo controllo prezzo
     */
    async monitorSingleItemOptimized(itemDoc) {
        const itemData = itemDoc.data();
        const itemId = itemDoc.id;
        
        try {
            console.log(`🔗 Scraping URL: ${itemData.link}`);
            
            // Step 1: Scraping
            const scraper = new WebScraper({
                useRealHeaders: true,
                enableDelays: true,
                maxRetries: 1
            });

            const scrapingResult = await scraper.scrapeComplete(itemData.link, {
                useNavigation: false,
                fallbackToAggressive: true
            });

            if (!scrapingResult.success) {
                console.log(`⚠️ Scraping fallito per ${itemData.name}: ${scrapingResult.error}`);
                return null;
            }

            const newScrapingText = scrapingResult.content.text;
            console.log(`📄 Nuovo contenuto: ${newScrapingText.length} caratteri`);

            // Step 2: ✅ CONTROLLO PREZZO (solo cifre)
            const extractedPrice = this.extractNumberFromPrice(itemData.estimatedPrice);
            const priceInContent = this.isPriceInContent(newScrapingText, extractedPrice);
            console.log(`💰 Prezzo ${extractedPrice} ${priceInContent ? 'trovato' : 'NON trovato'} nel nuovo contenuto`);
            
            // Step 3: ✅ DECISIONE DeepSeek
            if (priceInContent) {
                console.log(`✅ Prezzo presente → NESSUN aggiornamento DB per ${itemData.name}`);
                this.stats.samePrice++;
                return null;
            }

            // Step 4: 🤖 ANALISI DEEPSEEK (necessaria)
            console.log(`🤖 Analisi DeepSeek necessaria per ${itemData.name} (prezzo ASSENTE)`);
            this.stats.deepseekCalls++;
            
            const analysisResult = await this.analyzePriceWithDeepSeek(
                newScrapingText,
                itemData.link,
                itemData
            );

            if (!analysisResult) {
                console.log(`⚠️ Analisi DeepSeek fallita per ${itemData.name}`);
                return null;
            }

            // Step 5: ✅ RILEVA CAMBIAMENTI
            const changes = this.detectChanges(itemData, analysisResult);

            // Step 6: ✅ AGGIORNA DB SOLO SE CAMBIAMENTI REALI
            if (changes.hasChanges) {
                console.log(`💾 AGGIORNAMENTO DB per ${itemData.name}: cambiamenti rilevati`);
                
                await this.updateItemWithChanges(itemId, itemData, changes, analysisResult, newScrapingText);
                this.stats.dbWrites++;
                
                if (changes.priceChanged) this.stats.priceChanged++;
                
                return {
                    itemId: itemId,
                    itemName: itemData.name,
                    itemData: itemData,
                    changes: changes,
                    newData: analysisResult,
                    timestamp: new Date()
                };
            } else {
                console.log(`✅ Nessun cambiamento rilevato per ${itemData.name}, NESSUN aggiornamento DB`);
                return null;
            }

        } catch (error) {
            console.error(`❌ Errore monitoraggio item ${itemId}:`, error);
            this.stats.errors++;
            return null;
        }
    }

    /**
     * 💾 Aggiorna item con storico prezzi corretto
     */
    async updateItemWithChanges(itemId, currentData, changes, newData, newScrapingText) {
        try {
            const now = new Date();
            
            // ✅ Storico prezzi con date
            const enhancedPriceHistory = this.updateEnhancedPriceHistory(currentData, changes, now);
            
            const updateData = {
                // ✅ Aggiorna prezzo se cambiato
                ...(changes.priceChanged && { estimatedPrice: newData.estimatedPrice }),
                
                // ✅ NON aggiornare il nome (come richiesto)
                
                // ✅ Storico prezzi migliorato con date
                ...(changes.priceChanged && {
                    historicalPrice: enhancedPriceHistory.prices,
                    historicalPriceWithDates: enhancedPriceHistory.withDates
                }),
                
                // ✅ CORRETTO: Aggiorna scrapingText a root level
                scrapingText: newScrapingText,
                
                // ✅ Aggiorna scrapingData (oggetto separato)
                scrapingData: {
                    lastScraped: now,
                    scrapingSuccess: true,
                    scrapingMode: 'context_cached',
                    errors: null
                },
                
                // Metadati monitoraggio
                lastPriceCheck: now,
                priceMonitoring: {
                    lastCheck: now,
                    changesDetected: true,
                    priceChanged: changes.priceChanged,
                    analysisText: this.generateChangeDescription(changes, newData)
                },
                
                updatedAt: now
            };

            await this.db.collection('shopping_items').doc(itemId).update(updateData);
            console.log(`💾 Item ${itemId} aggiornato con nuovi dati`);

        } catch (error) {
            console.error(`❌ Errore aggiornamento item ${itemId}:`, error);
            throw error;
        }
    }

    /**
     * 📈 Crea storico prezzi migliorato con DATE
     */
    updateEnhancedPriceHistory(currentData, changes, timestamp) {
        let historicalPrice = currentData.historicalPrice || [];
        let historicalPriceWithDates = currentData.historicalPriceWithDates || [];
        
        if (changes.priceChanged && changes.newPrice !== null && changes.newPrice > 0) {
            const lastPrice = historicalPrice.length > 0 ? 
                historicalPrice[historicalPrice.length - 1] : null;
                
            if (lastPrice !== changes.newPrice) {
                // Storico semplice
                historicalPrice.push(changes.newPrice);
                
                // ✅ Storico con date per grafici
                historicalPriceWithDates.push({
                    price: changes.newPrice,
                    date: timestamp,
                    oldPrice: changes.oldPrice || null,
                    changeType: changes.newPrice > (changes.oldPrice || 0) ? 'increase' : 'decrease'
                });
                
                // Mantieni ultimi 50
                if (historicalPrice.length > 50) {
                    historicalPrice = historicalPrice.slice(-50);
                }
                if (historicalPriceWithDates.length > 50) {
                    historicalPriceWithDates = historicalPriceWithDates.slice(-50);
                }
                
                console.log(`📈 Storico prezzi aggiornato: ${changes.oldPrice} → ${changes.newPrice}`);
            }
        }
        
        return {
            prices: historicalPrice,
            withDates: historicalPriceWithDates
        };
    }

    // ===== METODI HELPER CORRETTI =====

    /**
     * ✅ Estrae numero dal prezzo (solo cifre)
     */
    extractNumberFromPrice(price) {
        if (!price) return null;
        
        const priceString = price.toString();
        const match = priceString.match(/(\d+[.,]\d+|\d+)/);
        
        if (match) {
            return parseFloat(match[1].replace(',', '.'));
        }
        
        return null;
    }

    /**
     * ✅ Verifica se prezzo (cifre) è presente nel contenuto
     */
    isPriceInContent(content, price) {
        if (!price || !content) return false;

        const priceString = price.toString();
        const pricePatterns = [
            new RegExp(`\\b${priceString}\\b`),
            new RegExp(`€\\s*${priceString}`),
            new RegExp(`${priceString}\\s*€`),
            new RegExp(`${priceString.replace('.', ',')}\\b`),
            new RegExp(`€\\s*${priceString.replace('.', ',')}`),
            new RegExp(`${priceString.replace('.', ',')}\\s*€`)
        ];

        return pricePatterns.some(pattern => pattern.test(content));
    }

    /**
     * ✅ Rileva cambiamenti reali (solo prezzo)
     */
    detectChanges(currentData, newData) {
        const changes = {
            hasChanges: false,
            priceChanged: false,
            oldPrice: this.extractNumberFromPrice(currentData.estimatedPrice),
            newPrice: this.extractNumberFromPrice(newData.estimatedPrice)
        };

        // ✅ Controllo prezzo basato solo su cifre
        if (changes.oldPrice !== changes.newPrice) {
            changes.priceChanged = true;
            changes.hasChanges = true;
            console.log(`💰 Prezzo cambiato: ${changes.oldPrice} → ${changes.newPrice}`);
        }

        return changes;
    }

    /**
     * 📝 Genera descrizione cambiamenti
     */
    generateChangeDescription(changes, newData) {
        const descriptions = [];
        
        if (changes.priceChanged) {
            const direction = changes.newPrice > changes.oldPrice ? 'aumentato' : 'diminuito';
            descriptions.push(`Prezzo ${direction}: €${changes.oldPrice} → €${changes.newPrice}`);
        }
        
        return descriptions.join('; ') || 'Cambiamenti rilevati dal monitoraggio automatico';
    }

    // ===== METODI UTILITÀ =====

    async getActiveNotCompletedItems() {
        try {
            const snapshot = await this.db
                .collection('shopping_items')
                .where('completed', '==', false)
                .where('link', '!=', '')
                .get();

            return snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.link && 
                       data.link.startsWith('http') && 
                       data.completed !== true;
            });
        } catch (error) {
            console.error('❌ Errore recupero item attivi:', error);
            return [];
        }
    }

    async analyzePriceWithDeepSeek(htmlContent, url, currentItemData) {
        try {
            const result = await DeepSeekClient.analyzeHtmlWithContext(
                this.conversationId,
                htmlContent,
                url
            );
            return this.validateAnalysisResult(result, currentItemData);
        } catch (error) {
            console.error('❌ Errore analisi DeepSeek:', error);
            return null;
        }
    }

    validateAnalysisResult(result, currentItemData) {
        try {
            // ✅ Validazione prezzo (SENZA logica 0)
            if (result.estimatedPrice) {
                const extracted = this.extractNumberFromPrice(result.estimatedPrice);
                result.estimatedPrice = extracted; // ✅ null se non valido
            } else {
                result.estimatedPrice = null; // ✅ null se non presente
            }

            // ✅ NON aggiornare il nome (come richiesto)
            if (!result.name || result.name.trim() === '') {
                result.name = currentItemData.name;
            }

            return result;
        } catch (error) {
            console.error('❌ Errore validazione risultato:', error);
            return null;
        }
    }

    async initializePriceMonitoringConversation() {
        try {
            const conversationId = DeepSeekClient.generateConversationId('price_monitoring');
            await DeepSeekClient.initializeConversation(conversationId);
            console.log(`🤖 Conversazione DeepSeek inizializzata: ${conversationId}`);
            return conversationId;
        } catch (error) {
            console.error('❌ Errore inizializzazione DeepSeek:', error);
            return null;
        }
    }

    createMockItemData(url) {
        return {
            name: 'Test Item',
            link: url,
            estimatedPrice: null,
            scrapingText: ''
        };
    }

    async humanDelay() {
        const delay = Math.random() * 1000 + 1500;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * 🔍 Trova documento per URL (utilizzato nella funzione di test)
     */
    async findDocumentByUrl(url) {
        try {
            console.log(`🔍 Cercando documento con URL: ${url}`);
            
            const snapshot = await this.db
                .collection('shopping_items')
                .where('link', '==', url)
                .limit(1)
                .get();

            if (snapshot.empty) {
                console.log(`❌ Nessun documento trovato per URL: ${url}`);
                return null;
            }

            const doc = snapshot.docs[0];
            console.log(`✅ Documento trovato: ${doc.id}`);
            
            return doc;

        } catch (error) {
            console.error(`❌ Errore ricerca documento per URL:`, error);
            return null;
        }
    }

    /**
     * 📊 Ottieni statistiche dello storico prezzi per grafici (metodo esistente)
     */
    async getPriceHistoryStats(itemId) {
        try {
            const doc = await this.db.collection('shopping_items').doc(itemId).get();
            
            if (!doc.exists) {
                return null;
            }
            
            const data = doc.data();
            const priceHistory = data.historicalPriceWithDates || [];
            
            if (priceHistory.length === 0) {
                return { message: 'Nessuno storico prezzi disponibile' };
            }
            
            const prices = priceHistory.map(entry => entry.price);
            const dates = priceHistory.map(entry => entry.date);
            
            return {
                itemName: data.name,
                currentPrice: data.estimatedPrice,
                priceHistory: priceHistory,
                stats: {
                    minPrice: Math.min(...prices),
                    maxPrice: Math.max(...prices),
                    avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
                    totalChecks: priceHistory.length,
                    firstCheck: dates[0],
                    lastCheck: dates[dates.length - 1],
                    priceChanges: priceHistory.filter(entry => entry.oldPrice !== null).length
                }
            };
            
        } catch (error) {
            console.error('❌ Errore recupero statistiche storico prezzi:', error);
            return null;
        }
    }
}

// Export singleton instance
const priceMonitorService = new PriceMonitorService();
module.exports = { priceMonitorService };