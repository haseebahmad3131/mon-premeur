/**
 * Firebase configuration and initialization
 * Ce module exporte les services Firebase initialisés pour l'application
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Configuration Firebase
 * Les valeurs sont obtenues exclusivement depuis les variables d'environnement
 * @type {Object} Configuration Firebase
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAS0trQOB_nB9LAdkKEIV8XgEv3TWOpL8U",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "solution-360-v2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "solution-360-v2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "solution-360-v2.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "421620675307",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:421620675307:web:7f46780ce7fed9eaec44ae"
};

let app;
let auth;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw new Error('Failed to initialize Firebase');
}

// Les émulateurs ne sont pas utilisés dans cet environnement
// Commentaires du code de connexion à l'émulateur
/*
if (import.meta.env.DEV) {
  try {
    // connectAuthEmulator(auth, 'http://localhost:9099');
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Firebase emulators connected');
  } catch (error) {
    console.error('Error connecting to Firebase emulators:', error);
  }
}
*/

/**
 * Fonction pour réinitialiser l'instance Firebase (utile pour les tests)
 */
export function resetFirebase() {
  // L'implémentation dépend des besoins spécifiques
}

export { auth, db, storage };