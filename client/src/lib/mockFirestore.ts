// Mock Firestore implementation for demo purposes when Firebase credentials are not available
import { ShoppingItem, Note, CalendarEvent, Category } from '@shared/schema';

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
      {
        id: '1',
        name: 'groceries',
        createdBy: 'admin',
        createdAt: new Date(),
      },
      {
        id: '2',
        name: 'electronics',
        createdBy: 'admin',
        createdAt: new Date(),
      },
      {
        id: '3',
        name: 'household',
        createdBy: 'admin',
        createdAt: new Date(),
      },
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
    const collectionName = collectionRef.name;
    const id = Date.now().toString();
    const newItem = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (this.data[collectionName as keyof MockData] as any[]).push(newItem);
    this.notifyListeners(collectionName);
    return { id };
  }

  async updateDoc(docRef: any, updates: any) {
    const { collectionName, id } = docRef;
    const collection = this.data[collectionName as keyof MockData] as any[];
    const index = collection.findIndex((item: any) => item.id === id);
    
    if (index !== -1) {
      collection[index] = {
        ...collection[index],
        ...updates,
        updatedAt: new Date(),
      };
      this.notifyListeners(collectionName);
    }
  }

  async deleteDoc(docRef: any) {
    const { collectionName, id } = docRef;
    const collection = this.data[collectionName as keyof MockData] as any[];
    const index = collection.findIndex((item: any) => item.id === id);
    
    if (index !== -1) {
      collection.splice(index, 1);
      this.notifyListeners(collectionName);
    }
  }

  doc(collectionName: string, id: string) {
    return {
      collectionName,
      id,
    };
  }

  private notifyListeners(collectionName: string) {
    const listener = this.listeners.get(collectionName);
    if (listener) {
      listener(this.data[collectionName as keyof MockData] || []);
    }
  }
}

export const mockFirestore = new MockFirestore();

// Mock collection function
export function mockCollection(db: any, name: string) {
  return { name };
}

// Mock doc function
export function mockDoc(db: any, collectionName: string, id: string) {
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
};