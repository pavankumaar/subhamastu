import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { applyAssistantActions, buildPlannerSnapshot, describeTools } from './assistantTools.js'
import { AuthError, createAuth, createRateLimiter } from './auth.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

const aiProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || 'gemini'
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || ''
const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash-lite'
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() || ''
const openRouterModel = process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini'
const openRouterEndpoint =
  process.env.OPENROUTER_ENDPOINT?.trim() || 'https://openrouter.ai/api/v1/chat/completions'
const openRouterReferer = process.env.OPENROUTER_HTTP_REFERER?.trim() || ''
const openRouterTitle = process.env.OPENROUTER_X_TITLE?.trim() || 'Wedding Planner AI'
const mongoUri =
  process.env.MONGODB_URI?.trim() ||
  process.env.MONGO_URI?.trim() ||
  process.env.MONGODB_URL?.trim() ||
  ''
const mongoDbName = process.env.MONGODB_DB?.trim() || 'wedding_planner'
const plannerCollectionName =
  process.env.MONGODB_PLANNER_COLLECTION?.trim() || 'planner_state'
const assistantCollectionName =
  process.env.MONGODB_ASSISTANT_COLLECTION?.trim() || 'assistant_sessions'
const assistantContextWindow = Math.max(
  0,
  Number.parseInt(process.env.ASSISTANT_CONTEXT_WINDOW ?? '18', 10),
)
const assistantProviderMaxRetries = Math.max(
  0,
  Number.parseInt(process.env.ASSISTANT_PROVIDER_MAX_RETRIES ?? '1', 10),
)

let mongoClientPromise

const assistantDailyLimit = Math.max(
  0,
  Number.parseInt(process.env.ASSISTANT_DAILY_LIMIT_PER_USER ?? '50', 10),
)

const auth = createAuth(getMongoDb, {
  usersCollection: process.env.MONGODB_USERS_COLLECTION?.trim() || 'users',
  sessionsCollection: process.env.MONGODB_SESSIONS_COLLECTION?.trim() || 'auth_sessions',
})

// Per-IP limits so nobody can mass-create accounts or spray PIN guesses across usernames.
const registerLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many accounts created from this network. Please try again later.',
})
const loginLimiter = createRateLimiter({
  limit: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts from this network. Please wait a few minutes.',
})

function createDefaultPlannerState() {
  return {
    event: {
      coupleNames: '',
      weddingDate: '',
      planningStartDate: '',
      venueName: '',
      venueCity: '',
      totalBudget: 0,
    },
    expenses: [],
    todos: [],
    vendors: [],
    guests: {
      totalInvited: 0,
      pending: 0,
      declined: 0,
      events: [],
      mealCounts: {
        vegetarian: 0,
        nonVegetarian: 0,
        vegan: 0,
      },
    },
  }
}

// Allowed browser origins, comma-separated (e.g. https://subhamastu.here.now). Local dev origins are always allowed.
const allowedOrigins = new Set(
  [
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CORS_ORIGINS ?? '').split(','),
  ]
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
)

// Render (and most hosts) sit behind one reverse proxy; trust it so request.ip is the real
// visitor IP for the per-IP rate limits instead of the proxy's address.
app.set('trust proxy', 1)

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin (UptimeRobot, curl, server-to-server) carry no browser credentials.
      callback(null, !origin || allowedOrigins.has(origin))
    },
  }),
)
app.use(express.json({ limit: '1mb' }))

app.use((error, _request, response, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Invalid JSON body.' })
    return
  }
  next(error)
})

app.get('/api/health', async (_request, response) => {
  try {
    await getMongoDb()
    response.json({ ok: true })
  } catch (error) {
    respondWithError(response, error, 503, 'MongoDB is not reachable.')
  }
})

function respondWithAuthError(response, error) {
  if (error instanceof AuthError) {
    response.status(error.status).json({ error: error.message, ...error.details })
    return
  }
  respondWithError(response, error, resolveStorageStatusCode(error, 500), 'Authentication failed.')
}

