// src/components/chat/hooks/useChat.tsx

import { CHAT_LABELS, AI_RESPONSES } from '@/lib/const/chat.constants';
import { Message } from '@/lib/models/chat.types';
import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  IntegratedChatService, 
  IntegratedChatResponse, 
  createIntegratedChat 
} from '../services/integratedChat.service';
import { 
  CalendarEventData, 
  ReminderData, 
  NoteData, 
  ShoppingFoodData 
} from '../services/smartAssistant.service';
import { ShoppingFood, ShoppingFoodItem } from '@/lib/models/food';
import { Reminder } from '@/lib/models/reminder';
import { CalendarEvent, Note } from '@/lib/models/types';
import { CategoryFood } from '@/lib/models/food';
import { DeepSeekCategorizationClient } from '@/lib/deepseek-client';
import { useFirestore } from './useFirestore';

// ==================== INTERFACCE ====================

export interface UseChatConfig {
  username: string;
  apiKey?: string;
  enableSmartAssistant?: boolean;
 onAddCalendarEvent?: (data: Omit<CalendarEvent, 'id'>) => Promise<string>;
  onAddReminder?: (data: Omit<Reminder, 'id'>) => Promise<string>;
  onAddNote?: (data: Omit<Note, 'id'>) => Promise<string>;
  onAddShoppingFood?: (data: Omit<ShoppingFood, 'id'>) => Promise<string>;
}

export interface UseChatReturn {
  // State
  messages: Message[];
  isOpen: boolean;
  isTyping: boolean;
  inputText: string;
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  pendingAction: IntegratedChatResponse['actionRequired'] | null;
  
  // Actions
  sendMessage: (text: string, isVoice?: boolean) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  setInputText: (text: string) => void;
  handleSendMessage: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  
  // Smart Assistant Actions
  confirmPendingAction: () => Promise<void>;
  cancelPendingAction: () => void;
  clearConversation: () => void;
  toggleSmartAssistant: (enabled: boolean) => void;
}

// ==================== HOOK PRINCIPALE ====================

