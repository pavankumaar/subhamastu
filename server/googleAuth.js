import { createPublicKey, verify } from 'node:crypto'

// Verifies a Google Sign-In ID token (a JWT signed by Google) without third-party packages:
// RS256 signature against Google's published keys, then issuer, audience, expiry and email checks.
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const CLOCK_SKEW_SECONDS = 60

export class GoogleTokenError extends Error {}

let keyCache = { keys: new Map(), expiresAt: 0 }

async function fetchGoogleKeys() {
  const response = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Google keys request failed with ${response.status}.`)
  const body = await response.json()
  const keys = new Map()
  for (const jwk of Array.isArray(body?.keys) ? body.keys : []) {
    if (jwk?.kid && jwk.kty === 'RSA') keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }))
  }
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  keyCache = { keys, expiresAt: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 }
}

async function getGoogleKey(kid) {
  if (Date.now() >= keyCache.expiresAt || !keyCache.keys.has(kid)) {
    // Google rotates keys; an unknown kid means our cache is stale, so refresh once.
    await fetchGoogleKeys()
  }
  return keyCache.keys.get(kid)
}

function decodeSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch {
    throw new GoogleTokenError('Malformed Google token.')
  }
}

export async function verifyGoogleIdToken(idToken, clientId) {
  if (typeof idToken !== 'string' || idToken.length > 4096) throw new GoogleTokenError('Missing Google token.')
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new GoogleTokenError('Malformed Google token.')
  const [headerPart, payloadPart, signaturePart] = parts
  const header = decodeSegment(headerPart)
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string') throw new GoogleTokenError('Unsupported Google token.')

  const key = await getGoogleKey(header.kid)
  if (!key) throw new GoogleTokenError('Unknown Google signing key.')
  const isValid = verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    key,
    Buffer.from(signaturePart, 'base64url'),
  )
  if (!isValid) throw new GoogleTokenError('Invalid Google token signature.')

  const claims = decodeSegment(payloadPart)
  const now = Math.floor(Date.now() / 1000)
  if (!GOOGLE_ISSUERS.has(claims.iss)) throw new GoogleTokenError('Google token has the wrong issuer.')
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audiences.includes(clientId)) throw new GoogleTokenError('Google token was issued for a different app.')
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) throw new GoogleTokenError('Google sign-in expired. Please try again.')
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) throw new GoogleTokenError('Google token is not valid yet.')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new GoogleTokenError('Google token has no account id.')
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new GoogleTokenError('Please verify your Google account email first.')
  }

  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : '',
    name: typeof claims.name === 'string' ? claims.name.slice(0, 80) : '',
    picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : '',
  }
}
