import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
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

export function useFirestore<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    if (!hasFirebaseConfig || !db) {
      setError('Firebase not configured');
      setLoading(false);
      return;
    }

    const collectionRef = collection(db, collectionName);
    
    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          startDate: doc.data().startDate?.toDate?.() || undefined,
          endDate: doc.data().endDate?.toDate?.() || undefined,
        })) as T[];
        
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, user]);

  const add = async (item: T | Omit<T, 'id'>): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');

    const itemData = (item as any).toFirestore?.() ?? { ...item };
    
    const itemWithMetadata = {
      ...itemData,
      createdBy: user.username,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };


    const docRef = await addDoc(collection(db, collectionName), itemWithMetadata);
    return docRef.id;
  };

  const update = async (id: string, updates: Partial<T>): Promise<void> => {
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  };

  const remove = async (id: string): Promise<void> => {
    if (!hasFirebaseConfig || !db) throw new Error('Firebase not configured');
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  };

  const getByUser = (username: string) => {
    return data.filter((item: any) => 
      item.createdBy === username || 
      (item.isPublic === true) || 
      user?.role === 'admin'
    );
  };

  return {
    data,
    loading,
    error,
    add,
    update,
    remove,
    getByUser
  };
}
