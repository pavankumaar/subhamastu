import { useEffect, useState } from 'react'
import App from '../App'
import { WeddingProvider } from '../context/WeddingContext'
import { LoginScreen } from './LoginScreen'
import { loadSession, loggedOutEvent, logout, type AuthSession } from './session'

export function AuthGate() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  useEffect(() => {
    // Fired by authFetch when the server rejects the stored session.
    const handleLoggedOut = () => setSession(null)
    window.addEventListener(loggedOutEvent, handleLoggedOut)
    return () => window.removeEventListener(loggedOutEvent, handleLoggedOut)
  }, [])

  async function handleLogout() {
    await logout()
    setSession(null)
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />
  }

  return (
    <WeddingProvider key={session.profile.id}>
      <App profile={session.profile} onLogout={handleLogout} />
    </WeddingProvider>
  )
}
