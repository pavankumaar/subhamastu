import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { SheetModal } from '../components/ScreenChrome'
import { GoogleSignInButton } from './GoogleSignInButton'
import { linkGoogle, type AuthProfile } from './session'

export function ConnectGoogleSheet({ onConnected, onClose }: { onConnected: (profile: AuthProfile) => void; onClose: () => void }) {
  const [error, setError] = useState('')
  const [isLinking, setLinking] = useState(false)

  async function handleCredential(credential: string) {
    setLinking(true)
    setError('')
    try {
      onConnected(await linkGoogle(credential))
      onClose()
    } catch (linkFailure) {
      setError(linkFailure instanceof Error ? linkFailure.message : 'Could not connect Google. Please try again.')
    } finally {
      setLinking(false)
    }
  }

  return (
    <SheetModal title="Connect Google" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-charcoal">
          Sign in with Google once here. After that you can use <span className="font-semibold">Continue with Google</span> on any device
          and open this same planner — your username and PIN keep working too.
        </p>
        <GoogleSignInButton onCredential={handleCredential} disabled={isLinking} />
        {isLinking ? <p className="text-center text-xs text-muted-taupe">Connecting…</p> : null}
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-blush-soft px-3 py-2.5 text-xs text-blush-deep">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    </SheetModal>
  )
}
