import { removeUndefinedFields } from "../utils";
import { FirestoreSerializable, ValidationResult, ValidationError } from "./types";

// ===== REMINDER CLASS =====

export class Reminder implements FirestoreSerializable {
  constructor(
    public id: string,
    public title: string,           // Titolo del promemoria
    public message: string,         // Messaggio/descrizione
    public scheduledTime: Date,     // Orario di esecuzione preciso
    public createdBy: string,       // Chi ha creato il promemoria
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public isActive: boolean = true,              // Se il promemoria è attivo
    public isPublic: boolean = true,              // Se è familiare o personale
    public isRecurring: boolean = false,          // Se è ricorrente
    public recurrencePattern?: RecurrencePattern, // Pattern di ricorrenza
    public reminderType: ReminderType = 'personal', // Tipo di promemoria
    public notificationSent: boolean = false,     // Se la notifica è stata inviata
    public notificationSentAt?: Date,             // Quando è stata inviata
    public cloudTaskId?: string,                  // ID del Cloud Task associato
    public lastTriggered?: Date,                  // Ultima volta che è stato eseguito
    public triggerCount: number = 0,              // Quante volte è stato eseguito
    public priority: "low" | "medium" | "high" = "medium", // Priorità
    public tags?: string[],                       // Tag per categorizzazione
    public notes?: string,                        // Note aggiuntive
    public snoozeUntil?: Date,                   // Posticipato fino a...
    public completedAt?: Date                     // Se completato manualmente
  ) {
    if (this.validate) {
      this.validate();
    }
  }

