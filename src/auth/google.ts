import { apiUrl } from '../apiBase'

// Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client).
interface GoogleCredentialResponse {
  credential?: string
}
interface GoogleIdApi {
  initialize: (options: Record<string, unknown>) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  disableAutoSelect: () => void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

let clientIdPromise: Promise<string> | null = null
let scriptPromise: Promise<GoogleIdApi> | null = null
let initializedFor = ''
// Only one Google button is on screen at a time; it registers where credentials should go.
let activeHandler: ((credential: string) => void) | null = null

export function fetchGoogleClientId() {
  clientIdPromise ??= fetch(apiUrl('/api/auth/config'))
    .then((response) => (response.ok ? response.json() : {}))
    .then((body: { googleClientId?: unknown }) => (typeof body.googleClientId === 'string' ? body.googleClientId : ''))
    .catch(() => {
      clientIdPromise = null
      return ''
    })
  return clientIdPromise
}

function loadScript() {
  scriptPromise ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const ready = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in unavailable.')))
    if (window.google?.accounts?.id) return ready()
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = ready
    script.onerror = () => {
      script.remove()
      scriptPromise = null
      reject(new Error("Google sign-in couldn't load. Check your connection and try again."))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
  text: 'continue_with' | 'signin_with' = 'continue_with',
) {
  const api = await loadScript()
  activeHandler = onCredential
  if (initializedFor !== clientId) {
    api.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => {
        if (response.credential) activeHandler?.(response.credential)
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_button: true,
    })
    initializedFor = clientId
  }
  parent.replaceChildren()
  api.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text,
    logo_alignment: 'center',
    width: Math.max(200, Math.min(400, Math.floor(parent.getBoundingClientRect().width))),
  })
}

export function releaseGoogleHandler(handler: (credential: string) => void) {
  if (activeHandler === handler) activeHandler = null
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id?.disableAutoSelect()
}

// Google blocks sign-in inside apps' built-in browsers (WhatsApp, Instagram, Facebook...).
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isStandalone) return false
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|; wv\)/i.test(ua) || /(iPhone|iPad|iPod).*AppleWebKit(?!.*Safari)/i.test(ua)
}
