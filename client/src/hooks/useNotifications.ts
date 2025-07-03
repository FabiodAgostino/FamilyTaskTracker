// client/src/hooks/useNotifications.ts - FIX DEFINITIVO TIMING E RACE CONDITIONS
import { useEffect, useState, useRef } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useToast } from './use-toast';

// 🔑 VAPID Key corretta dal .env
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// 🔧 Debug VAPID key all'avvio
console.log('🔑 === VAPID KEY DEBUG ===');
console.log('🔑 Has VAPID Key:', !!vapidKey);
console.log('🔑 VAPID Key Length:', vapidKey?.length);
console.log('🔑 VAPID Key Preview:', vapidKey?.substring(0, 20) + '...');
console.log('🔑 All Firebase Env Vars:', Object.keys(import.meta.env)
  .filter(key => key.startsWith('VITE_FIREBASE_'))
  .reduce((acc, key) => {
    acc[key] = !!import.meta.env[key];
    return acc;
  }, {} as Record<string, boolean>)
);
console.log('🔑 =========================');

// 🔧 SINGLETON: Variabili globali per evitare re-inizializzazioni
let globalSwRegistration: ServiceWorkerRegistration | null = null;
let globalToken: string | null = null;
let isGloballyInitialized = false;
let initPromise: Promise<void> | null = null;

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(globalToken);
  const [isRegistering, setIsRegistering] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(globalSwRegistration);
  const { toast } = useToast();

  const isNotificationSupported = () => {
    try {
      return typeof window !== 'undefined' && 'Notification' in window;
    } catch (error) {
      return false;
    }
  };

  const getSafePermission = (): NotificationPermission => {
    try {
      if (isNotificationSupported()) {
        return Notification.permission;
      }
      return 'default';
    } catch (error) {
      return 'default';
    }
  };

  // 🔧 NUOVO: Attende che il Service Worker sia completamente attivo
  const waitForServiceWorkerActive = async (registration: ServiceWorkerRegistration): Promise<ServiceWorker> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker activation timeout after 30 seconds'));
      }, 30000);

      const checkActive = () => {
        if (registration.active) {
          clearTimeout(timeout);
          console.log('✅ Service Worker is ACTIVE');
          resolve(registration.active);
          return;
        }

        // Se c'è un service worker in installing, aspetta che diventi active
        if (registration.installing) {
          console.log('⏳ Service Worker INSTALLING, waiting for active...');
          registration.installing.addEventListener('statechange', function handler() {
            console.log('🔄 SW State changed to:', this.state);
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

        // Se c'è un service worker in waiting, forza l'attivazione
        if (registration.waiting) {
          console.log('⏳ Service Worker WAITING, forcing activation...');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          registration.waiting.addEventListener('statechange', function handler() {
            console.log('🔄 SW State changed to:', this.state);
            if (this.state === 'activated') {
              this.removeEventListener('statechange', handler);
              clearTimeout(timeout);
              resolve(registration.active!);
            }
          });
          return;
        }

        clearTimeout(timeout);
        reject(new Error('Service Worker not found in any state'));
      };

      checkActive();
    });
  };

  // 🔧 MIGLIORATO: Registrazione Service Worker con attesa stato active
  const registerServiceWorkerOnce = async (): Promise<void> => {
    if (globalSwRegistration) {
      console.log('🔄 Service Worker già registrato globalmente');
      return;
    }

    setIsRegistering(true);
    
    try {
      console.log('🔥 Registrazione Firebase SW (UNICA VOLTA)...');
      
      const swPath = import.meta.env.PROD 
        ? '/FamilyTaskTracker/firebase-messaging-sw.js'
        : '/firebase-messaging-sw.js';
      
      console.log('📍 SW Path:', swPath);
      console.log('🌍 Environment:', { 
        PROD: import.meta.env.PROD, 
        DEV: import.meta.env.DEV,
        MODE: import.meta.env.MODE 
      });
      
      // 🔧 NUOVO: Test se il service worker file esiste
      console.log('🔍 Testando se il SW file è accessibile...');
      try {
        const testResponse = await fetch(swPath);
        console.log('📄 SW File status:', testResponse.status, testResponse.statusText);
        if (!testResponse.ok) {
          throw new Error(`SW file non trovato: ${testResponse.status} ${testResponse.statusText}`);
        }
        console.log('✅ SW File accessibile');
      } catch (fetchError) {
        console.error('❌ SW File non accessibile:', fetchError);
        throw new Error(`Service Worker file non trovato: ${swPath}`);
      }
      
      console.log('🔄 Avviando registrazione SW...');
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: import.meta.env.PROD ? '/FamilyTaskTracker/' : '/'
      });
      
      console.log('🎉 SW Registration SUCCESS!');
      console.log('📝 SW Registered:', {
        scope: registration.scope,
        state: registration.active?.state,
        installing: !!registration.installing,
        waiting: !!registration.waiting,
        active: !!registration.active
      });
      
      // 🔧 CRITICO: Aspetta che il SW sia completamente attivo
      console.log('⏳ Waiting for Service Worker to be active...');
      await waitForServiceWorkerActive(registration);
      
      globalSwRegistration = registration;
      console.log('✅ Firebase SW registrato e ATTIVO globalmente');
      
    } catch (error) {
      console.error('❌ Errore registrazione Firebase SW:', error);
      toast({
        title: '❌ Errore Service Worker',
        description: 'Impossibile registrare service worker per notifiche',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsRegistering(false);
    }
  };

  // 🔧 MIGLIORATO: Setup FCM con attesa service worker
  const setupFCM = async (): Promise<string | null> => {
    try {
      if (!vapidKey) {
        throw new Error('VAPID key mancante nel file .env (VITE_FIREBASE_VAPID_KEY)');
      }

      if (vapidKey.length !== 88) {
        console.warn('⚠️ VAPID key length non standard:', vapidKey.length, 'expected: 88');
      }
      
      // 🔧 Assicurati che il service worker sia registrato E attivo
      if (!globalSwRegistration) {
        console.log('⏳ Service worker non disponibile, inizializzando...');
        await initializeOnce();
        
        if (!globalSwRegistration) {
          throw new Error('Service worker non disponibile dopo inizializzazione');
        }
      }

      // 🔧 Verifica che il SW sia attivo (non solo registrato)
      if (!globalSwRegistration.active) {
        console.log('⏳ Service worker not active, waiting...');
        await waitForServiceWorkerActive(globalSwRegistration);
      }
      
      const messaging = getMessaging();
      
      const tokenOptions = {
        vapidKey,
        serviceWorkerRegistration: globalSwRegistration
      };
      
      console.log('🔑 Richiedendo token FCM con options:', {
        hasVapidKey: !!tokenOptions.vapidKey,
        vapidKeyPreview: tokenOptions.vapidKey?.substring(0, 20) + '...',
        swScope: tokenOptions.serviceWorkerRegistration?.scope,
        swActive: !!tokenOptions.serviceWorkerRegistration?.active
      });

      // 🔧 RETRY LOGIC per getToken
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔑 Tentativo ${attempts}/${maxAttempts} per ottenere token FCM...`);
          
          const currentToken = await getToken(messaging, tokenOptions);
          
          if (currentToken) {
            globalToken = currentToken;
            setToken(currentToken);
            
            console.log('🔑 ✅ FCM Token ottenuto con successo!');
            console.log('🔑 Token (primi 20 char):', currentToken.substring(0, 20) + '...');
            console.log('🔑 Token completo:', currentToken);
            
            // Copia negli appunti per debug
            try {
              await navigator.clipboard.writeText(currentToken);
              console.log('📋 Token copiato negli appunti');
            } catch (e) {
              console.log('📋 Impossibile copiare negli appunti');
            }
            
            console.log('🔑 === SETUP FCM COMPLETATO ===');
            return currentToken;
          } else {
            console.warn(`⚠️ Tentativo ${attempts}: Token vuoto ricevuto`);
            if (attempts < maxAttempts) {
              console.log('⏳ Attendo 2 secondi prima del prossimo tentativo...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
        } catch (attemptError) {
          console.error(`❌ Tentativo ${attempts} fallito:`, attemptError);
          if (attempts < maxAttempts) {
            console.log('⏳ Attendo 3 secondi prima del prossimo tentativo...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            throw attemptError;
          }
        }
      }

      throw new Error(`No FCM token available dopo ${maxAttempts} tentativi`);
      
    } catch (error) {
      console.error('❌ === ERRORE SETUP FCM ===');
      console.error('❌ Errore:', error);
      
      // 🔧 Debug dettagliato errore
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }

      console.error('❌ Debug info:', {
        hasVapidKey: !!vapidKey,
        vapidKeyLength: vapidKey?.length,
        hasSwRegistration: !!globalSwRegistration,
        swScope: globalSwRegistration?.scope,
        swActive: !!globalSwRegistration?.active,
        permission: permission
      });
      
      toast({
        title: '❌ Errore configurazione FCM',
        description: error instanceof Error ? error.message : 'Errore sconosciuto nella configurazione Firebase',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // 🔧 MIGLIORATO: Inizializzazione singleton con race condition protection
  const initializeOnce = async (): Promise<void> => {
    if (isGloballyInitialized) {
      console.log('🔄 Sistema già inizializzato globalmente, sync stato locale');
      setSwRegistration(globalSwRegistration);
      setToken(globalToken);
      return;
    }

    if (initPromise) {
      console.log('⏳ Inizializzazione già in corso, attendendo...');
      try {
        await initPromise;
        setSwRegistration(globalSwRegistration);
        setToken(globalToken);
        return;
      } catch (error) {
        console.error('❌ Errore durante attesa inizializzazione:', error);
        initPromise = null;
        throw error;
      }
    }

    console.log('🆕 Inizializzazione globale del sistema notifiche...');
    
    initPromise = (async () => {
      try {
        // Registra service worker una sola volta
        if ('serviceWorker' in navigator && !globalSwRegistration) {
          await registerServiceWorkerOnce();
        }

        // Setup listener foreground una sola volta
        if (globalSwRegistration && !isGloballyInitialized) {
          await setupForegroundListenerOnce();
        }

        // 🔧 CRITICO: Se i permessi sono già granted, ottieni subito il token
        if (Notification.permission === 'granted' && !globalToken) {
          console.log('🔑 Permessi già granted, ottenendo token FCM...');
          try {
            await setupFCM();
          } catch (tokenError) {
            console.error('⚠️ Errore ottenimento token durante init:', tokenError);
            // Non bloccare l'inizializzazione per questo errore
          }
        }

        isGloballyInitialized = true;
        console.log('✅ Sistema notifiche inizializzato globalmente');
      } catch (error) {
        console.error('❌ Errore inizializzazione globale:', error);
        isGloballyInitialized = false;
        initPromise = null;
        throw error;
      }
    })();

    await initPromise;
    setSwRegistration(globalSwRegistration);
    setToken(globalToken);
  };

  // 🔧 Setup listener foreground
  const setupForegroundListenerOnce = async () => {
    try {
      console.log('🔧 Configurando listener foreground (UNICA VOLTA)...');
      const messaging = getMessaging();
      
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('🔥🔥🔥 MESSAGGIO FOREGROUND RICEVUTO:', payload);
        
        toast({
          title: payload.notification?.title || 'Nuova notifica',
          description: payload.notification?.body || 'Controlla l\'app'
        });
        
        // Notifica browser di backup
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || 'Family Task Tracker', {
            body: payload.notification?.body,
            icon: '/FamilyTaskTracker/icon-192.png',
            tag: 'foreground-notification'
          });
        }
      });
      
      console.log('✅ Listener foreground attivato globalmente');
      return unsubscribe;
      
    } catch (error) {
      console.error('❌ Errore setup listener foreground:', error);
    }
  };

  // 🔧 useEffect che si esegue solo se necessario
  useEffect(() => {
    const currentPermission = getSafePermission();
    setPermission(currentPermission);
    console.log('🔔 Permesso notifiche attuale:', currentPermission);

    // Inizializza solo se non già fatto
    if (!isGloballyInitialized && !initPromise) {
      console.log('🚀 Avviando inizializzazione per la prima volta...');
      initializeOnce().catch(error => {
        console.error('💥 ERRORE CRITICO inizializzazione:', error);
        console.error('💥 Stack trace:', error.stack);
        // Re-throw per vedere l'errore chiaramente
        throw error;
      });
    } else if (isGloballyInitialized) {
      console.log('✅ Sistema già inizializzato, sincronizzando stato...');
      // Se già inizializzato, sincronizza stato locale
      setSwRegistration(globalSwRegistration);
      setToken(globalToken);
    } else {
      console.log('⏳ Inizializzazione in corso, attendendo...');
    }
  }, []); // Array vuoto - esegui solo al mount

  const requestPermission = async () => {
    if (!isNotificationSupported()) {
      toast({
        title: '📱 Non supportato',
        description: 'Le notifiche non sono supportate su questo dispositivo.',
        variant: 'destructive'
      });
      return;
    }

    try {
      console.log('🔔 Richiedendo permesso notifiche...');
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      
      console.log('🔔 Permesso ottenuto:', requestedPermission);
      
      if (requestedPermission === 'granted') {
        // Assicurati che il sistema sia inizializzato
        await initializeOnce();
        
        await setupFCM();
        toast({
          title: '🔔 Notifiche attivate',
          description: 'Riceverai aggiornamenti famiglia!'
        });
      } else {
        toast({
          title: '🔕 Notifiche bloccate',
          description: 'Puoi riabilitarle nelle impostazioni del browser.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Errore permessi:', error);
      toast({
        title: 'Errore notifiche',
        description: 'Impossibile attivare le notifiche',
        variant: 'destructive'
      });
    }
  };

  const testNotification = async () => {
    if (permission !== 'granted') {
      toast({
        title: '⚠️ Permessi necessari',
        description: 'Abilita prima le notifiche',
        variant: 'destructive'
      });
      return;
    }

    try {
      new Notification('🧪 Test Notifica Locale', {
        body: 'Se vedi questa notifica, il sistema funziona!',
        icon: '/FamilyTaskTracker/icon-192.png',
        tag: 'test-notification'
      });

      toast({
        title: '🧪 Test inviato!',
        description: 'Controlla se è apparsa la notifica'
      });

      if (token || globalToken) {
        const currentToken = token || globalToken;
        console.log('🔥 Token FCM per test remoto:', currentToken);
        toast({
          title: '🔑 Token disponibile',
          description: 'Token FCM presente nella console per test remoti'
        });
      } else {
        console.log('⚠️ Nessun token FCM disponibile per test remoto');
      }

    } catch (error) {
      console.error('❌ Errore test notifica:', error);
      toast({
        title: '❌ Errore test',
        description: 'Impossibile inviare notifica di test',
        variant: 'destructive'
      });
    }
  };

  // 🔧 DEBUG: Funzioni di debug integrate
  const getDebugInfo = async () => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    // Firebase env vars
    const firebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN', 
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_FIREBASE_MEASUREMENT_ID',
      'VITE_FIREBASE_VAPID_KEY'
    ];

    const missingVars = firebaseVars.filter(varName => !import.meta.env[varName]);
    
    // Service Worker info
    let swInfo = {
      supported: 'serviceWorker' in navigator,
      registrations: 0,
      activeScope: undefined as string | undefined,
      state: undefined as string | undefined,
      activeSW: !!globalSwRegistration?.active
    };

    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        swInfo.registrations = registrations.length;
        
        if (registrations.length > 0) {
          const activeReg = registrations.find(reg => reg.active);
          if (activeReg) {
            swInfo.activeScope = activeReg.scope;
            swInfo.state = activeReg.active?.state;
          }
        }
      } catch (error) {
        console.error('Error getting SW registrations:', error);
      }
    }

    const debugInfo = {
      environment: {
        isProd: import.meta.env.PROD,
        isDev: import.meta.env.DEV,
        mode: import.meta.env.MODE,
        baseUrl: import.meta.env.VITE_BASE_URL || 'not-set'
      },
      vapidKey: {
        exists: !!vapidKey,
        length: vapidKey?.length || 0,
        preview: vapidKey ? vapidKey.substring(0, 20) + '...' : 'N/A',
        isValid: vapidKey?.length >= 85 && vapidKey?.length <= 90 // Range valido per VAPID keys
      },
      serviceWorker: swInfo,
      notifications: {
        supported: 'Notification' in window,
        permission: permission,
        hasToken: !!(token || globalToken)
      },
      firebase: {
        configLoaded: firebaseVars.length - missingVars.length > 0,
        envVarsCount: firebaseVars.length - missingVars.length,
        missingVars,
        totalVars: firebaseVars.length
      },
      global: {
        isInitialized: isGloballyInitialized,
        hasGlobalSW: !!globalSwRegistration,
        hasGlobalToken: !!globalToken
      }
    };

    console.log('🔍 === FCM DEBUG INFO ===');
    console.table(debugInfo.environment);
    console.table(debugInfo.vapidKey);
    console.table(debugInfo.serviceWorker);
    console.table(debugInfo.notifications);
    console.table(debugInfo.firebase);
    console.table(debugInfo.global);
    console.log('🔍 =====================');

    return debugInfo;
  };

  const runDiagnostics = async () => {
    console.log('🩺 === AVVIO DIAGNOSTICA FCM ===');
    
    try {
      const debugInfo = await getDebugInfo();
      
      // Lista problemi rilevati
      const issues: string[] = [];
      
      if (!debugInfo.vapidKey.exists) {
        issues.push('❌ VAPID Key mancante');
      } else if (!debugInfo.vapidKey.isValid) {
        issues.push(`⚠️ VAPID Key lunghezza insolita: ${debugInfo.vapidKey.length} (normale: 85-90 caratteri)`);
      }
      
      if (!debugInfo.serviceWorker.supported) {
        issues.push('❌ Service Worker non supportato');
      } else if (debugInfo.serviceWorker.registrations === 0) {
        issues.push('⚠️ Nessun Service Worker registrato');
      } else if (!debugInfo.serviceWorker.activeSW) {
        issues.push('⚠️ Service Worker registrato ma non attivo');
      }
      
      if (!debugInfo.notifications.supported) {
        issues.push('❌ Notifiche non supportate');
      } else if (debugInfo.notifications.permission !== 'granted') {
        issues.push(`⚠️ Permesso notifiche: ${debugInfo.notifications.permission}`);
      }
      
      if (debugInfo.firebase.missingVars.length > 0) {
        issues.push(`❌ Variabili Firebase mancanti: ${debugInfo.firebase.missingVars.join(', ')}`);
      }
      
      if (!debugInfo.global.isInitialized) {
        issues.push('⚠️ Sistema non inizializzato');
      }
      
      if (issues.length === 0) {
        console.log('✅ DIAGNOSTICA: Nessun problema rilevato!');
        toast({
          title: '✅ Diagnostica Completata',
          description: 'Nessun problema rilevato nel sistema FCM'
        });
      } else {
        console.log('🚨 PROBLEMI RILEVATI:');
        issues.forEach(issue => console.log('  ' + issue));
        toast({
          title: '🚨 Problemi Rilevati',
          description: `${issues.length} problema(i) trovati. Controlla la console.`,
          variant: 'destructive'
        });
      }
      
      return { debugInfo, issues };
      
    } catch (error) {
      console.error('❌ Errore durante diagnostica:', error);
      toast({
        title: '❌ Errore Diagnostica',
        description: 'Impossibile completare la diagnostica',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const forceReset = async () => {
    try {
      console.log('🔄 RESET FORZATO del sistema FCM...');
      
      // Reset stato globale
      globalSwRegistration = null;
      globalToken = null;
      isGloballyInitialized = false;
      initPromise = null;
      
      // Reset stato locale
      setToken(null);
      setSwRegistration(null);
      setIsRegistering(false);
      
      // Disregistra tutti i service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('🗑️ Service Worker disregistrato:', registration.scope);
        }
      }
      
      console.log('✅ Reset completato');
      toast({
        title: '🔄 Reset Completato',
        description: 'Sistema FCM resettato. Riavvia l\'app per re-inizializzare.'
      });
      
    } catch (error) {
      console.error('❌ Errore durante reset:', error);
      toast({
        title: '❌ Errore Reset',
        description: 'Impossibile completare il reset',
        variant: 'destructive'
      });
    }
  };

  return {
    permission,
    token: token || globalToken,
    isRegistering,
    swRegistration: swRegistration || globalSwRegistration,
    requestPermission,
    testNotification,
    isSupported: isNotificationSupported() && 'serviceWorker' in navigator,
    // 🔧 DEBUG: Funzioni di debug esposte + setupFCM per uso esterno
    debug: {
      getDebugInfo,
      runDiagnostics,
      forceReset,
      isInitialized: isGloballyInitialized,
      hasGlobalSW: !!globalSwRegistration,
      hasGlobalToken: !!globalToken,
      setupFCM // 🔧 ESPONI setupFCM per uso esterno
    }
  };
}