app.post('/api/auth/register', async (request, response) => {
  try {
    registerLimiter(request.ip)
    const payload = isRecord(request.body) ? request.body : {}
    response.status(201).json(await auth.register(payload.username, payload.pin))
  } catch (error) {
    respondWithAuthError(response, error)
  }
})

app.post('/api/auth/login', async (request, response) => {
  try {
    loginLimiter(request.ip)
    const payload = isRecord(request.body) ? request.body : {}
    response.json(await auth.login(payload.username, payload.pin))
  } catch (error) {
    respondWithAuthError(response, error)
  }
})

app.post('/api/auth/logout', async (request, response) => {
  try {
    await auth.logout(auth.readToken(request))
    response.json({ ok: true })
  } catch (error) {
    respondWithAuthError(response, error)
  }
})

// Everything below requires a logged-in user; each user only ever touches their own data.
app.use(['/api/auth/me', '/api/planner', '/api/assistant'], auth.requireAuth(respondWithAuthError))

app.get('/api/auth/me', (request, response) => {
  response.json({ profile: request.user })
})

app.get('/api/planner/state', async (request, response) => {
  try {
    const state = await getPlannerState(request.user.id)
    response.json({ state })
  } catch (error) {
    respondWithError(
      response,
      error,
      resolveStorageStatusCode(error, 500),
      'Unable to read planner state.',
    )
  }
})

app.put('/api/planner/state', async (request, response) => {
  try {
    const payload = request.body ?? {}
    if (!isRecord(payload) || !isValidPlannerState(payload.state)) {
      response.status(400).json({ error: 'A valid planner state is required.' })
      return
    }

    const state = sanitizePlannerState(payload.state)
    await savePlannerState(request.user.id, state)
    response.json({ state })
  } catch (error) {
    respondWithError(
      response,
      error,
      resolveStorageStatusCode(error, 500),
      'Unable to update planner state.',
    )
  }
})

app.get('/api/assistant/history', async (request, response) => {
  try {
    const sessionId = assistantSessionIdFor(request.user)
    const messages = await listAssistantMessages(sessionId)
    response.json({ sessionId, messages })
  } catch (error) {
    respondWithError(
      response,
      error,
      resolveStorageStatusCode(error, 500),
      'Unable to read assistant history.',
    )
  }
})

app.post('/api/assistant/reply', async (request, response) => {
  try {
    const provider = resolveAiProvider()

    const payload = request.body ?? {}
    const query = normalizeText(payload.query)
    if (!query) {
      response.status(400).json({ error: 'Query is required.' })
      return
    }
    if (query.length > 2000) {
      response.status(400).json({ error: 'Query is too long.' })
      return
    }

    const sessionId = assistantSessionIdFor(request.user)
    await auth.consumeAiQuota(request.user.id, assistantDailyLimit)
    const currentState = await getPlannerState(request.user.id)
    const history = await listAssistantMessages(sessionId)
    const conversation = buildAssistantConversation({
      query,
      plannerState: currentState,
      history,
      contextWindow: assistantContextWindow,
      user: request.user,
    })

    const rawReply = await requestModelReply(conversation, provider)
    const envelope = parseAssistantEnvelope(rawReply)
    const actionResult = applyAssistantActions(envelope.actions, currentState)

    if (actionResult.appliedActions.length > 0) {
      await savePlannerState(request.user.id, actionResult.state)
    }

    // The model writes its reply before actions run, so append any validation failures
    // instead of spending a second model request to rewrite the reply.
    const reply =
      actionResult.failedActions.length > 0
        ? `${envelope.reply}\n\n⚠ Couldn't complete: ${actionResult.failedActions.map((entry) => entry.reason).join(' ')}`
        : envelope.reply

    await appendAssistantTurn(sessionId, {
      userText: query,
      assistantText: reply,
      appliedActions: actionResult.appliedActions,
      source: provider === 'openrouter' ? 'openrouter' : 'gemini-cloud',
    })

    response.json({
      sessionId,
      reply,
      source: provider === 'openrouter' ? 'openrouter' : 'gemini-cloud',
      state: actionResult.appliedActions.length > 0 ? actionResult.state : currentState,
      actionsApplied: actionResult.appliedActions.length,
      actionsFailed: actionResult.failedActions.length,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      respondWithAuthError(response, error)
      return
    }
    respondWithError(
      response,
      error,
      resolveStorageStatusCode(error, 502),
      'Unable to get AI response.',
    )
  }
})

app.listen(port, async () => {
  console.log(`Wedding planner API listening on http://localhost:${port}`)
  try {
    await getMongoDb()
    await auth.ensureAuthSetup()
    console.log('MongoDB connection ready.')
  } catch (error) {
    console.error('Unable to initialize MongoDB connection. API will stay up and return 503 for DB-backed routes.')
    console.error(error)
  }
})

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

// One private Mitra conversation per user, derived from the login rather than client input.
function assistantSessionIdFor(user) {
  return `user-${user.id}`
}

function plannerDocumentIdFor(userId) {
  return `user-${userId}`
}

function cloneState(state) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(state)
  }
  return JSON.parse(JSON.stringify(state))
}

function normalizeIsoDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  const parsed = new Date(typeof value === 'string' ? value : Date.now())
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

function getInviteeNameFromTodoTitle(title) {
  if (typeof title !== 'string') {
    return ''
  }
  const matched = /^invite(?:\s*[:-]\s*|\s+)(.+)$/i.exec(title.trim())
  if (!matched) {
    return ''
  }
  return matched[1]?.trim() || ''
}

function sanitizePlannerState(state) {
  const safeState = cloneState(state)
  const defaultGuests = createDefaultPlannerState().guests
  safeState.expenses = Array.isArray(safeState.expenses) ? safeState.expenses : []
  const normalizedTodos = Array.isArray(safeState.todos)
    ? safeState.todos
      .filter((todo) => isRecord(todo))
      .map((todo) => {
        const normalizedTodo = { ...todo, milestone: 'General' }
        delete normalizedTodo.assignee
        return normalizedTodo
      })
    : []
  const inviteesFromLegacyTodos = normalizedTodos
    .map((todo) => {
      const inviteeName = getInviteeNameFromTodoTitle(todo.title)
      if (!inviteeName) {
        return null
      }
      return { name: inviteeName, completed: Boolean(todo.completed) }
    })
    .filter(Boolean)
  safeState.todos = normalizedTodos.filter((todo) => !getInviteeNameFromTodoTitle(todo.title))
  safeState.vendors = Array.isArray(safeState.vendors) ? safeState.vendors : []
  safeState.guests = isRecord(safeState.guests)
    ? safeState.guests
    : defaultGuests
  const eventsFromState = Array.isArray(safeState.guests.events)
    ? safeState.guests.events
      .filter((event) => isRecord(event))
      .map((event) => {
        const eventName = typeof event.name === 'string' ? event.name.trim() : ''
        if (!eventName) {
          return null
        }

        const invitees = Array.isArray(event.invitees)
          ? event.invitees
            .filter((invitee) => isRecord(invitee))
            .map((invitee) => {
              const name = typeof invitee.name === 'string' ? invitee.name.trim() : ''
              if (!name) {
                return null
              }

              return {
                id:
                  typeof invitee.id === 'string' && invitee.id.trim()
                    ? invitee.id.trim()
                    : `invitee-${randomUUID()}`,
                name,
                completed: Boolean(invitee.completed),
              }
            })
            .filter(Boolean)
          : []

        return {
          id:
            typeof event.id === 'string' && event.id.trim()
              ? event.id.trim()
              : `event-${randomUUID()}`,
          name: eventName,
          date:
            typeof event.date === 'string' && event.date.trim()
              ? event.date.trim()
              : normalizeIsoDate(''),
          details:
            typeof event.details === 'string' && event.details.trim()
              ? event.details.trim()
              : '',
          invitees,
        }
      })
      .filter(Boolean)
    : []
  const inviteesFromState = Array.isArray(safeState.guests.invitees)
    ? safeState.guests.invitees
      .filter((invitee) => isRecord(invitee))
      .map((invitee) => {
        const name = typeof invitee.name === 'string' ? invitee.name.trim() : ''
        if (!name) {
          return null
        }

        return {
          id:
            typeof invitee.id === 'string' && invitee.id.trim()
              ? invitee.id.trim()
              : `invitee-${randomUUID()}`,
          name,
          completed: Boolean(invitee.completed),
        }
      })
      .filter(Boolean)
    : []
  const legacyInviteeNames = Array.isArray(safeState.guests.inviteeNames)
    ? safeState.guests.inviteeNames.filter((name) => typeof name === 'string')
    : []
  const migratedInvitees = [...inviteesFromState]
  for (const legacyInvitee of inviteesFromLegacyTodos) {
    if (migratedInvitees.some((invitee) => invitee.name.toLowerCase() === legacyInvitee.name.toLowerCase())) {
      continue
    }
    migratedInvitees.push({
      id: `invitee-${randomUUID()}`,
      name: legacyInvitee.name,
      completed: legacyInvitee.completed,
    })
  }
  for (const legacyName of legacyInviteeNames) {
    const normalizedName = legacyName.trim()
    if (!normalizedName) {
      continue
    }
    if (migratedInvitees.some((invitee) => invitee.name.toLowerCase() === normalizedName.toLowerCase())) {
      continue
    }
    migratedInvitees.push({
      id: `invitee-${randomUUID()}`,
      name: normalizedName,
      completed: false,
    })
  }
  const events = [...eventsFromState]
  if (migratedInvitees.length > 0) {
    if (events.length === 0) {
      events.push({
        id: `event-${randomUUID()}`,
        name: 'Main Event',
        date: normalizeIsoDate(''),
        details: '',
        invitees: migratedInvitees,
      })
    } else {
      const existingNames = new Set(
        events.flatMap((event) => event.invitees.map((invitee) => invitee.name.toLowerCase())),
      )
      const missingInvitees = migratedInvitees.filter(
        (invitee) => !existingNames.has(invitee.name.toLowerCase()),
      )
      if (missingInvitees.length > 0) {
        events.push({
          id: `event-${randomUUID()}`,
          name: 'Imported Event',
          date: normalizeIsoDate(''),
          details: '',
          invitees: missingInvitees.map((invitee) => ({ ...invitee, completed: false })),
        })
      }
    }
  }
  const allInvitees = events.flatMap((event) => event.invitees)
  safeState.guests.events = events
  safeState.guests.totalInvited = allInvitees.length
  safeState.guests.pending = allInvitees.filter((invitee) => !invitee.completed).length
  safeState.guests.declined = Math.max(0, Math.round(normalizeNumber(safeState.guests.declined, 0)))
  delete safeState.guests.attending
  delete safeState.guests.invitees
  delete safeState.guests.inviteeNames
  safeState.guests.mealCounts = isRecord(safeState.guests.mealCounts)
    ? safeState.guests.mealCounts
    : defaultGuests.mealCounts
  return safeState
}

