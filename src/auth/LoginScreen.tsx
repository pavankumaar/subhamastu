import { AlertTriangle, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getLastUsername, loginWithPin, registerAccount, type AuthSession } from './session'

type Mode = 'login' | 'register'

const usernamePattern = /^[a-z0-9._]{3,20}$/

function DiyaIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
      <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
      <path d="M8 20H16" />
    </svg>
  )
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function LoginScreen({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<Mode>(() => (getLastUsername() ? 'login' : 'register'))
  const [username, setUsername] = useState(getLastUsername)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setPin('')
    setConfirmPin('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUsername = username.trim().toLowerCase()

    if (!usernamePattern.test(normalizedUsername)) {
      setError('Username must be 3–20 characters: letters, numbers, dots or underscores.')
      return
    }
    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (mode === 'register' && pin !== confirmPin) {
      setError("PINs don't match. Please re-enter them.")
      setConfirmPin('')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const session =
        mode === 'register' ? await registerAccount(normalizedUsername, pin) : await loginWithPin(normalizedUsername, pin)
      onLogin(session)
    } catch (submitFailure) {
      setError(submitFailure instanceof Error ? submitFailure.message : 'Something went wrong. Please try again.')
      setPin('')
      setConfirmPin('')
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <main className="h-dvh overflow-y-auto bg-[#F4F0E8]">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 pb-8 pt-6">
        <header className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-line bg-champagne-light">
            <DiyaIcon className="h-[18px] w-[18px] text-champagne" />
          </span>
          <span className="font-display text-xl font-semibold leading-none tracking-tight text-charcoal">Subhamastu</span>
          <span className="border-l border-brass-line pl-2 text-[11px] leading-none text-muted-taupe">Telugu Wedding Atelier</span>
        </header>

        <section className="screen-animate flex flex-1 flex-col justify-center py-8">
          <p className="text-[11px] font-medium uppercase tracking-widest text-champagne">Namaskaram</p>
          <h1 className="mt-1 font-display text-[40px] font-semibold leading-none tracking-tight text-charcoal">
            {isRegister ? 'Begin your planner' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-taupe">
            {isRegister
              ? 'Create a private planner for your wedding — tasks, payments, ceremonies and vendors in one place.'
              : 'Sign in to continue planning your wedding.'}
          </p>

          <div className="mt-5 grid grid-cols-2 rounded-full border border-brass-line bg-silk p-1" role="tablist">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => switchMode(tab)}
                className={`rounded-full py-2 text-xs font-medium transition-colors ${
                  mode === tab ? 'bg-charcoal text-ivory' : 'text-muted-taupe hover:text-charcoal'
                }`}
              >
                {tab === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-3xl border border-brass-line bg-silk p-5 shadow-soft">
            <div>
              <label htmlFor="auth-username" className="mb-1.5 block text-[11px] font-medium text-muted-taupe">
                Username
              </label>
              <input
                id="auth-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="e.g. pavan"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                className="bg-ivory"
              />
              {isRegister ? (
                <p className="mt-1 text-[10px] text-muted-taupe">3–20 characters: letters, numbers, dots or underscores.</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="auth-pin" className="mb-1.5 block text-[11px] font-medium text-muted-taupe">
                {isRegister ? 'Choose a 4-digit PIN' : '4-digit PIN'}
              </label>
              <input
                id="auth-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(event) => setPin(onlyDigits(event.target.value))}
                placeholder="••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="bg-ivory tracking-[0.5em]"
              />
            </div>

            {isRegister ? (
              <div>
                <label htmlFor="auth-pin-confirm" className="mb-1.5 block text-[11px] font-medium text-muted-taupe">
                  Confirm PIN
                </label>
                <input
                  id="auth-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(event) => setConfirmPin(onlyDigits(event.target.value))}
                  placeholder="••••"
                  autoComplete="new-password"
                  className="bg-ivory tracking-[0.5em]"
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-blush-soft px-3 py-2.5 text-xs text-blush-deep">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-charcoal py-3 text-sm font-medium text-ivory disabled:opacity-60"
            >
              <LockKeyhole className="h-4 w-4 text-champagne" />
              {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-taupe">
            {isRegister ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
              className="font-medium text-blush-deep underline-offset-2 hover:underline"
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>
      </div>
    </main>
  )
}
