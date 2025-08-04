// src/components/chat/services/firestoreSearchProvider.ts

import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db, hasFirebaseConfig } from '@/lib/firebase';

// Riusa la logica di deserializzazione dal tuo hook
import { ShoppingItem } from '@/lib/models/shopping-item';
import { Category, Note, CalendarEvent, User } from '@/lib/models/types';
import { ShoppingFood, CategoryFood, Supermarket } from '@/lib/models/food';
import { FCMToken } from '@/lib/models/fcmtoken';
import { Reminder } from '@/lib/models/reminder';
import { FidelityCard } from '@/lib/models/FidelityCard';
import { SearchCriteria, SearchResult } from '@/lib/models/chat.types';
import { removeUndefinedFields } from '@/lib/utils';

// ==================== LOGICA COPIATA DAL TUO HOOK ====================

function deserializeDocument<T>(collectionName: string, docData: any): T {
  const processedData = {
    ...docData,
    createdAt: docData.createdAt?.toDate?.() || docData.createdAt || new Date(),
    updatedAt: docData.updatedAt?.toDate?.() || docData.updatedAt || new Date(),
    startDate: docData.startDate?.toDate?.() || docData.startDate || undefined,
    endDate: docData.endDate?.toDate?.() || docData.endDate || undefined,
    completedAt: docData.completedAt?.toDate?.() || docData.completedAt || undefined,
    lastLoginAt: docData.lastLoginAt?.toDate?.() || docData.lastLoginAt || undefined,
    lastViewedAt: docData.lastViewedAt?.toDate?.() || docData.lastViewedAt || undefined,
    lastUsedAt: docData.lastUsedAt?.toDate?.() || docData.lastUsedAt || undefined,
    expiresAt: docData.expiresAt?.toDate?.() || docData.expiresAt || undefined,
    scheduledTime: docData.scheduledTime?.toDate?.() || docData.scheduledTime || undefined,
  };

  try {
    switch (collectionName) {
      case 'shopping_items':
        return ShoppingItem.fromFirestore(processedData) as T;
      case 'categories':
        return Category.fromFirestore(processedData) as T;
      case 'notes':
        return Note.fromFirestore(processedData) as T;
      case 'calendar_events':
        return CalendarEvent.fromFirestore(processedData) as T;
      case 'users':
        return User.fromFirestore(processedData) as T;
      case 'shopping_food':
        return ShoppingFood.fromFirestore(processedData) as T;
      case 'food_categories':
        return CategoryFood.fromFirestore(processedData) as T;
      case 'supermarkets':
        return Supermarket.fromFirestore(processedData) as T;
      case 'fcm-tokens': 
        return FCMToken.fromFirestore(processedData) as T;
      case 'reminders': 
        return Reminder.fromFirestore(processedData) as T;
      case 'fidelity_cards': 
        return FidelityCard.fromFirestore(processedData) as T;
      default:
        console.warn(`Collection "${collectionName}" non riconosciuta, usando deserializzazione di default`);
        return processedData as T;
    }
  } catch (deserializationError) {
    console.error(`Errore deserializzazione per collection "${collectionName}":`, deserializationError);
    return processedData as T;
  }
}

// Removed unused serializeForFirestore function

// ==================== PROVIDER FIRESTORE ====================

export class FirestoreSearchProvider {
  
