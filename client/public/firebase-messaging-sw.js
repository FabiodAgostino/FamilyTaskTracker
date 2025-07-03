// 🔥 Service Worker Ottimizzato per iOS
console.log('🔥 FCM SW: Starting (iOS Compatible)...');

// 📱 Rileva piattaforma
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
console.log('📱 Platform detected:', isIOS ? 'iOS' : 'Other');

// 📦 Install event  
self.addEventListener('install', (event) => {
  console.log('📦 SW: Install event');
  self.skipWaiting();
});

// 🚀 Activate event
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: Activate event');
  event.waitUntil(clients.claim());
});

// 📬 Push event - Gestione Avanzata iOS
self.addEventListener('push', (event) => {
  console.log('📬 Push received:', event);
  
  let payload = {};
  let notificationData = {};
  
  try {
    if (event.data) {
      // 🔧 Parse dati FCM
      const text = event.data.text();
      payload = JSON.parse(text);
      console.log('📦 FCM payload:', payload);
      
      // 🍎 Gestione formato iOS/Android
      notificationData = payload.notification || {};
      if (payload.data) {
        notificationData.data = payload.data;
      }
    }
  } catch (error) {
    console.log('⚠️ Parse error, using fallback');
    notificationData = {
      title: '🏠 Family Task Tracker',
      body: 'Nuova notifica famiglia'
    };
  }

  const title = notificationData.title || '🏠 Family Task Tracker';
  const options = {
    body: notificationData.body || 'Nuova attività',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'family-task',
    requireInteraction: isIOS, // 🍎 iOS richiede interazione
    data: {
      ...notificationData.data,
      timestamp: Date.now(),
      platform: isIOS ? 'iOS' : 'other',
      originalPayload: payload
    },
    // 🍎 iOS Settings
    silent: false,
    renotify: true
  };

  console.log('🔔 Showing notification:', title, options);
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🖱️ Notification click - Fix iOS URL
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event.notification);
  
  event.notification.close();
  
  // 🍎 iOS: Gestione URL personalizzati
  let targetUrl = '/';
  
  try {
    const data = event.notification.data || {};
    targetUrl = data.url || data.click_action || '/';
    
    // 🔧 Se abbiamo payload originale FCM
    if (data.originalPayload?.data?.url) {
      targetUrl = data.originalPayload.data.url;
    }
    
    console.log('🎯 Target URL:', targetUrl);
  } catch (error) {
    console.log('⚠️ URL parsing error:', error);
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 🔍 Cerca finestra esistente
        for (const client of clientList) {
          if (client.url.includes(location.origin) && 'focus' in client) {
            console.log('👀 Focusing existing window');
            // 💬 Invia messaggio per navigazione custom
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: targetUrl
            });
            return client.focus();
          }
        }
        
        // 🆕 Apri nuova finestra
        console.log('🆕 Opening new window:', targetUrl);
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
      .catch(error => {
        console.error('❌ Click handling error:', error);
      })
  );
});

// 💬 Message handler per navigazione custom
self.addEventListener('message', (event) => {
  console.log('💬 Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ SW: Ready (iOS Compatible)');