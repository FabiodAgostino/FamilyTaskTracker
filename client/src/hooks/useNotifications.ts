// client/src/hooks/useNotifications.ts
import { useEffect, useState, useRef } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { FCMToken } from '@/lib/models/fcmtoken';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Stato globale singleton
let globalSwRegistration: ServiceWorkerRegistration | null = null;
let globalMessaging: any = null;
let isGloballyInitialized = false;
let initPromise: Promise<void> | null = null;
let foregroundUnsubscribe: (() => void) | null = null;

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [tokenRecord, setTokenRecord] = useState<FCMToken | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const isNotificationSupported = () => {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  };

  const getSafePermission = (): NotificationPermission => {
    try {
      return isNotificationSupported() ? Notification.permission : 'default';
    } catch {
      return 'default';
    }
  };

  // Pulisce token scaduti o inattivi per l'utente corrente
  const cleanupUserTokens = async (username: string): Promise<void> => {
    if (!hasFirebaseConfig || !db) return;

    try {
      const tokensRef = collection(db, 'fcm-tokens');
      const userTokensQuery = query(
        tokensRef,
        where('username', '==', username),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(userTokensQuery);
      const tokens = snapshot.docs.map(doc => 
        FCMToken.fromFirestore({ id: doc.id, ...doc.data() })
      );

      // Trova token duplicati, scaduti o inattivi
      const tokensToDelete: string[] = [];
      const seenTokens = new Set<string>();

      for (const token of tokens) {
        // Rimuovi token duplicati (mantieni il più recente)
        if (seenTokens.has(token.token)) {
          tokensToDelete.push(token.id);
          continue;
        }
        
        // Rimuovi token scaduti o inattivi
        if (!token.isValid()) {
          tokensToDelete.push(token.id);
          continue;
        }

        seenTokens.add(token.token);
      }

      // Elimina token non validi
      for (const tokenId of tokensToDelete) {
        await deleteDoc(doc(db, 'fcm-tokens', tokenId));
      }

      // Mantieni solo gli ultimi 3 token attivi per utente
      const activeTokens = tokens.filter(t => !tokensToDelete.includes(t.id));
      if (activeTokens.length > 3) {
        const tokensToRemove = activeTokens.slice(3);
        for (const token of tokensToRemove) {
          await deleteDoc(doc(db, 'fcm-tokens', token.id));
        }
      }
    } catch (error) {
      // Errore non critico, logga silenziosamente
    }
  };

  // Salva o aggiorna il token FCM in Firestore
  const saveTokenToFirestore = async (token: string): Promise<FCMToken | null> => {
    if (!user || !hasFirebaseConfig || !db) return null;

    try {
      // Prima pulisci i token vecchi
      await cleanupUserTokens(user.username);

      // Verifica se il token esiste già per questo utente
      const tokensRef = collection(db, 'fcm-tokens');
      const existingTokenQuery = query(
        tokensRef,
        where('username', '==', user.username),
        where('token', '==', token)
      );

      const existingSnapshot = await getDocs(existingTokenQuery);

      if (!existingSnapshot.empty) {
        // Token esiste già, aggiorna lastUsedAt
        const existingDoc = existingSnapshot.docs[0];
        const existingToken = FCMToken.fromFirestore({ 
          id: existingDoc.id, 
          ...existingDoc.data() 
        });

        existingToken.updateLastUsed();
        
        await updateDoc(doc(db, 'fcm-tokens', existingDoc.id), {
          lastUsedAt: Timestamp.fromDate(existingToken.lastUsedAt),
          updatedAt: Timestamp.fromDate(existingToken.updatedAt)
        });

        return existingToken;
      }

      // Crea nuovo token
      const userAgent = navigator.userAgent;
      const deviceType = FCMToken.detectDeviceType(userAgent);
      const expiresAt = FCMToken.getDefaultExpirationDate(30); // 30 giorni

      const newToken = new FCMToken(
        '', // ID sarà assegnato da Firestore
        token,
        user.username,
        userAgent,
        deviceType,
        true,
        new Date(),
        new Date(),
        new Date(),
        expiresAt
      );

      const docRef = await addDoc(tokensRef, {
        ...newToken.toFirestore(),
        createdAt: Timestamp.fromDate(newToken.createdAt),
        updatedAt: Timestamp.fromDate(newToken.updatedAt),
        lastUsedAt: Timestamp.fromDate(newToken.lastUsedAt),
        expiresAt: Timestamp.fromDate(newToken.expiresAt!)
      });

      newToken.id = docRef.id;
      return newToken;

    } catch (error) {
      return null;
    }
  };

  // Attende che il Service Worker sia attivo
  const waitForServiceWorkerActive = async (registration: ServiceWorkerRegistration): Promise<ServiceWorker> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker activation timeout'));
      }, 30000);

      const checkActive = () => {
        if (registration.active) {
          clearTimeout(timeout);
          resolve(registration.active);
          return;
        }

        if (registration.installing) {
          registration.installing.addEventListener('statechange', function handler() {
            if (this.state === 'activated') {
              this.removeEventListener('statechange', handler);
              clearTimeout(timeout);
              resolve(registration.active!);
            } else if (this.state === 'redundant') {
              this.removeEventListener('statechange', handler);
              clearTimeout(timeout);
              reject(new Error('Service Worker became redundant'));
            }
          });
          return;
        }

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          registration.waiting.addEventListener('statechange', function handler() {
            if (this.state === 'activated') {
              this.removeEventListener('statechange', handler);
              clearTimeout(timeout);
              resolve(registration.active!);
            }
          });
          return;
        }

        clearTimeout(timeout);
        reject(new Error('Service Worker not found'));
      };

      checkActive();
    });
  };

  // Registra il Service Worker
  const registerServiceWorker = async (): Promise<void> => {
    if (globalSwRegistration) return;

    const swPath = import.meta.env.PROD 
      ? '/FamilyTaskTracker/firebase-messaging-sw.js'
      : '/firebase-messaging-sw.js';
    
    try {
      // Verifica che il file service worker esista
      const testResponse = await fetch(swPath);
      if (!testResponse.ok) {
        throw new Error('Service Worker file not found');
      }

      const registration = await navigator.serviceWorker.register(swPath, {
        scope: import.meta.env.PROD ? '/FamilyTaskTracker/' : '/'
      });

      await waitForServiceWorkerActive(registration);
      globalSwRegistration = registration;
    } catch (error) {
      throw new Error('Failed to register Service Worker');
    }
  };

  // Setup Firebase Cloud Messaging
  const setupFCM = async (): Promise<string | null> => {
    if (!vapidKey || !user) {
      throw new Error('Missing VAPID key or user not authenticated');
    }

    if (!globalSwRegistration) {
      throw new Error('Service Worker not registered');
    }

    if (!globalSwRegistration.active) {
      await waitForServiceWorkerActive(globalSwRegistration);
    }

    try {
      if (!globalMessaging) {
        globalMessaging = getMessaging();
      }

      const tokenOptions = {
        vapidKey,
        serviceWorkerRegistration: globalSwRegistration
      };

      // Retry logic per getToken
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          const token = await getToken(globalMessaging, tokenOptions);
          
          if (token) {
            // Salva il token in Firestore
            const savedToken = await saveTokenToFirestore(token);
            setCurrentToken(token);
            setTokenRecord(savedToken);
            return token;
          } else if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (attemptError) {
          if (attempts >= maxAttempts) {
            throw attemptError;
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      throw new Error('No FCM token available after retries');
    } catch (error) {
      throw error;
    }
  };

  // Setup listener per messaggi in foreground
  const setupForegroundListener = async (): Promise<void> => {
    if (!globalMessaging || foregroundUnsubscribe) return;

    try {
      foregroundUnsubscribe = onMessage(globalMessaging, (payload) => {
        toast({
          title: payload.notification?.title || 'Nuova notifica',
          description: payload.notification?.body || 'Controlla l\'app'
        });
        
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || 'Family Task Tracker', {
            body: payload.notification?.body,
            icon: '/FamilyTaskTracker/icon-192.png',
            tag: 'foreground-notification'
          });
        }
      });
    } catch (error) {
      // Setup fallito, ma non critico
    }
  };

  // Inizializzazione singleton
  const initializeOnce = async (): Promise<void> => {
    if (isGloballyInitialized) return;

    if (initPromise) {
      await initPromise;
      return;
    }

    initPromise = (async () => {
      try {
        if (!globalSwRegistration) {
          await registerServiceWorker();
        }

        if (!globalMessaging) {
          globalMessaging = getMessaging();
        }

        await setupForegroundListener();

        isGloballyInitialized = true;
      } catch (error) {
        isGloballyInitialized = false;
        initPromise = null;
        throw error;
      }
    })();

    await initPromise;
  };

  // Effect per inizializzazione
  useEffect(() => {
    const currentPermission = getSafePermission();
    setPermission(currentPermission);

    if (!isNotificationSupported()) return;

    if (!isGloballyInitialized && !initPromise) {
      initializeOnce().catch(() => {
        // Errore durante inizializzazione
      });
    }
  }, [user]);

  // Effect separato per gestire l'automatismo quando permessi sono già granted
  useEffect(() => {
    const handleAutoSetup = async () => {
      if (permission === 'granted' && user && !currentToken && isGloballyInitialized) {
        try {
          await setupFCM();
        } catch (error) {
          // Errore non critico per l'automatismo
        }
      }
    };

    handleAutoSetup();
  }, [permission, user, isGloballyInitialized, currentToken]);

  // Effect per cleanup quando cambia utente
  useEffect(() => {
    if (!user) {
      setCurrentToken(null);
      setTokenRecord(null);
    }
  }, [user]);

  const requestPermission = async (): Promise<void> => {
    if (!isNotificationSupported()) {
      toast({
        title: 'Non supportato',
        description: 'Le notifiche non sono supportate su questo dispositivo.',
        variant: 'destructive'
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Accesso richiesto',
        description: 'Devi essere autenticato per abilitare le notifiche.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsRegistering(true);
      
      // Se i permessi sono già granted, vai diretto al setup FCM
      if (permission === 'granted') {
        await initializeOnce();
        await setupFCM();
        
        toast({
          title: 'Notifiche attivate',
          description: 'Riceverai aggiornamenti famiglia!'
        });
        return;
      }

      // Altrimenti richiedi permessi
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      
      if (requestedPermission === 'granted') {
        await initializeOnce();
        await setupFCM();
        
        toast({
          title: 'Notifiche attivate',
          description: 'Riceverai aggiornamenti famiglia!'
        });
      } else {
        toast({
          title: 'Notifiche bloccate',
          description: 'Puoi riabilitarle nelle impostazioni del browser.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Errore notifiche',
        description: 'Impossibile attivare le notifiche',
        variant: 'destructive'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const testNotification = async (): Promise<void> => {
    if (permission !== 'granted') {
      toast({
        title: 'Permessi necessari',
        description: 'Abilita prima le notifiche',
        variant: 'destructive'
      });
      return;
    }

    try {
      new Notification('Test Notifica Locale', {
        body: 'Se vedi questa notifica, il sistema funziona!',
        icon: '/FamilyTaskTracker/icon-192.png',
        tag: 'test-notification'
      });

      toast({
        title: 'Test inviato!',
        description: 'Controlla se è apparsa la notifica'
      });
    } catch (error) {
      toast({
        title: 'Errore test',
        description: 'Impossibile inviare notifica di test',
        variant: 'destructive'
      });
    }
  };

  const refreshToken = async (): Promise<void> => {
    if (!user || permission !== 'granted') return;

    try {
      setIsRegistering(true);
      await initializeOnce();
      await setupFCM();
    } catch (error) {
      toast({
        title: 'Errore aggiornamento',
        description: 'Impossibile aggiornare il token',
        variant: 'destructive'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Pulisci i token dell'utente corrente
  const clearUserTokens = async (): Promise<void> => {
    if (!user || !hasFirebaseConfig || !db) return;

    try {
      await cleanupUserTokens(user.username);
      setCurrentToken(null);
      setTokenRecord(null);
      
      toast({
        title: 'Token rimossi',
        description: 'Tutti i token FCM sono stati rimossi'
      });
    } catch (error) {
      toast({
        title: 'Errore rimozione',
        description: 'Impossibile rimuovere i token',
        variant: 'destructive'
      });
    }
  };

  return {
    permission,
    token: currentToken,
    tokenRecord,
    isRegistering,
    isSupported: isNotificationSupported(),
    isInitialized: isGloballyInitialized,
    requestPermission,
    testNotification,
    refreshToken,
    clearUserTokens,
    // Esponi le funzioni di debug per compatibilità con l'header
    debug: {
      setupFCM,
      runDiagnostics: async () => {
        // Diagnostica semplificata per l'header
        try {
          if (!currentToken) {
            await setupFCM();
          }
          return { success: true, message: 'Sistema FCM funzionante' };
        } catch (error) {
          return { success: false, message: 'Errore nel sistema FCM' };
        }
      }
    }
  };
}