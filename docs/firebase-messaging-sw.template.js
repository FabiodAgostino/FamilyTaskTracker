// client/public/firebase-messaging-sw.template.js
// 🔥 Template Service Worker - I placeholder verranno sostituiti durante il build

// 🔥 Aggiornato a Firebase 11
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

// 🔧 Configurazione Firebase da variabili d'ambiente (placeholder)
const firebaseConfig = {
  apiKey: "__VITE_FIREBASE_API_KEY__",
  authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket: "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__VITE_FIREBASE_APP_ID__",
  measurementId: "__VITE_FIREBASE_MEASUREMENT_ID__"
};

// 🔧 Configurazioni da variabili d'ambiente
const APP_CONFIG = {
  appName: "__VITE_APP_NAME__",
  baseUrl: "__VITE_BASE_URL__",
  environment: "__VITE_APP_ENVIRONMENT__",
  version: "__VITE_APP_VERSION__"
};

// 🍎 Try-catch per iOS Safari compatibility
try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  console.log(`🔔 Service Worker inizializzato per ${APP_CONFIG.appName} v${APP_CONFIG.version}`);
  console.log(`🌍 Environment: ${APP_CONFIG.environment}`);

  // Handler per notifiche in background
  messaging.onBackgroundMessage((payload) => {
    console.log('🔔 Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || `🏠 ${APP_CONFIG.appName}`;
    const notificationOptions = {
      body: payload.notification?.body || 'Nuovi aggiornamenti disponibili',
      tag: 'family-task-notification',
      silent: false,
      requireInteraction: false,
      data: {
        ...payload.data,
        timestamp: Date.now(),
        version: APP_CONFIG.version
      }
    };

    // 🔔 Log per debugging (solo in development)
    if (APP_CONFIG.environment === 'development') {
      console.log('🔔 Showing notification:', notificationTitle, notificationOptions);
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  // 🍎 Gestione click notifiche
  self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked:', event);
    
    event.notification.close();
    
    // 🔧 URL con base path da variabile d'ambiente
    const targetUrl = event.notification.data?.url || APP_CONFIG.baseUrl;
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Se c'è già una finestra aperta, focusla
          for (const client of clientList) {
            if (client.url.includes(APP_CONFIG.appName.replace(/\s+/g, '')) && 'focus' in client) {
              return client.focus();
            }
          }
          // Altrimenti apri nuova finestra
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
        .catch(error => {
          console.error('🚨 Errore apertura finestra:', error);
        })
    );
  });

  // 🔄 Gestione aggiornamenti service worker
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      console.log('🔄 Service Worker: SKIP_WAITING ricevuto');
      self.skipWaiting();
    }
  });

  // 📊 Service Worker installato
  self.addEventListener('install', (event) => {
    console.log(`✅ Service Worker v${APP_CONFIG.version} installato`);
    self.skipWaiting();
  });

  // 🔄 Service Worker attivato
  self.addEventListener('activate', (event) => {
    console.log(`🚀 Service Worker v${APP_CONFIG.version} attivato`);
    event.waitUntil(clients.claim());
  });

} catch (error) {
  console.error('🚨 Firebase service worker error:', error);
  
  // 🍎 Fallback per iOS Safari o altri browser non supportati
  console.log('🍎 Browser non supporta Firebase messaging, continuando senza notifiche push');
  
  // Mantieni comunque il service worker base attivo
  self.addEventListener('install', () => {
    console.log('📱 Service Worker base installato (senza Firebase)');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', () => {
    console.log('📱 Service Worker base attivato (senza Firebase)');
    self.skipWaiting();
  });
}