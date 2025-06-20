// client/public/firebase-messaging-sw.js

// 🔥 Aggiornato a Firebase 11 (come nel tuo package.json)
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

// 🔧 Configurazione Firebase hardcoded (service worker non può accedere a env vars)
const firebaseConfig = {
  apiKey: "AIzaSyDnuuXIHf37jS4syWsolJa0YTg_4bN-VUE",
  authDomain: "familytasktracker-c2dfe.firebaseapp.com",
  projectId: "familytasktracker-c2dfe",
  storageBucket: "familytasktracker-c2dfe.firebasestorage.app",
  messagingSenderId: "984085570940",
  appId: "1:984085570940:web:ddc61b61702341939130f9",
  measurementId: "G-2TFQZKTN8G"
};

// 🍎 Try-catch per iOS Safari compatibility
try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handler per notifiche in background
  messaging.onBackgroundMessage((payload) => {
    console.log('🔔 Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || '🏠 Family Task';
    const notificationOptions = {
      body: payload.notification?.body || 'Nuovi aggiornamenti disponibili',
      // 🔥 RIMOSSO: Nessuna icona per evitare 404 errors
      // icon: '/favicon.ico',     // ❌ Causa 404
      // badge: '/favicon.ico',    // ❌ Causa 404
      tag: 'family-task-notification',
      silent: false,
      requireInteraction: false,
      data: payload.data || {}
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  // 🍎 Gestione click notifiche per iOS
  self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked:', event);
    
    event.notification.close();
    
    // 🔧 URL con base path corretto
    const targetUrl = event.notification.data?.url || '/FamilyTaskTracker/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Se c'è già una finestra aperta, focusla
          for (const client of clientList) {
            if (client.url.includes('FamilyTaskTracker') && 'focus' in client) {
              return client.focus();
            }
          }
          // Altrimenti apri nuova finestra
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
    );
  });

} catch (error) {
  console.error('🚨 Firebase service worker error (iOS Safari):', error);
  // 🍎 Fallback silenzioso per iOS che non supporta Firebase messaging
}