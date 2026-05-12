// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAjaL7N_6uUAt6zQt-zhksTI-7vLsrbB8k",
  authDomain: "mapa-app-38b08.firebaseapp.com",
  projectId: "mapa-app-38b08",
  storageBucket: "mapa-app-38b08.firebasestorage.app",
  messagingSenderId: "871545322816",
  appId: "1:871545322816:web:92fe642ced4d8cffa08ea5",
  measurementId: "G-DK0G0R06YR"
});

const messaging = firebase.messaging();

// Gerencia as mensagens quando o app está em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Mensagem em segundo plano recebida: ", payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/favicon.ico", // Você pode trocar por um ícone da Lis depois
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
