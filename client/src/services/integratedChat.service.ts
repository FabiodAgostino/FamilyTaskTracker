// src/components/chat/services/integratedChat.service.ts

import { Message } from "@/lib/models/chat.types";
import { ChatAPIService, createChatService } from "./chatAPI.service";
import { 
  SmartAssistantService, 
  SmartAssistantResponse, 
  CalendarEventData,
  ReminderData,
  NoteData,
  ShoppingFoodData,
  createSmartAssistant 
} from "./smartAssistant.service";

// Import dei modelli per validazione
import { CalendarEvent, ModelFactory } from "@/lib/models/types";
import { Reminder } from "@/lib/models/reminder";
import { Note } from "@/lib/models/types";
import { ValidationError } from "@/lib/models/types";

// ==================== INTERFACCE ====================

export interface IntegratedChatResponse {
  message: Message;
  actionRequired?: {
    type: "calendar_events" | "reminders" | "notes" | "shopping_food";
    data: any;
    isValid: boolean;
    errors?: string[];
  };
}

export interface ChatServiceConfig {
  apiKey?: string;
  username: string;
  enableSmartAssistant?: boolean;
}

// ==================== SERVIZIO INTEGRATO ====================

export class IntegratedChatService {
  private smartAssistant: SmartAssistantService | null = null;
  private normalChatService: ChatAPIService;
  private username: string;
  private enableSmartAssistant: boolean;

  constructor(config: ChatServiceConfig) {
    this.username = config.username;
    this.enableSmartAssistant = config.enableSmartAssistant ?? true;
    // Crea sempre il servizio di chat normale
    this.normalChatService = createChatService(this.username,{
      apiKey: config.apiKey
    });
    
    // Crea il smart assistant solo se abilitato
    if (this.enableSmartAssistant) {
      this.smartAssistant = createSmartAssistant(config.apiKey, config.username);
    }
  }

  /**
   * 🚀 METODO PRINCIPALE: Processa il messaggio con intelligence
   */
  async processMessage(messageText: string, isVoice: boolean = false): Promise<IntegratedChatResponse> {
    try {
      // 1. Prima prova con Smart Assistant se abilitato
      if (this.enableSmartAssistant) {
        return await this.handleWithSmartAssistant(messageText, isVoice);
      }
      // 2. Altrimenti usa chat normale
      return await this.handleWithNormalChat(messageText, isVoice);

    } catch (error) {
      console.error('❌ Errore nel processamento del messaggio:', error);
      
      // Fallback su chat normale in caso di errore
      return await this.handleWithNormalChat(messageText, isVoice);
    }
  }


  /**
   * 🧹 PULISCI CONVERSAZIONE
   */
  clearConversation(): void {
    this.normalChatService.clearContext();
    if (this.enableSmartAssistant && this.smartAssistant) {
      this.smartAssistant.clearConversation();
    }
  }

  /**
   * ⚙️ ABILITA/DISABILITA SMART ASSISTANT
   */
  toggleSmartAssistant(enabled: boolean): void {
    this.enableSmartAssistant = enabled;
    
    // Se abilitato e non esiste, crealo
    if (enabled && !this.smartAssistant) {
      this.smartAssistant = createSmartAssistant(undefined, this.username);
    }
  }



  // ==================== METODI PRIVATI ====================

  private async handleWithSmartAssistant(
    messageText: string, 
    isVoice: boolean
  ): Promise<IntegratedChatResponse> {
    // Verifica che smartAssistant sia disponibile
    if (!this.smartAssistant) {
      return await this.handleWithNormalChat(messageText, isVoice);
    }

    const smartResponse = await this.smartAssistant.processUserMessage(messageText);
    switch (smartResponse.type) {
      case "calendar_events":
        return this.handleCalendarEventCreation(smartResponse.data, messageText, isVoice);
        
      case "reminders":
        return this.handleReminderCreation(smartResponse.data, messageText, isVoice);
        
      case "notes":
        return this.handleNoteCreation(smartResponse.data, messageText, isVoice);
        
      case "shopping_food":
        return this.handleShoppingListCreation(smartResponse.data, messageText, isVoice);
        
      case "clarification":
        return this.handleClarificationRequest(smartResponse, messageText, isVoice);
        
      case "conversation":
      default:
        return await this.handleWithNormalChat(messageText, isVoice);
    }
  }

