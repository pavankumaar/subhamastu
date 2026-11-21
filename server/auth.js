import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/
const PIN_PATTERN = /^\d{4}$/
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000
const DUMMY_SALT = randomBytes(16).toString('hex')

export class AuthError extends Error {
  constructor(status, message, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function hashPin(pin, salt) {
  const derived = await scrypt(pin, salt, 64)
  return derived.toString('hex')
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.username,
    displayName: user.displayName || '',
    email: user.email || '',
    picture: user.picture || '',
    google: Boolean(user.googleSub),
    hasPin: Boolean(user.pinHash),
  }
}

// Turns "Pavan.K+wedding@gmail.com" into a valid username base like "pavan.k".
function usernameBaseFromEmail(email) {
  const local = (email.split('@')[0] ?? '').toLowerCase().split('+')[0]
  const cleaned = local.replace(/[^a-z0-9._]/g, '').replace(/^[._]+|[._]+$/g, '').slice(0, 16)
  return cleaned.length >= 3 ? cleaned : `${cleaned || 'guest'}${'0'.repeat(Math.max(0, 3 - (cleaned || 'guest').length))}`
}

function validatePin(pin) {
  if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
    throw new AuthError(400, 'PIN must be exactly 4 digits.')
  }
}

// Fixed-window in-memory limiter, keyed by client IP. Good enough for a single API instance.
export function createRateLimiter({ limit, windowMs, message }) {
  const hits = new Map()
  return function check(key) {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return
    }
    entry.count += 1
    if (entry.count > limit) {
      throw new AuthError(429, message, { retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) })
    }
  }
}

