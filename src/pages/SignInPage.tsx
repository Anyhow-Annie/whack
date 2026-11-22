import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { formatFirebaseError } from '../lib/errors'
import { getServices } from '../lib/firebase'

export function SignInPage() {
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const auth = getServices().auth
      if (mode === 'create') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() })
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (caught) {
      setError(formatFirebaseError(caught))
    } finally {
      setPending(false)
    }
  }

  async function signInWithGoogle() {
    setPending(true)
    setError(null)
    try {
      await signInWithPopup(getServices().auth, new GoogleAuthProvider())
    } catch (caught) {
      setError(formatFirebaseError(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen">
      <h1>Living Organizational Memory</h1>
      <p className="lede">Sign in to find project knowledge and keep the next team from starting over.</p>
      <form className="card" onSubmit={onSubmit}>
        <h2>{mode === 'create' ? 'Create your account' : 'Sign in'}</h2>
        {mode === 'create' ? (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>{mode === 'create' ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="secondary" disabled={pending} onClick={signInWithGoogle}>
          Continue with Google
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setMode(mode === 'create' ? 'sign-in' : 'create')}
        >
          {mode === 'create' ? 'I already have an account' : 'Create an account'}
        </button>
      </form>
    </main>
  )
}
