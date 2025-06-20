// src/hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useToast } from './use-toast';

const vapidKey = 'BHvJqEIDOQuhXFouxEo9drLiqJpatiR-25GUZxorXO5GaA8viMvouU9N3oQ7wtmgCFCx3eDW_JP62fHHxAfGlNw';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { toast } = useToast();

  // 🍎 Rileva se siamo su iOS Safari
  const isIOSSafari = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    return isIOS && isSafari;
  };

  useEffect(() => {
    // Controlla permessi attuali
    setPermission(Notification.permission);

    // 🍎 Su iOS Safari, le notifiche possono essere problematiche
    if (isIOSSafari()) {
      console.log('🍎 iOS Safari detected - notifications may have limitations');
    }

    // Registra service worker se supportato
    if ('serviceWorker' in navigator && !isRegistering) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    setIsRegistering(true);
    
    try {
      // 🔧 Base path corretto per GitHub Pages
      const swPath = import.meta.env.PROD 
        ? '/FamilyTaskTracker/firebase-messaging-sw.js'
        : '/firebase-messaging-sw.js';
      
      console.log('🔧 Registering service worker:', swPath);
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: import.meta.env.PROD ? '/FamilyTaskTracker/' : '/'
      });
      
      console.log('✅ Service Worker registered successfully:', registration);
      setSwRegistration(registration);
      
      // 🔧 Assicurati che il service worker sia attivo
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      
      // 🍎 Su iOS Safari, fallimento service worker non deve bloccare l'app
      if (isIOSSafari()) {
        console.log('🍎 Service worker failed on iOS Safari - continuing without notifications');
      } else {
        toast({
          title: 'Avviso notifiche',
          description: 'Service worker non disponibile. Notifiche limitate.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const requestPermission = async () => {
    try {
      // 🍎 Su iOS Safari, richiedi permessi con cautela
      if (isIOSSafari() && Notification.permission === 'default') {
        toast({
          title: '📱 Permesso richiesto',
          description: 'Su iPhone, conferma il permesso nelle impostazioni del browser.'
        });
      }

      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      
      if (requestedPermission === 'granted') {
        await setupFCM();
        toast({
          title: '🔔 Notifiche attivate',
          description: 'Riceverai aggiornamenti famiglia!'
        });
      } else if (requestedPermission === 'denied') {
        toast({
          title: '🔕 Notifiche bloccate',
          description: 'Puoi riabilitarle nelle impostazioni del browser.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Errore permessi:', error);
      
      // 🍎 Messaggio specifico per iOS
      const description = isIOSSafari() 
        ? 'Su iPhone, abilita le notifiche nelle impostazioni Safari.'
        : 'Impossibile attivare le notifiche';
      
      toast({
        title: 'Errore notifiche',
        description,
        variant: 'destructive'
      });
    }
  };

  const setupFCM = async () => {
    try {
      const messaging = getMessaging();
      
      // 🔧 Usa service worker registration se disponibile
      const tokenOptions: any = { vapidKey };
      if (swRegistration) {
        tokenOptions.serviceWorkerRegistration = swRegistration;
      }
      
      // Ottieni token FCM
      const currentToken = await getToken(messaging, tokenOptions);
      
      if (currentToken) {
        setToken(currentToken);
        console.log('📱 FCM Token obtained:', currentToken.substring(0, 20) + '...');
        
        // Salva token nel database per l'utente
        await subscribeToTopic(currentToken);
        
        // 🔧 Handler per messaggi in foreground
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log('🔔 Foreground message received:', payload);
          
          toast({
            title: payload.notification?.title || 'Nuovo aggiornamento',
            description: payload.notification?.body || 'Controlla l\'app'
          });
        });
        
        // 🔧 Cleanup function per rimuovere listener
        return unsubscribe;
        
      } else {
        console.warn('⚠️ No FCM token available');
        
        if (isIOSSafari()) {
          toast({
            title: '📱 Info iPhone',
            description: 'Le notifiche push potrebbero non essere completamente supportate su questo dispositivo.'
          });
        }
      }
    } catch (error) {
      console.error('Errore FCM setup:', error);
      
      // 🍎 Non bloccare l'app su iOS se FCM fallisce
      if (!isIOSSafari()) {
        toast({
          title: 'Errore configurazione',
          description: 'Impossibile configurare le notifiche Firebase.',
          variant: 'destructive'
        });
      }
    }
  };

  const subscribeToTopic = async (token: string) => {
    try {
      // TODO: Implementa chiamata API per iscrivere al topic 'family-updates'
      console.log('📡 Subscribing to family-updates topic...');
      
      // Esempio di chiamata API:
      // const response = await fetch('/api/subscribe-topic', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ token, topic: 'family-updates' })
      // });
      
      console.log('✅ Topic subscription successful');
      
    } catch (error) {
      console.error('❌ Topic subscription failed:', error);
    }
  };

  // 🔧 Funzione per testare le notifiche
  const testNotification = () => {
    if (permission === 'granted') {
      toast({
        title: '🧪 Test notifica',
        description: 'Questa è una notifica di test!'
      });
    } else {
      toast({
        title: '⚠️ Permessi necessari',
        description: 'Abilita prima le notifiche.',
        variant: 'destructive'
      });
    }
  };

  // 🔧 Verifica supporto completo
  const getNotificationSupport = () => {
    const hasNotifications = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPermission = permission === 'granted';
    const hasToken = !!token;
    
    return {
      hasNotifications,
      hasServiceWorker,
      hasPermission,
      hasToken,
      isFullySupported: hasNotifications && hasServiceWorker && hasPermission && hasToken,
      isIOSSafari: isIOSSafari()
    };
  };

  return {
    permission,
    token,
    isRegistering,
    swRegistration,
    requestPermission,
    testNotification,
    getNotificationSupport,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator,
    isIOSSafari: isIOSSafari()
  };
}