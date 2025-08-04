import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  // getDocs unused 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { Category, Note, CalendarEvent, User } from '@/lib/models/types';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { ShoppingFood, CategoryFood, Supermarket } from '@/lib/models/food';
import { FCMToken } from '@/lib/models/fcmtoken';
import { Reminder } from '@/lib/models/reminder';
import { FidelityCard } from '@/lib/models/FidelityCard';

// Type mapping per la deserializzazione (unused)
/*
type CollectionTypeMap = {
  'shopping_items': ShoppingItem;
  'categories': Category;
  'notes': Note;
  'calendar_events': CalendarEvent;
  'users': User;
  'shopping_food': ShoppingFood;
  'food_categories': CategoryFood;
  'supermarkets': Supermarket;
  'fcm-tokens': FCMToken;
  'reminders': Reminder; 

};
*/

// Funzione helper per deserializzare basata sul nome della collection
function deserializeDocument<T>(collectionName: string, docData: any): T {
  // Prima converte i Timestamp di Firestore in Date
 const processedData = {
    ...docData,
    createdAt: docData.createdAt || new Date(),
    updatedAt: docData.updatedAt || new Date(),
    startDate: docData.startDate || undefined,
    endDate: docData.endDate || undefined,
    completedAt: docData.completedAt || undefined,
    lastLoginAt: docData.lastLoginAt || undefined,
    lastViewedAt: docData.lastViewedAt || undefined,
     lastUsedAt: docData.lastUsedAt?.toDate() || undefined,
    expiresAt: docData.expiresAt?.toDate() || undefined,
  };
  // Deserializza usando i metodi fromFirestore delle classi
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
        // Fallback per collection sconosciute - restituisce oggetto plain
        console.warn(`Collection "${collectionName}" non riconosciuta, usando deserializzazione di default`);
        return processedData as T;
    }
  } catch (deserializationError) {
    console.error(`Errore deserializzazione per collection "${collectionName}":`, deserializationError);
    // Fallback: restituisce oggetto processato senza deserializzazione di classe
    return processedData as T;
  }
}

// Funzione helper per serializzare per Firestore
function serializeForFirestore(item: any): Record<string, any> {
  // Se l'oggetto ha il metodo toFirestore, lo usa
  if (typeof item.toFirestore === 'function') {
    return item.toFirestore();
  }
  
  // Altrimenti crea una copia pulita rimuovendo campi non necessari
  const { id, ...itemData } = item;
  return itemData;
}

export function useFirestore<T>(
  collectionName: string, 
  options?: {
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  }
)  {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
  if (!user) {
    setLoading(true);
    setData([]);
    setLoading(false);
    return;
  }

  if (!hasFirebaseConfig || !db) {
    setError('Firebase not configured');
    setLoading(false);
    return;
  }
  setLoading(true);

  const collectionRef = collection(db, collectionName);
  
  // ✅ Crea query diversa per shopping_food per filtrare elementi cancellati
  let queryRef;
  if (collectionName === 'shopping_food') {
  if (options?.onlyDeleted) {
    // Solo elementi cancellati
    queryRef = query(
      collectionRef,
      where('isDeleted', '==', true),
      orderBy('createdAt', 'desc')
    );
    setLoading(false);

  } else if (options?.includeDeleted) {
    // Tutti gli elementi (cancellati e non)
    queryRef = query(collectionRef, orderBy('createdAt', 'desc'));
    setLoading(false);

  } else {
    // Solo elementi NON cancellati (comportamento di default)
    queryRef = query(
      collectionRef,
      where('isDeleted', 'in', [false, null]),
      orderBy('createdAt', 'desc')
    );
    setLoading(false);

  }
} else {
  // Per tutte le altre collezioni, query normale
  queryRef = collectionRef;
}
  
  const unsubscribe = onSnapshot(
    queryRef,
    (snapshot) => {
      try {
        setLoading(true);
        const items = snapshot.docs.map(doc => {
          const docData = { id: doc.id, ...doc.data() };
          // CRUCIALE: Deserializza usando le classi appropriate
          return deserializeDocument<T>(collectionName, docData);
        });
        
        // ✅ Filtro aggiuntivo lato client per sicurezza (solo per shopping_food)
        let filteredItems = items;
          if (collectionName === 'shopping_food' && !options?.includeDeleted) {
            if (options?.onlyDeleted) {
              filteredItems = items.filter((item: any) => item.isDeleted === true);
            } else {
              filteredItems = items.filter((item: any) => !item.isDeleted);
            }
          }
        setData(filteredItems);
       
      } catch (deserializationError) {
        console.error('Errore durante la deserializzazione batch:', deserializationError);
        setError('Errore durante il caricamento dei dati');
        setLoading(false);
      }
      finally
      {
        setLoading(false);
        setError(null);
      }
    },
    (err) => {
      console.error('Errore Firebase onSnapshot:', err);
      setError(err.message);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [collectionName, user]);

  const add = async (item: T | Omit<T, 'id'>): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');

    try {
      // Serializza l'oggetto per Firestore
      const itemData = serializeForFirestore(item);
      const itemWithMetadata = {
        ...itemData,
        createdBy: user.username,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
            const docRef = await addDoc(collection(db, collectionName), itemWithMetadata);
      return docRef.id;
    } catch (error) {
      console.error('Errore durante l\'aggiunta:', error);
      throw new Error(`Impossibile aggiungere l'elemento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const update = async (id: string, updates: Partial<T> | T): Promise<void> => {
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');
    
    try {
      const docRef = doc(db, collectionName, id);
      
      // Se updates è un oggetto completo, serializzalo
      let updateData;
      if (typeof (updates as any).toFirestore === 'function') {
        updateData = serializeForFirestore(updates);
      } else {
        updateData = { ...updates };
      }
      var u = updateData as any;
      // Aggiungi sempre updatedAt
      u.updatedAt = Timestamp.now();
      await updateDoc(docRef, u);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      throw new Error(`Impossibile aggiornare l'elemento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');
    
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      throw new Error(`Impossibile eliminare l'elemento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const getByUser = (username: string) => {
    var d= data.filter((item: any) => 
      item.createdBy === username || 
      (item.isPublic === true) || 
      user?.role === 'admin'
    );
        return d;
  };

  // Metodi di utilità aggiuntivi
  const getById = (id: string): T | undefined => {
    return data.find((item: any) => item.id === id);
  };

  const getByCategory = (categoryName: string) => {
    return data.filter((item: any) => 
      item.category === categoryName
    );
  };

  const search = (searchTerm: string, fields: string[] = ['name', 'title']) => {
    const term = searchTerm.toLowerCase();
    return data.filter((item: any) => 
      fields.some(field => 
        item[field]?.toLowerCase?.().includes(term)
      )
    );
  };

  return {
    data,
    loading,
    error,
    add,
    update,
    remove,
    getByUser,
    getById,
    getByCategory,
    search
  };
}