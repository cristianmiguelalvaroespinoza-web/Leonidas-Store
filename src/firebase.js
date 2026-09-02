import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Importación necesaria

const firebaseConfig = {
  apiKey: "AIzaSyCjOTrg7iyBFvAI2DAjG7tWdNbH6PUvL9M",
  authDomain: "leonidas-store.firebaseapp.com",
  projectId: "leonidas-store",
  storageBucket: "leonidas-store.firebasestorage.app",
  messagingSenderId: "482496929819",
  appId: "1:482496929819:web:165cd27d7e06c0701a98be"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar los servicios
const db = getFirestore(app);
const auth = getAuth(app); // <--- ESTO ES LO QUE FALTABA DEFINIR

// Exportar ambos para que AdminVentasView.jsx los pueda usar
export { db, auth };