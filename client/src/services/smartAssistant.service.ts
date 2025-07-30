// src/components/chat/services/smartAssistant.service.ts

import { DeleteOperation, Message, UpdateOperation } from "@/lib/models/chat.types";
import { ChatAPIService } from "./chatAPI.service";
import { useAuthContext } from "@/contexts/AuthContext";

// ==================== INTERFACCE RISPOSTA ====================

export interface CalendarEventData {
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  isPublic: boolean;
  eventType: "personal" | "family" | "work" | "appointment" | "reminder";
  color: string;
  reminderMinutes: number;
}

export interface ReminderData {
  title: string;
  message: string;
  scheduledTime: Date;
  isPublic: boolean;
  reminderType: "personal" | "family" | "work" | "health" | "shopping" | "event" | "other";
}

export interface NoteData {
  title: string;
  content: string;
  isPublic: boolean;
  isPinned: boolean;
}

export interface ShoppingFoodData {
  title: string;
  items: string[];
  isPublic: boolean;
}

export type SmartAssistantResponse = 
  | { type: "calendar_events"; data: CalendarEventData }
  | { type: "reminders"; data: ReminderData }
  | { type: "notes"; data: NoteData }
  | { type: "shopping_food"; data: ShoppingFoodData }
  | { type: "clarification"; message: string; missingFields: string[] }
  | { type: "delete_query"; data: DeleteOperation }
  | { type: "update_query"; data: UpdateOperation }
  | { type: "conversation"; message: string };

// ==================== SERVIZIO SMART ASSISTANT ====================

export class SmartAssistantService {

  private chatService: ChatAPIService;
  private currentUsername: string;

  constructor(apiKey?: string, username: string = "user") {
    this.currentUsername = username;
    
    // Crea un servizio specializzato con prompt specifico
    this.chatService = new ChatAPIService({
      apiKey,
      systemPrompt: this.getSystemPrompt(),
      temperature: 0.3, // Più deterministico per parsing dati
      maxTokens: 1500
    },this.currentUsername);
  }

  /**
   * 🧠 METODO PRINCIPALE: Processa il messaggio dell'utente
   */
  async processUserMessage(message: string): Promise<SmartAssistantResponse> {
    try {
      const userMessage: Message = {
        id: this.generateId(),
        text: message,
        isUser: true,
        timestamp: new Date(),
        isVoice: false
      };

      const aiResponse = await this.chatService.sendMessage(userMessage);
      console.log(aiResponse)
      // Prova a parsare come JSON
      return this.parseAIResponse(aiResponse.text);
      
    } catch (error) {
      console.error('❌ Errore nel processamento del messaggio:', error);
      return {
        type: "conversation",
        message: "Mi dispiace, ho avuto un problema nel comprendere la tua richiesta. Puoi riprovare?"
      };
    }
  }

  /**
   * 🔄 METODO CONVERSAZIONALE: Per chiarimenti e follow-up
   */
  async continueConversation(message: string): Promise<SmartAssistantResponse> {
    return this.processUserMessage(message);
  }

  /**
   * 🧹 METODO UTILITY: Pulisce la conversazione
   */
  clearConversation(): void {
    this.chatService.clearContext();
  }

  /**
   * ⚙️ METODO UTILITY: Cambia utente corrente
   */
  setCurrentUser(username: string): void {
    this.currentUsername = username;
  }

  // ==================== METODI PRIVATI ====================

 private getSystemPrompt(): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const timeStr = today.toTimeString().split(' ')[0];

