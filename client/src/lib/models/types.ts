// ===== USER MODELS =====

import { removeUndefinedFields } from "../utils";

export interface FirestoreSerializable {
  toFirestore(): Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
}

export class UserLogin {
  constructor(
    public username: string,
    public role: "admin" | "user" = "user",
    public password: string
  ) {}
}

export class User implements FirestoreSerializable {
  constructor(
    public id: string,
    public username: string,
    public role: "admin" | "user" = "user",
    public email?: string,
    public displayName?: string,
    public photoURL?: string,
    public createdAt: Date = new Date(),
    public lastLoginAt?: Date,
    public updatedAt?: Date,
  ) {}

  static fromFirestore(data: any): User {
    return new User(
      data.id,
      data.username,
      data.role,
      data.email,
      data.displayName,
      data.photoURL,
      data.createdAt?.toDate() || new Date(),
      data.lastLoginAt?.toDate()
    );
  }

  toFirestore() {
    const data = {
      username: this.username,
      role: this.role,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    };
    return removeUndefinedFields(data);
  }

  isAdmin(): boolean {
    return this.role === "admin";
  }
}

// ===== VALIDATION UTILITIES =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ===== SHOPPING ITEM MODELS =====

export class ShoppingItem implements FirestoreSerializable {
  constructor(
    public id: string,
    public category: string,        // SPOSTATO: obbligatorio
    public createdBy: string,       // SPOSTATO: obbligatorio  
    public link: string,            // SPOSTATO: obbligatorio
    public name?: string,           // OPZIONALE: può essere estratto dallo scraping
    public createdAt: Date = new Date(),
    public completed: boolean = false,
    public completedBy?: string,
    public completedAt?: Date,
    public priority: "low" | "medium" | "high" = "medium",
    public estimatedPrice?: number,
    public notes?: string,
    public updatedAt: Date = new Date(),
    public isPublic: boolean = true,  // MODIFICATO: default true
    public scrapingData?: {           // ✅ AGGIORNATO: struttura corretta per scraping
      lastScraped: Date;
      scrapingMode: string;
      scrapingSuccess: boolean;
      scrapingText?: string;
      errors?: any;
    },
    public brandName?: string,
  ) {
    // Validazione nel costruttore
    this.validate();
  }

  // Metodo di validazione integrato
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (this.name && this.name.length > 100) {
      errors.push('Product name must be less than 100 characters');
    }
    
    if (!this.category || this.category.trim().length === 0) {
      errors.push('Category is required');
    }
    
    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Created by is required');
    }
    
    if (!this.link || !this.isValidLink()) {
      errors.push('Valid URL is required');
    }
    
    if (this.estimatedPrice !== undefined && (this.estimatedPrice <= 0 || isNaN(this.estimatedPrice))) {
      errors.push('Price must be a positive number');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Shopping item validation failed', errors);
    }
    
    return { isValid: true, errors: [] };
  }

  static fromFirestore(data: any): ShoppingItem {
    try {
      // Gestione sicura delle date
      const parseDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          return dateValue.toDate();
        }
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'string' || typeof dateValue === 'number') {
          const parsed = new Date(dateValue);
          return isNaN(parsed.getTime()) ? new Date() : parsed;
        }
        return new Date();
      };

      // Validazione e default per campi obbligatori
      const category = data.category || 'Articoli';
      const createdBy = data.createdBy || 'Unknown';
      const link = data.link || '';

      // Crea l'oggetto senza validazione automatica nel costruttore
      const item = Object.create(ShoppingItem.prototype);
      
      // Assegna i valori manualmente nell'ordine corretto
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
      item.scrapingData = data.scrapingData;
      item.brandName = data.brandName;
      
      // Valida solo se i campi essenziali sono presenti
      if (link && category && createdBy) {
        try {
          item.validate();
        } catch (validationError) {
          console.warn('Validation warning for existing document:', data.id, validationError);
          // Non bloccare il caricamento per documenti esistenti
        }
      }

      return item;
      
    } catch (error) {
      console.error('Error in fromFirestore for ShoppingItem:', error, data);
      
      // Fallback: crea un oggetto minimo valido
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
      fallbackItem.brandName = data.brandName || "Brand sconosciuto";
      
      return fallbackItem;
    }
  }

  toFirestore() {
    const data = {
      name: this.name,
      category: this.category,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      completed: this.completed,
      link: this.link,
      completedBy: this.completedBy,
      completedAt: this.completedAt,
      priority: this.priority,
      estimatedPrice: this.estimatedPrice,
      notes: this.notes,
      updatedAt: this.updatedAt,
      isPublic: this.isPublic,
      scrapingData: this.scrapingData,
      brandName: this.brandName,
    };
    return removeUndefinedFields(data);
  }

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

  // Aggiornamento sicuro con validazione
  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
    this.validate(); // Ri-valida dopo l'aggiornamento
  }

  isValidLink(): boolean {
    if (!this.link) return false;
    try {
      new URL(this.link);
      return true;
    } catch {
      return false;
    }
  }
  
  // ✅ AGGIORNATO: metodo per aggiornare con dati di scraping
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
    
    if (scrapingData.price && !this.estimatedPrice) {
      const priceMatch = scrapingData.price.match(/(\d+[.,]\d+|\d+)/);
      if (priceMatch) {
        this.estimatedPrice = parseFloat(priceMatch[1].replace(',', '.'));
      }
    }
    
    // ✅ AGGIORNATO: struttura corretta
    this.scrapingData = {
      lastScraped: new Date(),
      scrapingMode: scrapingData.mode || 'html_analysis',
      scrapingSuccess: true,
      scrapingText: scrapingData.scrapingText || JSON.stringify(scrapingData),
      errors: null
    };
    
    this.updatedAt = new Date();
  }
}

