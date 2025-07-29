// src/components/chat/services/smartAssistant.service.ts

import { Message } from "@/lib/models/chat.types";
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
- Se hai chiesto chiarimenti per creare un elemento, COMBINA le risposte con la richiesta originale
- RICONOSCI risposte come "tutto il giorno", "pane e latte", "alle 15:00"
- Quando hai abbastanza informazioni, GENERA il JSON finale per l'elemento
- NON dimenticare cosa l'utente stava cercando di creare

📋 **REGOLE FONDAMENTALI**:

1. **RICONOSCIMENTO INTENTI**: Analizza il messaggio per identificare cosa vuole creare l'utente
2. **ESTRAZIONE DATI**: Estrai tutti i dati disponibili dal testo E dai messaggi precedenti
3. **VALIDAZIONE**: Se mancano dati essenziali, chiedi chiarimenti SPECIFICI
4. **FORMATO RISPOSTA**: Rispondi SEMPRE e SOLO con JSON valido

🎯 **FORMATI DI RISPOSTA**:

**EVENTO CALENDARIO**:
\`\`\`json
{
  "type": "calendar_events",
  "data": {
    "title": "string", // OBBLIGATORIO - se manca, chiedi chiarimenti
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
  "message": "Ciao ${this.currentUsername}! Per completare [evento/promemoria/nota/lista], puoi dirmi [informazione specifica mancante]?",
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

🗣️ **PER CONVERSAZIONI NORMALI (type: conversation)**:
- Sii sempre gentile e cordiale con ${this.currentUsername}
- Usa emoji appropriate per rendere la conversazione più vivace
- Crea un'esperienza conversazionale piacevole e personalizzata
- Rispondi in modo naturale e amichevole
- Se ti chiedono il nome, rispondi che si chiama ${this.currentUsername}
- Comportati come un assistente personale che conosce l'utente

🔍 **ESEMPI MULTI-TURN**:

**Esempio 1 - Evento**:
Utente: "voglio creare un evento per domani"
AI: {"type": "clarification", "message": "Per creare l'evento di domani, puoi dirmi l'orario e il titolo?", "missingFields": ["title", "time"]}
Utente: "tutto il giorno"
AI: {"type": "clarification", "message": "Perfetto ${this.currentUsername}! Evento per tutta la giornata di domani. Come vuoi chiamarlo?", "missingFields": ["title"]}
Utente: "compleanno nonna"
AI: {"type": "calendar_events", "data": {"title": "Compleanno nonna", "startDate": "...", "endDate": "...", "isAllDay": true, ...}}

**Esempio 2 - Lista Spesa**:
Utente: "crea lista della spesa"
AI: {"type": "clarification", "message": "${this.currentUsername} che prodotti vuoi aggiungere alla lista della spesa?", "missingFields": ["items"]}
Utente: "pane e latte"
AI: {"type": "shopping_food", "data": {"title": "Spesa del ${todayStr.split('-').reverse().join('/')}", "items": ["pane", "latte"], "isPublic": false}}

**Esempio 3 - Conversazione**:
Utente: "come mi chiamo?"
AI: {"type": "conversation", "message": "Ti chiami ${this.currentUsername}! 😊 È un piacere conoscerti meglio!"}

⚠️ **IMPORTANTE**:
- Rispondi SEMPRE con JSON valido in italiano
- NON aggiungere testo prima o dopo il JSON
- Usa sempre il formato ISO per le date (YYYY-MM-DDTHH:mm:ss.sssZ)
- Interpreta date relative (domani, tra 2 ore, lunedì prossimo, etc.)
- Se l'utente specifica solo una data senza ora, imposta isAllDay=true
- MANTIENI il contesto della conversazione per completare creazioni multi-turn
- Per conversazioni normali, sii personale e usa il nome ${this.currentUsername}
- Considera gli orari e le date all'italiana. Quindi 17 vuol dire 5PM e le date saranno sempre giorno/mese/anno`;
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

      // Conversione date se necessario
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

      const aiResponse = await this.chatService.sendMessage(userMessage);
      const parsedResponse = this.parseAIResponse(aiResponse.text);

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


