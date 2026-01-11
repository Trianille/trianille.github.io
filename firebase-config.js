// Конфигурация Firebase - ЗАМЕНИТЕ на свою!
const firebaseConfig = {
    apiKey: "AIzaSyARjHo31bujB14BavNlYaiC4Q4GK7zqEWY",
    authDomain: "webappjp-f68a2.firebaseapp.com",
    projectId: "webappjp-f68a2",
    storageBucket: "webappjp-f68a2.firebasestorage.app",
    messagingSenderId: "404634215374",
    appId: "1:404634215374:web:0ec16a9f5f9c2de726819f",
    measurementId: "G-Q0XZ2MGX9T"
  };

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();