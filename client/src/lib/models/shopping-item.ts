
import { removeUndefinedFields } from "../utils";
import { PriceHistoryEntry, PriceMonitoring } from "./price";
import { FirestoreSerializable, ValidationResult, ValidationError } from "./types";
// ===== SHOPPING ITEM CLASS =====

export class ShoppingItem implements FirestoreSerializable {
  public priceSelection?: PriceSelectionData;
  
  public needsPriceSelection: boolean = false;
  constructor(
    public id: string,
    public category: string,        
    public createdBy: string,       
    public link: string,            
    public name?: string,           
    public createdAt: Date = new Date(),
    public completed: boolean = false,
    public completedBy?: string,
    public completedAt?: Date,
    public priority: "low" | "medium" | "high" = "medium",
    public estimatedPrice?: number,
    public notes?: string,
    public updatedAt: Date = new Date(),
    public isPublic: boolean = true,
    public scrapingData?: ScrapingData,
    public brandName?: string,
    public imageUrl?: string,
    public imageUpdated?: boolean,
    
    // CAMPI MONITORAGGIO PREZZI
    public available: boolean = true,
    public historicalPrice: number[] = [],                      // Backward compatibility
    public lastPriceCheck?: Date,
    public priceMonitoring?: PriceMonitoring,
    
    // STORICO PREZZI CON DATE
    public historicalPriceWithDates?: PriceHistoryEntry[]
    
  ) {
    if (this.validate) {
      this.validate();
    }
  }
updateWithMultiplePrices(detectedPrices: DetectedPrice[]): void {
    if (detectedPrices.length === 0) {
      // Nessun prezzo trovato
      this.priceSelection = {
        status: 'error',
        detectedPrices: [],
        detectionErrors: ['Nessun prezzo rilevato nella pagina'],
        lastDetectionAttempt: new Date()
      };
      this.needsPriceSelection = false;
      
    } else if (detectedPrices.length === 1) {
      // Un solo prezzo trovato - selezione automatica
      const price = detectedPrices[0];
      this.estimatedPrice = price.numericValue;
      this.priceSelection = {
        status: 'single_price',
        detectedPrices: detectedPrices,
        selectedPriceIndex: 0,
        selectedCssSelector: price.cssSelector,
        selectionTimestamp: new Date(),
        lastDetectionAttempt: new Date()
      };
      this.needsPriceSelection = false;
      
    } else {
      // Prezzi multipli - necessita selezione utente
      this.priceSelection = {
        status: 'needs_selection',
        detectedPrices: detectedPrices,
        lastDetectionAttempt: new Date()
      };
      this.needsPriceSelection = true;
      // Non impostiamo estimatedPrice finché l'utente non sceglie
    }
    
    this.updatedAt = new Date();
  }

  selectPrice(priceIndex: number): void {
    if (!this.priceSelection || !this.priceSelection.detectedPrices[priceIndex]) {
      throw new Error('Prezzo non valido selezionato');
    }
    
    const selectedPrice = this.priceSelection.detectedPrices[priceIndex];
    
    this.estimatedPrice = selectedPrice.numericValue;
    this.priceSelection.status = 'selected';
    this.priceSelection.selectedPriceIndex = priceIndex;
    this.priceSelection.selectedCssSelector = selectedPrice.cssSelector;
    this.priceSelection.selectionTimestamp = new Date();
    this.needsPriceSelection = false;
    this.updatedAt = new Date();
    
    // Aggiungi al historical price
    this.addPriceToHistoryWithDate(selectedPrice.numericValue, new Date());
    
      }
  
  getSelectedCssSelector(): string | null {
    return this.priceSelection?.selectedCssSelector || null;
  }
  
  hasValidPriceSelector(): boolean {
    return this.priceSelection?.status === 'selected' || 
           this.priceSelection?.status === 'single_price';
  }
  
  canBeMonitored(): boolean {
    return this.hasValidPriceSelector() && !this.needsPriceSelection;
  }
  