export const useChat = (config: UseChatConfig): UseChatReturn => {
  // ==================== FIRESTORE HOOKS ====================
  const { data: existingShoppingLists } = useFirestore<ShoppingFood>('shopping_food');
  const { data: categories, add: addCategory } = useFirestore<CategoryFood>('food_categories');

  // ==================== STATE ====================
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: config.enableSmartAssistant
        ? `Invia un messaggio per cominciare la chat.`
        : CHAT_LABELS.welcomeMessage,
      isUser: true,
      timestamp: new Date(),
      isVoice: false,
      isSystem: true
    }
  ]);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<IntegratedChatResponse['actionRequired'] | null>(null);
  
  // ==================== REFS ====================
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatServiceRef = useRef<IntegratedChatService | null>(null);

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Converte array di stringhe in ShoppingFoodItem[] con categorizzazione automatica
   */
  const convertItemsToShoppingFoodItems = useCallback(async (itemStrings: string[]): Promise<ShoppingFoodItem[]> => {
    const result: ShoppingFoodItem[] = [];
    const itemsForAI: { text: string; category?: string }[] = [];

    // Step 1: Cerca categorie esistenti negli shopping già presenti
    for (const itemText of itemStrings) {
      let foundCategory: string | undefined;

      // Cerca in tutti gli shopping esistenti
      for (const shoppingList of existingShoppingLists || []) {
        const existingItem = shoppingList.items.find(
          item => item.text.toLowerCase().trim() === itemText.toLowerCase().trim()
        );
        
        if (existingItem?.category) {
          foundCategory = existingItem.category;
          break;
        }
      }

      if (foundCategory) {
        // Categoria trovata - crea subito l'item
        result.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: itemText,
          completed: false,
          category: foundCategory,
          assignedAutomatically: true,
          createdAt: new Date()
        });
      } else {
        // Nessuna categoria trovata - aggiungi alla lista per l'AI
        itemsForAI.push({ text: itemText });
      }
    }

    // Step 2: Se ci sono item senza categoria, usa l'AI per categorizzarli
    if (itemsForAI.length > 0) {
      try {
        const categoriesForAI = categories?.map(cat => ({
          name: cat.name,
          description: cat.description || 'Nessuna descrizione disponibile'
        })) || [];

        const categorizationResults = await DeepSeekCategorizationClient.categorizeProducts(
          itemsForAI,
          categoriesForAI
        );

        // Step 3: Crea gli ShoppingFoodItem con le categorie dall'AI
        for (let i = 0; i < itemsForAI.length; i++) {
          const itemText = itemsForAI[i].text;
          const aiCategory = categorizationResults[i]?.suggestedCategory;

          result.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: itemText,
            completed: false,
            category: aiCategory,
            assignedAutomatically: true,
            createdAt: new Date()
          });
        }

      } catch (error) {
        console.warn('⚠️ Errore nella categorizzazione AI, creo item senza categoria:', error);
        
        // Fallback: crea item senza categoria
        for (const itemForAI of itemsForAI) {
          result.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: itemForAI.text,
            completed: false,
            assignedAutomatically: false,
            createdAt: new Date()
          });
        }
      }
    }

    return result;
  }, [existingShoppingLists, categories]);

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    // Crea il servizio chat integrato
    chatServiceRef.current = createIntegratedChat({
      username: config.username,
      apiKey: config.apiKey,
      enableSmartAssistant: config.enableSmartAssistant
    });

    return () => {
      // Cleanup
      if (chatServiceRef.current) {
        chatServiceRef.current.clearConversation();
      }
    };
  }, [config.username, config.apiKey, config.enableSmartAssistant]);

  // ==================== CHAT LOGIC ====================

  const processAIResponse = useCallback(async (userMessage: string, isVoice: boolean = false) => {
    if (!chatServiceRef.current) {
      console.error('❌ Chat service non inizializzato');
      return;
    }

    setIsTyping(true);
    setError(null);

    try {
      const response = await chatServiceRef.current.processMessage(userMessage, isVoice);
      
      // Aggiungi il messaggio AI
      setMessages(prev => [...prev, response.message]);
      
      // Gestisci azioni richieste
      if (response.actionRequired) {
        if (response.actionRequired.isValid) {
          setPendingAction(response.actionRequired);
        } else {
          // Errori di validazione - l'AI chiederà chiarimenti
          setPendingAction(null);
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);
      
      // Fallback su risposta simulata in caso di errore
      console.warn('⚠️ Fallback su risposta simulata:', errorMessage);
      await simulateAIResponseFallback(userMessage);
      
    } finally {
      setIsTyping(false);
    }
  }, []);

  // Fallback per errori API (mantiene la vecchia logica)
  const simulateAIResponseFallback = useCallback(async (userMessage: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const fallbackResponse = `Mi dispiace, ho avuto un problema con la connessione. Per ora posso solo rispondere in modo limitato.\n\n💡 **Messaggio ricevuto:** "${userMessage}"\n\n🔧 **Suggerimento:** Verifica la configurazione della chiave API.`;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: fallbackResponse,
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };
    
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const sendMessage = useCallback(async (text: string, isVoice: boolean = false) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
      isVoice
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Processa con AI reale
    await processAIResponse(text.trim(), isVoice);
  }, [processAIResponse]);

  // ==================== SMART ASSISTANT ACTIONS ====================

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction || !pendingAction.isValid) return;

    setIsTyping(true);
    
    try {
      let success = false;
      let actionName = '';
      
      try {
        switch (pendingAction.type) {
          case 'calendar_events':
            actionName = 'evento calendario';
            if (config.onAddCalendarEvent) {
              await config.onAddCalendarEvent(pendingAction.data);
            } else {
              console.log('📅 Creazione evento:', pendingAction.data);
              success = true; // Simulazione successo se non c'è callback
            }
            break;

          case 'reminders':
            actionName = 'promemoria';
            if (config.onAddReminder) {
              await config.onAddReminder(pendingAction.data);
            } else {
              console.log('⏰ Creazione promemoria:', pendingAction.data);
              success = true;
            }
            break;

          case 'notes':
            actionName = 'nota';
            if (config.onAddNote) {
              await config.onAddNote(pendingAction.data);
            } else {
              console.log('📝 Creazione nota:', pendingAction.data);
              success = true;
            }
            break;

          case 'shopping_food':
            actionName = 'lista della spesa';
            
            if (config.onAddShoppingFood) {
              // ==================== CONVERSIONE ITEMS ====================
              
              console.log('🛒 Inizio conversione shopping food...');
              console.log('📝 Dati originali AI:', pendingAction.data);
              
              // Estrai i dati dall'AI
              const { title, items: itemStrings, isPublic } = pendingAction.data;
              
              // Genera title di default se mancante
              const todayStr = new Date().toISOString().split('T')[0];
              const finalTitle = title || `Spesa del ${todayStr.split('-').reverse().join('/')}`;
              
              // Converti stringhe in ShoppingFoodItem[]
              console.log('🔄 Conversione items:', itemStrings);
              const convertedItems = await convertItemsToShoppingFoodItems(itemStrings);
              console.log('✅ Items convertiti:', convertedItems);
              
              // Crea l'oggetto completo per Firestore
              const shoppingFoodData = new ShoppingFood(
                '', // id verrà generato da Firestore
                finalTitle,
                convertedItems,
                config.username,
                new Date(),
                undefined, // supermarketId
                isPublic || false,
                false, // isCompleted
                undefined, // completedAt
                undefined, // notes
                undefined, // estimatedTotal
                undefined, // actualTotal
                [], // sharedWith
                undefined, // updatedAt
                false // isDeleted
              );
              
              console.log('📦 Dati finali per Firestore:', shoppingFoodData);
              
              // Salva su Firestore
              await config.onAddShoppingFood(shoppingFoodData);
              
            } else {
              console.log('🛒 Creazione lista spesa (simulazione):', pendingAction.data);
              success = true;
            }
            break;
        }
        success = true;
      } catch (ex) {
        console.error('❌ Errore nella creazione:', ex);
        success = false;
      }

      // Messaggio di conferma
      const confirmMessage: Message = {
        id: Date.now().toString(),
        text: success 
          ? `Perfetto! Ho creato il tuo ${actionName}!` 
          : `❌ **Errore!** Non sono riuscito a creare il ${actionName}. Riprova o contatta il supporto.`,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };

      setMessages(prev => [...prev, confirmMessage]);
      setPendingAction(null);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`Errore nella creazione: ${errorMsg}`);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: `❌ **Errore nella creazione:** ${errorMsg}`,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };

      setMessages(prev => [...prev, errorMessage]);
      
    } finally {
      setIsTyping(false);
    }
  }, [pendingAction, config, convertItemsToShoppingFoodItems]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
    
    const cancelMessage: Message = {
      id: Date.now().toString(),
      text: "Come non detto... Posso aiutarti con qualcos'altro?",
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    setMessages(prev => [...prev, cancelMessage]);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([
      {
        id: '1',
        text: config.enableSmartAssistant
          ? `${CHAT_LABELS.welcomeMessage}\n\n🤖 **Smart Assistant riavviato!**`
          : CHAT_LABELS.welcomeMessage,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      }
    ]);
    setPendingAction(null);
    setError(null);
    
    if (chatServiceRef.current) {
      chatServiceRef.current.clearConversation();
    }
  }, [config.enableSmartAssistant]);

  const toggleSmartAssistant = useCallback((enabled: boolean) => {
    if (chatServiceRef.current) {
      chatServiceRef.current.toggleSmartAssistant(enabled);
    }
    
    const toggleMessage: Message = {
      id: Date.now().toString(),
      text: enabled 
        ? "🤖 **Smart Assistant attivato!** Ora posso creare eventi, promemoria, note e liste della spesa."
        : "💬 **Smart Assistant disattivato.** Ora funziono come chat normale.",
      isUser: false,
      timestamp: new Date(),
      isVoice: false
    };

    setMessages(prev => [...prev, toggleMessage]);
  }, []);

  // ==================== VOICE RECOGNITION ====================

  const startRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Il tuo browser non supporta la registrazione vocale');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const paroleChiave = ['aggiungi', 'promemoria', 'evento', 'nota', 'domani', 'spesa', "oggi","dopo","calendario"];
    const grammar = '#JSGF V1.0; grammar parole; public <parola> = ' + paroleChiave.join(' | ') + ' ;'

    // 2. Crea la lista di grammatiche
    const speechRecognitionList = new window.webkitSpeechGrammarList() || new window.SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);

    // 3. Assegna la grammatica all'istanza di recognition
    recognition.grammars = speechRecognitionList;
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'it-IT';

    // ==================== LOG DI DEBUG ====================
    
    // 1. Il processo sta per iniziare
    console.log('🎤 Tentativo di avvio della registrazione...');

    recognition.onstart = () => {
      // 2. Il processo è ufficialmente partito
      console.log('✅ Registrazione avviata.');
      setIsRecording(true);
      setError(null);
    };

    recognition.onsoundstart = () => {
      // 3. Rilevato un suono (qualsiasi suono)
      console.log('🔊 Suono rilevato.');
    };

    recognition.onspeechstart = () => {
      // 4. Il suono è stato identificato come parlato
      console.log('🗣️ Rilevato inizio del parlato.');
    };

    recognition.onspeechend = () => {
      // 5. Il parlato è terminato
      console.log('🛑 Rilevata fine del parlato.');
    };

    recognition.onsoundend = () => {
      // 6. Anche i suoni sono terminati
      console.log('🔇 Suono terminato.');
    };

    recognition.onresult = (event) => {
      console.log('🎯 RISULTATO OTTENUTO!', event.results);
      setIsRecording(false);
      setIsTranscribing(true);

      // Prendi il testo trascritto dall'evento
      const transcript = event.results[0][0].transcript;
      
      if (transcript) {
        sendMessage(transcript, true); 
      }

      // La trascrizione è finita, quindi puoi nascondere l'indicatore
      setTimeout(() => setIsTranscribing(false), 300); // Piccolo ritardo per fluidità
    };

    recognition.onerror = (event) => {
      // 8. ERRORE! Qualcosa è andato storto.
      console.error('❌ ERRORE DI RICONOSCIMENTO:', event.error, event.message);
      setIsRecording(false);
      setIsTranscribing(false);
      
      if (event.error === 'not-allowed') {
        setError('Permesso microfono negato. Abilita il microfono nelle impostazioni del browser.');
      } else if (event.error === 'no-speech') {
        setError('Nessun discorso rilevato. Prova a parlare più forte o in un ambiente meno rumoroso.');
      } else {
        setError(`Errore durante la registrazione: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // 9. Il processo è terminato (sempre, sia in caso di successo che di errore)
      console.log('🏁 Registrazione terminata (evento onend).');
      setIsRecording(false);
      // Nota: non impostare isTranscribing su false qui, perché onresult potrebbe essere ancora in elaborazione
    };

    // =======================================================

    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage, isTranscribing]); // Assicurati che le dipendenze siano corrette

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // ==================== UI ACTIONS ====================

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Interrompi registrazione se attiva
    if (isRecording) {
      stopRecording();
    }
    // Cancella azioni pendenti
    setPendingAction(null);
  }, [isRecording, stopRecording]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    // Pulisci errori quando l'utente inizia a scrivere
    if (error) {
      setError(null);
    }
  }, [error]);

  const handleSendMessage = useCallback(() => {
    sendMessage(inputText, false);
  }, [sendMessage, inputText]);

  // ==================== RETURN ====================

  return {
    // State
    messages,
    isOpen,
    isTyping,
    inputText,
    isRecording,
    isTranscribing,
    error,
    pendingAction,
    
    // Actions
    sendMessage,
    openChat,
    closeChat,
    setInputText: handleInputChange,
    handleSendMessage,
    startRecording,
    stopRecording,
    
    // Smart Assistant Actions
    confirmPendingAction,
    cancelPendingAction,
    clearConversation,
    toggleSmartAssistant
  };
};