

const { getFirestore } = require('firebase-admin/firestore');
const { WebScraper } = require('./web-scraper');
const { PriceDetectorService } = require('./price-detector-service');
const { emailService } = require('./email-service');

class PriceMonitorService {
    constructor() {
        this.db = getFirestore();
        this.conversationId = null;
        this.priceDetector = new PriceDetectorService();
       this.stats = {
            total: 0,
            processed: 0,
            completed: 0,
            legacyUrlMode: 0,
            noPriceSelection: 0,
            samePrice: 0,
            priceChanged: 0,
            cssSelectorFailed: 0,  // ✅ NUOVO: conta fallimenti CSS
            dbWrites: 0,
            errors: 0
        };
    }

    /**
     * 🧪 TEST FUNCTION: Monitoraggio singolo URL con CSS selector targeting
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

            // ✅ VALIDAZIONE PREREQUISITI
            const validationResult = this.validateItemForMonitoring(currentData);
            if (!validationResult.valid) {
                console.log(`⚠️ Item non valido per monitoraggio: ${validationResult.reason}`);
                return {
                    success: false,
                    step: 'validation',
                    error: validationResult.reason,
                    duration: Date.now() - startTime
                };
            }

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

            console.log(`✅ Scraping completato: ${scrapingResult.content.text.length} caratteri`);

            // Step 3: ✅ MONITORAGGIO CON CSS SELECTOR TARGETING
            const monitoringResult = await this.monitorPriceWithCssSelector(
                scrapingResult.html || scrapingResult.content.text,
                mockCurrentData
            );

            console.log(`🎯 Risultato monitoraggio CSS: ${monitoringResult.status}`);

            // Step 4: ✅ DECISIONE AGGIORNAMENTO
            let needsUpdate = false;
            let changes = null;

            if (monitoringResult.status === 'price_changed') {
                needsUpdate = true;
                changes = {
                    hasChanges: true,
                    priceChanged: true,
                    oldPrice: mockCurrentData.estimatedPrice,
                    newPrice: monitoringResult.newPrice,
                    cssSelector: monitoringResult.cssSelector,
                    confidence: monitoringResult.confidence
                };
            } else if (monitoringResult.skipItem) {
                console.log(`⏩ Skip item: ${monitoringResult.status}`);
                // Non aggiornare nulla, vai avanti
            }

            // Step 5: 💾 AGGIORNAMENTO FIRESTORE (se necessario)
            let documentUpdated = false;
            let updateError = null;

            if (needsUpdate && changes) {
                try {
                    console.log(`💾 Step 5: Aggiornamento documento Firestore...`);
                    
                    await this.updateItemWithChanges(
                        documentId, 
                        mockCurrentData, 
                        changes, 
                        monitoringResult.analysisData || changes, 
                        scrapingResult.content.text
                    );
                    documentUpdated = true;
                    
                    console.log(`✅ Documento ${documentId} aggiornato con successo`);
                    
                } catch (updateErr) {
                    updateError = updateErr.message;
                    console.error(`❌ Errore aggiornamento documento:`, updateErr);
                }
            } else {
                console.log(`✅ Nessun cambiamento → Nessun aggiornamento Firestore necessario`);
            }

            // Step 6: 📧 INVIO EMAIL (se ci sono stati cambiamenti)
            let emailSent = false;
            let emailError = null;

            if (changes && changes.hasChanges && documentUpdated) {
                try {
                    console.log(`📧 Step 6: Invio notifica email...`);
                    
                    const changeData = [{
                        itemId: documentId,
                        itemName: currentData.name,
                        itemData: mockCurrentData,
                        changes: changes,
                        newData: monitoringResult.analysisData || changes,
                        timestamp: new Date()
                    }];
                    
                    const emailResult = await emailService.sendPriceChangeEmail(changeData);
                    emailSent = emailResult.success;
                    
                    console.log(`✅ Email cambiamento inviata: ${emailResult.messageId}`);
                    
                } catch (emailErr) {
                    emailError = emailErr.message;
                    console.error(`❌ Errore invio email:`, emailErr);
                }
            }

            return {
                success: true,
                hasChanges: needsUpdate,
                reason: changes ? 'css_selector_detected_changes' : 'no_changes',
                documentId: documentId,
                documentUpdated: documentUpdated,
                updateError: updateError,
                duration: Date.now() - startTime,
                changes: changes,
                monitoringResult: monitoringResult,
                newScrapingText: scrapingResult.content.text,
                emailSent: emailSent,
                emailError: emailError,
                documentInfo: {
                    id: documentId,
                    name: currentData.name,
                    category: currentData.category,
                    createdBy: currentData.createdBy
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
     * ✅ VALIDAZIONE: Controlla se l'item è idoneo per il monitoraggio CSS selector
     */
    validateItemForMonitoring(itemData) {
        // 1. ✅ FONDAMENTALE: Controlla che l'item NON sia completato
        if (itemData.completed === true) {
            return {
                valid: false,
                reason: 'Item completato - saltato'
            };
        }

        // 2. Controlla scrapingMode
        if (itemData.scrapingData?.scrapingMode === 'url_legacy') {
            return {
                valid: false,
                reason: 'Item con scrapingMode url_legacy - saltato'
            };
        }

        // 3. Controlla priceSelection
        if (!itemData.priceSelection) {
            return {
                valid: false,
                reason: 'Item senza priceSelection - saltato'
            };
        }

        // 4. Controlla detectedPrices
        if (!itemData.priceSelection.detectedPrices || 
            !Array.isArray(itemData.priceSelection.detectedPrices) ||
            itemData.priceSelection.detectedPrices.length === 0) {
            return {
                valid: false,
                reason: 'Item senza detectedPrices validi - saltato'
            };
        }

        // 5. Controlla selectedCssSelector
        if (!itemData.priceSelection.selectedCssSelector) {
            return {
                valid: false,
                reason: 'Item senza selectedCssSelector - saltato'
            };
        }

        // 6. Controlla link valido
        if (!itemData.link || !itemData.link.startsWith('http')) {
            return {
                valid: false,
                reason: 'Link non valido'
            };
        }

        return {
            valid: true,
            reason: 'Item valido per monitoraggio CSS selector'
        };
    }

