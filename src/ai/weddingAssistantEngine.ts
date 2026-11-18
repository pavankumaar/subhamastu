import { authFetch } from '../auth/session'
import type { WeddingPlannerData } from '../types/wedding'
import { todayString } from '../utils/weddingFormat'

export interface AssistantContext {
  sessionId: string
}

export type AssistantCardType = 'vendor' | 'payment' | 'task' | 'event'

// Interactive items the agent attached to a reply (rendered as cards with actions in the chat).
export interface AssistantCard {
  type: AssistantCardType
  id: string
}

export interface AssistantResult {
  reply: string
  source: 'gemini-cloud' | 'openrouter'
  state: WeddingPlannerData | null
  sessionId: string
  failed: boolean
  cards: AssistantCard[]
}

interface AssistantApiPayload {
  reply?: string
  source?: 'gemini-cloud' | 'openrouter'
  state?: unknown
  sessionId?: string
  error?: string
  cards?: unknown
}

const assistantApiEndpoint = '/api/assistant/reply'
const assistantHistoryEndpoint = '/api/assistant/history'
const assistantRetryLimit = 1
const assistantRetryDelayMs = 550

export interface AssistantHistoryMessage {
  id?: string
  role: 'assistant' | 'user'
  text: string
  source?: 'gemini-cloud' | 'openrouter'
  createdAt: string
  cards: AssistantCard[]
}

const cardTypes = new Set<AssistantCardType>(['vendor', 'payment', 'task', 'event'])

function normalizeCards(value: unknown): AssistantCard[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry): entry is { type: AssistantCardType; id: string } =>
      isRecord(entry) && cardTypes.has(entry.type as AssistantCardType) && typeof entry.id === 'string',
    )
    .map((entry) => ({ type: entry.type, id: entry.id }))
    .slice(0, 8)
}

function normalizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeAssistantSource(value: unknown): 'gemini-cloud' | 'openrouter' {
  if (value === 'openrouter') {
    return 'openrouter'
  }
  return 'gemini-cloud'
}

function normalizeNumber(value: unknown, fallback = 0) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizePlannerState(candidate: unknown): WeddingPlannerData | null {
  if (!isRecord(candidate)) {
    return null
  }
  const event = candidate.event
  const expenses = candidate.expenses
  const todos = candidate.todos
  const vendors = candidate.vendors
  const guests = candidate.guests

  if (!isRecord(event)) {
    return null
  }
  if (!Array.isArray(expenses)) {
    return null
  }
  if (!Array.isArray(todos)) {
    return null
  }
  if (!Array.isArray(vendors)) {
    return null
  }
  if (!isRecord(guests)) {
    return null
  }
  const mealCounts =
    isRecord(guests.mealCounts)
      ? guests.mealCounts
      : { vegetarian: 0, nonVegetarian: 0, vegan: 0 }
  const eventsFromState: WeddingPlannerData['guests']['events'] = []
  if (Array.isArray(guests.events)) {
    for (const eventEntry of guests.events) {
      if (!isRecord(eventEntry)) {
        continue
      }
      const eventName = normalizeText(eventEntry.name)
      if (!eventName) {
        continue
      }
      const invitees: WeddingPlannerData['guests']['events'][number]['invitees'] = []
      if (Array.isArray(eventEntry.invitees)) {
        for (const inviteeEntry of eventEntry.invitees) {
          if (!isRecord(inviteeEntry)) {
            continue
          }
          const name = normalizeText(inviteeEntry.name)
          if (!name) {
            continue
          }
          invitees.push({
            id: normalizeText(inviteeEntry.id) || `invitee-${Math.random().toString(36).slice(2, 10)}`,
            name,
            completed: Boolean(inviteeEntry.completed),
          })
        }
      }
      eventsFromState.push({
        id: normalizeText(eventEntry.id) || `event-${Math.random().toString(36).slice(2, 10)}`,
        name: eventName,
        date: normalizeText(eventEntry.date),
        details: normalizeText(eventEntry.details),
        notes: typeof eventEntry.notes === 'string' ? eventEntry.notes : '',
        invitees,
      })
    }
  }
  const legacyInvitees: WeddingPlannerData['guests']['events'][number]['invitees'] = []
  if (Array.isArray(guests.invitees)) {
    for (const inviteeEntry of guests.invitees) {
      if (!isRecord(inviteeEntry)) {
        continue
      }
      const name = normalizeText(inviteeEntry.name)
      if (!name) {
        continue
      }
      legacyInvitees.push({
        id: normalizeText(inviteeEntry.id) || `invitee-${Math.random().toString(36).slice(2, 10)}`,
        name,
        completed: Boolean(inviteeEntry.completed),
      })
    }
  }
  const events =
    eventsFromState.length > 0
      ? eventsFromState
      : legacyInvitees.length > 0
        ? [{
            id: `event-${Math.random().toString(36).slice(2, 10)}`,
            name: 'Main Event',
            date: '',
            details: '',
            invitees: legacyInvitees,
          }]
        : []
  const allInvitees = events.flatMap((event) => event.invitees)

  return {
    event: {
      coupleNames: normalizeText(event.coupleNames, ''),
      weddingDate: normalizeText(event.weddingDate, ''),
      planningStartDate: normalizeText(event.planningStartDate, ''),
      venueName: normalizeText(event.venueName),
      venueCity: normalizeText(event.venueCity),
      totalBudget: normalizeNumber(event.totalBudget, 0),
    },
    expenses: expenses as WeddingPlannerData['expenses'],
    todos: todos as WeddingPlannerData['todos'],
    vendors: vendors as WeddingPlannerData['vendors'],
    guests: {
      totalInvited: allInvitees.length,
      pending: allInvitees.filter((invitee) => !invitee.completed).length,
      declined: normalizeNumber(guests.declined, 0),
      events,
      mealCounts: {
        vegetarian: normalizeNumber(mealCounts.vegetarian, 0),
        nonVegetarian: normalizeNumber(mealCounts.nonVegetarian, 0),
        vegan: normalizeNumber(mealCounts.vegan, 0),
      },
    },
  }
}

