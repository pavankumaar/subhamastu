import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { authFetch } from '../auth/session'
import { initialWeddingData } from '../data/initialWeddingData'
import { WeddingContext, type WeddingContextValue } from './WeddingStore'
import type {
  AddExpenseInput,
  AddGuestEventInput,
  AddTodoInput,
  AddVendorInput,
  BudgetMetrics,
  ExpenseItem,
  ExpenseStatus,
  GuestEventItem,
  InviteeChecklistItem,
  TodoPriority,
  VendorItem,
  TodoItem,
  WeddingPlannerData,
} from '../types/wedding'

const plannerStateEndpoint = '/api/planner/state'
const saveDebounceMs = 350
const hydrateRetryMs = 5000
const statusCycle: ExpenseStatus[] = ['Paid', 'Deposit Paid', 'Due Soon']

function cloneSeedData(): WeddingPlannerData {
  return JSON.parse(JSON.stringify(initialWeddingData)) as WeddingPlannerData
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
}

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

function nextStatus(current: ExpenseStatus) {
  const index = statusCycle.indexOf(current)
  if (index === -1) {
    return 'Due Soon' as ExpenseStatus
  }
  return statusCycle[(index + 1) % statusCycle.length]
}

function updatePaidAmountForStatus(expense: ExpenseItem, status: ExpenseStatus) {
  if (status === 'Paid') {
    return expense.totalAmount
  }
  if (status === 'Deposit Paid') {
    return Math.round(expense.totalAmount * 0.5)
  }
  return 0
}

function getInviteeNameFromTodoTitle(title: string) {
  const matched = /^invite(?:\s*[:-]\s*|\s+)(.+)$/i.exec(title.trim())
  if (!matched) {
    return ''
  }
  return matched[1]?.trim() ?? ''
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return Math.max(0, Math.round(value))
}

function normalizeInviteeName(rawName: string) {
  return rawName.trim().replace(/\s+/g, ' ')
}

function normalizeTodoPriority(value: unknown): TodoPriority {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'high') {
      return 'High'
    }
    if (normalized === 'low') {
      return 'Low'
    }
    if (normalized === 'medium') {
      return 'Medium'
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'High' : 'Medium'
  }
  return 'Medium'
}

function normalizeInviteesFromUnknown(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as InviteeChecklistItem[]
  }

  const invitees: InviteeChecklistItem[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const inviteeRecord = entry as Record<string, unknown>
    const name =
      typeof inviteeRecord.name === 'string'
        ? normalizeInviteeName(inviteeRecord.name)
        : ''
    if (!name) {
      continue
    }

    const key = name.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    invitees.push({
      id:
        typeof inviteeRecord.id === 'string' && inviteeRecord.id.trim()
          ? inviteeRecord.id.trim()
          : createId('invitee'),
      name,
      completed: Boolean(inviteeRecord.completed),
    })
  }

  return invitees
}

function normalizeEventsFromUnknown(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as GuestEventItem[]
  }

  const events: GuestEventItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const eventRecord = entry as Record<string, unknown>
    const name =
      typeof eventRecord.name === 'string'
        ? normalizeInviteeName(eventRecord.name)
        : ''
    if (!name) {
      continue
    }

    events.push({
      id:
        typeof eventRecord.id === 'string' && eventRecord.id.trim()
          ? eventRecord.id.trim()
          : createId('event'),
      name,
      date:
        typeof eventRecord.date === 'string' && eventRecord.date.trim()
          ? eventRecord.date.trim()
          : getCurrentDateString(),
      details:
        typeof eventRecord.details === 'string' && eventRecord.details.trim()
          ? eventRecord.details.trim()
          : '',
      invitees: normalizeInviteesFromUnknown(eventRecord.invitees),
    })
  }

  return events
}

function deriveGuestTotals(events: GuestEventItem[]) {
  const allInvitees = events.flatMap((event) => event.invitees)
  return {
    totalInvited: allInvitees.length,
    pending: allInvitees.filter((invitee) => !invitee.completed).length,
  }
}