   async monitorPriceWithCssSelector(htmlContent, itemData) {
    try {
        const priceSelection = itemData.priceSelection;
        const currentPrice = itemData.estimatedPrice;
        const selectedCssSelector = priceSelection.selectedCssSelector;
        const selectedPriceIndex = priceSelection.selectedPriceIndex || 0;
        
        console.log(`🎯 Monitoraggio CSS selector: "${selectedCssSelector}"`);
        console.log(`📊 Prezzo attuale: ${currentPrice}`);

        // ✅ USA IL NUOVO PriceDetectorService per rilevamento completo
        const detectionResult = await this.priceDetector.detectMultiplePrices(htmlContent);
        
        if (detectionResult.status === 'no_prices_detected') {
            console.log(`❌ Nessun prezzo rilevato nella pagina`);
            return {
                status: 'no_prices_detected',
                error: 'Nessun prezzo trovato nella pagina',
                skipItem: true
            };
        }

        // ✅ CERCA il CSS selector specifico nei prezzi rilevati
        const detectedPrices = detectionResult.detectedPrices;
        let matchingPrice = null;
        
        // Prova prima il CSS selector principale
        matchingPrice = detectedPrices.find(price => 
            price.cssSelector === selectedCssSelector
        );
        
        // ✅ FALLBACK: Prova alternativeSelectors se disponibili
        if (!matchingPrice && priceSelection.detectedPrices && 
            priceSelection.detectedPrices[selectedPriceIndex]?.alternativeSelectors) {
            
            const alternativeSelectors = priceSelection.detectedPrices[selectedPriceIndex].alternativeSelectors;
            
            for (const altSelector of alternativeSelectors) {
                matchingPrice = detectedPrices.find(price => 
                    price.cssSelector === altSelector.cssSelector
                );
                if (matchingPrice) {
                    console.log(`✅ Trovato con selector alternativo: ${altSelector.cssSelector}`);
                    break;
                }
            }
        }
        
        // ✅ FALLBACK: Prova per valore numerico simile (tolleranza 5%)
        if (!matchingPrice) {
            const tolerance = currentPrice * 0.05; // 5% di tolleranza
            matchingPrice = detectedPrices.find(price => 
                Math.abs(price.numericValue - currentPrice) <= tolerance
            );
            if (matchingPrice) {
                console.log(`✅ Trovato per valore simile: ${matchingPrice.value} (tolleranza ±5%)`);
            }
        }

        if (!matchingPrice) {
            console.log(`❌ CSS selector "${selectedCssSelector}" non trova corrispondenze`);
            console.log(`📋 Selettori disponibili: ${detectedPrices.map(p => p.cssSelector).join(', ')}`);
            return {
                status: 'css_selector_not_found',
                selectedCssSelector: selectedCssSelector,
                availableSelectors: detectedPrices.map(p => p.cssSelector),
                skipItem: true
            };
        }

        const newPrice = matchingPrice.numericValue;
        console.log(`💰 Prezzo estratto: ${newPrice} (dal selector: "${matchingPrice.cssSelector}")`);

        // ✅ CONFRONTA con tolleranza centesimi
        const priceChanged = Math.abs(newPrice - currentPrice) > 0.01;
        
        if (priceChanged) {
            console.log(`🔄 PREZZO CAMBIATO: ${currentPrice} → ${newPrice}`);
            return {
                status: 'price_changed',
                cssSelector: matchingPrice.cssSelector,
                oldPrice: currentPrice,
                newPrice: newPrice,
                confidence: matchingPrice.confidence,
                source: matchingPrice.source,
                analysisData: {
                    estimatedPrice: newPrice,
                    name: itemData.name,
                    method: 'css_selector_targeting',
                    detectionConfidence: matchingPrice.confidence,
                    usedSelector: matchingPrice.cssSelector
                }
            };
        } else {
            console.log(`✅ Prezzo invariato: ${currentPrice}`);
            return {
                status: 'price_unchanged',
                cssSelector: matchingPrice.cssSelector,
                currentPrice: currentPrice,
                newPrice: newPrice
            };
        }

    } catch (error) {
        console.error(`❌ Errore monitoraggio CSS selector:`, error);
        return {
            status: 'css_selector_error',
            error: error.message,
            skipItem: true
        };
    }
}
    

