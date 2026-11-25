import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}
const required = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
}
const missing = Object.entries(required).filter(([, value]) => !String(value ?? '').trim()).map(([name]) => name)
if (missing.length) throw new Error(`Thiếu cấu hình Firebase: ${missing.join(', ')}`)

// Reuse the default app across Vite hot reloads without reinitializing Auth/Firestore.
export const firebaseApp = getApps().some((app) => app.name === '[DEFAULT]') ? getApp() : initializeApp(firebaseConfig)
// Only the admin area signs in. Teachers can create assessments anonymously.
export const firebaseAuth = getAuth(firebaseApp)
export const firestoreDatabase = getFirestore(firebaseApp)