  /**
   * 🔍 RICERCA GENERALIZZATA
   */
  async executeQuery(criteria: SearchCriteria, entityType:string): Promise<SearchResult[]> {
    if (!hasFirebaseConfig || !db) {
      throw new Error('Firebase not configured');
    }

    console.log('🔍 FirestoreSearchProvider - Esecuzione query:', criteria);
    try {
      const collectionName = this.getCollectionName(entityType);
      const collectionRef = collection(db, collectionName);
      
      // Costruisci query constraints dinamicamente
      const constraints: QueryConstraint[] = [];
      
      // ============ FILTRI BASE ============
      
      // Filtro per createdBy (sempre presente)
      if (criteria.filters?.createdBy) {
        constraints.push(where('createdBy', '==', criteria.filters.createdBy));
      }

      // Filtri specifici per tipo
      if (criteria.filters) {
        for (const [key, value] of Object.entries(criteria.filters)) {
          if (key !== 'createdBy' && value !== undefined) {
            // Gestione speciale per shopping_food e isDeleted
            if (collectionName === 'shopping_food' && key === 'isCompleted') {
              constraints.push(where('isCompleted', '==', value));
            } else if (collectionName === 'shopping_food' && key === 'isDeleted') {
              // Gestisci isDeleted con in operator per compatibilità
              if (value === false) {
                constraints.push(where('isDeleted', 'in', [false, null]));
              } else {
                constraints.push(where('isDeleted', '==', true));
              }
            } else {
              constraints.push(where(key, '==', value));
            }
          }
        }
      }

      // ============ RANGE DATE ============
      
      if (criteria.dateRange) {
        const dateField = this.getDateField(criteria.entityType);
        
        if (criteria.dateRange.from) {
          constraints.push(where(dateField, '>=', Timestamp.fromDate(criteria.dateRange.from)));
        }
        if (criteria.dateRange.to) {
          constraints.push(where(dateField, '<=', Timestamp.fromDate(criteria.dateRange.to)));
        }
      }

      // ============ ORDINAMENTO ============
      
      const dateField = this.getDateField(criteria.entityType);
      constraints.push(orderBy(dateField, 'desc'));

      // Crea query finale
      const finalQuery = query(collectionRef, ...constraints);
      
      // Esegui query
      const snapshot = await getDocs(finalQuery);
      
      let results = snapshot.docs.map(doc => {
        const docData = { id: doc.id, ...doc.data() };
        return deserializeDocument(collectionName, docData) as SearchResult;
      });

      // ============ FILTRI LATO CLIENT ============
      // Filtro per searchText (non supportato nativamente da Firestore)
     if (criteria.searchText) {
  const searchLower = criteria.searchText.toLowerCase().trim();
  
  results = results.filter(item => {
    console.log(item);
    
    // ========== FUNZIONE DI RICERCA INTELLIGENTE ==========
    const smartMatch = (text: string, searchQuery: string): boolean => {
      if (!text) return false;
      
      const normalizedText = text.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c');
      
      const normalizedQuery = searchQuery.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c');

      // 1. Match esatto (massima priorità)
      if (normalizedText.includes(normalizedQuery)) return true;

      // 2a. Rimuovi articoli comuni dalla query
      const queryWithoutArticles = normalizedQuery
        .replace(/\b(il|lo|la|i|gli|le|del|dello|della|dei|degli|delle|dal|dallo|dalla|dai|dagli|dalle|al|allo|alla|ai|agli|alle|nel|nello|nella|nei|negli|nelle|sul|sullo|sulla|sui|sugli|sulle|col|collo|colla|coi|cogli|colle)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 2b. Rimuovi articoli comuni dal testo
      const textWithoutArticles = normalizedText
        .replace(/\b(il|lo|la|i|gli|le|del|dello|della|dei|degli|delle|dal|dallo|dalla|dai|dagli|dalle|al|allo|alla|ai|agli|alle|nel|nello|nella|nei|negli|nelle|sul|sullo|sulla|sui|sugli|sulle|col|collo|colla|coi|cogli|colle)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 2c. Match senza articoli
      if (queryWithoutArticles && textWithoutArticles.includes(queryWithoutArticles)) return true;
      if (queryWithoutArticles && normalizedText.includes(queryWithoutArticles)) return true;

      // 3. Match per parole singole (tutte le parole della query devono essere nel testo)
      const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 1);
      const allWordsMatch = queryWords.every(word => 
        normalizedText.includes(word) || textWithoutArticles.includes(word)
      );
      if (allWordsMatch && queryWords.length > 0) return true;

      // 4. Match parziale con regex (per errori di battitura minori)
      try {
        // Crea pattern flessibile: ogni carattere può avere 0-1 caratteri extra
        const flexiblePattern = queryWithoutArticles
          .split('')
          .map(char => char.match(/[a-z0-9]/) ? `${char}.{0,1}` : char)
          .join('');
        
        const regex = new RegExp(flexiblePattern, 'i');
        if (regex.test(normalizedText)) return true;
      } catch (e) {
        // Se regex fallisce, ignora questo match
      }

      // 5. Match inverso: ogni parola del testo è nella query (per query lunghe)
      if (normalizedQuery.length > normalizedText.length) {
        const textWords = normalizedText.split(/\s+/).filter(word => word.length > 2);
        const queryContainsAllTextWords = textWords.every(word => 
          normalizedQuery.includes(word)
        );
        if (queryContainsAllTextWords && textWords.length > 0) return true;
      }

      return false;
    };

    // ========== APPLICA LA RICERCA INTELLIGENTE ==========
    const titleMatch = smartMatch(item.title || '', searchLower);
    const contentMatch = this.searchInContent(item, searchLower, criteria.entityType) || 
                        smartMatch(item.content || '', searchLower) ||
                        smartMatch(item.description || '', searchLower) ||
                        smartMatch(item.notes || '', searchLower);

    return titleMatch || contentMatch;
  });
}

      // Applica limit
      if (criteria.limit && criteria.limit > 0) {
        results = results.slice(0, criteria.limit);
      }

      console.log(`✅ FirestoreSearchProvider - Trovati ${results.length} risultati`);
      return results;

    } catch (error) {
      console.error('❌ FirestoreSearchProvider - Errore query:', error);
      throw new Error(`Errore durante la ricerca: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }

  /**
   * 🗑️ CANCELLAZIONE ELEMENTO
   */
  async deleteItem(entityType: string, id: string): Promise<boolean> {
    if (!hasFirebaseConfig || !db) {
      throw new Error('Firebase not configured');
    }

    try {
      const collectionName = this.getCollectionName(entityType);
      const docRef = doc(db, collectionName, id);
      
      // Per shopping_food, usa soft delete
      if (collectionName === 'shopping_food') {
        await updateDoc(docRef, {
          isDeleted: true,
          updatedAt: Timestamp.now()
        });
      } else {
        // Per gli altri, cancellazione fisica
        await deleteDoc(docRef);
      }
      
      console.log(`✅ FirestoreSearchProvider - Eliminato ${entityType} con ID: ${id}`);
      return true;
      
    } catch (error) {
      console.error('❌ FirestoreSearchProvider - Errore cancellazione:', error);
      return false;
    }
  }


  /**
   * ✏️ AGGIORNAMENTO ELEMENTO
   */
  async updateItem(entityType: string, id: string, updates: any): Promise<boolean> {
    if (!hasFirebaseConfig || !db) {
      throw new Error('Firebase not configured');
    }
    try {
      const collectionName = this.getCollectionName(entityType);
      const docRef = doc(db, collectionName, id);
      
      // Serializza gli aggiornamenti
      const updateData = typeof updates.toFirestore === 'function' 
        ? updates.toFirestore() 
        : { ...updates };
      
      // Aggiungi sempre updatedAt
      updateData.updatedAt = Timestamp.now();
        console.log(updateData)
      let cleanData = removeUndefinedFields(updateData);
      await updateDoc(docRef, cleanData);
      
      console.log(`✅ FirestoreSearchProvider - Aggiornato ${entityType} con ID: ${id}`);
      return true;
      
    } catch (error) {
      console.error('❌ FirestoreSearchProvider - Errore aggiornamento:', error);
      return false;
    }
  }

  // ==================== METODI HELPER PRIVATI ====================

  private getCollectionName(entityType: string): string {
    const mapping: Record<string, string> = {
      shopping_food: 'shopping_food',
      reminders: 'reminders',
      notes: 'notes',
      calendar_events: 'calendar_events'
    };
    return mapping[entityType] || entityType;
  }

  private getDateField(entityType: string): string {
    const mapping: Record<string, string> = {
      shopping_food: 'createdAt',
      reminders: 'scheduledTime',
      notes: 'createdAt',
      calendar_events: 'startDate'
    };
    return mapping[entityType] || 'createdAt';
  }

  private searchInContent(item: any, searchTerm: string, entityType: string): boolean {
    switch (entityType) {
      case 'shopping_food':
        // Cerca negli items della lista
        return item.items?.some((foodItem: any) => 
          foodItem.text?.toLowerCase().includes(searchTerm)
        ) || false;
        
      case 'reminders':
        // Cerca nel messaggio
        return item.message?.toLowerCase().includes(searchTerm) || false;
        
      case 'notes':
        // Cerca nel contenuto
        return item.content?.toLowerCase().includes(searchTerm) || false;
        
      case 'calendar_events':
        // Cerca nella descrizione
        return item.description?.toLowerCase().includes(searchTerm) || false;
        
      default:
        return false;
    }
  }
}

// ==================== FACTORY E ISTANZA SINGLETON ====================

let firestoreSearchProvider: FirestoreSearchProvider | null = null;

export const getFirestoreSearchProvider = (): FirestoreSearchProvider => {
  if (!firestoreSearchProvider) {
    firestoreSearchProvider = new FirestoreSearchProvider();
  }
  return firestoreSearchProvider;
};

// ==================== ESEMPIO DI UTILIZZO ====================

/*
// Nel tuo IntegratedChatService:

const searchProvider = getFirestoreSearchProvider();

const integratedChat = new IntegratedChatService({
  username: 'testuser',
  enableSmartAssistant: true,
  searchProvider: {
    executeQuery: searchProvider.executeQuery.bind(searchProvider),
    deleteItem: searchProvider.deleteItem.bind(searchProvider),
    updateItem: searchProvider.updateItem.bind(searchProvider)
  }
});
*/