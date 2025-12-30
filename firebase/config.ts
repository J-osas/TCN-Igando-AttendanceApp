import { initializeApp, getApps } from 'firebase/app';
// Fixing firestore import error: Ensuring getFirestore is correctly imported from modular SDK
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAia5FAoouHP17b5RcxMDPFWcciqkHNJq8",
  authDomain: "crossover-service-2025.firebaseapp.com",
  projectId: "crossover-service-2025",
  storageBucket: "crossover-service-2025.firebasestorage.app",
  messagingSenderId: "112994722700",
  appId: "1:112994722700:web:d1b61c11eb135b39eaeca9"
};

// Initialize Firebase using the modular SDK pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);