// ===== CATEGORY MODELS =====

export class Category implements FirestoreSerializable {
  constructor(
    public id: string,
    public name: string,
    public createdBy: string,
    public createdAt: Date = new Date(),
    public description?: string,
    public color: string = "#6B7280",
    public icon?: string,
    public isDefault: boolean = false,
    public itemCount: number = 0,
    public updatedAt?: Date
  ) {}

  static fromFirestore(data: any): Category {
    return new Category(
      data.id,
      data.name,
      data.createdBy,
      data.createdAt?.toDate() || new Date(),
      data.description,
      data.color || "#6B7280",
      data.icon,
      data.isDefault || false,
      data.itemCount || 0
    );
  }

  toFirestore() {
    const data = {
      name: this.name,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      description: this.description,
      color: this.color,
      icon: this.icon,
      isDefault: this.isDefault,
      itemCount: this.itemCount,
    };
    return removeUndefinedFields(data);
  }

  incrementItemCount(): void {
    this.itemCount++;
  }

  decrementItemCount(): void {
    if (this.itemCount > 0) {
      this.itemCount--;
    }
  }

  isValidColor(): boolean {
    return /^#[0-9A-F]{6}$/i.test(this.color);
  }
}

// ===== NOTE MODELS =====

export class Note implements FirestoreSerializable {
  constructor(
    public id: string,
    public title: string,
    public content: string,
    public createdBy: string,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public isPublic: boolean = false,
    public tags: string[] = [],
    public isPinned: boolean = false,
    public color: string = "#F3F4F6",
    public sharedWith: string[] = [],
    public lastViewedAt?: Date
  ) {
    // Validazione nel costruttore
    this.validate();
  }

  // Metodo di validazione integrato
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (this.title && this.title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }
    
    if (!this.content || this.content.trim().length === 0) {
      errors.push('Content is required');
    }
    
    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Created by is required');
    }
    
    if (!this.isValidColor()) {
      errors.push('Invalid color format');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Note validation failed', errors);
    }
    
    return { isValid: true, errors: [] };
  }

  static fromFirestore(data: any): Note {
    return new Note(
      data.id,
      data.title,
      data.content,
      data.createdBy,
      data.createdAt?.toDate() || new Date(),
      data.updatedAt?.toDate() || new Date(),
      data.isPublic || false,
      data.tags || [],
      data.isPinned || false,
      data.color || "#F3F4F6",
      data.sharedWith || [],
      data.lastViewedAt?.toDate()
    );
  }

  toFirestore() {
    const data = {
      title: this.title,
      content: this.content,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isPublic: this.isPublic,
      tags: this.tags,
      isPinned: this.isPinned,
      color: this.color,
      sharedWith: this.sharedWith,
      lastViewedAt: this.lastViewedAt,
    };
    return removeUndefinedFields(data);
  }

  // Aggiornamento sicuro con validazione
  update(title?: string, content?: string): void {
    if (title) this.title = title;
    if (content) this.content = content;
    this.updatedAt = new Date();
    this.validate(); // Ri-valida dopo l'aggiornamento
  }

  private isValidColor(): boolean {
    return /^#[0-9A-F]{6}$/i.test(this.color);
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
    this.updatedAt = new Date();
  }

  shareWith(userId: string): void {
    if (!this.sharedWith.includes(userId)) {
      this.sharedWith.push(userId);
      this.updatedAt = new Date();
    }
  }

  unshareWith(userId: string): void {
    this.sharedWith = this.sharedWith.filter(id => id !== userId);
    this.updatedAt = new Date();
  }

  togglePin(): void {
    this.isPinned = !this.isPinned;
    this.updatedAt = new Date();
  }

  togglePublic(): void {
    this.isPublic = !this.isPublic;
    this.updatedAt = new Date();
  }

  markAsViewed(): void {
    this.lastViewedAt = new Date();
  }

  canBeViewedBy(userId: string): boolean {
    return this.isPublic || 
           this.createdBy === userId || 
           this.sharedWith.includes(userId);
  }

  canBeEditedBy(userId: string): boolean {
    return this.createdBy === userId;
  }
}

