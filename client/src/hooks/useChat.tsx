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
import { getFirestoreSearchProvider } from '@/services/firestoreSearchProvider';
import { ShoppingList } from '@/components/shopping/ShoppingList';
import { capitalizeFirstLetter } from '@/lib/utils';
import { useVoiceChat } from './useVoiceChat';

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
  // State esistenti
  messages: Message[];
  isOpen: boolean;
  isTyping: boolean;
  inputText: string;
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  pendingAction: IntegratedChatResponse['actionRequired'] | null;
  
  // 🆕 NUOVI STATI CHAT VOCALE
  isVoiceChatActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  
  // Actions esistenti
  sendMessage: (text: string, isVoice?: boolean) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  setInputText: (text: string) => void;
  handleSendMessage: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  
  // 🆕 NUOVE AZIONI CHAT VOCALE
  startVoiceChat: () => void;
  stopVoiceChat: () => void;
  toggleVoiceChat: () => void;
  
  // Smart Assistant Actions esistenti
  confirmPendingAction: () => Promise<void>;
  cancelPendingAction: () => void;
  clearConversation: () => void;
  toggleSmartAssistant: (enabled: boolean) => void;
}

// ==================== HOOK PRINCIPALE ====================

export const useChat = (config: UseChatConfig): UseChatReturn => {
  // ==================== FIRESTORE HOOKS ====================
  const { data: existingShoppingLists } = useFirestore<ShoppingFood>('shopping_food', { includeDeleted: true });
  const { data: categories, add: addCategory } = useFirestore<CategoryFood>('food_categories');
  const searchProvider = getFirestoreSearchProvider();

  // ==================== STATE ===== ===============
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
  const [vocalConfirmationAction, setVocalConfirmationAction] = useState<IntegratedChatResponse['actionRequired'] | null>(null);

  // ==================== REFS ====================
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatServiceRef = useRef<IntegratedChatService | null>(null);

 const voiceChat = useVoiceChat({
    ttsEndpoint: 'https://europe-west1-familytasktracker-c2dfe.cloudfunctions.net/textToSpeech',
     onTranscript: async (transcript) => {
        console.log('🎤 Transcript ricevuto:', transcript);

        // Controlla se siamo in attesa di una conferma vocale
        if (vocalConfirmationAction) {
            const confirmationText = transcript.toLowerCase().trim();

            if (['conferma', 'sì', 'confermo', 'ok', 'procedi'].includes(confirmationText)) {
                setPendingAction(vocalConfirmationAction);
                setTimeout(() => confirmPendingAction(), 50);

            } else if (['annulla', 'no', 'cancella', 'ferma'].includes(confirmationText)) {
                // L'utente ha annullato.
                cancelPendingAction();
            } else {
                // Risposta non chiara, annulliamo per sicurezza
                await voiceChat.respondWithVoice("Non ho capito. Per sicurezza, ho annullato l'operazione.");
                cancelPendingAction();
            }
            
            // Puliamo lo stato di attesa vocale
            setVocalConfirmationAction(null);

        } else {
            // Comportamento normale: invia il messaggio trascritto
            sendMessage(transcript, true);
        }
    },
    onTTSStart: () => {
      console.log('🔊 TTS iniziato');
    },
    onTTSEnd: () => {
      console.log('✅ TTS completato');
    },
    onError: (error) => {
      console.error('❌ Voice Chat Error:', error);
      setError(error);
    }
  });
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
      console.log(existingShoppingLists)
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
    result.forEach(item => {
                item.text = capitalizeFirstLetter(item.text);
              })
    return result;
  }, [existingShoppingLists, categories]);

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    chatServiceRef.current = createIntegratedChat({
      username: config.username,
      apiKey: config.apiKey,
      enableSmartAssistant: config.enableSmartAssistant,
      // 🔑 CONNESSIONE AL TUO FIRESTORE
      searchProvider: {
        executeQuery: searchProvider.executeQuery.bind(searchProvider),
        deleteItem: searchProvider.deleteItem.bind(searchProvider),
        updateItem: searchProvider.updateItem.bind(searchProvider)
      }})

    return () => {
      // Cleanup
      if (chatServiceRef.current) {
        chatServiceRef.current.clearConversation();
      }
    };
  }, [config.username, config.apiKey, config.enableSmartAssistant]);

  // ==================== CHAT LOGIC ====================

   const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const startVoiceChat = useCallback(() => {
    // Chiudi registrazione normale se attiva
    if (isRecording) {
      stopRecording();
    }
    
    voiceChat.startVoiceChat();
    // Messaggio di avvio
    const startMessage: Message = {
      id: Date.now().toString(),
      text: "🎤 **Chat vocale attivata!** Ora puoi parlare liberamente con me. Dì qualcosa per iniziare!",
      isUser: false,
      timestamp: new Date(),
      isVoice: false,
      isSystem: true
    };
    
    setMessages(prev => [...prev, startMessage]);
  }, [isRecording, stopRecording, voiceChat]);

  const stopVoiceChat = useCallback(() => {
    voiceChat.stopVoiceChat();
    
    const stopMessage: Message = {
      id: Date.now().toString(),
      text: "⏹️ **Chat vocale disattivata.** Ora puoi tornare a scrivere normalmente.",
      isUser: false,
      timestamp: new Date(),
      isVoice: false,
      isSystem: true
    };
    
    setMessages(prev => [...prev, stopMessage]);
  }, [voiceChat]);

  const toggleVoiceChat = useCallback(() => {
    if (voiceChat.isVoiceChatActive) {
      stopVoiceChat();
    } else {
      startVoiceChat();
    }
  }, [voiceChat.isVoiceChatActive, startVoiceChat, stopVoiceChat]);

  


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

      if (voiceChat.isVoiceChatActive) {
        await voiceChat.respondWithVoice("Mi dispiace, ho avuto un problema. Puoi ripetere?");
      }
      // 🎯 SE È CHAT VOCALE, FAI PARLARE L'AI
      if (voiceChat.isVoiceChatActive) {
        await voiceChat.respondWithVoice(response.message.text);
    }
      
      // Gestisci azioni richieste
     if (response.actionRequired) {
    if (response.actionRequired.isValid) {
        // 🗣️ Se la chat vocale è attiva, gestiamo la conferma a voce
        if (voiceChat.isVoiceChatActive) {
            setVocalConfirmationAction(response.actionRequired);
            await voiceChat.respondWithVoice(response.message.text + ". Confermi?");

        } else {
            // Comportamento standard: mostra i pulsanti di conferma nella UI
            setPendingAction(response.actionRequired);
        }
    } else {
        setPendingAction(null); // L'azione non è valida
    }
}
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);
      
      if (voiceChat.isVoiceChatActive) {
        await voiceChat.respondWithVoice("Mi dispiace, ho avuto un problema. Puoi ripetere?");
      } else {
        // Fallback testuale come prima
        await simulateAIResponseFallback(userMessage);
      }
      
    } finally {
      setIsTyping(false);
    }
  }, [voiceChat.isVoiceChatActive]);

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
      let resultMessage = '';
      try {
        switch (pendingAction.type) {
          case 'delete_query':
              actionName = 'cancellazione';
        
        if (pendingAction.searchResults?.items && pendingAction.searchResults.items.length > 0) {
          try {
            let deletedCount = 0;
            const totalItems = pendingAction.searchResults.items.length;
            
            // Cancella tutti gli elementi trovati
            for (const item of pendingAction.searchResults.items) {
              console.log(`🗑️ Cancellazione elemento: ${item.id} (${item.title})`);
              
              const deleted = await searchProvider.deleteItem(
                pendingAction.data.entityType, 
                item.id
              );
              
              if (deleted) {
                deletedCount++;
              } else {
                console.warn(`⚠️ Impossibile cancellare elemento ${item.id}`);
              }
            }
            
            if (deletedCount === totalItems) {
              success = true;
              resultMessage = deletedCount === 1 
                ? `Elemento cancellato! "${pendingAction.searchResults.items[0].title}" è stato eliminato definitivamente`
                : `${deletedCount} elementi cancellati! Tutti gli elementi selezionati sono stati eliminati.`;
            } else if (deletedCount > 0) {
              success = true;
              resultMessage = `Cancellazione parziale: ${deletedCount} su ${totalItems} elementi sono stati cancellati. Alcuni potrebbero non essere stati eliminati a causa di errori.`;
            } else {
              success = false;
              resultMessage = `Nessun elemento cancellato! Si è verificato un errore durante la cancellazione.`;
            }
            
          } catch (deleteError) {
            console.error('Errore durante la cancellazione:', deleteError);
            success = false;
            resultMessage = `Errore durante la cancellazione: ${deleteError instanceof Error ? deleteError.message : 'Errore sconosciuto'}`;
          }
        } else {
          success = false;
          resultMessage = `Nessun elemento da cancellare** trovato.`;
        }
        break;
         case 'update_query':
        actionName = 'modifica';
        
        if (pendingAction.searchResults?.items?.length === 1) {
          const itemToUpdate = pendingAction.searchResults.items[0];
          
          try {
            console.log(`✏️ Modifica elemento: ${itemToUpdate.id} (${itemToUpdate.title})`);
            console.log('📝 Updates da applicare:', pendingAction.data.updates);
            
            // ========== GESTIONE SPECIALE PER LISTE DELLA SPESA ==========
            if (pendingAction.data.entityType === 'shopping_food' && 
                pendingAction.data.updates.items?.action === 'add') {
              
              // Aggiunta elementi alla lista della spesa
              const currentItems = (itemToUpdate as any).items || [];
              const newItemsText = pendingAction.data.updates.items.items as string[];
              
              console.log('🛒 Aggiunta elementi alla lista spesa:', newItemsText);
              console.log('📋 Items attuali:', currentItems);
              
              // Converti stringhe in ShoppingFoodItem format
              const itemsToAdd = await convertItemsToShoppingFoodItems(newItemsText);
              
              console.log('✅ Items convertiti:', itemsToAdd);
              
              // Crea l'oggetto aggiornato
              const updatedShoppingList = {
                ...itemToUpdate,
                items: [...currentItems, ...itemsToAdd],
                updatedAt: new Date()
              };
              
              success = await searchProvider.updateItem(
                pendingAction.data.entityType,
                itemToUpdate.id,
                updatedShoppingList
              );
              
              if (success) {
                resultMessage = `Lista aggiornata! Ho aggiunto ${newItemsText.length === 1 ? `"${newItemsText[0]}"` : `${newItemsText.length} elementi`} alla lista "${itemToUpdate.title}"`;
              }
              
            } 
            // ========== RIMOZIONE ELEMENTI DALLA LISTA ==========
            else if (pendingAction.data.entityType === 'shopping_food' && 
                     pendingAction.data.updates.items?.action === 'remove') {
              
              const currentItems = (itemToUpdate as any).items || [];
              const itemsToRemove = pendingAction.data.updates.items.items as string[];
              
              console.log('🗑️ Rimozione elementi dalla lista:', itemsToRemove);
              
              // Rimuovi elementi per testo
              const updatedItems = currentItems.filter((item: any) => 
                !itemsToRemove.some(removeText => 
                  item.text.toLowerCase().includes(removeText.toLowerCase())
                )
              );
              
              const updatedShoppingList = {
                ...itemToUpdate,
                items: updatedItems,
                updatedAt: new Date()
              };
              
              success = await searchProvider.updateItem(
                pendingAction.data.entityType,
                itemToUpdate.id,
                updatedShoppingList
              );
              
              if (success) {
                const removedCount = currentItems.length - updatedItems.length;
                resultMessage = `🗑️ **Elementi rimossi!** Ho rimosso ${removedCount} elemento${removedCount !== 1 ? 'i' : ''} dalla lista "${itemToUpdate.title}"`;
              }
            }
            // ========== ALTRI TIPI DI AGGIORNAMENTO ==========
            else {
              // Aggiornamenti standard (titolo, orario, contenuto, etc.)
              const updates = { ...pendingAction.data.updates };
              
              // Rimuovi il campo items se non è un'operazione su lista spesa
              if (updates.items && pendingAction.data.entityType !== 'shopping_food') {
                delete updates.items;
              }
              
              success = await searchProvider.updateItem(
                pendingAction.data.entityType,
                itemToUpdate.id,
                updates
              );
              
              if (success) {
                // Genera messaggio basato su cosa è stato modificato
                const changeDescriptions = [];
                if (updates.title) changeDescriptions.push(`titolo in "${updates.title}"`);
                if (updates.scheduledTime) changeDescriptions.push(`orario a ${formatDateTime(updates.scheduledTime)}`);
                if (updates.message) changeDescriptions.push(`messaggio in "${updates.message}"`);
                if (updates.content) changeDescriptions.push(`contenuto`);
                if (updates.startDate && updates.endDate) changeDescriptions.push(`data/orario`);
                
                const entityName = getEntityDisplayName(pendingAction.data.entityType, true); // singolare
                resultMessage = `✅ **${entityName} modificat${entityName.endsWith('a') ? 'a' : 'o'}!** Ho cambiato ${changeDescriptions.join(', ')} per "${itemToUpdate.title}"`;
              }
            }
            
            if (!success) {
              resultMessage = `Errore nella modifica dell'elemento "${itemToUpdate.title}". Riprova.`;
            }
            
          } catch (updateError) {
            console.error('Errore durante l\'aggiornamento:', updateError);
            success = false;
            resultMessage = `Errore durante la modifica: ${updateError instanceof Error ? updateError.message : 'Errore sconosciuto'}`;
          }
          
        } else if (pendingAction.searchResults?.items?.length === 0) {
          success = false;
          resultMessage = `Nessun elemento da modificare trovato.`;
        } else if (pendingAction.searchResults?.items && pendingAction.searchResults.items.length > 1) {
          success = false;
          resultMessage = `Trovati ${pendingAction.searchResults.items.length} elementi. Puoi essere più specifico per identificare quello da modificare?`;
        }
        break;
          case 'calendar_events':
            actionName = 'evento calendario';
            if (config.onAddCalendarEvent) {
              await config.onAddCalendarEvent(pendingAction.data);
              resultMessage="Ho creato il nuovo evento a calendario!";
            } else {
              console.log('📅 Creazione evento:', pendingAction.data);
              success = true; // Simulazione successo se non c'è callback
            }
            break;

          case 'reminders':
            actionName = 'promemoria';
            if (config.onAddReminder) {
              await config.onAddReminder(pendingAction.data);
              resultMessage="Ho creato il nuovo promemoria!";
            } else {
              console.log('⏰ Creazione promemoria:', pendingAction.data);
              success = true;
            }
            break;

          case 'notes':
            actionName = 'nota';
            if (config.onAddNote) {
              await config.onAddNote(pendingAction.data);
              resultMessage="Ho creato la nuova nota!";
            } else {
              console.log('📝 Creazione nota:', pendingAction.data);
              success = true;
            }
            break;

          case 'shopping_food':
            actionName = 'lista della spesa';
            resultMessage="Ho creato la nuova lista della spesa!";

            if (config.onAddShoppingFood) {
              // ==================== CONVERSIONE ITEMS ====================
              
              console.log('📝 Dati originali AI:', pendingAction.data);
              
              // Estrai i dati dall'AI
              const { title, items: itemStrings, isPublic } = pendingAction.data;
              
              // Genera title di default se mancante
              const todayStr = new Date().toISOString().split('T')[0];
              const finalTitle = title || `Spesa del ${todayStr.split('-').reverse().join('/')}`;
              
              // Converti stringhe in ShoppingFoodItem[]
              const convertedItems = await convertItemsToShoppingFoodItems(itemStrings);
              
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
          ? `Perfetto! ${resultMessage}!` 
          : `Errore! Riprova o contatta il supporto.`,
        isUser: false,
        timestamp: new Date(),
        isVoice: false
      };

      setMessages(prev => [...prev, confirmMessage]);
      setPendingAction(null);

      if (voiceChat.isVoiceChatActive) {
        await voiceChat.respondWithVoice(confirmMessage.text);
      }

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
 const formatDateTime = useCallback((date: Date): string => {
  return date.toLocaleString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}, []);
  const getEntityDisplayName = useCallback((entityType: string, singular: boolean = false): string => {
  const names: Record<string, { singular: string; plural: string }> = {
    shopping_food: { singular: 'lista della spesa', plural: 'liste della spesa' },
    reminders: { singular: 'promemoria', plural: 'promemoria' },
    notes: { singular: 'nota', plural: 'note' },
    calendar_events: { singular: 'evento', plural: 'eventi' }
  };
  
  const name = names[entityType];
  if (!name) return singular ? 'elemento' : 'elementi';
  
  return singular ? name.singular : name.plural;
}, []);

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
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
  if (SpeechGrammarList) {
      const paroleChiave = ['aggiungi', 'promemoria', 'evento', 'nota', 'domani', 'spesa', "oggi", "dopo", "calendario"];
      const grammar = '#JSGF V1.0; grammar parole; public <parola> = ' + paroleChiave.join(' | ') + ' ;'
      
      // 2. Crea e assegna la grammatica SOLO se supportata
      const speechRecognitionList = new SpeechGrammarList();
      speechRecognitionList.addFromString(grammar, 1);
      recognition.grammars = speechRecognitionList;
      console.log('✅ Grammatica del discorso applicata.');
    } else {
      // Messaggio opzionale per il debug
      console.warn('⚠️ Questo browser non supporta SpeechGrammarList. Il riconoscimento funzionerà senza la grammatica specifica.');
    }
    
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

 

  // ==================== UI ACTIONS ====================

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

 const closeChat = useCallback(() => {
    setIsOpen(false);
    
    // Ferma tutto
    if (isRecording) {
      stopRecording();
    }
    
    if (voiceChat.isVoiceChatActive) {
      voiceChat.stopVoiceChat();
    }
    
    setPendingAction(null);
  }, [isRecording, stopRecording, voiceChat]);

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
    // State esistenti
    messages,
    isOpen,
    isTyping,
    inputText,
    isRecording,
    isTranscribing,
    error,
    pendingAction,
    
    // 🆕 NUOVI STATI CHAT VOCALE
    isVoiceChatActive: voiceChat.isVoiceChatActive,
    isListening: voiceChat.isListening,
    isSpeaking: voiceChat.isSpeaking,
    isProcessing: voiceChat.isProcessing,
    
    // Actions esistenti
    sendMessage,
    openChat,
    closeChat,
    setInputText: handleInputChange,
    handleSendMessage,
    startRecording,
    stopRecording,
    
    // 🆕 NUOVE AZIONI CHAT VOCALE
    startVoiceChat,
    stopVoiceChat,
    toggleVoiceChat,
    
    // Smart Assistant Actions esistenti
    confirmPendingAction,
    cancelPendingAction,
    clearConversation,
    toggleSmartAssistant
  };
};