  // ===== VALIDAZIONE =====

  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.title?.trim()) {
      errors.push('Il titolo è obbligatorio');
    }

    if (!this.message?.trim()) {
      errors.push('Il messaggio è obbligatorio');
    }

    if (!this.createdBy?.trim()) {
      errors.push('Il creatore è obbligatorio');
    }

    if (!this.scheduledTime || !(this.scheduledTime instanceof Date)) {
      errors.push('L\'orario programmato è obbligatorio e deve essere una data valida');
    }

    if (this.scheduledTime && this.scheduledTime <= new Date() && this.isActive) {
      errors.push('L\'orario programmato deve essere nel futuro per promemoria attivi');
    }

    if (this.isRecurring && !this.recurrencePattern) {
      errors.push('Il pattern di ricorrenza è richiesto per promemoria ricorrenti');
    }

    if (this.snoozeUntil && this.snoozeUntil <= new Date()) {
      errors.push('La data di posticipo deve essere nel futuro');
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

  static fromFirestore(data: any): Reminder {
    try {
      const parseDate = (dateField: any): Date => {
        if (!dateField) return new Date();
        if (dateField instanceof Date) return dateField;
        if (typeof dateField === 'object' && dateField.toDate) {
          return dateField.toDate();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      const reminder = Object.create(Reminder.prototype);
      
      // Campi obbligatori
      reminder.id = data.id;
      reminder.title = data.title || 'Promemoria senza titolo';
      reminder.message = data.message || '';
      reminder.scheduledTime = parseDate(data.scheduledTime);
      reminder.createdBy = data.createdBy || 'Unknown';
      reminder.createdAt = parseDate(data.createdAt);
      reminder.updatedAt = parseDate(data.updatedAt);
      
      // Campi con default
      reminder.isActive = data.isActive !== undefined ? data.isActive : true;
      reminder.isPublic = data.isPublic !== undefined ? data.isPublic : true;
      reminder.isRecurring = data.isRecurring || false;
      reminder.reminderType = data.reminderType || 'personal';
      reminder.notificationSent = data.notificationSent || false;
      reminder.triggerCount = data.triggerCount || 0;
      reminder.priority = data.priority || "medium";
      
      // Campi opzionali
      reminder.notificationSentAt = data.notificationSentAt ? parseDate(data.notificationSentAt) : undefined;
      reminder.cloudTaskId = data.cloudTaskId;
      reminder.lastTriggered = data.lastTriggered ? parseDate(data.lastTriggered) : undefined;
      reminder.tags = Array.isArray(data.tags) ? data.tags : undefined;
      reminder.notes = data.notes;
      reminder.snoozeUntil = data.snoozeUntil ? parseDate(data.snoozeUntil) : undefined;
      reminder.completedAt = data.completedAt ? parseDate(data.completedAt) : undefined;
      
      // Parsing recurrencePattern
      if (data.recurrencePattern && typeof data.recurrencePattern === 'object') {
        reminder.recurrencePattern = {
          type: data.recurrencePattern.type || 'daily',
          interval: data.recurrencePattern.interval || 1,
          daysOfWeek: Array.isArray(data.recurrencePattern.daysOfWeek) ? data.recurrencePattern.daysOfWeek : undefined,
          dayOfMonth: data.recurrencePattern.dayOfMonth,
          endDate: data.recurrencePattern.endDate ? parseDate(data.recurrencePattern.endDate) : undefined,
          maxOccurrences: data.recurrencePattern.maxOccurrences
        };
      }

      // Validazione condizionale per dati esistenti
      try {
        reminder.validate();
      } catch (validationError) {
        console.warn('Validation warning for existing reminder:', data.id, validationError);
      }

      return reminder;
      
    } catch (error) {
      console.error('Error in fromFirestore for Reminder:', error, data);
      
      // Fallback con valori di default
      const fallbackReminder = Object.create(Reminder.prototype);
      fallbackReminder.id = data.id || 'unknown';
      fallbackReminder.title = data.title || 'Promemoria senza titolo';
      fallbackReminder.message = data.message || 'Messaggio non disponibile';
      fallbackReminder.scheduledTime = new Date(Date.now() + 3600000); // +1 ora
      fallbackReminder.createdBy = data.createdBy || 'Unknown';
      fallbackReminder.createdAt = new Date();
      fallbackReminder.updatedAt = new Date();
      fallbackReminder.isActive = true;
      fallbackReminder.isPublic = true;
      fallbackReminder.isRecurring = false;
      fallbackReminder.reminderType = 'personal';
      fallbackReminder.notificationSent = false;
      fallbackReminder.triggerCount = 0;
      fallbackReminder.priority = "medium";
      
      return fallbackReminder;
    }
  }

  toFirestore() {
    const data = {
      title: this.title,
      message: this.message,
      scheduledTime: this.scheduledTime,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      isActive: this.isActive,
      isPublic: this.isPublic,
      isRecurring: this.isRecurring,
      recurrencePattern: this.recurrencePattern,
      reminderType: this.reminderType,
      notificationSent: this.notificationSent,
      notificationSentAt: this.notificationSentAt,
      cloudTaskId: this.cloudTaskId,
      lastTriggered: this.lastTriggered,
      triggerCount: this.triggerCount,
      priority: this.priority,
      tags: this.tags,
      notes: this.notes,
      snoozeUntil: this.snoozeUntil,
      completedAt: this.completedAt
    };
    return removeUndefinedFields(data);
  }

  // ===== METODI GESTIONE STATO =====

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  complete(): void {
    this.completedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }

  snooze(minutes: number): void {
    this.snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
    this.updatedAt = new Date();
  }

  markAsTriggered(): void {
    this.lastTriggered = new Date();
    this.triggerCount += 1;
    this.notificationSent = true;
    this.notificationSentAt = new Date();
    this.updatedAt = new Date();
  }

  updateScheduledTime(newTime: Date): void {
    if (newTime <= new Date()) {
      throw new Error('Il nuovo orario deve essere nel futuro');
    }
    this.scheduledTime = newTime;
    this.notificationSent = false;
    this.notificationSentAt = undefined;
    this.updatedAt = new Date();
    this.validate();
  }

  updateTitle(title: string): void {
    this.title = title;
    this.updatedAt = new Date();
    this.validate();
  }

  updateMessage(message: string): void {
    this.message = message;
    this.updatedAt = new Date();
    this.validate();
  }

  updatePriority(priority: "low" | "medium" | "high"): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  togglePublic(): void {
    this.isPublic = !this.isPublic;
    this.updatedAt = new Date();
  }

  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
      this.updatedAt = new Date();
    }
  }

  setCloudTaskId(taskId: string): void {
    this.cloudTaskId = taskId;
    this.updatedAt = new Date();
  }

  // ===== METODI VALIDAZIONE STATO =====

  isOverdue(): boolean {
    return this.scheduledTime < new Date() && this.isActive && !this.isCompleted();
  }

  isDue(toleranceMinutes: number = 5): boolean {
    const now = new Date();
    const timeDiff = Math.abs(this.scheduledTime.getTime() - now.getTime());
    return timeDiff <= toleranceMinutes * 60 * 1000;
  }

  isUpcoming(hoursAhead: number = 24): boolean {
    const now = new Date();
    const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    return this.scheduledTime > now && this.scheduledTime <= futureTime;
  }

  isSnoozed(): boolean {
    return this.snoozeUntil ? this.snoozeUntil > new Date() : false;
  }

  isCompleted(): boolean {
    return this.completedAt !== undefined;
  }

  isPersonal(): boolean {
    return this.reminderType === 'personal' || !this.isPublic;
  }

  isFamily(): boolean {
    return this.reminderType === 'family' && this.isPublic;
  }

  isOwnedBy(username: string): boolean {
    return this.createdBy === username;
  }

  hasCloudTask(): boolean {
    return this.cloudTaskId !== undefined;
  }

  needsCloudTask(): boolean {
    return this.isActive && !this.hasCloudTask() && this.scheduledTime > new Date();
  }

  // ===== METODI RICORRENZA =====

  getNextOccurrence(): Date | null {
    if (!this.isRecurring || !this.recurrencePattern) {
      return null;
    }

    const pattern = this.recurrencePattern;
    const lastTrigger = this.lastTriggered || this.createdAt;
    let nextDate = new Date(lastTrigger);

    switch (pattern.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + pattern.interval);
        break;
      
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * pattern.interval));
        break;
      
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + pattern.interval);
        if (pattern.dayOfMonth) {
          nextDate.setDate(pattern.dayOfMonth);
        }
        break;
      
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + pattern.interval);
        break;
      
      case 'custom':
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          // Trova il prossimo giorno della settimana
          const today = nextDate.getDay();
          const sortedDays = pattern.daysOfWeek.sort((a, b) => a - b);
          let nextDay = sortedDays.find(day => day > today);
          
          if (!nextDay) {
            nextDay = sortedDays[0];
            nextDate.setDate(nextDate.getDate() + (7 - today + nextDay));
          } else {
            nextDate.setDate(nextDate.getDate() + (nextDay - today));
          }
        }
        break;
    }

    // Controlla se ha raggiunto la data di fine o il massimo numero di occorrenze
    if (pattern.endDate && nextDate > pattern.endDate) {
      return null;
    }

    if (pattern.maxOccurrences && this.triggerCount >= pattern.maxOccurrences) {
      return null;
    }

    return nextDate;
  }

  shouldCreateNextOccurrence(): boolean {
    if (!this.isRecurring || !this.notificationSent) {
      return false;
    }

    return this.getNextOccurrence() !== null;
  }

  createNextOccurrence(): Reminder | null {
    const nextDate = this.getNextOccurrence();
    if (!nextDate) {
      return null;
    }

    const nextReminder = new Reminder(
      `${this.id}_${Date.now()}`, // Nuovo ID basato su timestamp
      this.title,
      this.message,
      nextDate,
      this.createdBy,
      new Date(), // Nuova data di creazione
      new Date(), // Nuova data di aggiornamento
      true,       // Attivo
      this.isPublic,
      this.isRecurring,
      this.recurrencePattern,
      this.reminderType,
      false,      // Notifica non ancora inviata
      undefined,  // Nessuna data di invio notifica
      undefined,  // Nessun Cloud Task ID ancora
      undefined,  // Mai triggerato
      0,          // Contatore trigger resettato
      this.priority,
      this.tags ? [...this.tags] : undefined,
      this.notes
    );

    return nextReminder;
  }

  // ===== METODI UTILITÀ =====

  getMinutesUntilDue(): number {
    const now = new Date();
    return Math.floor((this.scheduledTime.getTime() - now.getTime()) / (1000 * 60));
  }

  getAge(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getFormattedScheduledTime(): string {
    return this.scheduledTime.toLocaleString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSummary(): string {
    const parts = [this.title];
    
    if (this.priority === 'high') parts.push('🔴');
    if (this.priority === 'low') parts.push('🟢');
    if (this.isRecurring) parts.push('🔄');
    if (this.isOverdue()) parts.push('⏰');
    if (this.isCompleted()) parts.push('✅');
    if (this.isSnoozed()) parts.push('💤');
    
    return parts.join(' ');
  }

  clone(newScheduledTime?: Date): Reminder {
    return new Reminder(
      `${this.id}_copy`,
      this.title,
      this.message,
      newScheduledTime || new Date(this.scheduledTime.getTime() + 24 * 60 * 60 * 1000), // +1 giorno di default
      this.createdBy,
      new Date(), // Nuova data di creazione
      new Date(), // Nuova data di aggiornamento
      true,       // Attivo
      this.isPublic,
      false,      // Non ricorrente nel clone
      undefined,  // Nessun pattern di ricorrenza
      this.reminderType,
      false,      // Notifica non inviata
      undefined,  // Nessuna data di invio notifica
      undefined,  // Nessun Cloud Task ID
      undefined,  // Mai triggerato
      0,          // Contatore trigger resettato
      this.priority,
      this.tags ? [...this.tags] : undefined,
      this.notes
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      title: this.title,
      message: this.message,
      scheduledTime: this.scheduledTime.toISOString(),
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isActive: this.isActive,
      isPublic: this.isPublic,
      isRecurring: this.isRecurring,
      reminderType: this.reminderType,
      notificationSent: this.notificationSent,
      priority: this.priority,
      isOverdue: this.isOverdue(),
      isDue: this.isDue(),
      isUpcoming: this.isUpcoming(),
      isSnoozed: this.isSnoozed(),
      isCompleted: this.isCompleted(),
      minutesUntilDue: this.getMinutesUntilDue(),
      formattedTime: this.getFormattedScheduledTime(),
      summary: this.getSummary(),
      hasCloudTask: this.hasCloudTask(),
      needsCloudTask: this.needsCloudTask()
    };
  }
}

// ===== TIPI E INTERFACCE =====

export type ReminderType = 'personal' | 'family' | 'work' | 'health' | 'shopping' | 'event' | 'other';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrencePattern {
  type: RecurrenceType;
  interval: number;              // Ogni quanti giorni/settimane/mesi/anni
  daysOfWeek?: number[];         // 0=domenica, 1=lunedì, etc (per ricorrenza custom)
  dayOfMonth?: number;           // Giorno del mese (per ricorrenza mensile)
  endDate?: Date;                // Data di fine ricorrenza
  maxOccurrences?: number;       // Numero massimo di occorrenze
}