// firebase-messaging-sw.js
// Service Worker for handling background Firebase Cloud Messaging notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDhIwBjlR_YEqbsZTx_TT64tO_c8-bhR6M',
  authDomain: 'evolux-b9300.firebaseapp.com',
  projectId: 'evolux-b9300',
  storageBucket: 'evolux-b9300.firebasestorage.app',
  messagingSenderId: '414354486042',
  appId: '1:414354486042:web:53f0d264b1f059570532a3'
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const title = payload.notification?.title || 'VELORA — Nova Venda! 🎉';
  const options = {
    body: payload.notification?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    image: '/logo.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