function updateGuestsWithEvents(
  guests: WeddingPlannerData['guests'],
  events: GuestEventItem[],
): WeddingPlannerData['guests'] {
  const guestTotals = deriveGuestTotals(events)
  return {
    ...guests,
    events,
    totalInvited: guestTotals.totalInvited,
    pending: guestTotals.pending,
  }
}

function sanitizePlannerState(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return cloneSeedData()
  }

  const seed = cloneSeedData()
  const value = candidate as Partial<WeddingPlannerData>
  const allTodos = Array.isArray(value.todos)
    ? value.todos
      .filter((todo) => Boolean(todo) && typeof todo === 'object' && !Array.isArray(todo))
      .map((todo) => {
        const todoRecord = todo as unknown as Record<string, unknown>
        const title =
          typeof todoRecord.title === 'string' && todoRecord.title.trim()
            ? todoRecord.title.trim()
            : 'Untitled task'
        const normalizedTodo: TodoItem = {
          id:
            typeof todoRecord.id === 'string' && todoRecord.id.trim()
              ? todoRecord.id
              : createId('todo'),
          title,
          eventId:
            typeof todoRecord.eventId === 'string' && todoRecord.eventId.trim()
              ? todoRecord.eventId.trim()
              : undefined,
          milestone: 'General',
          completed: Boolean(todoRecord.completed),
          priority: normalizeTodoPriority(todoRecord.priority),
        }
        if (typeof todoRecord.dueDate === 'string' && todoRecord.dueDate.trim()) {
          normalizedTodo.dueDate = todoRecord.dueDate.trim()
        }
        return normalizedTodo
      })
    : []

  const inviteesFromLegacyTodos = allTodos
    .map((todo) => {
      const inviteeName = getInviteeNameFromTodoTitle(todo.title)
      if (!inviteeName) {
        return null
      }
      return { name: inviteeName, completed: todo.completed }
    })
    .filter((invitee): invitee is { name: string; completed: boolean } => Boolean(invitee))
  const todos = allTodos.filter((todo) => !getInviteeNameFromTodoTitle(todo.title))

  const guestSource: Record<string, unknown> =
    value.guests && typeof value.guests === 'object' && !Array.isArray(value.guests)
      ? (value.guests as unknown as Record<string, unknown>)
      : {}
  const mealCountsSource: Record<string, unknown> =
    guestSource.mealCounts && typeof guestSource.mealCounts === 'object' && !Array.isArray(guestSource.mealCounts)
      ? (guestSource.mealCounts as Record<string, unknown>)
      : {}
  const eventsFromState = normalizeEventsFromUnknown(guestSource.events)
  const inviteesFromState = normalizeInviteesFromUnknown(guestSource.invitees)
  const legacyInviteeNames = Array.isArray(guestSource.inviteeNames)
    ? guestSource.inviteeNames
      .filter((name): name is string => typeof name === 'string')
      .map((name) => normalizeInviteeName(name))
      .filter((name) => name.length > 0)
    : []
  const migratedInvitees = normalizeInviteesFromUnknown([
    ...inviteesFromState,
    ...inviteesFromLegacyTodos.map((invitee) => ({
      id: createId('invitee'),
      name: invitee.name,
      completed: invitee.completed,
    })),
    ...legacyInviteeNames.map((name) => ({
      id: createId('invitee'),
      name,
      completed: false,
    })),
  ])
  const events = [...eventsFromState]
  if (migratedInvitees.length > 0) {
    if (events.length === 0) {
      events.push({
        id: createId('event'),
        name: 'Main Event',
        date: getCurrentDateString(),
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
          id: createId('event'),
          name: 'Imported Event',
          date: getCurrentDateString(),
          details: '',
          invitees: missingInvitees.map((invitee) => ({
            ...invitee,
            completed: false,
          })),
        })
      }
    }
  }
  const declined = normalizeNonNegativeInteger(guestSource.declined, seed.guests.declined)
  const guestTotals = deriveGuestTotals(events)

  return {
    event: value.event ?? seed.event,
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    todos,
    vendors: Array.isArray(value.vendors) ? value.vendors : [],
    guests: {
      ...seed.guests,
      ...guestSource,
      totalInvited: guestTotals.totalInvited,
      pending: guestTotals.pending,
      declined,
      events,
      mealCounts: {
        ...seed.guests.mealCounts,
        vegetarian: normalizeNonNegativeInteger(
          mealCountsSource.vegetarian,
          seed.guests.mealCounts.vegetarian,
        ),
        nonVegetarian: normalizeNonNegativeInteger(
          mealCountsSource.nonVegetarian,
          seed.guests.mealCounts.nonVegetarian,
        ),
        vegan: normalizeNonNegativeInteger(mealCountsSource.vegan, seed.guests.mealCounts.vegan),
      },
    },
  }
}