async function safeParseResponse(response: Response) {
  const rawBody = await response.text()
  if (!rawBody.trim()) {
    return { payload: {} as AssistantApiPayload, rawBody: '' }
  }

  try {
    const payload = JSON.parse(rawBody) as AssistantApiPayload
    return { payload, rawBody }
  } catch {
    return { payload: {} as AssistantApiPayload, rawBody }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// Only network failures are retried (the API was never reached, so no model quota was spent).
// HTTP errors are returned as-is: the server already retries the model once for transient failures.
async function requestAssistantWithRetry(sessionId: string, query: string) {
  let attempt = 0

  while (true) {
    try {
      return await authFetch(assistantApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sessionId, clientDate: todayString() }),
      })
    } catch (error) {
      if (attempt >= assistantRetryLimit) {
        throw error
      }
    }

    attempt += 1
    await wait(assistantRetryDelayMs * attempt)
  }
}

export async function fetchAssistantHistory(sessionId: string): Promise<AssistantHistoryMessage[]> {
  const normalizedSessionId = normalizeText(sessionId)
  if (!normalizedSessionId) {
    return []
  }

  const response = await authFetch(
    `${assistantHistoryEndpoint}?sessionId=${encodeURIComponent(normalizedSessionId)}`,
  )
  const { payload, rawBody } = await safeParseResponse(response)

  if (!response.ok) {
    const message = normalizeText(payload.error, rawBody || 'Unable to load assistant history.')
    throw new Error(message)
  }

  const messages = (payload as { messages?: unknown }).messages
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .filter((entry): entry is AssistantHistoryMessage => {
      if (!isRecord(entry)) {
        return false
      }
      if (entry.role !== 'assistant' && entry.role !== 'user') {
        return false
      }
      return typeof entry.text === 'string'
    })
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : undefined,
      role: entry.role,
      text: entry.text,
      source: entry.source === 'gemini-cloud' || entry.source === 'openrouter'
        ? entry.source
        : undefined,
      createdAt:
        typeof entry.createdAt === 'string' && entry.createdAt
          ? entry.createdAt
          : new Date().toISOString(),
      cards: normalizeCards((entry as unknown as Record<string, unknown>).cards),
    }))
}

export async function executeAssistantQuery(
  rawInput: string,
  context: AssistantContext,
): Promise<AssistantResult> {
  const query = rawInput.trim()
  const sessionId = normalizeText(context.sessionId)

  if (!query) {
    return {
      reply: 'Please type a message first.',
      source: 'gemini-cloud',
      state: null,
      sessionId,
      failed: true,
      cards: [],
    }
  }

  if (!sessionId) {
    return {
      reply: 'Assistant session is not ready. Refresh once and try again.',
      source: 'gemini-cloud',
      state: null,
      sessionId: '',
      failed: true,
      cards: [],
    }
  }

  try {
    const response = await requestAssistantWithRetry(sessionId, query)

    const { payload, rawBody } = await safeParseResponse(response)
    if (!response.ok) {
      const message = normalizeText(
        payload.error,
        rawBody.trim() || `AI request failed with status ${response.status}.`,
      )
      return {
        reply: message,
        source: 'gemini-cloud',
        state: null,
        sessionId,
        failed: true,
        cards: [],
      }
    }

    const state = sanitizePlannerState(payload.state)
    return {
      reply: normalizeText(payload.reply, rawBody.trim() || 'Completed.'),
      source: normalizeAssistantSource(payload.source),
      state,
      sessionId: normalizeText(payload.sessionId, sessionId),
      failed: false,
      cards: normalizeCards(payload.cards),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI request failure.'
    return {
      reply: `Unable to process request right now: ${message}`,
      source: 'gemini-cloud',
      state: null,
      sessionId,
      failed: true,
      cards: [],
    }
  }
}