function isValidPlannerState(state) {
  return (
    isRecord(state) &&
    isRecord(state.event) &&
    Array.isArray(state.expenses) &&
    Array.isArray(state.todos) &&
    Array.isArray(state.vendors) &&
    isRecord(state.guests)
  )
}

function buildAssistantConversation({ query, plannerState, history, contextWindow, user }) {
  const today = new Date().toISOString().slice(0, 10)
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  const systemInstruction = [
    'You are Kalyana Mitra, the wedding planning agent for a South Indian (Telugu) wedding.',
    `You are chatting with ${user.name}. This is their own private planner.`,
    'You can do everything the couple can do in the planner app: manage events/ceremonies and their invitees,',
    'tasks, payments, vendors and overall wedding details. You also answer questions from their planner data.',
    `Today is ${weekday}, ${today}. Resolve relative dates (tomorrow, next Friday, in 2 weeks) against it.`,
    '',
    'OUTPUT FORMAT',
    'Return valid JSON only, no markdown: {"reply":"text for the user","actions":[{"type":"<tool>","payload":{...}}]}',
    'You get ONE response per user message, so put EVERY action needed in the actions array at once.',
    'Actions run in order. A later action may reference an item created earlier in the same list by its name',
    '(e.g. addEvent "Sangeet" then addTodo with "event":"Sangeet").',
    '',
    'TOOLS (payload fields marked ? are optional)',
    describeTools(),
    '',
    'REFERENCES',
    '- Refer to existing items by their id from the planner data (preferred) or their exact name/title.',
    '- Never invent ids. Never say you cannot do something a tool above supports.',
    '',
    'CONVERSATION CONTINUITY (critical)',
    '- Prior messages are real history. Read them before answering.',
    '- If your previous reply asked for missing details, the user\'s next message is the ANSWER: combine it with the',
    '  original request and perform the action now. Short replies ("saree shopping", "50k", "yes", "high") are answers.',
    '- Never ask for something already given. Never repeat a question.',
    '- Resolve "it", "that payment", "the same vendor", "them" from earlier messages and planner data.',
    '',
    'DEFAULTS (prefer acting over asking)',
    `- Missing dates default to ${today}. Missing task priority defaults to Medium. Missing paid amount defaults to 0.`,
    '- Infer payment category from the title. Required fields: task title; payment title + totalAmount; vendor name; event name.',
    '- Ask a clarifying question ONLY when a required field is truly missing; ask for all missing fields in one question.',
    '- Destructive actions (removeEvent, removeExpense, removeVendor, removeTodo) only when the user clearly asks.',
    '  removeEvent also deletes that event\'s linked tasks, payments and vendors â€” mention this in the reply.',
    '',
    'REPLY STYLE',
    '- Concise, warm, concrete. When you perform actions, state exactly what was done.',
    '- If no change is requested, return "actions": [].',
    '',
    `Planner data JSON: ${JSON.stringify(buildPlannerSnapshot(plannerState))}`,
  ].join('\n')

  const recentHistory = contextWindow > 0 ? history.slice(-contextWindow) : []
  const turns = []
  for (const entry of [...recentHistory, { role: 'user', text: query }]) {
    const text = normalizeText(entry.text)
    if (!text) {
      continue
    }
    const role = entry.role === 'assistant' ? 'assistant' : 'user'
    const previous = turns[turns.length - 1]
    if (previous && previous.role === role) {
      previous.text = `${previous.text}\n${text}`
      continue
    }
    turns.push({ role, text })
  }
  while (turns.length > 0 && turns[0].role !== 'user') {
    turns.shift()
  }

  return { systemInstruction, turns }
}