async function parseJsonResponse(response: Response) {
  const body = await response.text()
  if (!body.trim()) {
    return {}
  }
  return JSON.parse(body) as Record<string, unknown>
}

async function fetchPlannerState() {
  const response = await authFetch(plannerStateEndpoint)
  const payload = await parseJsonResponse(response)
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Unable to load planner state.'
    throw new Error(message)
  }
  return sanitizePlannerState(payload.state)
}

async function persistPlannerState(state: WeddingPlannerData) {
  const response = await authFetch(plannerStateEndpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  const payload = await parseJsonResponse(response)
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Unable to persist planner state.'
    throw new Error(message)
  }
}

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WeddingPlannerData>(() => cloneSeedData())
  const [isHydrating, setHydrating] = useState(true)
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false)
  const [saveRetryTick, setSaveRetryTick] = useState(0)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    let isMounted = true
    let retryTimeout: number | undefined

    async function hydratePlannerState() {
      try {
        const remoteState = await fetchPlannerState()
        if (isMounted) {
          setData(remoteState)
          setHasLoadedRemote(true)
          setSyncError('')
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : 'Unable to load planner state.'
          setSyncError(message)
          retryTimeout = window.setTimeout(hydratePlannerState, hydrateRetryMs)
        }
      } finally {
        if (isMounted) {
          setHydrating(false)
        }
      }
    }

    hydratePlannerState()
    return () => {
      isMounted = false
      window.clearTimeout(retryTimeout)
    }
  }, [])

  useEffect(() => {
    // Never save until the real planner has been loaded; otherwise the empty starting
    // state would overwrite everything stored in MongoDB.
    if (isHydrating || !hasLoadedRemote) {
      return
    }

    let retryTimeout: number | undefined
    const timeout = window.setTimeout(async () => {
      try {
        await persistPlannerState(data)
        setSyncError('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to persist planner state.'
        setSyncError(message)
        retryTimeout = window.setTimeout(() => setSaveRetryTick((tick) => tick + 1), hydrateRetryMs)
      }
    }, saveDebounceMs)

    return () => {
      window.clearTimeout(timeout)
      window.clearTimeout(retryTimeout)
    }
  }, [data, isHydrating, hasLoadedRemote, saveRetryTick])

  const budgetMetrics = useMemo<BudgetMetrics>(() => {
    const totalBudget = data.event.totalBudget
    const totalPaid = data.expenses.reduce((sum, expense) => sum + expense.paidAmount, 0)
    const committedAmount = data.expenses.reduce((sum, expense) => {
      if (expense.status === 'Paid') {
        return sum + expense.totalAmount
      }
      if (expense.status === 'Deposit Paid') {
        return sum + Math.max(expense.paidAmount, Math.round(expense.totalAmount * 0.5))
      }
      return sum
    }, 0)

    const remainingBalance = Math.max(0, totalBudget - totalPaid)
    const paidPercent =
      totalBudget === 0 ? 0 : Math.min(100, Math.round((totalPaid / totalBudget) * 100))
    const committedPercent =
      totalBudget === 0 ? 0 : Math.min(100, Math.round((committedAmount / totalBudget) * 100))

    return {
      totalBudget,
      committedAmount,
      totalPaid,
      remainingBalance,
      paidPercent,
      committedPercent,
    }
  }, [data.event.totalBudget, data.expenses])

  const taskCompletion = useMemo(() => {
    const todoItems = data.todos.filter((todo) => !getInviteeNameFromTodoTitle(todo.title))
    const completed = todoItems.filter((todo) => todo.completed).length
    return { completed, total: todoItems.length }
  }, [data.todos])

  const readinessPercent = useMemo(() => {
    const todoRatio = taskCompletion.total === 0 ? 0 : taskCompletion.completed / taskCompletion.total
    const paidRatio =
      budgetMetrics.totalBudget === 0 ? 0 : budgetMetrics.totalPaid / budgetMetrics.totalBudget
    return Math.round((todoRatio * 0.65 + paidRatio * 0.35) * 100)
  }, [budgetMetrics.totalBudget, budgetMetrics.totalPaid, taskCompletion])

  const upcomingPayments = useMemo(() => {
    return data.expenses
      .filter((expense) => expense.status !== 'Paid')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3)
  }, [data.expenses])

  const priorityTasks = useMemo(() => {
    return data.todos
      .filter(
        (todo) =>
          !getInviteeNameFromTodoTitle(todo.title) &&
          todo.priority === 'High' &&
          !todo.completed,
      )
      .slice(0, 4)
  }, [data.todos])

  function replaceData(nextData: WeddingPlannerData) {
    setData(sanitizePlannerState(nextData))
  }

  function addExpense(input: AddExpenseInput, eventId?: string) {
    setData((current) => {
      const normalizedPaid = Math.min(input.paidAmount, input.totalAmount)
      let status: ExpenseStatus = 'Due Soon'
      if (normalizedPaid >= input.totalAmount) {
        status = 'Paid'
      } else if (normalizedPaid > 0) {
        status = 'Deposit Paid'
      }

      const expense: ExpenseItem = {
        id: createId('expense'),
        title: input.title.trim(),
        vendorName: input.vendorName.trim(),
        eventId:
          eventId && current.guests.events.some((event) => event.id === eventId)
            ? eventId
            : undefined,
        category: input.category,
        totalAmount: input.totalAmount,
        paidAmount: normalizedPaid,
        dueDate: input.dueDate,
        status,
      }

      return { ...current, expenses: [expense, ...current.expenses] }
    })
  }

  function cycleExpenseStatus(id: string) {
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => {
        if (expense.id !== id) {
          return expense
        }
        const status = nextStatus(expense.status)
        return {
          ...expense,
          status,
          paidAmount: updatePaidAmountForStatus(expense, status),
        }
      }),
    }))
  }

  function markExpensePaid(id: string) {
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === id
          ? {
              ...expense,
              status: 'Paid',
              paidAmount: expense.totalAmount,
            }
          : expense,
      ),
    }))
  }

  function updateExpenseAmounts(id: string, totalAmount: number, paidAmount: number) {
    const normalizedTotalAmount = Math.max(1, totalAmount)
    const normalizedPaidAmount = Math.max(0, Math.min(paidAmount, normalizedTotalAmount))
    let status: ExpenseStatus = 'Due Soon'
    if (normalizedPaidAmount >= normalizedTotalAmount) {
      status = 'Paid'
    } else if (normalizedPaidAmount > 0) {
      status = 'Deposit Paid'
    }

    setData((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === id
          ? {
              ...expense,
              totalAmount: normalizedTotalAmount,
              paidAmount: normalizedPaidAmount,
              status,
            }
          : expense,
      ),
    }))
  }

  function addTodo(input: AddTodoInput, eventId?: string) {
    setData((current) => {
      const inviteeFromLegacyTodo = getInviteeNameFromTodoTitle(input.title)
      if (inviteeFromLegacyTodo) {
        const defaultEventName = 'Main Event'
        const existingEventIndex = current.guests.events.findIndex(
          (event) => event.name.toLowerCase() === defaultEventName.toLowerCase(),
        )
        const existingEvent =
          existingEventIndex === -1 ? undefined : current.guests.events[existingEventIndex]
        const inviteeAlreadyExists = existingEvent?.invitees.some(
          (invitee) => invitee.name.toLowerCase() === inviteeFromLegacyTodo.toLowerCase(),
        )
        if (inviteeAlreadyExists) {
          return current
        }

        const newInvitee: InviteeChecklistItem = {
          id: createId('invitee'),
          name: inviteeFromLegacyTodo,
          completed: false,
        }
        const events =
          existingEventIndex === -1
            ? [
                {
                  id: createId('event'),
                  name: defaultEventName,
                  date: getCurrentDateString(),
                  details: '',
                  invitees: [newInvitee],
                },
                ...current.guests.events,
              ]
            : current.guests.events.map((event, index) =>
                index === existingEventIndex
                  ? { ...event, invitees: [...event.invitees, newInvitee] }
                  : event,
              )

        return {
          ...current,
          guests: updateGuestsWithEvents(current.guests, events),
        }
      }

      const todo: TodoItem = {
        id: createId('todo'),
        title: input.title.trim(),
        eventId:
          eventId && current.guests.events.some((event) => event.id === eventId)
            ? eventId
            : undefined,
        milestone: 'General',
        dueDate: input.dueDate?.trim() || '',
        completed: false,
        priority: input.priority,
      }
      return { ...current, todos: [todo, ...current.todos] }
    })
  }

  function addGuestEvent(input: AddGuestEventInput) {
    const normalizedEventName = normalizeInviteeName(input.name)
    const normalizedEventDetails = normalizeInviteeName(input.details ?? '')
    const normalizedEventDate =
      typeof input.date === 'string' && input.date.trim()
        ? input.date.trim()
        : getCurrentDateString()
    if (!normalizedEventName) {
      return
    }

    setData((current) => {
      const typedMembers = input.members
        .map((name) => normalizeInviteeName(name))
        .filter((name) => name.length > 0)
      const selectedQuickAddIds = Array.isArray(input.quickAddEventIds)
        ? input.quickAddEventIds
        : []
      const quickAddMembers = current.guests.events
        .filter((event) => selectedQuickAddIds.includes(event.id))
        .flatMap((event) => event.invitees.map((invitee) => invitee.name))
      const combinedMembers = [...typedMembers, ...quickAddMembers]
      const uniqueMembersByName = new Map<string, string>()
      for (const memberName of combinedMembers) {
        const key = memberName.toLowerCase()
        if (!uniqueMembersByName.has(key)) {
          uniqueMembersByName.set(key, memberName)
        }
      }
      const uniqueMembers = Array.from(uniqueMembersByName.values())

      const invitees: InviteeChecklistItem[] = uniqueMembers.map((name) => ({
        id: createId('invitee'),
        name,
        completed: false,
      }))
      const events: GuestEventItem[] = [
        {
          id: createId('event'),
          name: normalizedEventName,
          date: normalizedEventDate,
          details: normalizedEventDetails,
          invitees,
        },
        ...current.guests.events,
      ]

      return {
        ...current,
        guests: updateGuestsWithEvents(current.guests, events),
      }
    })
  }

  function addEventInvitees(eventId: string, names: string[]) {
    if (!Array.isArray(names) || names.length === 0) {
      return
    }

    setData((current) => {
      const eventIndex = current.guests.events.findIndex((event) => event.id === eventId)
      if (eventIndex === -1) {
        return current
      }

      const normalizedNames = names
        .map((name) => normalizeInviteeName(name))
        .filter((name) => name.length > 0)
      if (normalizedNames.length === 0) {
        return current
      }

      const targetEvent = current.guests.events[eventIndex]
      const existingNames = new Set(targetEvent.invitees.map((invitee) => invitee.name.toLowerCase()))
      const uniqueNamesToAdd = normalizedNames.filter((name) => {
        const key = name.toLowerCase()
        if (existingNames.has(key)) {
          return false
        }
        existingNames.add(key)
        return true
      })
      if (uniqueNamesToAdd.length === 0) {
        return current
      }

      const nextInvitees = [
        ...targetEvent.invitees,
        ...uniqueNamesToAdd.map((name) => ({
          id: createId('invitee'),
          name,
          completed: false,
        })),
      ]

      const events = current.guests.events.map((event, index) =>
        index === eventIndex
          ? { ...event, invitees: nextInvitees }
          : event,
      )

      return {
        ...current,
        guests: updateGuestsWithEvents(current.guests, events),
      }
    })
  }

  function toggleTodo(id: string) {
    setData((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    }))
  }

  function updateTodo(id: string, input: AddTodoInput & { completed: boolean }) {
    const normalizedTitle = input.title.trim()
    const normalizedDueDate = input.dueDate?.trim() || ''
    if (!normalizedTitle || !normalizedDueDate) {
      return
    }

    setData((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              title: normalizedTitle,
              dueDate: normalizedDueDate,
              priority: input.priority,
              completed: input.completed,
            }
          : todo,
      ),
    }))
  }

  function removeTodo(id: string) {
    setData((current) => ({
      ...current,
      todos: current.todos.filter((todo) => todo.id !== id),
    }))
  }

  function toggleEventInvitee(eventId: string, inviteeId: string) {
    setData((current) => {
      const events = current.guests.events.map((event) =>
        event.id !== eventId
          ? event
          : {
              ...event,
              invitees: event.invitees.map((invitee) =>
                invitee.id === inviteeId
                  ? { ...invitee, completed: !invitee.completed }
                  : invitee,
              ),
            },
      )

      return {
        ...current,
        guests: updateGuestsWithEvents(current.guests, events),
      }
    })
  }

  function removeEventInvitee(eventId: string, inviteeId: string) {
    setData((current) => {
      const events = current.guests.events.map((event) =>
        event.id !== eventId
          ? event
          : {
              ...event,
              invitees: event.invitees.filter((invitee) => invitee.id !== inviteeId),
            },
      )

      return {
        ...current,
        guests: updateGuestsWithEvents(current.guests, events),
      }
    })
  }

  function removeGuestEvent(eventId: string) {
    setData((current) => {
      const events = current.guests.events.filter((event) => event.id !== eventId)
      return {
        ...current,
        expenses: current.expenses.filter((expense) => expense.eventId !== eventId),
        todos: current.todos.filter((todo) => todo.eventId !== eventId),
        vendors: current.vendors.filter((vendor) => vendor.eventId !== eventId),
        guests: updateGuestsWithEvents(current.guests, events),
      }
    })
  }

  function addVendor(input: AddVendorInput, eventId?: string) {
    setData((current) => {
      const paidAmount = Math.max(0, Math.min(input.paidAmount, input.totalContract))
      const vendor: VendorItem = {
        id: createId('vendor'),
        name: input.name.trim(),
        eventId:
          eventId && current.guests.events.some((event) => event.id === eventId)
            ? eventId
            : undefined,
        role: input.role.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        totalContract: Math.max(0, input.totalContract),
        paidAmount,
        notes: input.notes.trim(),
      }

      return { ...current, vendors: [vendor, ...current.vendors] }
    })
  }

  function updateVendorPhone(id: string, phone: string) {
    const normalizedPhone = phone.trim()
    if (!normalizedPhone) {
      return
    }

    setData((current) => ({
      ...current,
      vendors: current.vendors.map((vendor) =>
        vendor.id === id ? { ...vendor, phone: normalizedPhone } : vendor,
      ),
    }))
  }

  const value: WeddingContextValue = {
    data,
    isHydrating,
    syncError,
    budgetMetrics,
    readinessPercent,
    taskCompletion,
    upcomingPayments,
    priorityTasks,
    replaceData,
    addExpense,
    cycleExpenseStatus,
    markExpensePaid,
    updateExpenseAmounts,
    addTodo,
    addGuestEvent,
    addEventInvitees,
    toggleEventInvitee,
    removeEventInvitee,
    removeGuestEvent,
    toggleTodo,
    updateTodo,
    removeTodo,
    addVendor,
    updateVendorPhone,
  }

  return <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>
}
