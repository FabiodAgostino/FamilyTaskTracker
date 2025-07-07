// ===== USER MODELS =====

import { removeUndefinedFields } from "../utils";
import { PriceHistoryEntry } from "./price";
import { ShoppingItem } from "./shopping-item";

export interface FirestoreSerializable {
  toFirestore(): Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
}

export class ValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}


export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
export class UserLogin {
  constructor(
    public username: string,
    public role: "admin" | "user" = "user",
    public email: string,  // ← Campo email obbligatorio
    public password: string
  ) {}

  // Metodo helper per verificare se è admin
  isAdmin(): boolean {
    return this.role === "admin";
  }

  // Metodo per ottenere una versione sicura (senza password)
  toSafeUser(): { username: string; role: "admin" | "user"; email: string; isAdmin(): boolean } {
    return {
      username: this.username,
      role: this.role,
      email: this.email,
      isAdmin: () => this.isAdmin()
    };
  }
}

// Interfaccia per dati di validazione utente
export interface UserLoginData {
  username: string;
  role: "admin" | "user";
  email: string;
  password: string;
  displayName?: string;
}

// Classe User più completa per Firestore
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
    public isActive: boolean = true,
    // Campi per password cifrata
    public passwordEncrypted?: string,
    public passwordIV?: string
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
      data.lastLoginAt?.toDate(),
      data.updatedAt?.toDate(),
      data.isActive !== undefined ? data.isActive : true,
      data.passwordEncrypted,
      data.passwordIV
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
      updatedAt: this.updatedAt || new Date(),
      isActive: this.isActive,
      passwordEncrypted: this.passwordEncrypted,
      passwordIV: this.passwordIV
    };
    return removeUndefinedFields(data);
  }

  isAdmin(): boolean {
    return this.role === "admin";
  }

  // Converte User in UserLogin per compatibilità
  toUserLogin(password: string = ''): UserLogin {
    return new UserLogin(
      this.username,
      this.role,
      this.email || `${this.username}@familytasktracker.local`,
      password
    );
  }
}

// ===== VALIDATION FUNCTIONS =====

export function validateUserLogin(data: Partial<UserLoginData>): string[] {
  const errors: string[] = [];
  
  if (!data.username || data.username.trim().length === 0) {
    errors.push("Username è obbligatorio");
  }
  
  if (data.username && (data.username.length < 3 || data.username.length > 20)) {
    errors.push("Username deve essere tra 3 e 20 caratteri");
  }
  
  if (data.username && !/^[a-zA-Z0-9_-]+$/.test(data.username)) {
    errors.push("Username può contenere solo lettere, numeri, _ e -");
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push("Email valida è obbligatoria");
  }
  
  if (!data.password || data.password.length < 6) {
    errors.push("Password deve essere almeno 6 caratteri");
  }
  
  if (data.role && !["admin", "user"].includes(data.role)) {
    errors.push("Ruolo deve essere 'admin' o 'user'");
  }
  
  if (data.displayName && (data.displayName.length < 2 || data.displayName.length > 50)) {
    errors.push("Nome display deve essere tra 2 e 50 caratteri");
  }
  
  return errors;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
    public updatedAt: Date = new Date(),
    // NUOVI CAMPI PER LE NOTIFICHE
    public reminderMinutes?: number,  // Minuti prima dell'evento per la notifica
    public reminderSent?: boolean,    // Flag se la notifica è stata inviata
    public reminderSentAt?: Date,     // Timestamp di quando è stata inviata
    public cloudTaskId?: string       // ID del Cloud Task creato
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
    data.updatedAt?.toDate() || new Date(),
    // AGGIUNGI I NUOVI CAMPI
    data.reminderMinutes,
    data.reminderSent || false,
    data.reminderSentAt?.toDate(),
    data.cloudTaskId
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
    // AGGIUNGI I NUOVI CAMPI
    reminderMinutes: this.reminderMinutes,
    reminderSent: this.reminderSent,
    reminderSentAt: this.reminderSentAt,
    cloudTaskId: this.cloudTaskId,
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

  // ✅ AGGIORNATO: Factory con validazione sicura per ShoppingItem (inclusa imageUrl)
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
      
      // ✅ NUOVO: Validazione imageUrl se presente
      if (data.imageUrl && data.imageUrl.trim().length > 0) {
        try {
          const url = new URL(data.imageUrl);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new ValidationError('Shopping item validation failed', ['Image URL must use http or https protocol']);
          }
        } catch {
          throw new ValidationError('Shopping item validation failed', ['Invalid image URL format']);
        }
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
        data.brandName,
        data.imageUrl            // ✅ NUOVO: Include imageUrl nel factory
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
        data.updatedAt || new Date(),
        data.reminderMinutes
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create calendar event', ['Unknown validation error']);
    }
  }
}

export interface GoogleImageSearchResult {
  error: any;
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
      searchType: string;
    }>;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: Array<{
    kind: string;
    title: string;
    htmlTitle: string;
    link: string;
    displayLink: string;
    snippet: string;
    htmlSnippet: string;
    mime: string;
    fileFormat?: string;
    image: {
      contextLink: string;
      height: number;
      width: number;
      byteSize: number;
      thumbnailLink: string;
      thumbnailHeight: number;
      thumbnailWidth: number;
    };
  }>;
}

// ✅ NUOVO: Interface per i risultati delle immagini processati
export interface ProcessedImageResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  width: number;
  height: number;
  contextLink: string;
}