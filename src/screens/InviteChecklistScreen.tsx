import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { PaymentCard, SectionTitle, TodoCard, VendorCard } from '../components/Cards'
import { DetailHeader, EmptyStateCard, FieldLabel, PageHeader, SheetModal } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import type { OpenItem } from '../navigation'
import { EXPENSE_CATEGORIES, type ExpenseCategory, type GuestEventItem, type TodoPriority } from '../types/wedding'
import {
  compareEventsNearestFirst,
  formatDate,
  resolvePaidAmount,
  sanitizePhone,
  todayString,
} from '../utils/weddingFormat'

type ComposerKind = 'invite' | 'todo' | 'buy' | 'payment' | 'vendor'

const composerTabs: Array<[ComposerKind, string]> = [
  ['invite', 'Invitee'],
  ['todo', 'To-Do'],
  ['buy', 'Item to buy'],
  ['payment', 'Payment'],
  ['vendor', 'Vendor'],
]

interface ComposerState {
  title: string
  dueDate: string
  priority: TodoPriority
  category: ExpenseCategory
  total: string
  paid: string
  phone: string
  notes: string
  inviteeInput: string
  invitees: string[]
}

function emptyComposer(): ComposerState {
  return {
    title: '',
    dueDate: todayString(),
    priority: 'Medium',
    category: 'Others',
    total: '',
    paid: '',
    phone: '',
    notes: '',
    inviteeInput: '',
    invitees: [],
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function EventSummaryCard({
  event,
  counts,
  onSelect,
}: {
  event: GuestEventItem
  counts: { todos: number; buy: number; payments: number; vendors: number }
  onSelect: () => void
}) {
  const confirmed = event.invitees.filter((invitee) => invitee.completed).length
  const stats: Array<[string, string]> = [
    ['Invites', `${confirmed}/${event.invitees.length}`],
    ['To-Dos', String(counts.todos)],
    ['To buy', String(counts.buy)],
    ['Payments', String(counts.payments)],
    ['Vendors', String(counts.vendors)],
  ]
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full space-y-2 rounded-2xl border border-brass-line bg-silk p-3 text-left shadow-soft transition-colors hover:border-champagne/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-charcoal">{event.name}</h3>
          <p className="text-xs font-semibold tabular-nums text-champagne">
            {event.date ? formatDate(event.date) : 'Date not set'}
          </p>
        </div>
      </div>
      {event.details ? <p className="line-clamp-2 text-xs text-muted-taupe">{event.details}</p> : null}
      <div className="grid grid-cols-5 gap-1 border-t border-brass-line/70 pt-2 text-center tabular-nums">
        {stats.map(([label, value]) => (
          <div key={label}>
            <p className="text-sm font-bold text-charcoal">{value}</p>
            <p className="text-[10px] text-muted-taupe">{label}</p>
          </div>
        ))}
      </div>
    </button>
  )
}

interface InviteChecklistScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
  initialItemId?: string
  onOpenItem?: OpenItem
}

