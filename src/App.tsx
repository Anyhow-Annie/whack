import { AuthProvider, useAuth } from './auth/AuthProvider'
import { SetupScreen } from './components/SetupScreen'
import { SignInPage } from './pages/SignInPage'
import { Workspace } from './pages/Workspace'

function AppGate() {
  const { preview, loading, user, enterPreview } = useAuth()

  if (loading) {
    return <p className="status">Checking your session…</p>
  }

  if (!user) {
    return preview ? <SetupScreen onEnter={enterPreview} /> : <SignInPage />
  }

  return <Workspace />
}

export function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  )
}
