// 🔥 Generated Service Worker - DO NOT EDIT MANUALLY
// Generated at: 2025-06-26T13:30:27.459Z
// Environment: development
// Version: 1.0.0

// client/public/firebase-messaging-sw.template.js
// 🔥 Template Service Worker - I placeholder verranno sostituiti durante il build

// 🔥 Aggiornato a Firebase 11
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

// 🔧 Configurazione Firebase da variabili d'ambiente (placeholder)
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// 🔧 Configurazioni da variabili d'ambiente
const APP_CONFIG = {
  appName: "Family Task Tracker",
  baseUrl: "/FamilyTaskTracker/",
  environment: "development",
  version: "1.0.0"
};

// 🍎 Try-catch per iOS Safari compatibility
try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();


  // Handler per notifiche in background
  messaging.onBackgroundMessage((payload) => {
    
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


    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  // 🍎 Gestione click notifiche
  self.addEventListener('notificationclick', (event) => {
    
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
      self.skipWaiting();
    }
  });

  // 📊 Service Worker installato
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  // 🔄 Service Worker attivato
  self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
  });

} catch (error) {
  console.error('🚨 Firebase service worker error:', error);
  
  self.addEventListener('install', () => {
    self.skipWaiting();
  });
  
  self.addEventListener('activate', () => {
    self.skipWaiting();
  });
}