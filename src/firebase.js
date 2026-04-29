import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjOTrg7iyBFvAI2DAjG7tWdNbH6PUvL9M",
  authDomain: "leonidas-store.firebaseapp.com",
  projectId: "leonidas-store",
  storageBucket: "leonidas-store.firebasestorage.app",
  messagingSenderId: "482496929819",
  appId: "1:482496929819:web:165cd27d7e06c0701a98be"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);