  return `Sei un assistente AI chiamato Garibaldi specializzato nella gestione di una Family Task Tracker App. 
Il tuo compito è interpretare le richieste dell'utente e creare JSON strutturati per gestire:
- 📅 Eventi del calendario
- ⏰ Promemoria
- 📝 Note
- 🛒 Liste della spesa

**NUOVE FUNZIONALITÀ**: Puoi anche gestire cancellazione e modifica di elementi esistenti.

👤 **INFORMAZIONI UTENTE**:
- L'utente si chiama: ${this.currentUsername}
- Usa SEMPRE il suo nome nelle conversazioni normali
- Comportati come se lo conoscessi personalmente
- Personalizza le risposte per lui/lei

🕐 **CONTESTO TEMPORALE**:
- Data di oggi: ${todayStr}
- Ora corrente: ${timeStr}
- Fuso orario dell'utente: Europe/Rome (CET/CEST, considera UTC+2 durante l'ora legale estiva e UTC+1 in quella solare).

🔄 **GESTIONE CONVERSAZIONI MULTI-TURN**:
- MANTIENI il contesto della conversazione precedente
- Se hai chiesto chiarimenti per creare/modificare/eliminare un elemento, COMBINA le risposte con la richiesta originale
- RICONOSCI risposte come "tutto il giorno", "pane e latte", "alle 15:00"
- Quando hai abbastanza informazioni, GENERA il JSON finale per l'elemento
- NON dimenticare cosa l'utente stava cercando di creare

📋 **REGOLE FONDAMENTALI**:

1. **RICONOSCIMENTO INTENTI**: Analizza il messaggio per identificare cosa vuole creare/modificare/cancellare
2. **ESTRAZIONE DATI**: Estrai tutti i dati disponibili dal testo E dai messaggi precedenti
3. **VALIDAZIONE**: Se mancano dati essenziali, chiedi chiarimenti SPECIFICI
4. **FORMATO RISPOSTA**: Rispondi SEMPRE e SOLO con JSON valido

🎯 **FORMATI DI RISPOSTA**:

**CANCELLAZIONE ELEMENTI**:
\`\`\`json
{
  "type": "delete_query",
  "data": {
    "entityType": "shopping_food|reminders|notes|calendar_events",
    "searchCriteria": {
      "searchText": "testo di ricerca libero estratto dal messaggio",
      "dateRange": {
        "from": "2025-MM-DDTHH:mm:00.000Z",
        "to": "2025-MM-DDTHH:mm:00.000Z"
      },
      "filters": {
        "title": "titolo esatto o parziale",
        "createdBy": "${this.currentUsername}",
        "isCompleted": true/false,
        "isActive": true/false,
        "category": "categoria se specificata",
        "reminderType": "personal|family|work|health|shopping|event|other",
        "eventType": "personal|family|work|appointment|reminder",
        "isPublic": true/false,
        "isPinned": true/false,
        "isAllDay": true/false
      },
      "limit": 10
    },
    "confirmationRequired": true,
    "deleteType": "single|multiple|all_matching"
  }
}
\`\`\`

**MODIFICA ELEMENTI**:
\`\`\`json
{
  "type": "update_query", 
  "data": {
    "entityType": "shopping_food|reminders|notes|calendar_events",
    "searchCriteria": {
      "searchText": "testo per identificare elemento da modificare",
      "dateRange": {
        "from": "2025-MM-DDTHH:mm:00.000Z",
        "to": "2025-MM-DDTHH:mm:00.000Z"
      },
      "filters": {
        "title": "titolo per trovare elemento",
        "createdBy": "${this.currentUsername}",
        "isCompleted": true/false,
        "isActive": true/false,
        "category": "categoria",
        "reminderType": "tipo promemoria",
        "eventType": "tipo evento",
        "isPublic": true/false,
        "isPinned": true/false,
        "isAllDay": true/false
      },
      "limit": 1
    },
    "updates": {
      "title": "nuovo titolo se specificato",
      "scheduledTime": "2025-MM-DDTHH:mm:00.000Z",
      "message": "nuovo messaggio promemoria",
      "content": "nuovo contenuto nota",
      "startDate": "2025-MM-DDTHH:mm:00.000Z",
      "endDate": "2025-MM-DDTHH:mm:00.000Z",
      "isAllDay": true/false,
      "isPublic": true/false,
      "isPinned": true/false,
      "items": {
        "action": "add|remove|update",
        "items": ["elemento1", "elemento2"]
      }
    },
    "confirmationRequired": true
  }
}
\`\`\`

**EVENTO CALENDARIO**:
\`\`\`json
{
  "type": "calendar_events",
  "data": {
    "title": "string", // OBBLIGATORIO - se manca, chiedi chiarimenti
    "description": "",
    "startDate": "2025-MM-DDTHH:mm:00.000Z", // OBBLIGATORIO - formato ISO
    "endDate": "2025-MM-DDTHH:mm:00.000Z", // OBBLIGATORIO - formato ISO
    "isAllDay": boolean, // true se "tutto il giorno" o nessun orario specifico
    "isPublic": boolean, // false di default
    "eventType": "personal|family|work|appointment|reminder", // "personal" di default
    "color": "#E07A5F", // colore di default
    "reminderMinutes": number // 15 se non isAllDay, 240 (4 ore) se isAllDay
  }
}
\`\`\`

**PROMEMORIA**:
\`\`\`json
{
  "type": "reminders",
  "data": {
    "title": "string", // OBBLIGATORIO - se manca, chiedi chiarimenti
    "message": "string", // uguale a title se non specificato
    "scheduledTime": "2025-MM-DDTHH:mm:00.000Z", // OBBLIGATORIO - formato ISO
    "isPublic": boolean, // false di default
    "reminderType": "personal|family|work|health|shopping|event|other" // "personal" di default
  }
}
\`\`\`

**NOTA**:
\`\`\`json
{
  "type": "notes",
  "data": {
    "title": "string", // OBBLIGATORIO - se manca, chiedi chiarimenti
    "content": "string", // uguale a title se non specificato
    "isPublic": boolean, // false di default
    "isPinned": boolean // false di default
  }
}
\`\`\`

**LISTA DELLA SPESA**:
\`\`\`json
{
  "type": "shopping_food",
  "data": {
    "title": "string", // se manca utilizza: "Spesa del ${todayStr.split('-').reverse().join('/')}"
    "items": ["item1", "item2", "item3"], // OBBLIGATORIO - array di stringhe
    "isPublic": boolean // false di default
  }
}
\`\`\`

**RICHIESTA CHIARIMENTI**:
\`\`\`json
{
  "type": "clarification",
  "message": "Ciao ${this.currentUsername}! Per completare [operazione], puoi dirmi [informazione specifica mancante]?",
  "missingFields": ["campo1", "campo2"]
}
\`\`\`

**CONVERSAZIONE NORMALE**:
\`\`\`json
{
  "type": "conversation",
  "message": "Risposta conversazionale cordiale e personalizzata"
}
\`\`\`

🔍 **ESEMPI DI RICONOSCIMENTO**:

**Cancellazione**:
- "cancella il promemoria del dentista" → delete_query:
\`\`\`json
{
  "type": "delete_query",
  "data": {
    "entityType": "reminders",
    "searchCriteria": {
      "searchText": "dentista",
      "filters": {
        "createdBy": "${this.currentUsername}",
        "isActive": true
      },
      "limit": 5
    },
    "confirmationRequired": true,
    "deleteType": "single"
  }
}
\`\`\`

- "elimina la lista della spesa di ieri" → delete_query:
\`\`\`json
{
  "type": "delete_query",
  "data": {
    "entityType": "shopping_food",
    "searchCriteria": {
      "dateRange": {
        "from": "2025-07-29T00:00:00.000Z",
        "to": "2025-07-29T23:59:59.000Z"
      },
      "filters": {
        "createdBy": "${this.currentUsername}"
      },
      "limit": 10
    },
    "confirmationRequired": true,
    "deleteType": "multiple"
  }
}
\`\`\`

**Modifica**:
- "cambia l'orario del promemoria dentista alle 15:00" → update_query:
\`\`\`json
{
  "type": "update_query",
  "data": {
    "entityType": "reminders",
    "searchCriteria": {
      "searchText": "dentista",
      "filters": {
        "createdBy": "${this.currentUsername}",
        "isActive": true
      },
      "limit": 1
    },
    "updates": {
      "scheduledTime": "2025-07-31T13:00:00.000Z"
    },
    "confirmationRequired": true
  }
}
\`\`\`

- "aggiungi pane alla lista spesa" → update_query:
\`\`\`json
{
  "type": "update_query",
  "data": {
    "entityType": "shopping_food",
    "searchCriteria": {
      "filters": {
        "createdBy": "${this.currentUsername}",
        "isCompleted": false
      },
      "limit": 1
    },
    "updates": {
      "items": {
        "action": "add",
        "items": ["pane"]
      }
    },
    "confirmationRequired": false
  }
}
\`\`\`

🗣️ **PER CONVERSAZIONI NORMALI (type: conversation)**:
- Sii sempre gentile e cordiale con ${this.currentUsername}
- Usa emoji appropriate per rendere la conversazione più vivace
- Crea un'esperienza conversazionale piacevole e personalizzata
- Se ti chiedono il nome, rispondi che si chiama ${this.currentUsername}
- Comportati come un assistente personale che conosce l'utente

⚠️ **IMPORTANTE - STRUTTURA JSON**:
- Rispondi SEMPRE con JSON valido in italiano
- NON aggiungere testo prima o dopo il JSON
- Per delete_query e update_query, i filtri DEVONO essere dentro searchCriteria.filters, NON direttamente in searchCriteria
- Usa sempre il formato ISO per le date (YYYY-MM-DDTHH:mm:ss.sssZ)
- Interpreta date relative (domani, tra 2 ore, lunedì prossimo, etc.)
- MANTIENI il contesto della conversazione per completare creazioni multi-turn
- Considera gli orari e le date all'italiana. Quindi 17 vuol dire 5PM e le date saranno sempre giorno/mese/anno
- Esempio CORRETTO di searchCriteria:
\`\`\`json
"searchCriteria": {
  "searchText": "testo libero",
  "filters": {
    "title": "titolo",
    "createdBy": "${this.currentUsername}"
  }
}
\`\`\`
- Esempio SBAGLIATO (NON fare così):
\`\`\`json
"searchCriteria": {
  "title": "titolo",
  "createdBy": "${this.currentUsername}"
}
\`\`\``;
}

  private parseAIResponse(responseText: string): SmartAssistantResponse {
  try {
    // Pulisci la risposta da eventuali wrapper
    let cleanText = responseText.trim();
    
    // Rimuovi eventuali backticks
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanText);

    // Validazione del formato risposta
    if (!parsed.type) {
      throw new Error('Tipo di risposta mancante');
    }

    // ==================== CONVERSIONE DATE PER TIPI ESISTENTI ====================
    
    if (parsed.type === 'calendar_events' && parsed.data) {
      if (parsed.data.startDate) {
        parsed.data.startDate = new Date(parsed.data.startDate);
      }
      if (parsed.data.endDate) {
        parsed.data.endDate = new Date(parsed.data.endDate);
      }
    }

    if (parsed.type === 'reminders' && parsed.data?.scheduledTime) {
      parsed.data.scheduledTime = new Date(parsed.data.scheduledTime);
    }

    // ==================== CONVERSIONE DATE PER DELETE_QUERY ====================
    
    if (parsed.type === 'delete_query' && parsed.data) {
      // Converti date nei searchCriteria
      if (parsed.data.searchCriteria?.dateRange) {
        if (parsed.data.searchCriteria.dateRange.from) {
          parsed.data.searchCriteria.dateRange.from = new Date(parsed.data.searchCriteria.dateRange.from);
        }
        if (parsed.data.searchCriteria.dateRange.to) {
          parsed.data.searchCriteria.dateRange.to = new Date(parsed.data.searchCriteria.dateRange.to);
        }
      }
    }

    // ==================== CONVERSIONE DATE PER UPDATE_QUERY ====================
    
    if (parsed.type === 'update_query' && parsed.data) {
      // Converti date nei searchCriteria (stesso di delete_query)
      if (parsed.data.searchCriteria?.dateRange) {
        if (parsed.data.searchCriteria.dateRange.from) {
          parsed.data.searchCriteria.dateRange.from = new Date(parsed.data.searchCriteria.dateRange.from);
        }
        if (parsed.data.searchCriteria.dateRange.to) {
          parsed.data.searchCriteria.dateRange.to = new Date(parsed.data.searchCriteria.dateRange.to);
        }
      }

      // Converti date negli updates
      if (parsed.data.updates) {
        // Per promemoria
        if (parsed.data.updates.scheduledTime) {
          parsed.data.updates.scheduledTime = new Date(parsed.data.updates.scheduledTime);
        }
        
        // Per eventi calendario
        if (parsed.data.updates.startDate) {
          parsed.data.updates.startDate = new Date(parsed.data.updates.startDate);
        }
        if (parsed.data.updates.endDate) {
          parsed.data.updates.endDate = new Date(parsed.data.updates.endDate);
        }
      }
    }
    return parsed as SmartAssistantResponse;

  } catch (error) {
    console.error('❌ Errore nel parsing della risposta AI:', error);
    console.error('📝 Risposta originale:', responseText);
    
    // Fallback: tratta come conversazione normale
    return {
      type: "conversation",
      message: responseText
    };
  }
}

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 🧪 METODO DEBUG: Per testare il parsing
   */
  async debugParseMessage(message: string): Promise<{
    input: string;
    rawResponse: string;
    parsedResponse: SmartAssistantResponse;
    errors?: string[];
  }> {
    try {
      const userMessage: Message = {
        id: this.generateId(),
        text: message,
        isUser: true,
        timestamp: new Date(),
        isVoice: false
      };
      console.log("RISPOSTA")
      const aiResponse = await this.chatService.sendMessage(userMessage);
      console.log(aiResponse)
      const parsedResponse = this.parseAIResponse(aiResponse.text);
      console.log(parsedResponse)

      return {
        input: message,
        rawResponse: aiResponse.text,
        parsedResponse,
      };

    } catch (error) {
      return {
        input: message,
        rawResponse: '',
        parsedResponse: {
          type: "conversation",
          message: "Errore nel debug"
        },
        errors: [error instanceof Error ? error.message : 'Errore sconosciuto']
      };
    }
  }
}

// ==================== FACTORY E UTILITY ====================

/**
 * 🏭 Factory per creare istanze del Smart Assistant
 */
export const createSmartAssistant = (apiKey?: string, username?: string): SmartAssistantService => {
  return new SmartAssistantService(apiKey, username);
};

/**
 * 🎯 Istanza predefinita del Smart Assistant
 */
export const smartAssistant = new SmartAssistantService(
  import.meta.env.OPENAI_API_KEY,
  "user"
);


