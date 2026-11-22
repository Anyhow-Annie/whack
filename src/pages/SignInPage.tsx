
import { useState, type FormEvent } from 'react'
import { getSupabase } from '../lib/supabase'

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
      const supabase = getSupabase()

      if (mode === 'create') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        })

        if (error) throw error

        setError(
          'Account created. Check your email to confirm your account before signing in.',
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen">
      <h1>Living Organizational Memory</h1>
      <p className="lede">
        Sign in to find project knowledge and keep the next team from starting over.
      </p>

      <form className="card" onSubmit={onSubmit}>
        <h2>{mode === 'create' ? 'Create your account' : 'Sign in'}</h2>

        {mode === 'create' ? (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
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

        <button type="submit" disabled={pending}>
          {pending
            ? 'Please wait...'
            : mode === 'create'
              ? 'Create account'
              : 'Sign in'}
        </button>

        <button
          type="button"
          className="ghost"
          disabled={pending}
          onClick={() => {
            setMode(mode === 'create' ? 'sign-in' : 'create')
            setError(null)
          }}
        >
          {mode === 'create'
            ? 'I already have an account'
            : 'Create an account'}
        </button>
      </form>
    </main>
  )
}