function parseAssistantEnvelope(rawReply) {
  const candidate = stripMarkdownCodeFence(rawReply)
  const parsed = parseJsonCandidate(candidate)

  if (!isRecord(parsed)) {
    throw new Error('Gemini returned an invalid response shape.')
  }

  const reply = normalizeText(parsed.reply)
  if (!reply) {
    throw new Error('Gemini response did not include reply text.')
  }

  const actions = Array.isArray(parsed.actions)
    ? parsed.actions.filter((entry) => isRecord(entry) && normalizeText(entry.type))
    : []

  return { reply, actions }
}

function stripMarkdownCodeFence(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonCandidate(text) {
  try {
    return JSON.parse(text)
  } catch {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Gemini returned non-JSON output.')
    }
    const sliced = text.slice(firstBrace, lastBrace + 1)
    return JSON.parse(sliced)
  }
}

async function getMongoDb() {
  if (!mongoUri) {
    throw new Error(
      'MongoDB URI is not configured. Set MONGODB_URI (or MONGO_URI / MONGODB_URL) and restart the API server.',
    )
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
    })
    mongoClientPromise = client
      .connect()
      .catch(async (error) => {
        mongoClientPromise = undefined
        try {
          await client.close()
        } catch {
          // Ignore close failures after unsuccessful connect.
        }
        throw createMongoConnectionError(error)
      })
  }

  const client = await mongoClientPromise
  return client.db(mongoDbName)
}

