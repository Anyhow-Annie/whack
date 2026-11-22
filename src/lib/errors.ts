import { FirebaseError } from 'firebase/app'

export function formatFirebaseError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password did not match.'
      case 'auth/email-already-in-use':
        return 'An account already exists for that email.'
      case 'auth/weak-password':
        return 'Use at least 6 characters.'
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
      case 'auth/popup-closed-by-user':
        return 'The sign-in window was closed.'
      case 'functions/unauthenticated':
        return 'Sign in again before continuing.'
      case 'functions/permission-denied':
        return error.message || 'You do not have permission to do that.'
      case 'functions/not-found':
      case 'functions/unavailable':
        return 'The backend function is not available. Deploy Cloud Functions or start the emulators.'
      default:
        return error.message
    }
  }

  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
