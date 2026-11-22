import { type FirebaseOptions, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

export const FUNCTIONS_REGION = 'us-central1'

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

type ReadyConfig = {
  ok: true
  options: FirebaseOptions
  useEmulators: boolean
}

type MissingConfig = {
  ok: false
  missing: string[]
}

export function isLocalPreview(): boolean {
  return !readFirebaseConfig().ok
}

export function readFirebaseConfig(): ReadyConfig | MissingConfig {
  const missing = REQUIRED_ENV.filter((key) => !import.meta.env[key]?.trim())
  if (missing.length > 0) {
    return { ok: false, missing: [...missing] }
  }

  return {
    ok: true,
    useEmulators: import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true',
    options: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    },
  }
}

type FirebaseServices = {
  auth: ReturnType<typeof getAuth>
  db: ReturnType<typeof getFirestore>
  storage: ReturnType<typeof getStorage>
  functions: ReturnType<typeof getFunctions>
  useEmulators: boolean
}

const globalFirebase = globalThis as { __lomFirebase?: FirebaseServices }

export function getServices(): FirebaseServices {
  if (globalFirebase.__lomFirebase) return globalFirebase.__lomFirebase

  const config = readFirebaseConfig()
  if (!config.ok) {
    throw new Error('Firebase environment variables are missing.')
  }

  const app = initializeApp(config.options)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)
  const functions = getFunctions(app, FUNCTIONS_REGION)

  if (config.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  globalFirebase.__lomFirebase = { auth, db, storage, functions, useEmulators: config.useEmulators }
  return globalFirebase.__lomFirebase
}
