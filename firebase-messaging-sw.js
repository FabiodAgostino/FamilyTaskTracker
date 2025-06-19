// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDnuuXIHf37jS4syWsolJa0YTg_4bN-VUE",
  authDomain: "familytasktracker-c2dfe.firebaseapp.com",
  projectId: "familytasktracker-c2dfe",
  storageBucket: "familytasktracker-c2dfe.firebasestorage.app",
  messagingSenderId: "984085570940",
  appId: "1:984085570940:web:ddc61b61702341939130f9",
  measurementId: "G-2TFQZKTN8G"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handler per notifiche in background
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || '🏠 Family Task';
  const notificationOptions = {
    body: payload.notification?.body || 'Nuovi aggiornamenti disponibili',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});