    /**
     * 🎯 FUNZIONE PRINCIPALE: Monitoraggio ottimizzato con CSS selector targeting
     */
    async runDailyPriceMonitoring() {
        console.log('🌅 Avvio monitoraggio prezzi con CSS selector targeting...');
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
                legacyUrlMode: 0,
                noPriceSelection: 0,
                samePrice: 0,
                priceChanged: 0,
                cssSelectorFailed: 0,
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
            version: '2.0.0_css_targeting'
        };

        try {
            // Step 1: Recupera SOLO item attivi NON completati
            const activeItems = await this.getActiveNotCompletedItems();
            this.stats.total = activeItems.length;
            reportData.stats.total = activeItems.length;
            
            console.log(`📦 Trovati ${activeItems.length} item attivi NON completati`);
            
            if (activeItems.length === 0) {
                reportData.success = true;
                reportData.endTime = new Date();
                reportData.duration = Date.now() - startTime;
                
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

            // Step 3: Monitora ogni item con CSS selector targeting
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
                            category: itemData.category || 'Senza categoria',
                            method: changes.method || 'css_selector'
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

            // Aggiorna statistiche finali
            reportData.stats = { ...this.stats };
            
            const duration = Date.now() - startTime;
            reportData.success = true;
            reportData.endTime = new Date();
            reportData.duration = duration;
            
            console.log(`✅ Monitoraggio completato in ${Math.round(duration/1000)}s`);
            
            // Step 5: Salva report
            try {
                await this.saveJobReport(reportData);
                console.log(`📊 Report salvato su Firestore con ID: ${jobId}`);
            } catch (reportError) {
                console.error('❌ Errore salvataggio report:', reportError.message);
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
     * 🧠 LOGICA OTTIMIZZATA: Monitoraggio con CSS selector targeting
     */
    async monitorSingleItemOptimized(itemDoc) {
        const itemData = itemDoc.data();
        const itemId = itemDoc.id;
        
        try {
            // Step 1: ✅ VALIDAZIONE PREREQUISITI
            const validationResult = this.validateItemForMonitoring(itemData);
            if (!validationResult.valid) {
                console.log(`⏩ Skip ${itemData.name}: ${validationResult.reason}`);
                
                // Aggiorna statistiche appropriate
                if (validationResult.reason.includes('url_legacy')) {
                    this.stats.legacyUrlMode++;
                } else if (validationResult.reason.includes('priceSelection')) {
                    this.stats.noPriceSelection++;
                }
                
                return null;
            }

            console.log(`🔗 Scraping URL: ${itemData.link}`);
            
            // Step 2: Scraping
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

            console.log(`📄 Nuovo contenuto: ${scrapingResult.content.text.length} caratteri`);

            // Step 3: ✅ MONITORAGGIO CON CSS SELECTOR TARGETING
            const monitoringResult = await this.monitorPriceWithCssSelector(
                scrapingResult.html || scrapingResult.content.text,
                itemData
            );

            console.log(`🎯 Risultato monitoraggio: ${monitoringResult.status}`);

            // Step 4: ✅ GESTIONE RISULTATO
            if (monitoringResult.status === 'price_unchanged') {
                console.log(`✅ Prezzo invariato per ${itemData.name}, NESSUN aggiornamento DB`);
                this.stats.samePrice++;
                return null;
            }

            if (monitoringResult.status === 'price_changed') {
                console.log(`💰 PREZZO CAMBIATO per ${itemData.name}: ${monitoringResult.oldPrice} → ${monitoringResult.newPrice}`);
                
                const changes = {
                    hasChanges: true,
                    priceChanged: true,
                    oldPrice: monitoringResult.oldPrice,
                    newPrice: monitoringResult.newPrice,
                    cssSelector: monitoringResult.cssSelector,
                    confidence: monitoringResult.confidence,
                    method: 'css_selector'
                };

                // Aggiorna DB
                await this.updateItemWithChanges(
                    itemId, 
                    itemData, 
                    changes, 
                    monitoringResult.analysisData,
                    scrapingResult.content.text
                );
                
                this.stats.dbWrites++;
                this.stats.priceChanged++;
                
                return {
                    itemId: itemId,
                    itemName: itemData.name,
                    itemData: itemData,
                    changes: changes,
                    newData: monitoringResult.analysisData,
                    timestamp: new Date(),
                    method: 'css_selector'
                };
            }

            // Step 5: ✅ FALLBACK DEEPSEEK (se CSS selector fallisce)
           if (monitoringResult.skipItem) {
                console.log(`⏩ Skip ${itemData.name}: ${monitoringResult.status}`);
                this.stats.cssSelectorFailed++;
                return null;
            }

            console.log(`✅ Nessun cambiamento per ${itemData.name}`);
            return null;

        } catch (error) {
            console.error(`❌ Errore monitoraggio item ${itemId}:`, error);
            this.stats.errors++;
            return null;
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
                    changeType: changes.newPrice > (changes.oldPrice || 0) ? 'increase' : 'decrease',
                    method: changes.method || 'css_selector',
                    cssSelector: changes.cssSelector || null,
                    confidence: changes.confidence || null
                });
                
                // Mantieni ultimi 50
                if (historicalPrice.length > 50) {
                    historicalPrice = historicalPrice.slice(-50);
                }
                if (historicalPriceWithDates.length > 50) {
                    historicalPriceWithDates = historicalPriceWithDates.slice(-50);
                }
                
                console.log(`📈 Storico prezzi aggiornato: ${changes.oldPrice} → ${changes.newPrice} (${changes.method})`);
            }
        }
        
        return {
            prices: historicalPrice,
            withDates: historicalPriceWithDates
        };
    }

