

const { getFirestore } = require('firebase-admin/firestore');
const { WebScraper } = require('./web-scraper');
const { DeepSeekClient } = require('./deepseek-client');
const { ContentExtractor } = require('./content-extractor');
const { PriceDetectorService } = require('./price-detector-service');
const { emailService } = require('./email-service');
const cheerio = require('cheerio');

class PriceMonitorService {
    constructor() {
        this.db = getFirestore();
        this.conversationId = null;
        this.priceDetector = new PriceDetectorService();
        this.stats = {
            total: 0,
            processed: 0,
            completed: 0,         // Item completati saltati
            legacyUrlMode: 0,     // Item con scrapingMode = url_legacy saltati
            noPriceSelection: 0,  // Item senza priceSelection saltati
            samePrice: 0,         // Prezzo presente e invariato
            priceChanged: 0,      // Solo questi aggiornano il DB
            deepseekCalls: 0,
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
            } else if (monitoringResult.status === 'price_not_found' || monitoringResult.status === 'css_selector_failed') {
                // Fallback a DeepSeek solo se CSS selector fallisce completamente
                console.log(`🤖 Fallback DeepSeek necessario: ${monitoringResult.status}`);
                
                if (!this.conversationId) {
                    this.conversationId = await this.initializePriceMonitoringConversation();
                }

                const analysisResult = await this.analyzePriceWithDeepSeek(
                    scrapingResult.content.text,
                    url,
                    mockCurrentData
                );

                if (analysisResult) {
                    const deepSeekChanges = this.detectChanges(mockCurrentData, analysisResult);
                    if (deepSeekChanges.hasChanges) {
                        needsUpdate = true;
                        changes = deepSeekChanges;
                        changes.fallbackMethod = 'deepseek';
                    }
                }
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

    /**
     * 🎯 CORE: Monitoraggio prezzo con CSS selector targeting
     */
    async monitorPriceWithCssSelector(htmlContent, itemData) {
        try {
            const priceSelection = itemData.priceSelection;
            const currentPrice = itemData.estimatedPrice;
            const cssSelector = priceSelection.selectedCssSelector;
            
            console.log(`🎯 Monitoraggio CSS selector: "${cssSelector}"`);
            console.log(`📊 Prezzo attuale: ${currentPrice}`);

            const $ = cheerio.load(htmlContent);
            
            // Step 1: Prova CSS selector specifico
            const targetElement = $(cssSelector);
            
            if (targetElement.length === 0) {
                console.log(`❌ CSS selector "${cssSelector}" non trova elementi`);
                return {
                    status: 'css_selector_failed',
                    cssSelector: cssSelector,
                    error: 'Selector non trova elementi',
                    fallbackNeeded: true
                };
            }

            console.log(`✅ CSS selector trovato ${targetElement.length} elementi`);

            // Step 2: Estrai prezzo dal primo elemento
            const elementText = targetElement.first().text().trim();
            console.log(`📋 Testo elemento: "${elementText}"`);

            // Step 3: Usa PriceDetectorService per estrarre prezzo dal testo
            const extractedPrices = this.priceDetector.extractPricesFromText(elementText);
            
            if (extractedPrices.length === 0) {
                console.log(`❌ Nessun prezzo estratto dal testo: "${elementText}"`);
                return {
                    status: 'price_not_found',
                    cssSelector: cssSelector,
                    elementText: elementText,
                    error: 'Nessun prezzo trovato nel selector',
                    fallbackNeeded: true
                };
            }

            const foundPrice = extractedPrices[0];
            const newPrice = foundPrice.numericValue;
            
            console.log(`💰 Prezzo estratto: ${newPrice} (dal testo: "${foundPrice.value}")`);

            // Step 4: Confronta con prezzo attuale
            const priceChanged = Math.abs(newPrice - currentPrice) > 0.01; // Tolleranza centesimi
            
            if (priceChanged) {
                console.log(`🔄 PREZZO CAMBIATO: ${currentPrice} → ${newPrice}`);
                return {
                    status: 'price_changed',
                    cssSelector: cssSelector,
                    oldPrice: currentPrice,
                    newPrice: newPrice,
                    elementText: elementText,
                    extractedValue: foundPrice.value,
                    confidence: 0.95, // Alta confidenza per CSS selector specifico
                    analysisData: {
                        estimatedPrice: newPrice,
                        name: itemData.name, // Mantieni nome esistente
                        method: 'css_selector_targeting'
                    }
                };
            } else {
                console.log(`✅ Prezzo invariato: ${currentPrice}`);
                return {
                    status: 'price_unchanged',
                    cssSelector: cssSelector,
                    currentPrice: currentPrice,
                    elementText: elementText,
                    extractedValue: foundPrice.value
                };
            }

        } catch (error) {
            console.error(`❌ Errore monitoraggio CSS selector:`, error);
            return {
                status: 'css_selector_error',
                error: error.message,
                fallbackNeeded: true
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

            // Step 2: Inizializza conversazione DeepSeek (per fallback)
            this.conversationId = await this.initializePriceMonitoringConversation();
            
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
            if (monitoringResult.fallbackNeeded) {
                console.log(`🤖 Fallback DeepSeek necessario per ${itemData.name}: ${monitoringResult.status}`);
                this.stats.deepseekCalls++;
                
                const analysisResult = await this.analyzePriceWithDeepSeek(
                    scrapingResult.content.text,
                    itemData.link,
                    itemData
                );

                if (!analysisResult) {
                    console.log(`⚠️ Analisi DeepSeek fallita per ${itemData.name}`);
                    return null;
                }

                const changes = this.detectChanges(itemData, analysisResult);

                if (changes.hasChanges) {
                    console.log(`💾 AGGIORNAMENTO DB per ${itemData.name}: cambiamenti rilevati via DeepSeek fallback`);
                    
                    changes.method = 'deepseek_fallback';
                    changes.originalMethod = 'css_selector_failed';
                    
                    await this.updateItemWithChanges(itemId, itemData, changes, analysisResult, scrapingResult.content.text);
                    this.stats.dbWrites++;
                    
                    if (changes.priceChanged) this.stats.priceChanged++;
                    
                    return {
                        itemId: itemId,
                        itemName: itemData.name,
                        itemData: itemData,
                        changes: changes,
                        newData: analysisResult,
                        timestamp: new Date(),
                        method: 'deepseek_fallback'
                    };
                } else {
                    console.log(`✅ Nessun cambiamento rilevato via DeepSeek fallback per ${itemData.name}`);
                    return null;
                }
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
     * ✅ Rileva cambiamenti reali (per fallback DeepSeek)
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
            console.log(`💰 Prezzo cambiato (DeepSeek): ${changes.oldPrice} → ${changes.newPrice}`);
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
            const method = changes.method === 'css_selector' ? 'CSS selector' : 
                          changes.method === 'deepseek_fallback' ? 'DeepSeek (fallback)' : 'Sistema automatico';
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
                        Math.round(((reportData.stats.processed - reportData.stats.deepseekCalls) / reportData.stats.processed) * 100) : 0,
                    deepseekFallbackRate: reportData.stats.processed > 0 ? 
                        Math.round((reportData.stats.deepseekCalls / reportData.stats.processed) * 100) : 0
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
            cssSelectorEfficiency: stats.processed > 0 ? Math.round(((stats.processed - stats.deepseekCalls) / stats.processed) * 100) : 0,
            
            // Efficienza database (chiamate DB/items processati)
            dbEfficiency: stats.processed > 0 ? Math.round((stats.dbWrites / stats.processed) * 100) / 100 : 0,
            
            // Classificazione performance
            performanceClass: this.getPerformanceClass(duration, stats.processed, stats.errors, stats.deepseekCalls)
        };
    }

    /**
     * 📊 Determina la classe di performance del job (aggiornata per CSS targeting)
     */
    getPerformanceClass(duration, processed, errors, deepseekCalls) {
        const avgTimePerItem = processed > 0 ? duration / processed : 0;
        const errorPercentage = processed > 0 ? (errors / processed) * 100 : 0;
        const deepseekFallbackRate = processed > 0 ? (deepseekCalls / processed) * 100 : 0;
        
        if (errorPercentage > 20) return 'poor';
        if (avgTimePerItem > 30000) return 'slow'; // > 30s per item
        if (deepseekFallbackRate > 50) return 'poor'; // Troppi fallback CSS
        
        if (avgTimePerItem < 10000 && errorPercentage < 5 && deepseekFallbackRate < 10) return 'excellent';
        if (avgTimePerItem < 20000 && errorPercentage < 10 && deepseekFallbackRate < 25) return 'good';
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
            // ✅ Validazione prezzo
            if (result.estimatedPrice) {
                const extracted = this.extractNumberFromPrice(result.estimatedPrice);
                result.estimatedPrice = extracted;
            } else {
                result.estimatedPrice = null;
            }

            // ✅ NON aggiornare il nome (mantieni quello esistente)
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
            const conversationId = DeepSeekClient.generateConversationId('price_monitoring_css');
            await DeepSeekClient.initializeConversation(conversationId);
            console.log(`🤖 Conversazione DeepSeek inizializzata: ${conversationId}`);
            return conversationId;
        } catch (error) {
            console.error('❌ Errore inizializzazione DeepSeek:', error);
            return null;
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
                        deepseekFallback: priceHistory.filter(entry => entry.method === 'deepseek_fallback').length
                    }
                }
            };
            
        } catch (error) {
            console.error('❌ Errore recupero statistiche storico prezzi:', error);
            return null;
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
                    averageDeepseekFallbackRate: reports.length > 0 ? 
                        Math.round(reports.reduce((sum, r) => sum + (r.cssTargetingMetrics?.deepseekFallbackRate || 0), 0) / reports.length) : 0,
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