// ===== CALENDAR EVENT MODELS =====

export class CalendarEvent implements FirestoreSerializable {
  constructor(
    public id: string,
    public title: string,
    public startDate: Date,
    public endDate: Date,
    public createdBy: string,
    public description?: string,
    public isAllDay: boolean = false,
    public isPublic: boolean = false,
    public eventType: "personal" | "family" | "work" | "appointment" | "reminder" = "personal",
    public color: string = "#E07A5F",
    public location?: string,
    public attendees: string[] = [],
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {
    // Validazione nel costruttore
    this.validate();
  }

  // Metodo di validazione integrato
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (this.title && this.title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }
    
    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Created by is required');
    }
    
    if (this.endDate <= this.startDate) {
      errors.push('End date must be after start date');
    }
    
    if (!this.isValidColor()) {
      errors.push('Invalid color format');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Calendar event validation failed', errors);
    }
    
    return { isValid: true, errors: [] };
  }

  private isValidColor(): boolean {
    return /^#[0-9A-F]{6}$/i.test(this.color);
  }

  static fromFirestore(data: any): CalendarEvent {
    return new CalendarEvent(
      data.id,
      data.title,
      data.startDate?.toDate() || new Date(),
      data.endDate?.toDate() || new Date(),
      data.createdBy,
      data.description,
      data.isAllDay || false,
      data.isPublic || false,
      data.eventType || "personal",
      data.color || "#E07A5F",
      data.location,
      data.attendees || [],
      data.createdAt?.toDate() || new Date(),
      data.updatedAt?.toDate() || new Date()
    );
  }

  toFirestore() {
    const data = {
      title: this.title,
      startDate: this.startDate,
      endDate: this.endDate,
      createdBy: this.createdBy,
      description: this.description,
      isAllDay: this.isAllDay,
      isPublic: this.isPublic,
      eventType: this.eventType,
      color: this.color,
      location: this.location,
      attendees: this.attendees,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    return removeUndefinedFields(data);
  }

  getDuration(): number {
    return this.endDate.getTime() - this.startDate.getTime();
  }

  getDurationInHours(): number {
    return this.getDuration() / (1000 * 60 * 60);
  }

  isOnDate(date: Date): boolean {
    const eventStart = new Date(this.startDate);
    const eventEnd = new Date(this.endDate);
    const checkDate = new Date(date);
    
    // Reset time for date comparison
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(23, 59, 59, 999);
    checkDate.setHours(12, 0, 0, 0);
    
    return checkDate >= eventStart && checkDate <= eventEnd;
  }

  isInRange(startDate: Date, endDate: Date): boolean {
    return this.startDate <= endDate && this.endDate >= startDate;
  }

  addAttendee(userId: string): void {
    if (!this.attendees.includes(userId)) {
      this.attendees.push(userId);
      this.updatedAt = new Date();
    }
  }

  removeAttendee(userId: string): void {
    this.attendees = this.attendees.filter(id => id !== userId);
    this.updatedAt = new Date();
  }

  // Aggiornamento sicuro con validazione
  updateDates(startDate: Date, endDate: Date): void {
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedAt = new Date();
    this.validate(); // Ri-valida dopo l'aggiornamento
  }

  canBeViewedBy(userId: string): boolean {
    return this.isPublic || 
           this.createdBy === userId || 
           this.attendees.includes(userId);
  }

  canBeEditedBy(userId: string): boolean {
    return this.createdBy === userId;
  }

  isUpcoming(): boolean {
    return this.startDate > new Date();
  }

  isPast(): boolean {
    return this.endDate < new Date();
  }

  isOngoing(): boolean {
    const now = new Date();
    return this.startDate <= now && this.endDate >= now;
  }
}

