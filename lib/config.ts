/**
 * Firebase Configuration
 * Club BZR - Experimental Art Community
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, type Analytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyaEBwqehRKoNWCmWSLklZuViP0_P2KGk",
  authDomain: "club-bzr.firebaseapp.com",
  projectId: "club-bzr",
  storageBucket: "club-bzr.firebasestorage.app",
  messagingSenderId: "272639933450",
  appId: "1:272639933450:web:5d2b2241031c5f8e4533f3"
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

// Initialize Analytics (client-side only)
export function initializeAnalytics(): Analytics | null {
  if (typeof window !== 'undefined' && !analytics) {
    try {
      analytics = getAnalytics(app);
    } catch (error) {
      console.warn('Analytics initialization failed:', error);
    }
  }
  return analytics;
}

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  const authHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  const firestoreHost = import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const storageHost = import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });

  const [firestoreHostname, firestorePort] = firestoreHost.split(':');
  connectFirestoreEmulator(db, firestoreHostname, parseInt(firestorePort));

  const [storageHostname, storagePort] = storageHost.split(':');
  connectStorageEmulator(storage, storageHostname, parseInt(storagePort));

  console.log('🔧 Connected to Firebase emulators');
}

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  ARTISTS: 'artists',
  ARTIST_FOLLOWS: 'artistFollows',
  SESSIONS: 'sessions',
  QUESTS: 'quests',
  QUEST_SUBMISSIONS: 'questSubmissions',
  COMMUNITY_POSTS: 'communityPosts',
  EXHIBITIONS: 'exhibitions',
  ART_LOCATIONS: 'artLocations',
  RADIO_CONTENT: 'radioContent',
  CREATIVE_PASSPORTS: 'creativePassports',
  MATCHES: 'matches',
  PROMPTS: 'prompts',
  NOTIFICATIONS: 'notifications',
} as const;

// Storage paths
export const STORAGE_PATHS = {
  AVATARS: 'avatars',
  PORTFOLIOS: 'portfolios',
  SESSIONS: 'sessions',
  QUESTS: 'quests',
  COMMUNITY: 'community',
  EXHIBITIONS: 'exhibitions',
  LOCATIONS: 'locations',
  RADIO: 'radio',
} as const;

export { app, auth, db, storage, analytics };