export function createAuth(getDb, { usersCollection, sessionsCollection }) {
  async function collections() {
    const db = await getDb()
    return {
      users: db.collection(usersCollection),
      sessions: db.collection(sessionsCollection),
    }
  }

  async function ensureAuthSetup() {
    const { sessions, users } = await collections()
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await sessions.createIndex({ userId: 1 })
    // One planner account per Google account; accounts without Google are not indexed.
    await users.createIndex({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } })
  }

  async function createSession(user) {
    const { sessions } = await collections()
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    await sessions.insertOne({
      _id: hashToken(token),
      userId: user._id,
      createdAt: new Date(now),
      expiresAt: new Date(now + SESSION_TTL_MS),
    })
    return token
  }

  async function register(rawUsername, pin) {
    const username = normalizeUsername(rawUsername)
    if (!USERNAME_PATTERN.test(username)) {
      throw new AuthError(400, 'Username must be 3–20 characters: letters, numbers, dots or underscores.')
    }
    validatePin(pin)

    const { users } = await collections()
    const salt = randomBytes(16).toString('hex')
    const user = {
      _id: username,
      username,
      pinHash: await hashPin(pin, salt),
      pinSalt: salt,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    }
    try {
      await users.insertOne(user)
    } catch (error) {
      if (error?.code === 11000) {
        throw new AuthError(409, 'That username is already taken.')
      }
      throw error
    }
    return { token: await createSession(user), profile: publicUser(user) }
  }

  async function login(rawUsername, pin) {
    const username = normalizeUsername(rawUsername)
    validatePin(pin)
    const { users } = await collections()
    const user = USERNAME_PATTERN.test(username) ? await users.findOne({ _id: username }) : null

    if (!user || !user.pinHash) {
      // Spend the same hashing time as a real check so response timing doesn't reveal valid usernames.
      // Google-only accounts have no PIN and are rejected the same way.
      await hashPin(pin, DUMMY_SALT)
      throw new AuthError(401, 'Incorrect username or PIN.')
    }

    const now = Date.now()
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now) {
      const retryAfterSeconds = Math.ceil((new Date(user.lockedUntil).getTime() - now) / 1000)
      throw new AuthError(429, `Too many wrong attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`, {
        retryAfterSeconds,
      })
    }

    const candidate = Buffer.from(await hashPin(pin, user.pinSalt), 'hex')
    const stored = Buffer.from(user.pinHash, 'hex')
    const isMatch = candidate.length === stored.length && timingSafeEqual(candidate, stored)

    if (!isMatch) {
      const failedAttempts = (user.failedAttempts ?? 0) + 1
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await users.updateOne({ _id: username }, { $set: { failedAttempts: 0, lockedUntil: new Date(now + LOCKOUT_MS) } })
        throw new AuthError(429, 'Too many wrong attempts. Try again in 5 minute(s).', {
          retryAfterSeconds: LOCKOUT_MS / 1000,
        })
      }
      await users.updateOne({ _id: username }, { $set: { failedAttempts } })
      throw new AuthError(401, 'Incorrect username or PIN.', { attemptsLeft: MAX_FAILED_ATTEMPTS - failedAttempts })
    }

    await users.updateOne({ _id: username }, { $set: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } })
    return { token: await createSession(user), profile: publicUser(user) }
  }

  function googleFields(google) {
    return { googleSub: google.sub, email: google.email, displayName: google.name, picture: google.picture }
  }

  // Signs in with a verified Google identity, creating a new planner account on first use.
  async function loginWithGoogle(google) {
    const { users } = await collections()
    const existing = await users.findOneAndUpdate(
      { googleSub: google.sub },
      { $set: { ...googleFields(google), lastLoginAt: new Date() } },
      { returnDocument: 'after' },
    )
    if (existing) {
      return { token: await createSession(existing), profile: publicUser(existing), created: false }
    }

    const base = usernameBaseFromEmail(google.email)
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const suffix = attempt === 0 ? '' : attempt < 20 ? String(attempt + 1) : randomBytes(2).toString('hex')
      const username = `${base.slice(0, 20 - suffix.length)}${suffix}`
      const user = {
        _id: username,
        username,
        ...googleFields(google),
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
      try {
        await users.insertOne(user)
        return { token: await createSession(user), profile: publicUser(user), created: true }
      } catch (error) {
        if (error?.code !== 11000) throw error
        // Same Google account created concurrently (e.g. double tap): sign into that one instead.
        if (error?.keyPattern?.googleSub) return loginWithGoogle(google)
      }
    }
    throw new AuthError(409, 'Could not create a username for this Google account. Please try again.')
  }

  // Connects Google to the signed-in account so either sign-in method opens the same planner.
  async function linkGoogle(userId, google) {
    const { users } = await collections()
    const owner = await users.findOne({ googleSub: google.sub }, { projection: { _id: 1 } })
    if (owner && owner._id !== userId) {
      throw new AuthError(409, `This Google account is already used by the planner account "${owner._id}".`)
    }
    try {
      const user = await users.findOneAndUpdate(
        { _id: userId },
        { $set: googleFields(google) },
        { returnDocument: 'after' },
      )
      if (!user) throw new AuthError(404, 'Account not found.')
      return { profile: publicUser(user) }
    } catch (error) {
      if (error?.code === 11000) throw new AuthError(409, 'This Google account is already used by another planner account.')
      throw error
    }
  }

  async function unlinkGoogle(userId) {
    const { users } = await collections()
    const user = await users.findOne({ _id: userId })
    if (!user) throw new AuthError(404, 'Account not found.')
    if (!user.pinHash) {
      throw new AuthError(400, 'This account signs in only with Google, so Google cannot be disconnected.')
    }
    const updated = await users.findOneAndUpdate(
      { _id: userId },
      { $unset: { googleSub: '', email: '', displayName: '', picture: '' } },
      { returnDocument: 'after' },
    )
    return { profile: publicUser(updated) }
  }

  function readToken(request) {
    const header = request.get('authorization') || ''
    const match = /^Bearer\s+(.+)$/i.exec(header)
    return match ? match[1].trim() : ''
  }

  async function resolveUser(token) {
    if (!token) return null
    const { sessions, users } = await collections()
    const session = await sessions.findOne({ _id: hashToken(token) })
    if (!session || session.expiresAt.getTime() <= Date.now()) return null
    const user = await users.findOne({ _id: session.userId })
    return user ? publicUser(user) : null
  }

  async function logout(token) {
    if (!token) return
    const { sessions } = await collections()
    await sessions.deleteOne({ _id: hashToken(token) })
  }

  // Atomically counts one Mitra request against the user's daily allowance (UTC day).
  async function consumeAiQuota(userId, dailyLimit) {
    if (dailyLimit <= 0) return
    const { users } = await collections()
    const today = new Date().toISOString().slice(0, 10)
    await users.updateOne({ _id: userId, 'aiUsage.date': { $ne: today } }, { $set: { aiUsage: { date: today, count: 0 } } })
    const result = await users.updateOne(
      { _id: userId, 'aiUsage.date': today, 'aiUsage.count': { $lt: dailyLimit } },
      { $inc: { 'aiUsage.count': 1 } },
    )
    if (result.modifiedCount === 0) {
      throw new AuthError(429, `You've used all ${dailyLimit} Mitra messages for today. Please try again tomorrow.`)
    }
  }

  // Express middleware: attaches request.user or responds 401.
  function requireAuth(onError) {
    return async (request, response, next) => {
      try {
        const user = await resolveUser(readToken(request))
        if (!user) {
          response.status(401).json({ error: 'Please log in to continue.' })
          return
        }
        request.user = user
        next()
      } catch (error) {
        onError(response, error)
      }
    }
  }

  return {
    ensureAuthSetup,
    register,
    login,
    loginWithGoogle,
    linkGoogle,
    unlinkGoogle,
    logout,
    readToken,
    resolveUser,
    consumeAiQuota,
    requireAuth,
  }
}
