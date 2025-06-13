// src/hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useToast } from './use-toast';

const vapidKey = 'BHvJqEIDOQuhXFouxEo9drLiqJpatiR-25GUZxorXO5GaA8viMvouU9N3oQ7wtmgCFCx3eDW_JP62fHHxAfGlNw';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Controlla permessi attuali
    setPermission(Notification.permission);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await setupFCM();
        toast({
          title: '🔔 Notifiche attivate',
          description: 'Riceverai aggiornamenti famiglia!'
        });
      }
    } catch (error) {
      console.error('Errore permessi:', error);
      toast({
        title: 'Errore notifiche',
        description: 'Impossibile attivare le notifiche',
        variant: 'destructive'
      });
    }
  };

  const setupFCM = async () => {
    try {
      const messaging = getMessaging();
      
      // Ottieni token FCM
      const currentToken = await getToken(messaging, { vapidKey });
      
      if (currentToken) {
        setToken(currentToken);
        console.log('FCM Token:', currentToken);
        
        // TODO: Salva token nel database per l'utente
        await subscribeToTopic(currentToken);
        
        // Handler per messaggi in foreground
        onMessage(messaging, (payload) => {
          console.log('Foreground message:', payload);
          toast({
            title: payload.notification?.title || 'Nuovo aggiornamento',
            description: payload.notification?.body || 'Controlla l\'app'
          });
        });
      }
    } catch (error) {
      console.error('Errore FCM setup:', error);
    }
  };

  const subscribeToTopic = async (token: string) => {
    // TODO: Chiamata API per iscrivere al topic 'family-updates'
    console.log('TODO: Subscribe to topic family-updates');
  };

  return {
    permission,
    token,
    requestPermission,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator
  };
}