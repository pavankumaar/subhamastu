import { useCallback, useEffect, useState } from 'react'
import App from '../App'
import { WeddingProvider } from '../context/WeddingContext'
import { disableGoogleAutoSelect } from './google'
import { LoginScreen } from './LoginScreen'
import { loadSession, loggedOutEvent, logout, refreshProfile, type AuthProfile, type AuthSession } from './session'

export function AuthGate() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const sessionToken = session?.token

  useEffect(() => {
    // Fired by authFetch when the server rejects the stored session.
    const handleLoggedOut = () => setSession(null)
    window.addEventListener(loggedOutEvent, handleLoggedOut)
    return () => window.removeEventListener(loggedOutEvent, handleLoggedOut)
  }, [])

  const updateProfile = useCallback((profile: AuthProfile) => {
    setSession((current) => (current ? { ...current, profile } : current))
  }, [])

  // Sessions saved before Google sign-in existed lack the newer profile fields; fetch the current ones.
  useEffect(() => {
    if (!sessionToken) return
    refreshProfile().then(updateProfile).catch(() => {})
  }, [sessionToken, updateProfile])

  async function handleLogout() {
    disableGoogleAutoSelect()
    await logout()
    setSession(null)
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />
  }

  return (
    <WeddingProvider key={session.profile.id}>
      <App profile={session.profile} onLogout={handleLogout} onProfileChange={updateProfile} />
    </WeddingProvider>
  )
}
