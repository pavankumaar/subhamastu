import { AlertTriangle, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchGoogleClientId, isInAppBrowser, releaseGoogleHandler, renderGoogleButton } from './google'

type Status = 'loading' | 'ready' | 'hidden' | 'in-app' | 'failed'

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void
  text?: 'continue_with' | 'signin_with'
  // Shown under the button (e.g. "or use username & PIN") only when Google sign-in is offered.
  dividerLabel?: string
  disabled?: boolean
}

export function GoogleSignInButton({ onCredential, text = 'continue_with', dividerLabel, disabled }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handlerRef = useRef(onCredential)
  const [status, setStatus] = useState<Status>('loading')
  const [failure, setFailure] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    handlerRef.current = onCredential
  })

  useEffect(() => {
    let isActive = true
    const handler = (credential: string) => handlerRef.current(credential)
    fetchGoogleClientId().then((clientId) => {
      if (!isActive) return
      if (!clientId) return setStatus('hidden')
      if (isInAppBrowser()) return setStatus('in-app')
      const container = containerRef.current
      if (!container) return
      renderGoogleButton(container, clientId, handler, text)
        .then(() => isActive && setStatus('ready'))
        .catch((error: unknown) => {
          if (!isActive) return
          setFailure(error instanceof Error ? error.message : 'Google sign-in is unavailable right now.')
          setStatus('failed')
        })
    })
    return () => {
      isActive = false
      releaseGoogleHandler(handler)
    }
  }, [text])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (status === 'hidden') return null

  return (
    <div className="space-y-4">
      {status === 'in-app' ? (
        <div className="space-y-2 rounded-2xl border border-brass-line bg-silk p-3.5 text-xs leading-relaxed text-charcoal">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blush-deep" />
            Google sign-in doesn't work inside this app's built-in browser. Open this page in Chrome or Safari (menu ⋮ → "Open in
            browser"), or use your username and PIN below.
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-brass-line bg-ivory px-3 text-xs font-semibold"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      ) : (
        <div className={disabled ? 'pointer-events-none opacity-60' : ''} aria-busy={status === 'loading'}>
          {/* Google draws its own button in here; the fixed height avoids a layout jump while it loads. */}
          <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />
          {status === 'failed' ? <p className="mt-1 text-center text-[11px] text-blush-deep">{failure}</p> : null}
        </div>
      )}
      {dividerLabel ? (
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-taupe">
          <span className="h-px flex-1 bg-brass-line" />
          {dividerLabel}
          <span className="h-px flex-1 bg-brass-line" />
        </div>
      ) : null}
    </div>
  )
}