// ===== UTILITY TYPES =====

export type UserRole = "admin" | "user";
export type Priority = "low" | "medium" | "high";
export type EventType = "personal" | "family" | "work" | "appointment" | "reminder";

// ===== SAFE FACTORY FUNCTIONS =====

export class ModelFactory {
  static createCategory(data: Partial<Category>): Category {
    try {
      // Prima validiamo i dati in input
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Category validation failed', ['Category name is required']);
      }
      
      if (data.name.length > 50) {
        throw new ValidationError('Category validation failed', ['Category name must be less than 50 characters']);
      }
      
      if (!data.createdBy || data.createdBy.trim().length === 0) {
        throw new ValidationError('Category validation failed', ['Created by is required']);
      }
      
      if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
        throw new ValidationError('Category validation failed', ['Invalid color format - must be hex color (e.g., #FF0000)']);
      }
      
      if (data.description && data.description.length > 100) {
        throw new ValidationError('Category validation failed', ['Description must be less than 100 characters']);
      }
      
      if (data.icon && data.icon.length > 2) {
        throw new ValidationError('Category validation failed', ['Icon must be less than 2 characters']);
      }
      
      // Crea la categoria con i dati validati
      const category = new Category(
        data.id || `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data.name.trim(),
        data.createdBy,
        data.createdAt || new Date(),
        data.description?.trim() || undefined,
        data.color || "#6B7280",
        data.icon || "🏷️",
        data.isDefault || false,
        data.itemCount || 0
      );
      
      // Validazione aggiuntiva tramite il metodo della classe
      if (!category.isValidColor()) {
        throw new ValidationError('Category validation failed', ['Invalid color format']);
      }
      
      return category;
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create category', ['Unknown validation error']);
    }
  }

  // Factory con validazione sicura per Note
  static createNote(data: Partial<Note>): Note {
    try {
      return new Note(
        data.id || "",
        data.title || "",
        data.content || "",
        data.createdBy || "",
        data.createdAt || new Date(),
        data.updatedAt || new Date(),
        data.isPublic || false,
        data.tags || [],
        data.isPinned || false,
        data.color || "#F3F4F6",
        data.sharedWith || [],
        data.lastViewedAt
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create note', ['Unknown validation error']);
    }
  }

  // Factory con validazione sicura per ShoppingItem
  static createShoppingItem(data: Partial<ShoppingItem>): ShoppingItem {
    try {
      // Validazione dati richiesti
      if (!data.link || !data.link.startsWith('http')) {
        throw new ValidationError('Shopping item validation failed', ['Valid URL is required']);
      }
      
      if (!data.category || data.category.trim().length === 0) {
        throw new ValidationError('Shopping item validation failed', ['Category is required']);
      }
      
      if (!data.createdBy || data.createdBy.trim().length === 0) {
        throw new ValidationError('Shopping item validation failed', ['Created by is required']);
      }
      
      return new ShoppingItem(
        data.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data.category,           // obbligatorio
        data.createdBy,          // obbligatorio
        data.link,               // obbligatorio
        data.name,               // opzionale - può essere estratto
        data.createdAt || new Date(),
        data.completed || false,
        data.completedBy,
        data.completedAt,
        data.priority || "medium",
        data.estimatedPrice,
        data.notes,
        data.updatedAt || new Date(),
        data.isPublic !== undefined ? data.isPublic : true,
        data.scrapingData,
        data.brandName
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create shopping item', ['Unknown validation error']);
    }
  }

  // Factory con validazione sicura per CalendarEvent
  static createCalendarEvent(data: Partial<CalendarEvent>): CalendarEvent {
    try {
      return new CalendarEvent(
        data.id || "",
        data.title || "",
        data.startDate || new Date(),
        data.endDate || new Date(),
        data.createdBy || "",
        data.description,
        data.isAllDay || false,
        data.isPublic || false,
        data.eventType || "personal",
        data.color || "#E07A5F",
        data.location,
        data.attendees || [],
        data.createdAt || new Date(),
        data.updatedAt || new Date()
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create calendar event', ['Unknown validation error']);
    }
  }
}