  getPriceSelectionSummary(): string {
    if (!this.priceSelection) return 'Nessun dato prezzi';
    
    switch (this.priceSelection.status) {
      case 'needs_selection':
        return `${this.priceSelection.detectedPrices.length} prezzi trovati - necessita selezione`;
      case 'selected':
        const selected = this.priceSelection.detectedPrices[this.priceSelection.selectedPriceIndex!];
        return `Prezzo selezionato: ${selected.value}`;
      case 'single_price':
        return `Prezzo unico: ${this.priceSelection.detectedPrices[0].value}`;
      case 'error':
        return `Errore rilevamento: ${this.priceSelection.detectionErrors?.join(', ')}`;
      default:
        return 'Stato sconosciuto';
    }
  }
  // ===== VALIDAZIONE =====

  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.category?.trim()) {
      errors.push('La categoria è obbligatoria');
    }

    if (!this.createdBy?.trim()) {
      errors.push('Il creatore è obbligatorio');
    }

    if (!this.link?.trim()) {
      errors.push('Il link è obbligatorio');
    } else {
      try {
        new URL(this.link);
      } catch {
        errors.push('Il link deve essere un URL valido');
      }
    }

    if (this.estimatedPrice !== undefined && this.estimatedPrice < 0) {
      errors.push('Il prezzo stimato non può essere negativo');
    }

    // Validazione storico prezzi
    if (this.historicalPrice && !Array.isArray(this.historicalPrice)) {
      errors.push('Lo storico prezzi deve essere un array');
    }

    if (this.historicalPrice && this.historicalPrice.some(price => 
      typeof price !== 'number' || price < 0)) {
      errors.push('Lo storico prezzi deve contenere solo numeri positivi');
    }

    // Validazione storico prezzi con date
    if (this.historicalPriceWithDates && !Array.isArray(this.historicalPriceWithDates)) {
      errors.push('Lo storico prezzi con date deve essere un array');
    }

    if (this.historicalPriceWithDates && this.historicalPriceWithDates.some(entry => 
      !entry || typeof entry.price !== 'number' || entry.price < 0 || !(entry.date instanceof Date))) {
      errors.push('Lo storico prezzi con date deve contenere oggetti validi con prezzo e data');
    }

    if (typeof this.available !== 'boolean') {
      errors.push('La disponibilità deve essere un booleano');
    }

    const result = {
      isValid: errors.length === 0,
      errors
    };

    if (!result.isValid) {
      throw new ValidationError(`Validazione fallita: ${errors.join(', ')}`, errors);
    }

    return result;
  }

  // ===== FIRESTORE SERIALIZATION =====

 static getAlternativeSelectors(data: any): any[] {
  try {
    const detectedPrices = data?.priceSelection?.detectedPrices;
    
    if (!Array.isArray(detectedPrices)) {
      console.log('detectedPrices non è un array o non esiste');
      return [];
    }
    
    // Estrai tutti gli alternativeSelectors da ogni elemento
    const allSelectors: any[] = [];
    
    detectedPrices.forEach((price: any, index: number) => {
      if (price?.alternativeSelectors && Array.isArray(price.alternativeSelectors)) {
        allSelectors.push(...price.alternativeSelectors);
      }
    });
    
    return allSelectors;
  } catch (error) {
    console.error('Errore nell\'estrazione dei selettori:', error);
    return [];
  }
}

  static fromFirestore(data: any): ShoppingItem {
    try {
      this.getAlternativeSelectors(data);
      const parseDate = (dateField: any): Date => {
        if (!dateField) return new Date();
        if (dateField instanceof Date) return dateField;
        if (typeof dateField === 'object' && dateField.toDate) {
          return dateField.toDate();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      const parseHistoricalPriceWithDates = (historyData: any): PriceHistoryEntry[] => {
        if (!Array.isArray(historyData)) return [];
        
        return historyData.map(entry => {
          if (typeof entry === 'object' && entry !== null) {
            return {
              price: typeof entry.price === 'number' ? entry.price : 0,
              date: parseDate(entry.date),
              oldPrice: typeof entry.oldPrice === 'number' ? entry.oldPrice : null,
              changeType: entry.changeType || 'initial'
            };
          }
          return {
            price: typeof entry === 'number' ? entry : 0,
            date: new Date(),
            changeType: 'initial' as const
          };
        });
      };

      const category = data.category || 'Articoli';
      const createdBy = data.createdBy || 'Unknown';
      const link = data.link || '';

      const item = Object.create(ShoppingItem.prototype);
      
      // Campi base
      item.id = data.id;
      item.category = category;
      item.createdBy = createdBy;
      item.link = link;
      item.name = data.name;
      item.createdAt = parseDate(data.createdAt);
      item.completed = data.completed || false;
      item.completedBy = data.completedBy;
      item.completedAt = data.completedAt ? parseDate(data.completedAt) : undefined;
      item.priority = data.priority || "medium";
      item.estimatedPrice = data.estimatedPrice;
      item.notes = data.notes;
      item.updatedAt = parseDate(data.updatedAt);
      item.isPublic = data.isPublic !== undefined ? data.isPublic : true;
      item.brandName = data.brandName;
      item.imageUrl = data.imageUrl;
      item.imageUpdated = data.imageUpdated || false;

      // Parsing scrapingData
      if (data.scrapingData && typeof data.scrapingData === 'object') {
        item.scrapingData = {
          lastScraped: parseDate(data.scrapingData.lastScraped),
          scrapingMode: data.scrapingData.scrapingMode || 'html_analysis',
          scrapingSuccess: data.scrapingData.scrapingSuccess || false,
          scrapingText: data.scrapingData.scrapingText,
          errors: data.scrapingData.errors
        };
      }

      // Campi monitoraggio prezzi
      item.available = data.available !== undefined ? data.available : true;
      item.historicalPrice = Array.isArray(data.historicalPrice) ? data.historicalPrice : [];
      item.lastPriceCheck = data.lastPriceCheck ? parseDate(data.lastPriceCheck) : undefined;
      
      // Storico prezzi con date
      item.historicalPriceWithDates = parseHistoricalPriceWithDates(data.historicalPriceWithDates);
      
      // Parsing priceMonitoring
      if (data.priceMonitoring && typeof data.priceMonitoring === 'object') {
        item.priceMonitoring = {
          lastCheck: parseDate(data.priceMonitoring.lastCheck),
          changesDetected: data.priceMonitoring.changesDetected || false,
          priceChanged: data.priceMonitoring.priceChanged || false,
          availabilityChanged: data.priceMonitoring.availabilityChanged || false,
          analysisText: data.priceMonitoring.analysisText
        };
      }
// ===== PARSING PRICE SELECTION CON DESERIALIZZAZIONE =====
if (data.priceSelection && typeof data.priceSelection === 'object') {
  let detectedPrices: DetectedPrice[] = [];
  
  if (data.priceSelection.detectedPrices) {
    try {
      // Deserializza l'array di prezzi rilevati
      const rawPrices = data.priceSelection.detectedPrices;
     if (Array.isArray(rawPrices)) {
    // ✅ PASSA L'INDEX DEL LOOP come fallback
    detectedPrices = rawPrices.map((rawPrice, index) => 
        parseDetectedPrice(rawPrice, index)  // ← Passa l'index!
    );
} else if (typeof rawPrices === 'object') {
    // ✅ ANCHE QUI, usa l'index dell'array dei valori
    const values = Object.values(rawPrices);
    detectedPrices = values.map((rawPrice, index) => 
        parseDetectedPrice(rawPrice, index)  // ← Passa l'index!
    );
}
    } catch (error) {
      console.error('❌ Error parsing detectedPrices:', error, data.priceSelection.detectedPrices);
      detectedPrices = [];
    }
  }

  item.priceSelection = {
    status: deserializeFirestoreValue(data.priceSelection.status) || 'error',
    detectedPrices: detectedPrices,
    selectedPriceIndex: deserializeFirestoreValue(data.priceSelection.selectedPriceIndex),
    selectedCssSelector: deserializeFirestoreValue(data.priceSelection.selectedCssSelector),
    selectionTimestamp: data.priceSelection.selectionTimestamp 
      ? parseDate(data.priceSelection.selectionTimestamp) 
      : undefined,
    lastDetectionAttempt: data.priceSelection.lastDetectionAttempt 
      ? parseDate(data.priceSelection.lastDetectionAttempt) 
      : undefined,
    detectionErrors: data.priceSelection.detectionErrors 
      ? deserializeFirestoreObject(data.priceSelection.detectionErrors)
      : undefined,
  };
}

item.needsPriceSelection = deserializeFirestoreValue(data.needsPriceSelection) || false;

      // Validazione condizionale per dati esistenti
      if (link && category && createdBy) {
        try {
          item.validate();
        } catch (validationError) {
          console.warn('Validation warning for existing document:', data.id, validationError);
        }
      }

      return item;
      
    } catch (error) {
      console.error('Error in fromFirestore for ShoppingItem:', error, data);
      
      // Fallback con valori di default
      const fallbackItem = Object.create(ShoppingItem.prototype);
      fallbackItem.id = data.id || 'unknown';
      fallbackItem.category = data.category || 'Articoli';
      fallbackItem.createdBy = data.createdBy || 'Unknown';
      fallbackItem.link = data.link || 'https://example.com';
      fallbackItem.name = data.name || 'Prodotto sconosciuto';
      fallbackItem.createdAt = new Date();
      fallbackItem.completed = false;
      fallbackItem.priority = "medium";
      fallbackItem.updatedAt = new Date();
      fallbackItem.isPublic = true;
      fallbackItem.imageUpdated = false;
      fallbackItem.available = true;
      fallbackItem.historicalPrice = [];
      fallbackItem.historicalPriceWithDates = [];
      
      return fallbackItem;
    }
  }

  toFirestore() {
  // 🔧 FIX: Pulizia ricorsiva degli oggetti annidati
  const cleanObjectRecursive = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined; // Sarà rimosso da removeUndefinedFields
    }
    
    if (obj instanceof Date) {
      return obj; // Le date sono OK
    }
    
    if (Array.isArray(obj)) {
      // Pulisci array ricorsivamente
      return obj.map(item => cleanObjectRecursive(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = cleanObjectRecursive(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    
    return obj; // Valori primitivi (string, number, boolean)
  };

  const data = {
    category: this.category,
    createdBy: this.createdBy,
    link: this.link,
    name: this.name,
    createdAt: this.createdAt,
    completed: this.completed,
    completedBy: this.completedBy,
    completedAt: this.completedAt,
    priority: this.priority,
    estimatedPrice: this.estimatedPrice,
    notes: this.notes,
    updatedAt: new Date(),
    isPublic: this.isPublic,
    scrapingData: this.scrapingData,
    brandName: this.brandName,
    imageUrl: this.imageUrl,
    imageUpdated: this.imageUpdated,
    
    // Campi monitoraggio prezzi
    available: this.available,
    historicalPrice: this.historicalPrice,
    lastPriceCheck: this.lastPriceCheck,
    priceMonitoring: this.priceMonitoring,
    historicalPriceWithDates: this.historicalPriceWithDates,
    
    // 🔧 FIX: Pulizia speciale per priceSelection
  priceSelection: this.priceSelection ? this.serializePriceSelection() : undefined,
    
    needsPriceSelection: this.needsPriceSelection
  };

  // Applica la pulizia finale (che ora funziona anche su oggetti annidati)
  return removeUndefinedFields(data);
}

  // ===== METODI GESTIONE STATO =====

  complete(userId: string): void {
    this.completed = true;
    this.completedBy = userId;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  uncomplete(): void {
    this.completed = false;
    this.completedBy = undefined;
    this.completedAt = undefined;
    this.updatedAt = new Date();
  }

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
    this.validate();
  }

  updateNotes(notes: string): void {
    this.notes = notes;
    this.updatedAt = new Date();
  }

  updateCategory(category: string): void {
    this.category = category;
    this.updatedAt = new Date();
    this.validate();
  }

  updatePriority(priority: "low" | "medium" | "high"): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  updatePrice(price: number): void {
    if (price < 0) {
      throw new Error('Il prezzo non può essere negativo');
    }
    this.estimatedPrice = price;
    this.updatedAt = new Date();
  }

  togglePublic(): void {
    this.isPublic = !this.isPublic;
    this.updatedAt = new Date();
  }

  updateBrand(brandName: string): void {
    this.brandName = brandName;
    this.updatedAt = new Date();
  }

  updateImageUrl(imageUrl: string): void {
    if (this.canUpdateImage()) {
      this.imageUrl = imageUrl;
      this.imageUpdated = true;
      this.updatedAt = new Date();
    }
  }

  removeImage(): void {
    this.imageUrl = undefined;
    this.imageUpdated = false;
    this.updatedAt = new Date();
  }

  // ===== METODI VALIDAZIONE =====

  isValidLink(): boolean {
    if (!this.link) return false;
    try {
      new URL(this.link);
      return true;
    } catch {
      return false;
    }
  }

  isValidImageUrl(): boolean {
    if (!this.imageUrl) return true;
    try {
      const url = new URL(this.imageUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  canUpdateImage(): boolean {
    return !this.imageUpdated;
  }

  hasPrice(): boolean {
    return this.estimatedPrice !== undefined && this.estimatedPrice !== null;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  isPublicItem(): boolean {
    return this.isPublic;
  }

  isOwnedBy(username: string): boolean {
    return this.createdBy === username;
  }

  // ===== METODI GESTIONE PREZZI =====

  getLastPrice(): number | null {
    if (this.historicalPrice.length === 0) {
      return this.estimatedPrice || null;
    }
    return this.historicalPrice[this.historicalPrice.length - 1];
  }

  addPriceToHistory(price: number): void {
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Il prezzo deve essere un numero positivo');
    }

    // Evita duplicati consecutivi
    const lastPrice = this.getLastPrice();
    if (lastPrice !== price) {
      this.historicalPrice.push(price);
      
      // Mantieni solo gli ultimi 50 prezzi
      if (this.historicalPrice.length > 50) {
        this.historicalPrice = this.historicalPrice.slice(-50);
      }
      
      this.updatedAt = new Date();
    }
  }

  addPriceToHistoryWithDate(price: number, date: Date = new Date(), oldPrice?: number | null): void {
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Il prezzo deve essere un numero positivo');
    }

    // Aggiorna storico semplice (backward compatibility)
    const lastPrice = this.getLastPrice();
    if (lastPrice !== price) {
      this.historicalPrice.push(price);
      
      if (this.historicalPrice.length > 50) {
        this.historicalPrice = this.historicalPrice.slice(-50);
      }
    }

    // Aggiorna storico con date
    if (!this.historicalPriceWithDates) {
      this.historicalPriceWithDates = [];
    }

    const lastPriceWithDate = this.getLastPriceWithDate();
    if (!lastPriceWithDate || lastPriceWithDate.price !== price) {
      
      const changeType: 'increase' | 'decrease' | 'initial' = 
        oldPrice === undefined || oldPrice === null ? 'initial' :
        price > oldPrice ? 'increase' : 
        price < oldPrice ? 'decrease' : 'initial';

      this.historicalPriceWithDates.push({
        price: price,
        date: date,
        oldPrice: oldPrice || null,
        changeType: changeType
      });
      
      if (this.historicalPriceWithDates.length > 50) {
        this.historicalPriceWithDates = this.historicalPriceWithDates.slice(-50);
      }
    }
    
    this.updatedAt = new Date();
  }

  getLastPriceWithDate(): PriceHistoryEntry | null {
    if (!this.historicalPriceWithDates || this.historicalPriceWithDates.length === 0) {
      return null;
    }
    return this.historicalPriceWithDates[this.historicalPriceWithDates.length - 1];
  }

  getMinPrice(): number | null {
    if (this.historicalPrice.length === 0) {
      return this.estimatedPrice || null;
    }
    return Math.min(...this.historicalPrice);
  }

  getMaxPrice(): number | null {
    if (this.historicalPrice.length === 0) {
      return this.estimatedPrice || null;
    }
    return Math.max(...this.historicalPrice);
  }

  getPriceChangePercentage(): number | null {
    if (this.historicalPrice.length < 2) {
      return null;
    }
    
    const firstPrice = this.historicalPrice[0];
    const lastPrice = this.historicalPrice[this.historicalPrice.length - 1];
    
    if (firstPrice === 0) return null;
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }

  isPriceTrendingUp(): boolean {
    if (this.historicalPrice.length < 3) {
      return false;
    }
    
    const recentPrices = this.historicalPrice.slice(-3);
    return recentPrices[0] < recentPrices[1] && recentPrices[1] < recentPrices[2];
  }

  isPriceTrendingDown(): boolean {
    if (this.historicalPrice.length < 3) {
      return false;
    }
    
    const recentPrices = this.historicalPrice.slice(-3);
    return recentPrices[0] > recentPrices[1] && recentPrices[1] > recentPrices[2];
  }

  // ===== METODI GESTIONE DISPONIBILITÀ =====

  updateAvailability(isAvailable: boolean, analysisText?: string): void {
    const oldAvailability = this.available;
    this.available = isAvailable;
    
    // Aggiorna metadati di monitoraggio
    this.priceMonitoring = {
      lastCheck: new Date(),
      changesDetected: oldAvailability !== isAvailable,
      priceChanged: false,
      availabilityChanged: oldAvailability !== isAvailable,
      analysisText: analysisText
    };
    
    this.lastPriceCheck = new Date();
    this.updatedAt = new Date();
  }

  updatePriceAndAvailability(newPrice: number | null, isAvailable: boolean, analysisText?: string): void {
    const oldPrice = this.estimatedPrice;
    const oldAvailability = this.available;
    
    // Aggiorna prezzo
    if (newPrice !== null && newPrice !== oldPrice) {
      this.estimatedPrice = newPrice;
      this.addPriceToHistoryWithDate(newPrice, new Date(), oldPrice);
    }
    
    // Aggiorna disponibilità
    this.available = isAvailable;
    
    // Aggiorna metadati
    this.priceMonitoring = {
      lastCheck: new Date(),
      changesDetected: (newPrice !== oldPrice) || (oldAvailability !== isAvailable),
      priceChanged: newPrice !== oldPrice,
      availabilityChanged: oldAvailability !== isAvailable,
      analysisText: analysisText
    };
    
    this.lastPriceCheck = new Date();
    this.updatedAt = new Date();
  }

  isAvailable(): boolean {
    return this.available;
  }

  // ===== METODI GESTIONE MONITORAGGIO =====

  needsPriceCheck(hoursThreshold: number = 24): boolean {
    if (!this.lastPriceCheck) {
      return true; // Mai controllato
    }
    
    const now = new Date();
    const hoursSinceLastCheck = (now.getTime() - this.lastPriceCheck.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastCheck >= hoursThreshold;
  }

  markAsChecked(): void {
    this.lastPriceCheck = new Date();
    if (this.priceMonitoring) {
      this.priceMonitoring.lastCheck = new Date();
    }
  }

  hasRecentChanges(): boolean {
    return this.priceMonitoring?.changesDetected || false;
  }

  // ===== METODI GESTIONE SCRAPING =====

  updateWithScrapingData(scrapingData: any): void {
    if (scrapingData.nameProduct && !this.name) {
      this.name = scrapingData.nameProduct;
    }
    
    if (scrapingData.nameBrand && !this.brandName) {
      this.brandName = scrapingData.nameBrand;
    }
    
    if (scrapingData.category && this.category === 'Articoli') {
      this.category = scrapingData.category;
    }
    
    // Gestione prezzo con storico
    if (scrapingData.price && !this.estimatedPrice) {
      const priceMatch = scrapingData.price.match(/(\d+[.,]\d+|\d+)/);
      if (priceMatch) {
        const newPrice = parseFloat(priceMatch[1].replace(',', '.'));
        this.estimatedPrice = newPrice;
        this.addPriceToHistoryWithDate(newPrice);
      }
    }
    
    if (scrapingData.imageUrl && !this.imageUrl) {
      this.imageUrl = scrapingData.imageUrl;
    }
    
    // Gestione disponibilità da scraping
    if (typeof scrapingData.available === 'boolean') {
      this.available = scrapingData.available;
    }
    
    this.scrapingData = {
      lastScraped: new Date(),
      scrapingMode: scrapingData.mode || 'html_analysis',
      scrapingSuccess: true,
      scrapingText: scrapingData.scrapingText || JSON.stringify(scrapingData),
      errors: null
    };
    
    this.updatedAt = new Date();
    
    try {
      this.validate();
    } catch (validationError) {
      console.warn('Validation warning after scraping update:', validationError);
      if (this.imageUrl && !this.isValidImageUrl()) {
        this.imageUrl = undefined;
      }
    }
  }

  hasScrapingData(): boolean {
    return this.scrapingData !== undefined;
  }

  getLastScrapingDate(): Date | null {
    return this.scrapingData?.lastScraped || null;
  }

  wasScrapingSuccessful(): boolean {
    return this.scrapingData?.scrapingSuccess || false;
  }

  // ===== METODI UTILITÀ =====

  getAge(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getAgeInHours(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
  }

  getTimeSinceLastUpdate(): number {
    const now = new Date();
    const lastUpdate = this.updatedAt || this.createdAt;
    return Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
  }

  getSummary(): string {
    const parts = [];
    
    if (this.name) parts.push(this.name);
    if (this.brandName) parts.push(`by ${this.brandName}`);
    if (this.estimatedPrice) parts.push(`€${this.estimatedPrice}`);
    if (!this.available) parts.push('(Non disponibile)');
    if (this.completed) parts.push('(Completato)');
    
    return parts.join(' ');
  }

  clone(): ShoppingItem {
    return new ShoppingItem(
      `${this.id}_copy`,
      this.category,
      this.createdBy,
      this.link,
      this.name,
      new Date(), // Nuova data di creazione
      false,      // Non completato
      undefined,  // Nessun completedBy
      undefined,  // Nessun completedAt
      this.priority,
      this.estimatedPrice,
      this.notes,
      new Date(), // Nuova data di aggiornamento
      this.isPublic,
      undefined,  // Nessun scrapingData
      this.brandName,
      this.imageUrl,
      this.imageUpdated,
      this.available,
      [],         // Storico prezzi vuoto
      undefined,  // Nessun lastPriceCheck
      undefined,  // Nessun priceMonitoring
      []          // Storico prezzi con date vuoto
    );
  }

    /**
   * Serializza correttamente priceSelection per Firestore
   */
  private serializePriceSelection(): any {
    if (!this.priceSelection) return undefined;

    return {
      status: this.priceSelection.status,
      detectedPrices: this.priceSelection.detectedPrices || [],
      selectedPriceIndex: this.priceSelection.selectedPriceIndex,
      selectedCssSelector: this.priceSelection.selectedCssSelector,
      selectionTimestamp: this.priceSelection.selectionTimestamp,
      lastDetectionAttempt: this.priceSelection.lastDetectionAttempt,
      detectionErrors: this.priceSelection.detectionErrors
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      category: this.category,
      createdBy: this.createdBy,
      link: this.link,
      name: this.name,
      createdAt: this.createdAt.toISOString(),
      completed: this.completed,
      completedBy: this.completedBy,
      completedAt: this.completedAt?.toISOString(),
      priority: this.priority,
      estimatedPrice: this.estimatedPrice,
      notes: this.notes,
      updatedAt: this.updatedAt.toISOString(),
      isPublic: this.isPublic,
      brandName: this.brandName,
      imageUrl: this.imageUrl,
      imageUpdated: this.imageUpdated,
      available: this.available,
      historicalPrice: this.historicalPrice,
      lastPriceCheck: this.lastPriceCheck?.toISOString(),
      hasScrapingData: this.hasScrapingData(),
      age: this.getAge(),
      summary: this.getSummary()
    };
  }
}

export interface DetectedPrice {
  value: string;           // "€29.99", "25,50 EUR", etc.
  numericValue: number;    // 29.99, 25.50, etc.
  cssSelector: string;     // CSS selector per trovare questo prezzo
  parentClasses: string[]; // Classi CSS dei 4 div parent
  elementText: string;     // Testo completo dell'elemento che contiene il prezzo
  confidence: number;      // 0-1, confidence che sia un prezzo valido
  isStrikethrough?: boolean; // Se il prezzo è barrato
  priority?: number;       // Priorità del prezzo
  source?: string;         // Fonte del rilevamento (css, json, etc.)
  conversionType?: string; // Tipo di conversione applicata
  position?: {             // Posizione nell'HTML per ranking
    index: number;         // Ordine di apparizione nella pagina
    depth: number;         // Profondità nell'HTML
  };
  context?: {              // Contesto per aiutare l'utente a scegliere
    nearbyText: string;    // Testo vicino al prezzo (es: "Prezzo scontato:", "Spedizione:")
    isProminent: boolean;  // Se il prezzo è visivamente prominente
  };
  alternativeSelectors: Array<AlternativeSelector>;
}

export interface AlternativeSelector
{
  confidence:number;
  context: string;
  cssSelector:string;
  source:string;

}

export interface PriceSelectionData {
  status: 'needs_selection' | 'selected' | 'single_price' | 'error' | 'skipped';
  detectedPrices: DetectedPrice[];
  selectedPriceIndex?: number;         // Indice del prezzo scelto dall'utente
  selectedCssSelector?: string;        // Selector CSS da usare nel monitoraggio
  selectionTimestamp?: Date;           // Quando l'utente ha fatto la selezione
  lastDetectionAttempt?: Date;         // Ultimo tentativo di rilevamento prezzi
  detectionErrors?: string[];          // Eventuali errori durante il rilevamento
}


export interface ScrapingData {
  lastScraped: Date;
  scrapingMode: string;
  scrapingSuccess: boolean;
  scrapingText?: string;
  errors?: any;
}

// ===== HELPER FUNCTIONS FOR FIRESTORE DESERIALIZATION =====

/**
 * Deserializza i valori Firestore che contengono metadati sui tipi
 * Gestisce stringhe come "@{stringValue=value}", "@{integerValue=42}", etc.
 */
function deserializeFirestoreValue(value: any): any {
  if (typeof value !== 'string') {
    return value; // Se non è una stringa, restituisci così com'è
  }

  // Pattern per estrarre valori wrappati in metadati Firestore
  const patterns = [
    { regex: /^@\{stringValue=(.+)\}$/, parser: (match: string) => match },
    { regex: /^@\{integerValue=(.+)\}$/, parser: (match: string) => parseInt(match, 10) },
    { regex: /^@\{doubleValue=(.+)\}$/, parser: (match: string) => parseFloat(match) },
    { regex: /^@\{booleanValue=(.+)\}$/, parser: (match: string) => match.toLowerCase() === 'true' },
    { regex: /^@\{arrayValue=\}$/, parser: () => [] }, // Array vuoto
    { regex: /^@\{mapValue=\}$/, parser: () => ({}) }, // Oggetto vuoto
    { regex: /^@\{nullValue=.*\}$/, parser: () => null }, // Valore null
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (match) {
      return pattern.parser(match[1] || '');
    }
  }

  // Se non corrisponde a nessun pattern, restituisci il valore originale
  return value;
}

/**
 * Deserializza ricorsivamente un oggetto che può contenere valori Firestore serializzati
 */
function deserializeFirestoreObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deserializeFirestoreObject(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeFirestoreObject(deserializeFirestoreValue(value));
    }
    return result;
  }

  return deserializeFirestoreValue(obj);

  
}

/**
 * Parser specifico per DetectedPrice con validazione dei campi
 */
function parseDetectedPrice(rawPrice: any, fallbackIndex: number = 0): DetectedPrice {
    const deserialized = deserializeFirestoreObject(rawPrice);
    return {
        value: deserialized.value || '',
        numericValue: typeof deserialized.numericValue === 'number' ? deserialized.numericValue : 0,
        cssSelector: deserialized.cssSelector || '',
        parentClasses: Array.isArray(deserialized.parentClasses) ? deserialized.parentClasses : [],
        elementText: deserialized.elementText || '',
        confidence: typeof deserialized.confidence === 'number' ? deserialized.confidence : 0,
        isStrikethrough: typeof deserialized.isStrikethrough === 'boolean' ? deserialized.isStrikethrough : false,
        priority: typeof deserialized.priority === 'number' ? deserialized.priority : 0,
        source: deserialized.source || 'unknown',
        conversionType: deserialized.conversionType,
        
        // ✅ FIX: Se position esiste usalo, altrimenti usa fallbackIndex
        position: deserialized.position || { 
            index: fallbackIndex,  // ← Usa l'index del loop invece di sempre 0!
            depth: 0 
        },
        context: deserialized.context || { nearbyText: '', isProminent: false },
        alternativeSelectors:deserialized.alternativeSelectors || []
    };
}