    // ===== METODI HELPER E UTILITÀ =====

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
     * 📝 Genera descrizione cambiamenti
     */
    generateChangeDescription(changes, newData) {
    const descriptions = [];
    
    if (changes.priceChanged) {
        const direction = changes.newPrice > changes.oldPrice ? 'aumentato' : 'diminuito';
        const method = changes.method === 'css_selector' ? 'CSS selector' : 'Sistema automatico';  // ✅ CORRETTO
        descriptions.push(`Prezzo ${direction}: €${changes.oldPrice} → €${changes.newPrice} (rilevato via ${method})`);
    }
    
    return descriptions.join('; ') || 'Cambiamenti rilevati dal monitoraggio automatico';
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
                jobType: 'price_monitoring_css_targeting',
                
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
                    legacyUrlModeItems: reportData.stats.legacyUrlMode,
                    noPriceSelectionItems: reportData.stats.noPriceSelection,
                    unchangedItems: reportData.stats.samePrice,
                    priceChangedItems: reportData.stats.priceChanged,
                    cssSelectorFailedCount: reportData.stats.cssSelectorFailed,
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
                
                // Riepilogo cambiamenti con metodi utilizzati
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
                        method: change.method || 'unknown',
                        cssSelector: change.changes?.cssSelector,
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
                performance: this.calculatePerformanceMetrics(reportData),
                
                // ✅ NUOVO: Metriche specifiche CSS targeting
                cssTargetingMetrics: {
                    totalEligibleItems: reportData.stats.processed,
                    legacyUrlSkipped: reportData.stats.legacyUrlMode,
                    noPriceSelectionSkipped: reportData.stats.noPriceSelection,
                    cssSuccessRate: reportData.stats.processed > 0 ? 
                        Math.round(((reportData.stats.processed - reportData.stats.cssSelectorFailed) / reportData.stats.processed) * 100) : 0,  // ✅
                    cssSelectorFailureRate: reportData.stats.processed > 0 ? 
                        Math.round((reportData.stats.cssSelectorFailed / reportData.stats.processed) * 100) : 0  // ✅
                }
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
            
            // Efficienza CSS selector (meno DeepSeek calls = meglio)
            cssSelectorEfficiency: stats.processed > 0 ? Math.round(((stats.processed - stats.cssSelectorFailed) / stats.processed) * 100) : 0,  // ✅
            
            // Efficienza database (chiamate DB/items processati)
            dbEfficiency: stats.processed > 0 ? Math.round((stats.dbWrites / stats.processed) * 100) / 100 : 0,
            
            // Classificazione performance
            performanceClass: this.getPerformanceClass(duration, stats.processed, stats.errors, stats.cssSelectorFailed)  // ✅

        };
    }

    /**
     * 📊 Determina la classe di performance del job (aggiornata per CSS targeting)
     */
    getPerformanceClass(duration, processed, errors, cssSelectorFailed) {  // ✅
        const avgTimePerItem = processed > 0 ? duration / processed : 0;
        const errorPercentage = processed > 0 ? (errors / processed) * 100 : 0;
        const cssFailureRate = processed > 0 ? (cssSelectorFailed / processed) * 100 : 0;  // ✅
        
        if (errorPercentage > 20) return 'poor';
        if (avgTimePerItem > 30000) return 'slow'; // > 30s per item
        if (cssFailureRate > 50) return 'poor'; // Troppi fallimenti CSS  // ✅
        
        if (avgTimePerItem < 10000 && errorPercentage < 5 && cssFailureRate < 10) return 'excellent';  // ✅
        if (avgTimePerItem < 20000 && errorPercentage < 10 && cssFailureRate < 25) return 'good';  // ✅
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

    // ===== METODI UTILITÀ ESISTENTI =====

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
     * 📊 Ottieni statistiche dello storico prezzi per grafici
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
                    priceChanges: priceHistory.filter(entry => entry.oldPrice !== null).length,
                    cssTargetingStats: {
                        cssSuccessful: priceHistory.filter(entry => entry.method === 'css_selector').length,
                        cssSelectorFailed: priceHistory.filter(entry => entry.method === 'css_selector_failed').length  // ✅ CORRETTO
                    }
                }
            };
            
        } catch (error) {
            console.error('❌ Errore recupero statistiche storico prezzi:', error);
            return null;
        }
    }

    /**
 * 💾 Aggiorna item nel database con i cambiamenti rilevati
 */
