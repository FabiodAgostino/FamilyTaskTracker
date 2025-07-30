// src/components/chat/services/integratedChat.service.ts

import { DeleteOperation, Message, SearchConfig, SearchCriteria, SearchResult, UpdateOperation } from "@/lib/models/chat.types";
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

// Import delle interfacce per delete/update

// Import dei modelli per validazione
import { CalendarEvent, ModelFactory } from "@/lib/models/types";
import { Reminder } from "@/lib/models/reminder";
import { Note } from "@/lib/models/types";
import { ValidationError } from "@/lib/models/types";

// ==================== INTERFACCE LOCALI ====================

export interface IntegratedChatResponse {
  message: Message;
  actionRequired?: {
    type: "calendar_events" | "reminders" | "notes" | "shopping_food" | "delete_query" | "update_query";
    data: any;
    isValid: boolean;
    errors?: string[];
    searchResults?: {
      count: number;
      items: any[];
      preview: string;
    };
  };
}

export interface ChatServiceConfig {
  apiKey?: string;
  username: string;
  enableSmartAssistant?: boolean;
  // Opzioni per database search (da implementare)
  searchProvider?: {
    executeQuery: (criteria: SearchCriteria, entityType:string) => Promise<SearchResult[]>;
    deleteItem: (entityType: string, id: string) => Promise<boolean>;
    updateItem: (entityType: string, id: string, updates: any) => Promise<boolean>;
  };
}

// ==================== SERVIZIO INTEGRATO ====================

export class IntegratedChatService {
  private smartAssistant: SmartAssistantService | null = null;
  private normalChatService: ChatAPIService;
  private username: string;
  private enableSmartAssistant: boolean;
  private searchProvider: ChatServiceConfig['searchProvider'];

  // Configurazioni per ricerca dinamica
  private searchConfigs: Record<string, SearchConfig> = {
    shopping_food: {
      collection: 'shopping_food',
      titleField: 'title',
      searchableFields: ['title', 'items'],
      dateField: 'createdAt',
      filterMappings: {
        isCompleted: 'isCompleted',
        isPublic: 'isPublic',
        createdBy: 'createdBy'
      }
    },
    reminders: {
      collection: 'reminders',
      titleField: 'title',
      searchableFields: ['title', 'message'],
      dateField: 'scheduledTime',
      filterMappings: {
        isActive: 'isActive',
        isPublic: 'isPublic',
        reminderType: 'reminderType',
        createdBy: 'createdBy'
      }
    },
    notes: {
      collection: 'notes',
      titleField: 'title',
      searchableFields: ['title', 'content'],
      dateField: 'createdAt',
      filterMappings: {
        isPinned: 'isPinned',
        isPublic: 'isPublic',
        createdBy: 'createdBy'
      }
    },
    calendar_events: {
      collection: 'calendar_events',
      titleField: 'title',
      searchableFields: ['title', 'description'],
      dateField: 'startDate',
      filterMappings: {
        eventType: 'eventType',
        isAllDay: 'isAllDay',
        isPublic: 'isPublic',
        createdBy: 'createdBy'
      }
    }
  };