  private async handleWithNormalChat(
    messageText: string, 
    isVoice: boolean
  ): Promise<IntegratedChatResponse> {
    const userMessage: Message = {
      id: this.generateId(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
      isVoice
    };

    const aiResponse = await this.normalChatService.sendMessage(userMessage);
    
    return {
      message: aiResponse
    };
  }

  // ==================== VALIDAZIONE CON MODELLI ====================

  /**
   * 📅 Valida CalendarEvent usando il modello
   */
  private validateCalendarEventData(data: CalendarEventData): { isValid: boolean; errors: string[] } {
    try {
      // Crea istanza temporanea per validare
      const tempEvent = new CalendarEvent(
        'temp-id',
        data.title,
        data.startDate,
        data.endDate,
        this.username,
        undefined, // description
        data.isAllDay,
        data.isPublic,
        data.eventType,
        data.color,
        undefined, // location
        [], // attendees
        new Date(), // createdAt
        new Date(), // updatedAt
        data.reminderMinutes
      );

      // Usa validazione del modello
      tempEvent.validate();
      return { isValid: true, errors: [] };

    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      // Errore generico
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  /**
   * ⏰ Valida Reminder usando il modello
   */
  private validateReminderData(data: ReminderData): { isValid: boolean; errors: string[] } {
    try {
      // Crea istanza temporanea per validare
      const tempReminder = new Reminder(
        'temp-id',
        data.title,
        data.message,
        data.scheduledTime,
        this.username,
        new Date(), // createdAt
        new Date(), // updatedAt
        true, // isActive
        data.isPublic,
        false, // isRecurring
        undefined, // recurrencePattern
        data.reminderType,
        false, // notificationSent
        undefined, // notificationSentAt
        undefined, // cloudTaskId
        undefined, // lastTriggered
        0, // triggerCount
        "medium", // priority
        [], // tags
        undefined // notes
      );

      // Usa validazione del modello
      tempReminder.validate();
      return { isValid: true, errors: [] };

    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  /**
   * 📝 Valida Note usando il modello
   */
  private validateNoteData(data: NoteData): { isValid: boolean; errors: string[] } {
    try {
      // Crea istanza temporanea per validare
      const tempNote = new Note(
        'temp-id',
        data.title,
        data.content,
        this.username,
        new Date(), // createdAt
        new Date(), // updatedAt
        data.isPublic,
        [], // tags
        data.isPinned,
        "#F3F4F6", // color default
        [], // sharedWith
        undefined // lastViewedAt
      );

      // Usa validazione del modello
      tempNote.validate();
      return { isValid: true, errors: [] };

    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  /**
   * 🛒 Valida ShoppingFood creando ShoppingItem temporanei
   */
  private validateShoppingFoodData(data: ShoppingFoodData): { isValid: boolean; errors: string[] } {
    try {
      const errors: string[] = [];

      // Validazione base
      if (!data.title || data.title.trim().length === 0) {
        errors.push('Titolo lista è obbligatorio');
      }

      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push('La lista deve contenere almeno un elemento');
      }

      // Validazione singoli items creando ShoppingItem temporanei
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const itemName = data.items[i];
          
          if (!itemName || itemName.trim().length === 0) {
            errors.push(`Elemento ${i + 1} della lista è vuoto`);
            continue;
          }

          try {
            // Crea ShoppingItem temporaneo per validazione
            const tempItem = ModelFactory.createShoppingItem({
              id: 'temp-id',
              category: "Alimentari",
              createdBy: this.username,
              link: `https://example.com/search?q=${encodeURIComponent(itemName)}`,
              name: itemName,
              isPublic: data.isPublic,
              completed: false,
              priority: "medium",
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // La validazione avviene nel ModelFactory.createShoppingItem
            // Se arriviamo qui, l'item è valido

          } catch (error) {
            if (error instanceof ValidationError) {
              errors.push(`Elemento "${itemName}": ${error.errors.join(', ')}`);
            } else {
              errors.push(`Elemento "${itemName}": errore validazione`);
            }
          }
        }
      }

      return { isValid: errors.length === 0, errors };

    } catch (error) {
      return { isValid: false, errors: ['Errore di validazione lista spesa'] };
    }
  }

  // ==================== HANDLER CREAZIONE ====================

  private handleCalendarEventCreation(
    data: CalendarEventData, 
    originalMessage: string, 
    isVoice: boolean
  ): IntegratedChatResponse {
    const validation = this.validateCalendarEventData(data);
    
    const responseMessage = validation.isValid 
      ? `Dunque il titolo è "${data.title}" e l'ho fissato per il ${this.formatDateRange(data.startDate, data.endDate, data.isAllDay)}.\nIl promemoria ti avvertirà ${data.reminderMinutes} minuti prima.`
      : `❌ **Non posso creare l'evento.**\n\nMancano alcune informazioni:\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\nPuoi fornire maggiori dettagli?`;

    const message: Message = {
      id: this.generateId(),
      text: responseMessage,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return {
      message,
      actionRequired: validation.isValid ? {
        type: "calendar_events",
        data,
        isValid: true
      } : {
        type: "calendar_events",
        data,
        isValid: false,
        errors: validation.errors
      }
    };
  }

  private handleReminderCreation(
    data: ReminderData, 
    originalMessage: string, 
    isVoice: boolean
  ): IntegratedChatResponse {
    const validation = this.validateReminderData(data);
    
    const responseMessage = validation.isValid 
      ? `Ok! vediamo un po'... \nIl titolo è: "${data.title}", schedulata per il ${this.formatDateTime(data.scheduledTime)} con il messaggio: "${data.message}".`
      : `❌ **Non posso creare il promemoria.**\n\nMancano alcune informazioni:\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\nPuoi fornire maggiori dettagli?`;

    const message: Message = {
      id: this.generateId(),
      text: responseMessage,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return {
      message,
      actionRequired: validation.isValid ? {
        type: "reminders",
        data,
        isValid: true
      } : {
        type: "reminders",
        data,
        isValid: false,
        errors: validation.errors
      }
    };
  }

  private handleNoteCreation(
    data: NoteData, 
    originalMessage: string, 
    isVoice: boolean
  ): IntegratedChatResponse {
    const validation = this.validateNoteData(data);
    
    const responseMessage = validation.isValid 
      ? `Quindi la nota avrà questo titolo: "${data.title}" e il contenuto: ${data.content}?.\n`
      : `❌ **Non posso creare la nota.**\n\nMancano alcune informazioni:\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\nPuoi fornire maggiori dettagli?`;

    const message: Message = {
      id: this.generateId(),
      text: responseMessage,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return {
      message,
      actionRequired: validation.isValid ? {
        type: "notes",
        data,
        isValid: true
      } : {
        type: "notes",
        data,
        isValid: false,
        errors: validation.errors
      }
    };
  }

  private handleShoppingListCreation(
    data: ShoppingFoodData, 
    originalMessage: string, 
    isVoice: boolean
  ): IntegratedChatResponse {
    const validation = this.validateShoppingFoodData(data);
    
    const responseMessage = validation.isValid 
      ? `Quindi il titolo sarà "${data.title}" e i prodotti saranno: ${data.items.slice(0, 5).map(item => `${item},`).join('\n')}${data.items.length > 5 ? `\n... e altri ${data.items.length - 5} prodotti, corretto?` : ' corretto?'}}`
      : `❌ **Non posso creare la lista.**\n\nMancano alcune informazioni:\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\nPuoi fornire maggiori dettagli?`;

    const message: Message = {
      id: this.generateId(),
      text: responseMessage,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return {
      message,
      actionRequired: validation.isValid ? {
        type: "shopping_food",
        data,
        isValid: true
      } : {
        type: "shopping_food",
        data,
        isValid: false,
        errors: validation.errors
      }
    };
  }

  private handleClarificationRequest(
    smartResponse: { type: "clarification"; message: string; missingFields: string[] }, 
    originalMessage: string, 
    isVoice: boolean
  ): IntegratedChatResponse {
    const responseMessage = `${smartResponse.message}`;

    const message: Message = {
      id: this.generateId(),
      text: responseMessage,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return { message };
  }

  // ==================== UTILITY METHODS ====================


  private formatDateTime(date: Date): string {
    return date.toLocaleString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private formatDateRange(startDate: Date, endDate: Date, isAllDay: boolean): string {
    if (isAllDay) {
      if (startDate.toDateString() === endDate.toDateString()) {
        return startDate.toLocaleDateString('it-IT', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else {
        return `${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}`;
      }
    } else {
      return `${this.formatDateTime(startDate)} - ${endDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

}

// ==================== FACTORY E ISTANZE ====================

/**
 * 🏭 Factory per creare istanze del servizio integrato
 */
export const createIntegratedChat = (config: ChatServiceConfig): IntegratedChatService => {
  return new IntegratedChatService(config);
};

/**
 * 🎯 Istanza predefinita (da configurare con username dinamico)
 */
let defaultIntegratedChat: IntegratedChatService | null = null;
let currentUsername: string = '';

export const getIntegratedChat = (username: string): IntegratedChatService => {
  if (!defaultIntegratedChat || username !== currentUsername) {
    currentUsername = username;
    defaultIntegratedChat = new IntegratedChatService({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      username,
      enableSmartAssistant: true
    });
  }
  return defaultIntegratedChat;
};