async updateItemWithChanges(itemId, currentData, changes, analysisData, newScrapingText) {
    try {
        const timestamp = new Date();
        
        console.log(`💾 Aggiornamento DB per item ${itemId}...`);
        
        // ✅ PREPARA I DATI PER L'AGGIORNAMENTO
        const updateData = {
            // Aggiorna prezzo se cambiato
            estimatedPrice: changes.priceChanged ? changes.newPrice : currentData.estimatedPrice,
            
            // Aggiorna dati di scraping
            scrapingData: {
                ...currentData.scrapingData,
                lastScraped: timestamp,
                scrapingSuccess: true,
                scrapingMode: 'css_targeting', // ✅ Nuovo modo
                errors: null
            },
            
            // Aggiorna timestamp monitoraggio
            lastDetectionAttempt: timestamp,
            
            // ✅ Aggiorna informazioni sui cambiamenti (se ci sono stati)
            ...(changes.hasChanges && {
                lastPriceChange: {
                    date: timestamp,
                    oldPrice: changes.oldPrice,
                    newPrice: changes.newPrice,
                    method: changes.method || 'css_selector',
                    cssSelector: changes.cssSelector,
                    confidence: changes.confidence || null
                }
            }),
            
            // ✅ Mantieni informazioni di analisi (se disponibili)
            ...(analysisData && analysisData.name && {
                // Non sovrascrivere il nome esistente a meno che non sia vuoto
                ...((!currentData.name || currentData.name.trim() === '') && { name: analysisData.name })
            })
        };
        
        // ✅ AGGIORNA STORICO PREZZI (se prezzo cambiato)
        if (changes.priceChanged) {
            const updatedHistory = this.updateEnhancedPriceHistory(currentData, changes, timestamp);
            updateData.historicalPrice = updatedHistory.prices;
            updateData.historicalPriceWithDates = updatedHistory.withDates;
            
            console.log(`📈 Storico prezzi aggiornato: ${changes.oldPrice} → ${changes.newPrice}`);
        }
        
        // ✅ AGGIORNA CONTENUTO SCRAPING (limitato a 1500 caratteri)
        if (newScrapingText && newScrapingText.length > 0) {
            const ContentExtractor = require('./content-extractor');
            const extractedText = ContentExtractor.extractAllText(newScrapingText);
            updateData.scrapingData.extractedText = extractedText;
            
            console.log(`📄 Contenuto scraping aggiornato: ${extractedText.length} caratteri`);
        }
        
        // ✅ SALVA SU FIRESTORE
        await this.db.collection('shopping_items').doc(itemId).update(updateData);
        
        console.log(`✅ Item ${itemId} aggiornato con successo`);
        
        // ✅ LOG DETTAGLIATO DEI CAMBIAMENTI
        if (changes.hasChanges) {
            const changeDescription = this.generateChangeDescription(changes, analysisData);
            console.log(`🔄 Cambiamenti: ${changeDescription}`);
        }
        
        return {
            success: true,
            updatedFields: Object.keys(updateData),
            priceChanged: changes.priceChanged,
            newPrice: changes.newPrice,
            method: changes.method
        };
        
    } catch (error) {
        console.error(`❌ Errore aggiornamento item ${itemId}:`, error);
        
        // ✅ Tenta di salvare almeno il timestamp di tentativo
        try {
            await this.db.collection('shopping_items').doc(itemId).update({
                lastDetectionAttempt: new Date(),
                scrapingData: {
                    ...currentData.scrapingData,
                    lastScraped: new Date(),
                    scrapingSuccess: false,
                    errors: error.message
                }
            });
            console.log(`⚠️ Salvato timestamp di errore per item ${itemId}`);
        } catch (timestampError) {
            console.error(`❌ Impossibile salvare nemmeno il timestamp:`, timestampError);
        }
        
        throw error; // Rilancia l'errore per gestione upstream
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
                },
                // ✅ NUOVO: Statistiche CSS targeting
                cssTargetingStats: {
                    averageCssSuccessRate: reports.length > 0 ? 
                        Math.round(reports.reduce((sum, r) => sum + (r.cssTargetingMetrics?.cssSuccessRate || 0), 0) / reports.length) : 0,
                    averageCssFailureRate: reports.length > 0 ? 
                        Math.round(reports.reduce((sum, r) => sum + (r.cssTargetingMetrics?.cssSelectorFailureRate || 0), 0) / reports.length) : 0,  // ✅
                    totalLegacyItemsSkipped: reports.reduce((sum, r) => sum + (r.stats?.legacyUrlModeItems || 0), 0),
                    totalNoPriceSelectionSkipped: reports.reduce((sum, r) => sum + (r.stats?.noPriceSelectionItems || 0), 0)
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
}

// Export singleton instance
const priceMonitorService = new PriceMonitorService();
module.exports = { priceMonitorService };