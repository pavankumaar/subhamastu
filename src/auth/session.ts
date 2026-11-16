import { apiUrl } from '../apiBase'

export interface AuthSession {
  token: string
  profile: { id: string; name: string }
}

const storageKey = 'subhamastu.auth'
const lastUsernameKey = 'subhamastu.last-username'
export const loggedOutEvent = 'subhamastu:logged-out'

export function loadSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    return parsed?.token && parsed.profile?.id ? parsed : null
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session))
}

export function clearSession() {
  window.localStorage.removeItem(storageKey)
}

// fetch wrapper for protected API routes: adds the bearer token and
// signs the user out if the server says the session is no longer valid.
export async function authFetch(input: string, init: RequestInit = {}) {
  const session = loadSession()
  const headers = new Headers(init.headers)
  if (session) {
    headers.set('Authorization', `Bearer ${session.token}`)
  }
  const response = await fetch(apiUrl(input), { ...init, headers })
  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new Event(loggedOutEvent))
  }
  return response
}

async function readJson(response: Response) {
  const body = await response.text()
  try {
    return body ? (JSON.parse(body) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function getLastUsername() {
  return window.localStorage.getItem(lastUsernameKey) ?? ''
}

async function authenticate(path: string, username: string, pin: string): Promise<AuthSession> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  })
  const payload = await readJson(response)
  if (!response.ok) {
    let message = typeof payload.error === 'string' ? payload.error : 'Something went wrong. Please try again.'
    if (typeof payload.attemptsLeft === 'number') {
      message = `${message} ${payload.attemptsLeft} attempt${payload.attemptsLeft === 1 ? '' : 's'} left.`
    }
    throw new Error(message)
  }
  const session = { token: String(payload.token), profile: payload.profile as AuthSession['profile'] }
  saveSession(session)
  window.localStorage.setItem(lastUsernameKey, session.profile.name)
  return session
}

export function loginWithPin(username: string, pin: string) {
  return authenticate('/api/auth/login', username, pin)
}

export function registerAccount(username: string, pin: string) {
  return authenticate('/api/auth/register', username, pin)
}

export async function logout() {
  const session = loadSession()
  clearSession()
  if (session) {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      })
    } catch {
      // Local sign-out already happened; the server session will expire on its own.
    }
  }
}
