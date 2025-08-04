// Mock Firestore implementation for demo purposes when Firebase credentials are not available

import { Note, CalendarEvent, Category } from "./models/types";
import { ShoppingItem } from "./models/shopping-item";


interface MockData {
  shopping_items: ShoppingItem[];
  notes: Note[];
  calendar_events: CalendarEvent[];
  categories: Category[];
}

class MockFirestore {
  private data: MockData = {
    shopping_items: [],
    notes: [],
    calendar_events: [],
    categories: [
      new Category('1', 'groceries', 'admin', new Date()),
      new Category('2', 'electronics', 'admin', new Date()),
      new Category('3', 'household', 'admin', new Date()),
      new Category('4', 'clothing', 'admin', new Date()),
    ],
  };
  private listeners: Map<string, (data: any[]) => void> = new Map();

  collection(name: string) {
    return {
      onSnapshot: (callback: (snapshot: any) => void) => {
        // Initial call
        const docs = (this.data[name as keyof MockData] || []).map((item: any) => ({
          id: item.id,
          data: () => item,
        }));
        callback({ docs });

        // Store listener for updates
        this.listeners.set(name, (data: any[]) => {
          const docs = data.map((item: any) => ({
            id: item.id,
            data: () => item,
          }));
          callback({ docs });
        });

        // Return unsubscribe function
        return () => {
          this.listeners.delete(name);
        };
      },
    };
  }

  async addDoc(collectionRef: any, data: any) {
    try {
      const collectionName = collectionRef.name;
      const id = Date.now().toString();
      
      // ✅ Rimuovi campi undefined prima di salvare nel mock
      const cleanData = this.removeUndefinedFields(data);
      
      const newItem = {
        ...cleanData,
        id,
        createdAt: cleanData.createdAt || new Date(),
        updatedAt: cleanData.updatedAt || new Date(),
      };


      (this.data[collectionName as keyof MockData] as any[]).push(newItem);
      this.notifyListeners(collectionName);
      return { id };
    } catch (error) {
      console.error('MockFirestore: Error adding document:', error);
      throw error;
    }
  }

  async updateDoc(docRef: any, updates: any) {
    try {
            
      const { collectionName, id } = docRef;
      const collection = this.data[collectionName as keyof MockData] as any[];
      const index = collection.findIndex((item: any) => item.id === id);
      
      if (index !== -1) {
        // ✅ Rimuovi campi undefined dagli updates
        const cleanUpdates = this.removeUndefinedFields(updates);
        
        collection[index] = {
          ...collection[index],
          ...cleanUpdates,
          updatedAt: new Date(),
        };
        this.notifyListeners(collectionName);
              } else {
        console.warn('MockFirestore: Document not found for update:', id);
      }
    } catch (error) {
      console.error('MockFirestore: Error updating document:', error);
      throw error;
    }
  }

  async deleteDoc(docRef: any) {
    try {
            
      const { collectionName, id } = docRef;
      const collection = this.data[collectionName as keyof MockData] as any[];
      const index = collection.findIndex((item: any) => item.id === id);
      
      if (index !== -1) {
        collection.splice(index, 1);
        this.notifyListeners(collectionName);
              } else {
        console.warn('MockFirestore: Document not found for deletion:', id);
      }
    } catch (error) {
      console.error('MockFirestore: Error deleting document:', error);
      throw error;
    }
  }

  doc(collectionName: string, id: string) {
    return {
      collectionName,
      id,
    };
  }

  // ✅ Metodo per rimuovere campi undefined (come nel vero Firestore)
  private removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedFields(item));
    }

    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedFields(value);
        }
      }
      return cleaned;
    }

    return obj;
  }

  private notifyListeners(collectionName: string) {
    const listener = this.listeners.get(collectionName);
    if (listener) {
      listener(this.data[collectionName as keyof MockData] || []);
    }
  }

  // ✅ Metodo per ottenere dati (utile per debug)
  getData() {
    return this.data;
  }

  // ✅ Metodo per reset dati (utile per testing)
  clearData() {
    this.data = {
      shopping_items: [],
      notes: [],
      calendar_events: [],
      categories: [
        new Category('1', 'groceries', 'admin', new Date()),
        new Category('2', 'electronics', 'admin', new Date()),
        new Category('3', 'household', 'admin', new Date()),
        new Category('4', 'clothing', 'admin', new Date()),
      ],
    };
    
    // Notify all listeners
    Object.keys(this.data).forEach(collectionName => {
      this.notifyListeners(collectionName);
    });
  }
}

export const mockFirestore = new MockFirestore();

// Mock collection function
export function mockCollection(_db: any, name: string) {
  return { name };
}

// Mock doc function
export function mockDoc(_db: any, collectionName: string, id: string) {
  return mockFirestore.doc(collectionName, id);
}

// Mock addDoc function
export async function mockAddDoc(collectionRef: any, data: any) {
  return mockFirestore.addDoc(collectionRef, data);
}

// Mock updateDoc function
export async function mockUpdateDoc(docRef: any, updates: any) {
  return mockFirestore.updateDoc(docRef, updates);
}

// Mock deleteDoc function
export async function mockDeleteDoc(docRef: any) {
  return mockFirestore.deleteDoc(docRef);
}

// Mock Timestamp
export const mockTimestamp = {
  now: () => new Date(),
  fromDate: (date: Date) => date,
  toDate: (timestamp: any) => timestamp instanceof Date ? timestamp : new Date(),
};

// ✅ Export dell'istanza mockFirestore per debug
export { mockFirestore as __mockFirestoreInstance__ };