  constructor(config: ChatServiceConfig) {
    this.username = config.username;
    this.enableSmartAssistant = config.enableSmartAssistant ?? true;
    this.searchProvider = config.searchProvider;
    
    // Crea sempre il servizio di chat normale
    this.normalChatService = createChatService(this.username, {
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
      if (this.enableSmartAssistant) {
        return await this.handleWithSmartAssistant(messageText, isVoice);
      }
      return await this.handleWithNormalChat(messageText, isVoice);
    } catch (error) {
      console.error('❌ Errore nel processamento del messaggio:', error);
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
    if (enabled && !this.smartAssistant) {
      this.smartAssistant = createSmartAssistant(undefined, this.username);
    }
  }

  // ==================== METODI PRIVATI PRINCIPALI ====================

  private async handleWithSmartAssistant(
    messageText: string, 
    isVoice: boolean
  ): Promise<IntegratedChatResponse> {
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
      case "update_query":
        return await this.handleUpdateItem(smartResponse as SmartAssistantResponse & { type: "update_query" }, messageText, isVoice);
      case "delete_query":
        return await this.handleDeleteItem(smartResponse as SmartAssistantResponse & { type: "delete_query" }, messageText, isVoice);
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
    return { message: aiResponse };
  }

  // ==================== RICERCA DINAMICA GENERALIZZATA ====================

  /**
   * 🔍 RICERCA GENERALIZZATA E DINAMICA
   */
  private async executeSearch(criteria: SearchCriteria, entityType:string): Promise<SearchResult[]> {
    console.log('🔍 Esecuzione ricerca dinamica:', criteria);
    
    try {
      console.log(criteria)
      // Se c'è un provider personalizzato, usalo
      if (this.searchProvider?.executeQuery) {
        return await this.searchProvider.executeQuery(criteria,entityType);
      }
      throw "searchProvider non registrato";
      
    } catch (error) {
      console.error('❌ Errore nella ricerca:', error);
      throw error;
    }
  }

  /**
   * 🧪 RICERCA MOCK DINAMICA (per testing)
   */
  private async mockDynamicSearch(criteria: SearchCriteria): Promise<SearchResult[]> {
    const config = this.searchConfigs[criteria.entityType];
    if (!config) return [];

    // Simula dati mock basati sul tipo di entità
    const mockData = this.generateMockData(criteria.entityType);
    
    let results = mockData.filter(item => {
      // Filtro per createdBy (sempre l'utente corrente)
      if (item.createdBy !== this.username) return false;
      
      // Filtro per searchText
      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(searchLower);
        const contentMatch = config.searchableFields.some(field => 
          item[field]?.toString().toLowerCase().includes(searchLower)
        );
        if (!titleMatch && !contentMatch) return false;
      }
      
      // Filtri specifici
      if (criteria.filters) {
        for (const [key, value] of Object.entries(criteria.filters)) {
          const mappedField = config.filterMappings[key] || key;
          if (item[mappedField] !== undefined && item[mappedField] !== value) {
            return false;
          }
        }
      }
      
      // Filtro per range date
      if (criteria.dateRange) {
        const itemDate = new Date(item[config.dateField]);
        if (criteria.dateRange.from && itemDate < criteria.dateRange.from) return false;
        if (criteria.dateRange.to && itemDate > criteria.dateRange.to) return false;
      }
      
      return true;
    });

    // Applica limit
    if (criteria.limit && criteria.limit > 0) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * 🎭 GENERA DATI MOCK PER TESTING
   */
  private generateMockData(entityType: string): SearchResult[] {
    const baseDate = new Date();
    
    switch (entityType) {
      case 'shopping_food':
        return [
          {
            id: '1',
            title: 'Spesa del 30/07',
            items: ['pane', 'latte', 'uova'],
            createdBy: this.username,
            createdAt: baseDate,
            isCompleted: false
          },
          {
            id: '2', 
            title: 'Lista per cena',
            items: ['pasta', 'pomodori'],
            createdBy: this.username,
            createdAt: new Date(baseDate.getTime() - 86400000),
            isCompleted: true
          }
        ];
        
      case 'reminders':
        return [
          {
            id: '1',
            title: 'Dentista',
            message: 'Controllo annuale',
            scheduledTime: new Date(baseDate.getTime() + 86400000),
            createdBy: this.username,
            isActive: true,
            reminderType: 'health'
          },
          {
            id: '2',
            title: 'Chiamare Mario',
            message: 'Per il progetto',
            scheduledTime: new Date(baseDate.getTime() + 3600000),
            createdBy: this.username,
            isActive: true,
            reminderType: 'work'
          }
        ];
        
      case 'notes':
        return [
          {
            id: '1',
            title: 'Appunti riunione',
            content: 'Discusso budget Q4',
            createdBy: this.username,
            createdAt: baseDate,
            isPinned: false
          }
        ];
        
      case 'calendar_events':
        return [
          {
            id: '1',
            title: 'Compleanno Sara',
            startDate: new Date(baseDate.getTime() + 172800000),
            endDate: new Date(baseDate.getTime() + 172800000),
            createdBy: this.username,
            isAllDay: true,
            eventType: 'personal'
          }
        ];
        
      default:
        return [];
    }
  }


  /**
   * 🗑️ GESTIONE CANCELLAZIONE
   */
  private async handleDeleteItem(
    smartResponse: { type: "delete_query"; data: DeleteOperation }, 
    originalMessage: string, 
    isVoice: boolean
  ): Promise<IntegratedChatResponse> {
    
    let responseMessage = "";
    let searchResults:SearchResult[] = [];
    let preview = "";
    try {
      try
      {
        searchResults = await this.executeSearch(smartResponse.data.searchCriteria, smartResponse.data.entityType);
        preview = this.generateResultsPreview(searchResults, smartResponse.data.entityType);
        
        if (searchResults.length === 0) {
          responseMessage = `🔍 Non ho trovato nessun elemento corrispondente a "${originalMessage}". Puoi essere più specifico?`;
        } else if (searchResults.length === 1) {
          responseMessage = `Mi hai chiesto di eliminare ${preview}, vero? Sei davvero sicuro? l'azione non può essere annullata! 🤔`;
        } else {
          const entityName = this.getEntityDisplayName(smartResponse.data.entityType);
          responseMessage = `🔍 Trovati ${searchResults.length} ${entityName}: \n\n📋 ${preview}\n\n⚠️ **Attenzione:** Verranno cancellati tutti gli elementi trovati.\n\n🤔 Vuoi procedere con la cancellazione di tutti?`;
        }
      }catch(ex)
      {
        if(ex instanceof Error)
        {
          if(ex.message.includes("The query requires an index"))
            responseMessage = "Devi aggiungere agli indici la proprietà per effettuare la ricerca: "+ex.message;
          else
            responseMessage = ex.message;
        }
      }
      

      const message: Message = {
        id: this.generateId(),
        text: responseMessage,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };

      return {
        message,
        actionRequired: searchResults.length > 0 ? {
          type: "delete_query",
          data: smartResponse.data,
          isValid: true,
          searchResults: {
            count: searchResults.length,
            items: searchResults,
            preview
          }
        } : undefined
      };

    } catch (error) {
      return this.createErrorResponse('Errore durante la ricerca per cancellazione', error);
    }
  }

  /**
   * ✏️ GESTIONE MODIFICA
   */
  private async handleUpdateItem(
    smartResponse: { type: "update_query"; data: UpdateOperation }, 
    originalMessage: string, 
    isVoice: boolean
  ): Promise<IntegratedChatResponse> {
    
    console.log('✏️ Gestione modifica:', smartResponse.data);
    
    try {
      const searchResults = await this.executeSearch(smartResponse.data.searchCriteria, smartResponse.data.entityType);
      const preview = this.generateResultsPreview(searchResults, smartResponse.data.entityType);
      
      let responseMessage: string;
      
      if (searchResults.length === 0) {
        responseMessage = `🔍 Non ho trovato nessun elemento da modificare corrispondente a "${originalMessage}". Prova ad essere più specifico!`;
      } else if (searchResults.length === 1) {
        const updatesDescription = this.describeUpdates(smartResponse.data.updates, smartResponse.data.entityType);
        responseMessage = `Vuoi che modifico ${preview} con le seguenti modifiche da applicare: ${updatesDescription}\n\n${smartResponse.data.confirmationRequired ? ', confermi le modifiche?' : ' procedo con le modifiche!'}`;
      } else {
        const entityName = this.getEntityDisplayName(smartResponse.data.entityType);
        const updatesDescription = this.describeUpdates(smartResponse.data.updates, smartResponse.data.entityType);
        responseMessage = `Trovati ${searchResults.length} ${entityName}: ${preview}. Modifiche da applicare: ${updatesDescription}. Quale elemento vuoi modificare? Puoi essere più specifico per identificare quello giusto.`;
      }

      const message: Message = {
        id: this.generateId(),
        text: responseMessage,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };

      return {
        message,
        actionRequired: searchResults.length > 0 ? {
          type: "update_query",
          data: smartResponse.data,
          isValid: searchResults.length === 1,
          searchResults: {
            count: searchResults.length,
            items: searchResults,
            preview
          }
        } : undefined
      };

    } catch (error) {
      return this.createErrorResponse('Errore durante la ricerca per modifica', error);
    }
  }

  // ==================== UTILITY HELPERS ====================

  /**
   * 📄 GENERA ANTEPRIMA RISULTATI
   */
  private generateResultsPreview(results: SearchResult[], entityType: string): string {
    if (results.length === 0) return "Nessun elemento trovato";
    
    if (results.length === 1) {
      const item = results[0];
      switch (entityType) {
        case 'shopping_food':
          return `una lista chiamata "${item.title}" da ${(item as any).items?.length || 0} elementi`;
        case 'reminders':
          return `un promemoria: "${item.title}" per ${new Date((item as any).scheduledTime).toLocaleDateString('it-IT')}`;
        case 'notes':
          return `una nota: "${item.title}"`;
        case 'calendar_events':
          return `un evento: "${item.title}" del ${new Date((item as any).startDate).toLocaleDateString('it-IT')}`;
        default:
          return `un elemento: "${item.title || item.id}"`;
      }
    }
    
    const itemsPreview = results.slice(0, 3).map(r => `"${r.title}"`).join(', ');
    const moreText = results.length > 3 ? ` e altri ${results.length - 3}` : '';
    return `${itemsPreview}${moreText}`;
  }

  /**
   * 📝 DESCRIVI LE MODIFICHE DA APPLICARE
   */
  private describeUpdates(updates: UpdateOperation['updates'], entityType: string): string {
    const descriptions: string[] = [];
    
    if (updates.title) {
      descriptions.push(`Titolo: "${updates.title}"`);
    }
    
    if (updates.scheduledTime) {
      descriptions.push(`Nuovo orario: ${this.formatDateTime(updates.scheduledTime)}`);
    }
    
    if (updates.message) {
      descriptions.push(`Messaggio: "${updates.message}"`);
    }
    
    if (updates.content) {
      descriptions.push(`Contenuto: "${updates.content}"`);
    }
    
    if (updates.items) {
      switch (updates.items.action) {
        case 'add':
          descriptions.push(`Aggiungi elementi: ${(updates.items.items as string[]).join(', ')}`);
          break;
        case 'remove':
          descriptions.push(`Rimuovi elementi: ${(updates.items.items as string[]).join(', ')}`);
          break;
        case 'update':
          descriptions.push(`Modifica elementi della lista`);
          break;
      }
    }
    
    if (updates.isPublic !== undefined) {
      descriptions.push(`Visibilità: ${updates.isPublic ? 'Pubblico' : 'Privato'}`);
    }
    
    if (updates.isPinned !== undefined) {
      descriptions.push(`${updates.isPinned ? 'Fissa' : 'Sfissa'}** nota`);
    }
    
    if (updates.isAllDay !== undefined) {
      descriptions.push(`Modalità: ${updates.isAllDay ? 'Tutto il giorno' : 'Orario specifico'}`);
    }

    if (updates.startDate && updates.endDate) {
      descriptions.push(`Nuovo periodo: ${this.formatDateRange(updates.startDate, updates.endDate, updates.isAllDay || false)}`);
    }
    
    return descriptions.length > 0 ? descriptions.join('\n') : 'Nessuna modifica specificata';
  }

  /**
   * 🏷️ OTTIENI NOME DISPLAY PER TIPO ENTITÀ
   */
  private getEntityDisplayName(entityType: string): string {
    const names: Record<string, string> = {
      shopping_food: 'liste della spesa',
      reminders: 'promemoria', 
      notes: 'note',
      calendar_events: 'eventi del calendario'
    };
    return names[entityType] || 'elementi';
  }

  /**
   * ❌ CREA RISPOSTA DI ERRORE
   */
  private createErrorResponse(context: string, error: any): IntegratedChatResponse {
    const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error(`❌ ${context}:`, error);
    
    const message: Message = {
      id: this.generateId(),
      text: `❌ **${context}**\n\n${errorMsg}\n\n🔄 Puoi riprovare o essere più specifico nella richiesta.`,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    return { message };
  }

  // ==================== VALIDAZIONE E CREAZIONE (ESISTENTI) ====================

  private validateCalendarEventData(data: CalendarEventData): { isValid: boolean; errors: string[] } {
    try {
      const tempEvent = new CalendarEvent(
        'temp-id', data.title, data.startDate, data.endDate, this.username,
        undefined, data.isAllDay, data.isPublic, data.eventType, data.color,
        undefined, [], new Date(), new Date(), data.reminderMinutes
      );
      tempEvent.validate();
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  private validateReminderData(data: ReminderData): { isValid: boolean; errors: string[] } {
    try {
      const tempReminder = new Reminder(
        'temp-id', data.title, data.message, data.scheduledTime, this.username,
        new Date(), new Date(), true, data.isPublic, false, undefined,
        data.reminderType, false, undefined, undefined, undefined, 0, "medium", [], undefined
      );
      tempReminder.validate();
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  private validateNoteData(data: NoteData): { isValid: boolean; errors: string[] } {
    try {
      const tempNote = new Note(
        'temp-id', data.title, data.content, this.username, new Date(), new Date(),
        data.isPublic, [], data.isPinned, "#F3F4F6", [], undefined
      );
      tempNote.validate();
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { isValid: false, errors: error.errors };
      }
      return { isValid: false, errors: ['Errore di validazione sconosciuto'] };
    }
  }

  private validateShoppingFoodData(data: ShoppingFoodData): { isValid: boolean; errors: string[] } {
    try {
      const errors: string[] = [];
      if (!data.title || data.title.trim().length === 0) {
        errors.push('Titolo lista è obbligatorio');
      }
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push('La lista deve contenere almeno un elemento');
      }
      
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const itemName = data.items[i];
          if (!itemName || itemName.trim().length === 0) {
            errors.push(`Elemento ${i + 1} della lista è vuoto`);
            continue;
          }
          try {
            ModelFactory.createShoppingItem({
              id: 'temp-id', category: "Alimentari", createdBy: this.username,
              link: `https://example.com/search?q=${encodeURIComponent(itemName)}`,
              name: itemName, isPublic: data.isPublic, completed: false,
              priority: "medium", createdAt: new Date(), updatedAt: new Date()
            });
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

  // Handler per creazione (esistenti - mantenuti identici)
  private handleCalendarEventCreation(data: CalendarEventData, originalMessage: string, isVoice: boolean): IntegratedChatResponse {
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

  private handleReminderCreation(data: ReminderData, originalMessage: string, isVoice: boolean): IntegratedChatResponse {
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

  private handleNoteCreation(data: NoteData, originalMessage: string, isVoice: boolean): IntegratedChatResponse {
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

  private handleShoppingListCreation(data: ShoppingFoodData, originalMessage: string, isVoice: boolean): IntegratedChatResponse {
    const validation = this.validateShoppingFoodData(data);
    const responseMessage = validation.isValid 
      ? `Quindi il titolo sarà "${data.title}" e i prodotti saranno: ${data.items.slice(0, 5).map(item => `${item},`).join('\n')}${data.items.length > 5 ? `\n... e altri ${data.items.length - 5} prodotti, corretto?` : ' corretto?'}`
      : `Non posso creare la lista se mancano queste informazioni: ${validation.errors.map(e => `• ${e}`).join('\n')}. Puoi fornire maggiori dettagli?`;

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
    const message: Message = {
      id: this.generateId(),
      text: smartResponse.message,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };
    return { message };
  }

  // Utility methods (esistenti)
  private formatDateTime(date: Date): string {
    return date.toLocaleString('it-IT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  private formatDateRange(startDate: Date, endDate: Date, isAllDay: boolean): string {
    if (isAllDay) {
      if (startDate.toDateString() === endDate.toDateString()) {
        return startDate.toLocaleDateString('it-IT', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
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

export const createIntegratedChat = (config: ChatServiceConfig): IntegratedChatService => {
  return new IntegratedChatService(config);
};

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