async function getCollections() {
  const db = await getMongoDb()
  return {
    planner: db.collection(plannerCollectionName),
    assistant: db.collection(assistantCollectionName),
  }
}

async function getPlannerState(userId) {
  const { planner } = await getCollections()
  const document = await planner.findOne({ _id: plannerDocumentIdFor(userId) })
  if (!document || !isValidPlannerState(document.state)) {
    return createDefaultPlannerState()
  }
  return sanitizePlannerState(document.state)
}

async function savePlannerState(userId, state) {
  const { planner } = await getCollections()
  await planner.updateOne(
    { _id: plannerDocumentIdFor(userId) },
    {
      $set: {
        userId,
        state: sanitizePlannerState(state),
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
}

async function listAssistantMessages(sessionId) {
  const { assistant } = await getCollections()
  const document = await assistant.findOne({ _id: sessionId })
  const messages = Array.isArray(document?.messages) ? document.messages : []
  return messages.filter(
    (entry) =>
      isRecord(entry) &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      typeof entry.text === 'string',
  )
}

async function appendAssistantTurn(sessionId, turn) {
  const now = new Date().toISOString()
  const { assistant } = await getCollections()

  const userMessage = {
    id: `msg-${randomUUID()}`,
    role: 'user',
    text: turn.userText,
    createdAt: now,
  }

  const assistantMessage = {
    id: `msg-${randomUUID()}`,
    role: 'assistant',
    text: turn.assistantText,
    source: turn.source === 'openrouter' ? 'openrouter' : 'gemini-cloud',
    createdAt: now,
  }

  await assistant.updateOne(
    { _id: sessionId },
    {
      $set: {
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
      $push: {
        messages: {
          $each: [userMessage, assistantMessage],
          $slice: -200,
        },
        actionLog: {
          $each: [
            {
              id: `action-${randomUUID()}`,
              createdAt: now,
              items: turn.appliedActions,
            },
          ],
          $slice: -200,
        },
      },
    },
    { upsert: true },
  )
}

function respondWithError(response, error, statusCode, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage
  response.status(statusCode).json({ error: message })
}

function resolveStorageStatusCode(error, fallbackStatusCode) {
  if (isMongoConnectivityError(error)) {
    return 503
  }
  return fallbackStatusCode
}

function isMongoConnectivityError(error) {
  if (!(error instanceof Error)) {
    return false
  }
  if (error.name.toLowerCase().includes('mongo')) {
    return true
  }
  const message = error.message.toLowerCase()
  return (
    message.includes('mongodb') ||
    message.includes('server selection') ||
    message.includes('tls handshake') ||
    message.includes('tlsv1 alert internal error')
  )
}

function createMongoConnectionError(error) {
  const rawMessage = error instanceof Error ? error.message : 'Unknown MongoDB connection error.'
  const message = rawMessage.toLowerCase()
  if (message.includes('tlsv1 alert internal error')) {
    const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
    const nodeHint = Number.isFinite(nodeMajor) && nodeMajor >= 25
      ? `Detected Node ${process.versions.node}. Use Node 22 LTS for Atlas compatibility.`
      : `Node version: ${process.versions.node}.`
    return new Error(
      `MongoDB TLS handshake failed (Atlas). ${nodeHint} Also verify Atlas IP allowlist and any VPN/proxy SSL inspection. Raw error: ${rawMessage}`,
    )
  }
  return new Error(`MongoDB connection failed: ${rawMessage}`)
}

function resolveAiProvider() {
  if (aiProvider !== 'gemini' && aiProvider !== 'openrouter') {
    throw new Error('AI_PROVIDER must be either "gemini" or "openrouter".')
  }

  if (aiProvider === 'openrouter' && !openRouterApiKey) {
    throw new Error(
      'OpenRouter API key is not configured. Set OPENROUTER_API_KEY and restart the API server.',
    )
  }

  if (aiProvider === 'gemini' && !geminiApiKey) {
    throw new Error(
      'Gemini API key is not configured. Set GEMINI_API_KEY and restart the API server.',
    )
  }

  return aiProvider
}

async function requestModelReply(conversation, provider) {
  const maxAttempts = assistantProviderMaxRetries + 1
  let attempt = 0
  let lastError

  while (attempt < maxAttempts) {
    attempt += 1
    try {
      if (provider === 'openrouter') {
        return await requestOpenRouterReply(conversation)
      }
      return await requestGeminiReply(conversation)
    } catch (error) {
      lastError = error
      if (!isTransientModelError(error) || attempt >= maxAttempts) {
        throw error
      }
      await sleep(Math.min(6000, 1000 * 2 ** (attempt - 1)))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Model request failed.')
}

// Rate-limit/quota errors (429) are deliberately not retried: retrying burns OpenRouter quota and won't succeed.
function isTransientModelError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('high demand') ||
    message.includes('temporarily unavailable') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('empty response') ||
    message.includes('status 500') ||
    message.includes('status 502') ||
    message.includes('status 503') ||
    message.includes('status 504')
  )
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function requestGeminiReply({ systemInstruction, turns }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  try {
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: turns.map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        })),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    })

    const body = await geminiResponse.json()
    if (!geminiResponse.ok) {
      const detail =
        body?.error?.message || `Gemini request failed with status ${geminiResponse.status}.`
      throw new Error(`[gemini] ${detail}`)
    }

    const candidate = body?.candidates?.[0]
    const textParts = candidate?.content?.parts
    const firstText = Array.isArray(textParts)
      ? textParts.find((part) => typeof part?.text === 'string')?.text
      : ''

    if (!firstText || !firstText.trim()) {
      throw new Error('Gemini returned an empty response.')
    }

    return firstText.trim()
  } finally {
    clearTimeout(timeout)
  }
}

