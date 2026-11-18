import { randomUUID } from 'node:crypto'

// Every tool the agent can call. `params` documents the payload for the model;
// `run` mutates the draft planner state and returns a short summary or throws a ToolError.

const EXPENSE_CATEGORIES = ['Venue', 'Catering', 'Attire', 'Photography', 'Decor', 'Others']

class ToolError extends Error {}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function hasValue(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== null
}

function money(value, label) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ToolError(`${label} must be a non-negative number.`)
  }
  return Math.round(parsed)
}

// The user's local "today" for the actions currently being applied (set by applyAssistantActions).
let activeToday = ''

function isoDate(value, fallbackToday = true) {
  const raw = text(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(raw).getTime())) {
    return raw
  }
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }
  return fallbackToday ? activeToday || new Date().toISOString().slice(0, 10) : ''
}

function priority(value) {
  if (value === true) return 'High'
  const normalized = text(value).toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'low') return 'Low'
  return 'Medium'
}

function category(value, title = '') {
  const normalized = text(value).toLowerCase()
  const exact = EXPENSE_CATEGORIES.find((entry) => entry.toLowerCase() === normalized)
  if (exact) return exact
  const hint = `${normalized} ${title.toLowerCase()}`
  if (/(hall|mandapam|venue|kalyana mandapam|function hall|resort)/.test(hint)) return 'Venue'
  if (/(food|cater|lunch|dinner|breakfast|bhojanam|sweets|meal)/.test(hint)) return 'Catering'
  if (/(saree|sari|attire|dress|jewel|sherwani|pattu|blouse|outfit|makeup)/.test(hint)) return 'Attire'
  if (/(photo|video|camera|album|drone)/.test(hint)) return 'Photography'
  if (/(decor|flower|garland|mandap decor|lighting|stage|rangoli)/.test(hint)) return 'Decor'
  return 'Others'
}

function todoKind(value) {
  return text(value).toLowerCase() === 'buy' ? 'buy' : 'task'
}

function applyTodoKind(todo, value) {
  if (todoKind(value) === 'buy') todo.kind = 'buy'
  else delete todo.kind
}

function expenseStatus(totalAmount, paidAmount) {
  if (paidAmount >= totalAmount) return 'Paid'
  if (paidAmount > 0) return 'Deposit Paid'
  return 'Due Soon'
}

function id(prefix) {
  return `${prefix}-${randomUUID()}`
}

// The UI turns todos titled "Invite <name>" into invitees, so keep agent-created tasks clear of that pattern.
function safeTodoTitle(title) {
  return /^invite(?:\s*[:-]\s*|\s+)/i.test(title) ? title.replace(/^invite/i, 'Invitation') : title
}

// Resolve a reference given as an id or as a (partial) name, case-insensitively.
function findByRef(items, ref, nameKey, label) {
  const value = text(ref)
  if (!value) {
    throw new ToolError(`${label} reference is required.`)
  }
  const lower = value.toLowerCase()
  const match =
    items.find((item) => item.id === value) ||
    items.find((item) => text(item[nameKey]).toLowerCase() === lower) ||
    items.filter((item) => text(item[nameKey]).toLowerCase().includes(lower))
  if (Array.isArray(match)) {
    if (match.length === 1) return match[0]
    if (match.length > 1) {
      throw new ToolError(`"${value}" matches multiple ${label}s: ${match.map((item) => item[nameKey]).join(', ')}.`)
    }
    throw new ToolError(`No ${label} found matching "${value}".`)
  }
  return match
}

function events(state) {
  return state.guests.events
}

// Optional event link: "" or null unlinks, undefined keeps current value.
function resolveEventLink(state, ref) {
  if (ref === undefined) return undefined
  if (ref === null || text(ref) === '') return ''
  return findByRef(events(state), ref, 'name', 'event').id
}

function syncGuestTotals(state) {
  const invitees = events(state).flatMap((event) => event.invitees)
  state.guests.totalInvited = invitees.length
  state.guests.pending = invitees.filter((invitee) => !invitee.completed).length
}

function addUniqueInvitees(event, names) {
  const existing = new Set(event.invitees.map((invitee) => invitee.name.toLowerCase()))
  const added = []
  for (const raw of names) {
    const name = text(raw)
    if (!name || existing.has(name.toLowerCase())) continue
    existing.add(name.toLowerCase())
    event.invitees.push({ id: id('invitee'), name, completed: false })
    added.push(name)
  }
  return added
}

