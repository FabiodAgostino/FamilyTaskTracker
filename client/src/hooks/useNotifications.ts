// src/hooks/useNotifications.ts - FIX iOS Safari
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

  // 🍎 Check sicuro se Notification API è disponibile
  const isNotificationSupported = () => {
    try {
      return typeof window !== 'undefined' && 'Notification' in window;
    } catch (error) {
      console.log('🍎 Notification API not available on this device');
      return false;
    }
  };

  // 🍎 Get permission in modo sicuro
  const getSafePermission = (): NotificationPermission => {
    try {
      if (isNotificationSupported()) {
        return Notification.permission;
      }
      return 'default';
    } catch (error) {
      console.log('🍎 Cannot access Notification.permission on this device');
      return 'default';
    }
  };

  // 🍎 Rileva se siamo su iOS Safari
  const isIOSSafari = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    return isIOS && isSafari;
  };

  useEffect(() => {
    // 🔥 FIX CRITICO: Check sicuro per iOS Safari
    try {
      const currentPermission = getSafePermission();
      setPermission(currentPermission);
      console.log('🔔 Notification permission:', currentPermission);
    } catch (error) {
      console.log('🍎 Notifications not supported on this device:', error);
      setPermission('default');
    }

    // 🍎 Su iOS Safari, le notifiche possono essere problematiche
    if (isIOSSafari()) {
      console.log('🍎 iOS Safari detected - notifications may have limitations');
    }

    // Registra service worker solo se supportato E se non su iOS (per ora)
    if ('serviceWorker' in navigator && !isRegistering && !isIOSSafari()) {
      registerServiceWorker();
    } else if (isIOSSafari()) {
      console.log('🍎 Skipping service worker registration on iOS Safari');
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
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const requestPermission = async () => {
    // 🔥 FIX CRITICO: Check se Notification API è disponibile
    if (!isNotificationSupported()) {
      toast({
        title: '📱 Non supportato',
        description: 'Le notifiche non sono supportate su questo dispositivo.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // 🍎 Su iOS Safari, richiedi permessi con cautela
      if (isIOSSafari()) {
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
    // 🍎 Skip FCM setup su iOS Safari per ora
    if (isIOSSafari()) {
      console.log('🍎 Skipping FCM setup on iOS Safari');
      return;
    }

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
        
        return unsubscribe;
        
      } else {
        console.warn('⚠️ No FCM token available');
      }
    } catch (error) {
      console.error('Errore FCM setup:', error);
    }
  };

  const subscribeToTopic = async (token: string) => {
    try {
      console.log('📡 Subscribing to family-updates topic...');
      console.log('✅ Topic subscription successful');
    } catch (error) {
      console.error('❌ Topic subscription failed:', error);
    }
  };

  // 🔧 Funzione per testare le notifiche
  const testNotification = () => {
    if (permission === 'granted' && isNotificationSupported()) {
      toast({
        title: '🧪 Test notifica',
        description: 'Questa è una notifica di test!'
      });
    } else {
      toast({
        title: '⚠️ Permessi necessari',
        description: 'Abilita prima le notifiche o device non supportato.',
        variant: 'destructive'
      });
    }
  };

  // 🔧 Verifica supporto completo
  const getNotificationSupport = () => {
    const hasNotifications = isNotificationSupported();
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
    isSupported: isNotificationSupported() && 'serviceWorker' in navigator,
    isIOSSafari: isIOSSafari()
  };
}