async function requestOpenRouterReply({ systemInstruction, turns }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  const headers = {
    Authorization: `Bearer ${openRouterApiKey}`,
    'Content-Type': 'application/json',
  }

  if (openRouterReferer) {
    headers['HTTP-Referer'] = openRouterReferer
  }

  if (openRouterTitle) {
    headers['X-Title'] = openRouterTitle
  }

  try {
    const openRouterResponse = await fetch(openRouterEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          { role: 'system', content: systemInstruction },
          ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    const body = await openRouterResponse.json()
    if (!openRouterResponse.ok) {
      const detail =
        body?.error?.message ||
        body?.error ||
        `OpenRouter request failed with status ${openRouterResponse.status}.`
      throw new Error(`[openrouter] ${detail}`)
    }

    const firstChoice = body?.choices?.[0]
    const content = firstChoice?.message?.content

    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }

    if (Array.isArray(content)) {
      const merged = content
        .map((entry) => {
          if (typeof entry?.text === 'string') {
            return entry.text
          }
          if (typeof entry?.content === 'string') {
            return entry.content
          }
          return ''
        })
        .join('')
        .trim()
      if (merged) {
        return merged
      }
    }

    if (isRecord(content) && typeof content.text === 'string' && content.text.trim()) {
      return content.text.trim()
    }

    if (typeof firstChoice?.text === 'string' && firstChoice.text.trim()) {
      return firstChoice.text.trim()
    }

    const finishReason =
      typeof firstChoice?.finish_reason === 'string' ? firstChoice.finish_reason : 'unknown'
    const messageShape = isRecord(firstChoice?.message)
      ? JSON.stringify(firstChoice.message).slice(0, 300)
      : 'none'
    throw new Error(
      `OpenRouter returned an empty response (model=${openRouterModel}, finish_reason=${finishReason}, message=${messageShape}).`,
    )
  } finally {
    clearTimeout(timeout)
  }
}