function namesList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  const single = text(value)
  return single ? single.split(/\s*,\s*|\s+and\s+/i).filter(Boolean) : []
}

function applyEventLink(item, state, payload, key = 'eventId') {
  const link = resolveEventLink(state, payload[key])
  if (link === undefined) return
  if (link) item.eventId = link
  else delete item.eventId
}

const tools = {
  // ---------- Wedding details ----------
  updateWeddingDetails: {
    params: '{"coupleNames"?,"weddingDate"?:"YYYY-MM-DD","venueName"?,"venueCity"?,"totalBudget"?:number}',
    description: 'Set overall wedding info. totalBudget sets the planned spend shown on Payments.',
    run(state, payload) {
      const event = state.event
      const changed = []
      for (const key of ['coupleNames', 'venueName', 'venueCity']) {
        if (hasValue(payload, key)) {
          event[key] = text(payload[key])
          changed.push(key)
        }
      }
      if (hasValue(payload, 'weddingDate')) {
        event.weddingDate = isoDate(payload.weddingDate)
        changed.push('weddingDate')
      }
      if (hasValue(payload, 'totalBudget')) {
        event.totalBudget = money(payload.totalBudget, 'totalBudget')
        changed.push('totalBudget')
      }
      if (changed.length === 0) throw new ToolError('No wedding details were provided.')
      return `Updated wedding details (${changed.join(', ')})`
    },
  },

  // ---------- Events / ceremonies ----------
  addEvent: {
    params: '{"name","date"?:"YYYY-MM-DD","details"?,"notes"?,"invitees"?:["name"],"copyInviteesFrom"?:["event id or name"]}',
    description: 'Create a ceremony/event (Sangeet, Haldi, Muhurtham...) optionally with invitees and notes.',
    run(state, payload) {
      const name = text(payload.name)
      if (!name) throw new ToolError('Event name is required.')
      if (events(state).some((event) => event.name.toLowerCase() === name.toLowerCase())) {
        throw new ToolError(`An event named "${name}" already exists.`)
      }
      const event = {
        id: id('event'),
        name,
        date: isoDate(payload.date),
        details: text(payload.details),
        notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
        invitees: [],
      }
      const copied = (Array.isArray(payload.copyInviteesFrom) ? payload.copyInviteesFrom : [])
        .flatMap((ref) => findByRef(events(state), ref, 'name', 'event').invitees.map((invitee) => invitee.name))
      const added = addUniqueInvitees(event, [...namesList(payload.invitees), ...copied])
      events(state).unshift(event)
      syncGuestTotals(state)
      return `Created event "${name}" on ${event.date}${added.length ? ` with ${added.length} invitee(s)` : ''}`
    },
  },
  updateEvent: {
    params: '{"event":"id or name","name"?,"date"?:"YYYY-MM-DD","details"?,"notes"?}',
    description: 'Edit an event: rename, change date, details, or notes (notes replaces the existing notes).',
    run(state, payload) {
      const event = findByRef(events(state), payload.event ?? payload.eventId, 'name', 'event')
      if (hasValue(payload, 'name') && text(payload.name)) event.name = text(payload.name)
      if (hasValue(payload, 'date')) event.date = isoDate(payload.date)
      if (hasValue(payload, 'details')) event.details = text(payload.details)
      if (typeof payload.notes === 'string') event.notes = payload.notes.trim()
      return `Updated event "${event.name}"`
    },
  },
  removeEvent: {
    params: '{"event":"id or name"}',
    description: 'Delete an event. Like the app, this also deletes its linked tasks, payments and vendors.',
    run(state, payload) {
      const event = findByRef(events(state), payload.event ?? payload.eventId, 'name', 'event')
      state.guests.events = events(state).filter((entry) => entry.id !== event.id)
      state.todos = state.todos.filter((entry) => entry.eventId !== event.id)
      state.expenses = state.expenses.filter((entry) => entry.eventId !== event.id)
      state.vendors = state.vendors.filter((entry) => entry.eventId !== event.id)
      syncGuestTotals(state)
      return `Removed event "${event.name}" and its linked items`
    },
  },
  addInvitees: {
    params: '{"event":"id or name","names":["name"]}',
    description: 'Invite guests to an existing event.',
    run(state, payload) {
      const event = findByRef(events(state), payload.event ?? payload.eventId, 'name', 'event')
      const added = addUniqueInvitees(event, namesList(payload.names))
      if (added.length === 0) throw new ToolError(`No new invitees to add to "${event.name}".`)
      syncGuestTotals(state)
      return `Invited ${added.join(', ')} to "${event.name}"`
    },
  },
  setInviteeConfirmed: {
    params: '{"event":"id or name","invitee":"id or name","confirmed":boolean}',
    description: 'Mark an invitee as confirmed (attending) or not confirmed.',
    run(state, payload) {
      const event = findByRef(events(state), payload.event ?? payload.eventId, 'name', 'event')
      const invitee = findByRef(event.invitees, payload.invitee ?? payload.inviteeId, 'name', 'invitee')
      invitee.completed = payload.confirmed !== false
      syncGuestTotals(state)
      return `${invitee.name} ${invitee.completed ? 'confirmed' : 'marked not confirmed'} for "${event.name}"`
    },
  },
  removeInvitee: {
    params: '{"event":"id or name","invitee":"id or name"}',
    description: 'Remove a guest from an event.',
    run(state, payload) {
      const event = findByRef(events(state), payload.event ?? payload.eventId, 'name', 'event')
      const invitee = findByRef(event.invitees, payload.invitee ?? payload.inviteeId, 'name', 'invitee')
      event.invitees = event.invitees.filter((entry) => entry.id !== invitee.id)
      syncGuestTotals(state)
      return `Removed ${invitee.name} from "${event.name}"`
    },
  },

  // ---------- Tasks ----------
  addTodo: {
    params: '{"title","kind"?:"task|buy","dueDate"?:"YYYY-MM-DD","priority"?:"High|Medium|Low","event"?:"id or name"}',
    description: 'Add a checklist task / reminder / follow-up. Use kind "buy" for shopping items (things to buy).',
    run(state, payload) {
      const title = safeTodoTitle(text(payload.title))
      if (!title) throw new ToolError('Task title is required.')
      const todo = {
        id: id('todo'),
        title,
        milestone: 'General',
        dueDate: isoDate(payload.dueDate),
        completed: false,
        priority: priority(payload.priority),
      }
      applyTodoKind(todo, payload.kind)
      applyEventLink(todo, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      state.todos.unshift(todo)
      return `Added ${todo.kind === 'buy' ? 'item to buy' : 'task'} "${title}" (${todo.priority}, due ${todo.dueDate})`
    },
  },
  updateTodo: {
    params: '{"todo":"id or title","title"?,"kind"?:"task|buy","dueDate"?:"YYYY-MM-DD","priority"?:"High|Medium|Low","completed"?:boolean,"event"?:"id or name or \\"\\" to unlink"}',
    description: 'Edit a task or item to buy: rename, reschedule, change priority/kind, mark done/bought, link/unlink event.',
    run(state, payload) {
      const todo = findByRef(state.todos, payload.todo ?? payload.todoId ?? payload.todoTitle, 'title', 'task')
      if (hasValue(payload, 'title') && text(payload.title)) todo.title = safeTodoTitle(text(payload.title))
      if (hasValue(payload, 'kind')) applyTodoKind(todo, payload.kind)
      if (hasValue(payload, 'dueDate')) todo.dueDate = isoDate(payload.dueDate)
      if (hasValue(payload, 'priority')) todo.priority = priority(payload.priority)
      if (typeof payload.completed === 'boolean') todo.completed = payload.completed
      applyEventLink(todo, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      return `Updated task "${todo.title}"`
    },
  },
  removeTodo: {
    params: '{"todo":"id or title"}',
    description: 'Delete a task.',
    run(state, payload) {
      const todo = findByRef(state.todos, payload.todo ?? payload.todoId, 'title', 'task')
      state.todos = state.todos.filter((entry) => entry.id !== todo.id)
      return `Deleted task "${todo.title}"`
    },
  },

  // ---------- Payments ----------
  addExpense: {
    params: '{"title","totalAmount":number,"paidAmount"?:number,"category"?:"Venue|Catering|Attire|Photography|Decor|Others","dueDate"?:"YYYY-MM-DD","event"?:"id or name"}',
    description: 'Add a payment / expense. If paidAmount is omitted the payment is recorded as FULLY PAID; pass paidAmount 0 for an unpaid due/reminder, or the advance amount for a partial payment.',
    run(state, payload) {
      const title = text(payload.title)
      if (!title) throw new ToolError('Payment title is required.')
      const totalAmount = money(payload.totalAmount, 'totalAmount')
      if (totalAmount <= 0) throw new ToolError('Payment total must be greater than 0.')
      const paidAmount = Math.min(totalAmount, money(payload.paidAmount ?? totalAmount, 'paidAmount'))
      const expense = {
        id: id('expense'),
        title,
        vendorName: '',
        category: category(payload.category, title),
        totalAmount,
        paidAmount,
        dueDate: isoDate(payload.dueDate),
        status: expenseStatus(totalAmount, paidAmount),
      }
      applyEventLink(expense, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      state.expenses.unshift(expense)
      return `Added payment "${title}" (₹${paidAmount} of ₹${totalAmount} paid, ${expense.category})`
    },
  },
  updateExpense: {
    params: '{"expense":"id or title","title"?,"category"?,"totalAmount"?:number,"paidAmount"?:number,"dueDate"?:"YYYY-MM-DD","event"?:"id or name or \\"\\" to unlink"}',
    description: 'Edit a payment. paidAmount here is the NEW total paid so far (absolute).',
    run(state, payload) {
      const expense = findByRef(state.expenses, payload.expense ?? payload.expenseId ?? payload.expenseTitle, 'title', 'payment')
      if (hasValue(payload, 'title') && text(payload.title)) expense.title = text(payload.title)
      if (hasValue(payload, 'category')) expense.category = category(payload.category, expense.title)
      if (hasValue(payload, 'totalAmount')) {
        const total = money(payload.totalAmount, 'totalAmount')
        if (total <= 0) throw new ToolError('Payment total must be greater than 0.')
        expense.totalAmount = total
      }
      if (hasValue(payload, 'paidAmount')) expense.paidAmount = money(payload.paidAmount, 'paidAmount')
      expense.paidAmount = Math.min(expense.paidAmount, expense.totalAmount)
      if (hasValue(payload, 'dueDate')) expense.dueDate = isoDate(payload.dueDate)
      applyEventLink(expense, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      expense.status = expenseStatus(expense.totalAmount, expense.paidAmount)
      return `Updated payment "${expense.title}"`
    },
  },
  recordPayment: {
    params: '{"expense":"id or title","amount":number}',
    description: 'Add an installment to an existing payment (e.g., "paid 20k more for catering").',
    run(state, payload) {
      const expense = findByRef(state.expenses, payload.expense ?? payload.expenseId, 'title', 'payment')
      const amount = money(payload.amount, 'amount')
      if (amount <= 0) throw new ToolError('Installment amount must be greater than 0.')
      expense.paidAmount = Math.min(expense.totalAmount, expense.paidAmount + amount)
      expense.status = expenseStatus(expense.totalAmount, expense.paidAmount)
      return `Recorded ₹${amount} for "${expense.title}" (now ₹${expense.paidAmount} of ₹${expense.totalAmount})`
    },
  },
  markExpensePaid: {
    params: '{"expense":"id or title"}',
    description: 'Mark a payment as fully paid/settled.',
    run(state, payload) {
      const expense = findByRef(state.expenses, payload.expense ?? payload.expenseId ?? payload.expenseTitle, 'title', 'payment')
      expense.paidAmount = expense.totalAmount
      expense.status = 'Paid'
      return `Marked "${expense.title}" fully paid`
    },
  },
  removeExpense: {
    params: '{"expense":"id or title"}',
    description: 'Delete a payment.',
    run(state, payload) {
      const expense = findByRef(state.expenses, payload.expense ?? payload.expenseId, 'title', 'payment')
      state.expenses = state.expenses.filter((entry) => entry.id !== expense.id)
      return `Deleted payment "${expense.title}"`
    },
  },

  // ---------- Vendors ----------
  addVendor: {
    params: '{"name","phone"?,"totalContract"?:number,"paidAmount"?:number,"notes"?,"event"?:"id or name"}',
    description: 'Save a vendor (florist, purohit, caterer, photographer...).',
    run(state, payload) {
      const name = text(payload.name)
      if (!name) throw new ToolError('Vendor name is required.')
      const totalContract = money(payload.totalContract ?? 0, 'totalContract')
      const vendor = {
        id: id('vendor'),
        name,
        role: '',
        phone: text(payload.phone),
        email: '',
        totalContract,
        paidAmount: Math.min(totalContract, money(payload.paidAmount ?? 0, 'paidAmount')),
        notes: text(payload.notes),
      }
      applyEventLink(vendor, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      state.vendors.unshift(vendor)
      return `Added vendor "${name}"`
    },
  },
  updateVendor: {
    params: '{"vendor":"id or name","name"?,"phone"?,"totalContract"?:number,"paidAmount"?:number,"notes"?,"event"?:"id or name or \\"\\" to unlink"}',
    description: 'Edit a vendor: phone, contract, amount paid, notes, event link.',
    run(state, payload) {
      const vendor = findByRef(state.vendors, payload.vendor ?? payload.vendorId, 'name', 'vendor')
      if (hasValue(payload, 'name') && text(payload.name)) vendor.name = text(payload.name)
      if (hasValue(payload, 'phone')) vendor.phone = text(payload.phone)
      if (hasValue(payload, 'notes')) vendor.notes = text(payload.notes)
      if (hasValue(payload, 'totalContract')) vendor.totalContract = money(payload.totalContract, 'totalContract')
      if (hasValue(payload, 'paidAmount')) vendor.paidAmount = money(payload.paidAmount, 'paidAmount')
      vendor.paidAmount = Math.min(vendor.paidAmount, vendor.totalContract)
      applyEventLink(vendor, state, payload, hasValue(payload, 'event') ? 'event' : 'eventId')
      return `Updated vendor "${vendor.name}"`
    },
  },
  removeVendor: {
    params: '{"vendor":"id or name"}',
    description: 'Delete a vendor.',
    run(state, payload) {
      const vendor = findByRef(state.vendors, payload.vendor ?? payload.vendorId, 'name', 'vendor')
      state.vendors = state.vendors.filter((entry) => entry.id !== vendor.id)
      return `Deleted vendor "${vendor.name}"`
    },
  },
}

const toolAliases = {
  addexpense: 'addExpense', addpayment: 'addExpense', createexpense: 'addExpense', createpayment: 'addExpense',
  updateexpense: 'updateExpense', updatepayment: 'updateExpense', editpayment: 'updateExpense',
  recordpayment: 'recordPayment', addinstallment: 'recordPayment', payinstallment: 'recordPayment',
  markexpensepaid: 'markExpensePaid', markpaid: 'markExpensePaid', settleexpense: 'markExpensePaid',
  removeexpense: 'removeExpense', deleteexpense: 'removeExpense', removepayment: 'removeExpense', deletepayment: 'removeExpense',
  addtodo: 'addTodo', addtask: 'addTodo', createtask: 'addTodo', createtodo: 'addTodo',
  updatetodo: 'updateTodo', updatetask: 'updateTodo', edittask: 'updateTodo', completetodo: 'updateTodo',
  removetodo: 'removeTodo', deletetodo: 'removeTodo', removetask: 'removeTodo', deletetask: 'removeTodo',
  addvendor: 'addVendor', createvendor: 'addVendor',
  updatevendor: 'updateVendor', editvendor: 'updateVendor',
  removevendor: 'removeVendor', deletevendor: 'removeVendor',
  addevent: 'addEvent', createevent: 'addEvent', addceremony: 'addEvent',
  updateevent: 'updateEvent', editevent: 'updateEvent',
  removeevent: 'removeEvent', deleteevent: 'removeEvent',
  addinvitees: 'addInvitees', addinvitee: 'addInvitees', inviteguests: 'addInvitees', addguests: 'addInvitees',
  setinviteeconfirmed: 'setInviteeConfirmed', confirminvitee: 'setInviteeConfirmed',
  removeinvitee: 'removeInvitee', deleteinvitee: 'removeInvitee',
  updateweddingdetails: 'updateWeddingDetails', setbudget: 'updateWeddingDetails',
}

function resolveToolName(value) {
  const raw = text(value)
  if (tools[raw]) return raw
  return toolAliases[raw.toLowerCase().replace(/[^a-z]/g, '')] || ''
}

export function describeTools() {
  return Object.entries(tools)
    .map(([name, tool]) => `- ${name} ${tool.params} — ${tool.description}`)
    .join('\n')
}

// Applies actions in order on a copy of the state. Later actions can reference
// items created by earlier ones by name (e.g. create an event, then add a task to it).
export function applyAssistantActions(actions, currentState, options = {}) {
  activeToday = typeof options.today === 'string' ? options.today : ''
  let state = structuredClone(currentState)
  if (!isRecord(state.guests)) state.guests = { events: [] }
  if (!Array.isArray(state.guests.events)) state.guests.events = []
  for (const key of ['todos', 'expenses', 'vendors']) {
    if (!Array.isArray(state[key])) state[key] = []
  }
  if (!isRecord(state.event)) state.event = {}

  const applied = []
  const failed = []

  for (const action of Array.isArray(actions) ? actions : []) {
    const name = resolveToolName(action?.type)
    if (!name) {
      failed.push({ type: text(action?.type) || 'unknown', reason: 'Unknown action.' })
      continue
    }
    const payload = isRecord(action.payload) ? action.payload : {}
    const working = structuredClone(state)
    try {
      applied.push({ type: name, summary: tools[name].run(working, payload) })
      state = working
    } catch (error) {
      if (!(error instanceof ToolError)) throw error
      failed.push({ type: name, reason: error.message })
    }
  }

  return { state, appliedActions: applied, failedActions: failed }
}

const CARD_SOURCES = {
  vendor: { list: (state) => state?.vendors ?? [], nameKey: 'name' },
  payment: { list: (state) => state?.expenses ?? [], nameKey: 'title' },
  task: { list: (state) => state?.todos ?? [], nameKey: 'title' },
  event: { list: (state) => state?.guests?.events ?? [], nameKey: 'name' },
}

// Resolves the model's requested cards ({type, ref}) against the final planner state, so the
// client only ever receives ids that exist. Unknown or ambiguous references are dropped silently.
export function resolveCards(cards, state) {
  if (!Array.isArray(cards)) return []
  const seen = new Set()
  const resolved = []
  for (const card of cards.slice(0, 8)) {
    const type = text(card?.type).toLowerCase()
    const source = CARD_SOURCES[type]
    if (!source) continue
    try {
      const item = findByRef(source.list(state), card.ref ?? card.id ?? card.name ?? card.title, source.nameKey, type)
      const key = `${type}:${item.id}`
      if (!seen.has(key)) {
        seen.add(key)
        resolved.push({ type, id: item.id })
      }
    } catch (error) {
      if (!(error instanceof ToolError)) throw error
    }
  }
  return resolved
}

// Compact view of planner data for the model: fewer tokens, ids included for precise references.
export function buildPlannerSnapshot(state) {
  const eventName = new Map((state?.guests?.events ?? []).map((event) => [event.id, event.name]))
  const linked = (eventId) => (eventId && eventName.has(eventId) ? eventName.get(eventId) : undefined)
  return {
    wedding: state?.event ?? {},
    events: (state?.guests?.events ?? []).map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      details: event.details || undefined,
      notes: event.notes || undefined,
      invitees: event.invitees.map((invitee) => ({ id: invitee.id, name: invitee.name, confirmed: invitee.completed })),
    })),
    tasks: (state?.todos ?? []).map((todo) => ({
      id: todo.id,
      title: todo.title,
      kind: todo.kind === 'buy' ? 'buy' : undefined,
      dueDate: todo.dueDate,
      priority: todo.priority,
      done: Boolean(todo.completed),
      event: linked(todo.eventId),
    })),
    payments: (state?.expenses ?? []).map((expense) => ({
      id: expense.id,
      title: expense.title,
      category: expense.category,
      total: expense.totalAmount,
      paid: expense.paidAmount,
      dueDate: expense.dueDate,
      event: linked(expense.eventId),
    })),
    vendors: (state?.vendors ?? []).map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone || undefined,
      contract: vendor.totalContract,
      paid: vendor.paidAmount,
      notes: vendor.notes || undefined,
      event: linked(vendor.eventId),
    })),
  }
}