export function InviteChecklistScreen({
  onQuickActionVisibilityChange,
  initialItemId,
  onOpenItem,
}: InviteChecklistScreenProps) {
  const {
    data,
    addEventInvitees,
    addExpense,
    addTodo,
    addVendor,
    toggleTodo,
    toggleEventInvitee,
    removeEventInvitee,
    removeGuestEvent,
    updateGuestEvent,
    markExpensePaid,
    markVendorPaid,
  } = useWedding()

  const [selectedEventId, setSelectedEventId] = useState(() =>
    initialItemId && data.guests.events.some((event) => event.id === initialItemId) ? initialItemId : '',
  )
  const [composerKind, setComposerKind] = useState<ComposerKind | null>(null)
  const [composer, setComposer] = useState<ComposerState>(emptyComposer)
  const [composerError, setComposerError] = useState('')
  const [isEditingEvent, setEditingEvent] = useState(false)
  const [eventForm, setEventForm] = useState({ name: '', date: '', details: '', notes: '' })
  const [eventFormError, setEventFormError] = useState('')
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [inviteSearch, setInviteSearch] = useState('')
  const [buyDraft, setBuyDraft] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const events = useMemo(() => [...data.guests.events].sort(compareEventsNearestFirst), [data.guests.events])
  const selectedEvent = data.guests.events.find((event) => event.id === selectedEventId) ?? null

  useEffect(() => {
    if (!onQuickActionVisibilityChange) return
    onQuickActionVisibilityChange(!selectedEvent)
    return () => onQuickActionVisibilityChange(true)
  }, [onQuickActionVisibilityChange, selectedEvent])

  function openEvent(id: string) {
    setSelectedEventId(id)
    setInviteSearch('')
    setNotesDraft(null)
    setConfirmRemove(false)
  }

  function closeEvent() {
    setSelectedEventId('')
    setComposerKind(null)
    setEditingEvent(false)
    setNotesDraft(null)
    setConfirmRemove(false)
  }

  function openComposer(kind: ComposerKind) {
    setComposer(emptyComposer())
    setComposerError('')
    setComposerKind(kind)
  }

  function closeComposer() {
    setComposerKind(null)
    setComposerError('')
  }

  function addInviteeChip(rawName: string) {
    const name = normalizeName(rawName)
    if (!name) return
    setComposer((current) =>
      current.invitees.some((entry) => entry.toLowerCase() === name.toLowerCase())
        ? { ...current, inviteeInput: '' }
        : { ...current, inviteeInput: '', invitees: [...current.invitees, name] },
    )
  }

  function handleInviteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addInviteeChip(composer.inviteeInput)
  }

  function submitComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEvent || !composerKind) return
    setComposerError('')

    if (composerKind === 'invite') {
      const pending = normalizeName(composer.inviteeInput)
      const names = pending ? [...composer.invitees, pending] : composer.invitees
      if (names.length === 0) {
        setComposerError('Add at least one name.')
        return
      }
      addEventInvitees(selectedEvent.id, names)
    } else if (composerKind === 'todo' || composerKind === 'buy') {
      if (!composer.title.trim()) {
        setComposerError(composerKind === 'buy' ? 'What do you need to buy?' : 'Please add a title.')
        return
      }
      addTodo(
        { title: composer.title, dueDate: composer.dueDate, priority: composer.priority, kind: composerKind === 'buy' ? 'buy' : 'task' },
        selectedEvent.id,
      )
    } else if (composerKind === 'payment') {
      const total = Number(composer.total)
      const paid = resolvePaidAmount(composer.paid, total)
      if (!composer.title.trim()) {
        setComposerError('Please add a payment title.')
        return
      }
      if (!Number.isFinite(total) || total <= 0) {
        setComposerError('Total must be greater than ₹0.')
        return
      }
      if (!Number.isFinite(paid) || paid < 0 || paid > total) {
        setComposerError('Paid amount must be between ₹0 and the total.')
        return
      }
      addExpense(
        { title: composer.title, vendorName: '', category: composer.category, totalAmount: total, paidAmount: paid, dueDate: composer.dueDate },
        selectedEvent.id,
      )
    } else {
      const contract = Number(composer.total || 0)
      const paid = Number(composer.paid || 0)
      if (!composer.title.trim()) {
        setComposerError('Please add the vendor name.')
        return
      }
      if (!Number.isFinite(contract) || contract < 0 || !Number.isFinite(paid) || paid < 0 || paid > contract) {
        setComposerError('Check the contract and paid amounts.')
        return
      }
      addVendor(
        { name: composer.title, role: '', phone: composer.phone, email: '', totalContract: contract, paidAmount: paid, notes: composer.notes },
        selectedEvent.id,
      )
    }
    closeComposer()
  }

  function startEditEvent(event: GuestEventItem) {
    setEventForm({ name: event.name, date: event.date ?? '', details: event.details ?? '', notes: event.notes ?? '' })
    setEventFormError('')
    setEditingEvent(true)
  }

  function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!selectedEvent) return
    if (!eventForm.name.trim()) {
      setEventFormError('Event name is required.')
      return
    }
    updateGuestEvent(selectedEvent.id, eventForm)
    setEditingEvent(false)
  }

  if (!selectedEvent) {
    return (
      <section className="screen-animate space-y-3">
        <PageHeader title="Events" rightMeta={`${events.length} ceremonies`} />
        {events.length === 0 ? (
          <EmptyStateCard
            title="Plan your ceremonies"
            subtitle="Nischayathartham, Pellikuthuru, Muhurtham and Reception — each with guests, tasks, payments and vendors."
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <EventSummaryCard
                key={event.id}
                event={event}
                counts={{
                  todos: data.todos.filter((todo) => todo.eventId === event.id && todo.kind !== 'buy').length,
                  buy: data.todos.filter((todo) => todo.eventId === event.id && todo.kind === 'buy').length,
                  payments: data.expenses.filter((expense) => expense.eventId === event.id).length,
                  vendors: data.vendors.filter((vendor) => vendor.eventId === event.id).length,
                }}
                onSelect={() => openEvent(event.id)}
              />
            ))}
          </div>
        )}
      </section>
    )
  }

  const eventTodos = data.todos.filter((todo) => todo.eventId === selectedEvent.id && todo.kind !== 'buy')
  const eventBuyItems = data.todos.filter((todo) => todo.eventId === selectedEvent.id && todo.kind === 'buy')
  const eventPayments = data.expenses.filter((expense) => expense.eventId === selectedEvent.id)
  const eventVendors = data.vendors.filter((vendor) => vendor.eventId === selectedEvent.id)
  const search = inviteSearch.trim().toLowerCase()
  const visibleInvitees = selectedEvent.invitees
    .map((invitee, index) => ({ invitee, index }))
    .filter(({ invitee }) => !search || invitee.name.toLowerCase().includes(search))
    .sort((left, right) => Number(left.invitee.completed) - Number(right.invitee.completed) || left.index - right.index)
    .map(({ invitee }) => invitee)
  const confirmedCount = selectedEvent.invitees.filter((invitee) => invitee.completed).length
  const subtitle = [selectedEvent.date ? formatDate(selectedEvent.date) : 'Date pending', selectedEvent.details]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="screen-animate space-y-4 pb-4">
      <DetailHeader
        backLabel="Events"
        onBack={closeEvent}
        title={selectedEvent.name}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => startEditEvent(selectedEvent)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirmRemove) {
                  setConfirmRemove(true)
                  return
                }
                removeGuestEvent(selectedEvent.id)
                closeEvent()
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blush-deep"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmRemove ? 'Tap to confirm' : 'Remove'}
            </button>
          </div>
        }
      />
      {confirmRemove ? (
        <p className="-mt-2 rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">
          Removing this event also deletes its linked to-dos, items to buy, payments and vendors.
        </p>
      ) : null}

      <div className="no-scrollbar -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5">
        {composerTabs.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => openComposer(kind)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brass-line bg-silk px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-champagne/60"
          >
            <Plus className="h-3.5 w-3.5 text-champagne" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <SectionTitle
          title="Notes"
          action={
            notesDraft === null ? (
              <button type="button" onClick={() => setNotesDraft(selectedEvent.notes ?? '')} className="text-xs font-semibold text-blush-deep">
                {selectedEvent.notes ? 'Edit notes' : '+ Add'}
              </button>
            ) : null
          }
        />
        {notesDraft !== null ? (
          <div className="space-y-2 rounded-2xl border border-brass-line bg-silk p-3 shadow-soft">
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={4}
              autoFocus
              placeholder="Muhurtham timing, dress code, return gifts, Purohit instructions…"
              className="resize-y bg-ivory"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNotesDraft(null)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-taupe">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateGuestEvent(selectedEvent.id, {
                    name: selectedEvent.name,
                    date: selectedEvent.date ?? '',
                    details: selectedEvent.details ?? '',
                    notes: notesDraft,
                  })
                  setNotesDraft(null)
                }}
                className="rounded-xl bg-charcoal px-3 py-1.5 text-xs font-semibold text-ivory"
              >
                Save notes
              </button>
            </div>
          </div>
        ) : selectedEvent.notes ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-brass-line bg-silk p-3 text-sm leading-relaxed text-charcoal shadow-soft">
            {selectedEvent.notes}
          </p>
        ) : (
          <p className="px-0.5 text-xs text-muted-taupe">No notes yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle title="Invitees" count={selectedEvent.invitees.length} action={<span className="text-xs text-muted-taupe">{confirmedCount} confirmed</span>} />
        <div className="space-y-2 rounded-2xl border border-brass-line bg-silk p-3 shadow-soft">
          {selectedEvent.invitees.length > 0 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-taupe" />
              <input
                value={inviteSearch}
                onChange={(event) => setInviteSearch(event.target.value)}
                placeholder="Search invitees"
                className="bg-ivory py-1.5 pl-8 text-sm"
              />
            </div>
          ) : null}
          {selectedEvent.invitees.length === 0 ? (
            <p className="py-1 text-xs text-muted-taupe">No invitees yet. Tap “+ Invitee” above.</p>
          ) : visibleInvitees.length === 0 ? (
            <p className="py-1 text-xs text-muted-taupe">No invitee matches “{inviteSearch}”.</p>
          ) : (
            <div className="divide-y divide-brass-line/60">
              {visibleInvitees.map((invitee) => (
                <div key={invitee.id} className="flex items-center justify-between gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleEventInvitee(selectedEvent.id, invitee.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        invitee.completed ? 'border-sage bg-sage text-white' : 'border-champagne/60'
                      }`}
                    >
                      {invitee.completed ? <Check className="h-3 w-3 stroke-[2.5]" /> : null}
                    </span>
                    <span className={`truncate text-sm ${invitee.completed ? 'text-muted-taupe line-through' : 'text-charcoal'}`}>
                      {invitee.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEventInvitee(selectedEvent.id, invitee.id)}
                    className="p-1 text-muted-taupe hover:text-blush-deep"
                    aria-label={`Remove ${invitee.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle title="Items to buy" count={eventBuyItems.length} />
        <form
          onSubmit={(formEvent) => {
            formEvent.preventDefault()
            if (!buyDraft.trim()) return
            addTodo({ title: buyDraft, dueDate: todayString(), priority: 'Medium', kind: 'buy' }, selectedEvent.id)
            setBuyDraft('')
          }}
          className="flex items-center gap-2"
        >
          <input
            value={buyDraft}
            onChange={(event) => setBuyDraft(event.target.value)}
            placeholder="e.g. Talambralu pearls, pattu saree"
            className="flex-1 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl bg-charcoal px-3 py-2 text-xs font-semibold text-ivory">
            Add
          </button>
        </form>
        {eventBuyItems.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onToggle={() => toggleTodo(todo.id)} onOpen={() => onOpenItem?.('todos', todo.id)} />
        ))}
      </div>

      <div className="space-y-2">
        <SectionTitle title="To-Dos" count={eventTodos.length} />
        {eventTodos.length === 0 ? <p className="px-0.5 text-xs text-muted-taupe">None linked.</p> : null}
        {eventTodos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onToggle={() => toggleTodo(todo.id)} onOpen={() => onOpenItem?.('todos', todo.id)} />
        ))}
      </div>

      <div className="space-y-2">
        <SectionTitle title="Payments" count={eventPayments.length} />
        {eventPayments.length === 0 ? <p className="px-0.5 text-xs text-muted-taupe">None linked.</p> : null}
        {eventPayments.map((expense) => (
          <PaymentCard
            key={expense.id}
            title={expense.title}
            subtitle={`${expense.category} · ${formatDate(expense.dueDate)}`}
            totalAmount={expense.totalAmount}
            paidAmount={expense.paidAmount}
            onOpen={() => onOpenItem?.('payments', expense.id)}
            onMarkPaid={() => markExpensePaid(expense.id)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <SectionTitle title="Vendors" count={eventVendors.length} />
        {eventVendors.length === 0 ? <p className="px-0.5 text-xs text-muted-taupe">None linked.</p> : null}
        {eventVendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            onOpen={() => onOpenItem?.('vendors', vendor.id)}
            onMarkPaid={() => markVendorPaid(vendor.id)}
          />
        ))}
      </div>

      {composerKind ? (
        <SheetModal title={`Add to ${selectedEvent.name}`} onClose={closeComposer}>
          <form onSubmit={submitComposer} className="space-y-3">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {composerTabs.map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setComposerKind(kind)
                    setComposerError('')
                  }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    composerKind === kind ? 'bg-charcoal text-ivory' : 'border border-brass-line bg-silk text-charcoal'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {composerKind === 'invite' ? (
              <div className="space-y-2">
                <FieldLabel>Guest / family name *</FieldLabel>
                <input
                  value={composer.inviteeInput}
                  onChange={(event) => setComposer({ ...composer, inviteeInput: event.target.value })}
                  onKeyDown={handleInviteKeyDown}
                  placeholder="Type a name and press Enter"
                  autoFocus
                />
                {composer.invitees.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {composer.invitees.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 rounded-full border border-brass-line bg-ivory px-2.5 py-1 text-xs text-charcoal">
                        {name}
                        <button
                          type="button"
                          onClick={() => setComposer({ ...composer, invitees: composer.invitees.filter((entry) => entry !== name) })}
                          className="text-muted-taupe"
                          aria-label={`Remove ${name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <FieldLabel>
                  {composerKind === 'vendor' ? 'Vendor name *' : composerKind === 'payment' ? 'Payment title *' : composerKind === 'buy' ? 'Item *' : 'Title *'}
                </FieldLabel>
                <input value={composer.title} onChange={(event) => setComposer({ ...composer, title: event.target.value })} autoFocus />
              </div>
            )}

            {composerKind === 'todo' || composerKind === 'buy' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel>Due date</FieldLabel>
                  <input type="date" value={composer.dueDate} onChange={(event) => setComposer({ ...composer, dueDate: event.target.value })} />
                </div>
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <select value={composer.priority} onChange={(event) => setComposer({ ...composer, priority: event.target.value as TodoPriority })}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            ) : null}

            {composerKind === 'payment' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel>Total (₹) *</FieldLabel>
                  <input type="number" inputMode="numeric" min={1} value={composer.total} onChange={(event) => setComposer({ ...composer, total: event.target.value })} />
                </div>
                <div>
                  <FieldLabel>Paid (₹)</FieldLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={composer.paid}
                    onChange={(event) => setComposer({ ...composer, paid: event.target.value })}
                    placeholder="Blank = fully paid"
                  />
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select value={composer.category} onChange={(event) => setComposer({ ...composer, category: event.target.value as ExpenseCategory })}>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Due date</FieldLabel>
                  <input type="date" value={composer.dueDate} onChange={(event) => setComposer({ ...composer, dueDate: event.target.value })} />
                </div>
              </div>
            ) : null}

            {composerKind === 'vendor' ? (
              <div className="space-y-2.5">
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={composer.phone}
                    onChange={(event) => setComposer({ ...composer, phone: sanitizePhone(event.target.value) })}
                    placeholder="9849000000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>Contract (₹)</FieldLabel>
                    <input type="number" inputMode="numeric" min={0} value={composer.total} onChange={(event) => setComposer({ ...composer, total: event.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Paid (₹)</FieldLabel>
                    <input type="number" inputMode="numeric" min={0} value={composer.paid} onChange={(event) => setComposer({ ...composer, paid: event.target.value })} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <input value={composer.notes} onChange={(event) => setComposer({ ...composer, notes: event.target.value })} />
                </div>
              </div>
            ) : null}

            {composerError ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{composerError}</p> : null}
            <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-sm font-semibold text-ivory">
              Add
            </button>
          </form>
        </SheetModal>
      ) : null}

      {isEditingEvent ? (
        <SheetModal title="Edit event" onClose={() => setEditingEvent(false)}>
          <form onSubmit={saveEvent} className="space-y-3">
            <div>
              <FieldLabel>Name *</FieldLabel>
              <input value={eventForm.name} onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Date</FieldLabel>
              <input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Details</FieldLabel>
              <input
                value={eventForm.details}
                onChange={(event) => setEventForm({ ...eventForm, details: event.target.value })}
                placeholder="Venue, timing…"
              />
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={eventForm.notes}
                onChange={(event) => setEventForm({ ...eventForm, notes: event.target.value })}
                rows={4}
                className="resize-y"
              />
            </div>
            {eventFormError ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{eventFormError}</p> : null}
            <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-sm font-semibold text-ivory">
              Save event
            </button>
          </form>
        </SheetModal>
      ) : null}
    </section>
  )
}
