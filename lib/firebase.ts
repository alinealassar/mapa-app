import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAjaL7N_6uUAt6zQt-zhksTI-7vLsrbB8k",
  authDomain: "mapa-app-38b08.firebaseapp.com",
  projectId: "mapa-app-38b08",
  storageBucket: "mapa-app-38b08.firebasestorage.app",
  messagingSenderId: "871545322816",
  appId: "1:871545322816:web:92fe642ced4d8cffa08ea5",
  measurementId: "G-DK0G0R06YR"
};

// Inicializa o Firebase apenas se ainda não foi inicializado
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Messaging | undefined;

// O Messaging só funciona no lado do cliente (browser)
if (typeof window !== "undefined") {
  messaging = getMessaging(app);
}

export { app, messaging };
