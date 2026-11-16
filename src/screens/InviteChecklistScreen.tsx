import { ArrowLeft, Check, X } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { EmptyStateCard, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import type { ExpenseCategory, GuestEventItem, TodoPriority } from '../types/wedding'
import { formatCurrencyInr, formatDate } from '../utils/weddingFormat'

type ComposerKind = 'todo' | 'payment' | 'vendor' | 'invite'

const expenseCategories: ExpenseCategory[] = ['Venue', 'Catering', 'Attire', 'Photography', 'Decor']

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

function EventSummaryCard({
  event,
  todoCount,
  paymentCount,
  vendorCount,
  onSelect,
}: {
  event: GuestEventItem
  todoCount: number
  paymentCount: number
  vendorCount: number
  onSelect: () => void
}) {
  const actionItems = event.invitees.length + todoCount + paymentCount + vendorCount
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full space-y-3 rounded-2xl border border-brass-line bg-silk p-4 text-left shadow-soft transition-all hover:border-champagne/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[36px] font-semibold leading-tight text-charcoal">{event.name}</h3>
          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-champagne">
            {event.date ? formatDate(event.date) : 'Date not set'}
          </p>
        </div>
        <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-[10px] font-medium text-charcoal tabular-nums">
          {actionItems} items
        </span>
      </div>

      {event.details ? <p className="text-xs leading-relaxed text-muted-taupe">{event.details}</p> : null}

      <div className="grid grid-cols-4 gap-1 border-t border-brass-line/70 pt-2.5 text-center text-[11px] tabular-nums">
        <div>
          <span className="font-semibold text-charcoal">{event.invitees.length}</span>{' '}
          <span className="text-muted-taupe">Invites</span>
        </div>
        <div>
          <span className="font-semibold text-charcoal">{todoCount}</span>{' '}
          <span className="text-muted-taupe">To-Dos</span>
        </div>
        <div>
          <span className="font-semibold text-charcoal">{paymentCount}</span>{' '}
          <span className="text-muted-taupe">Payments</span>
        </div>
        <div>
          <span className="font-semibold text-charcoal">{vendorCount}</span>{' '}
          <span className="text-muted-taupe">Vendors</span>
        </div>
      </div>
    </button>
  )
}

export function InviteChecklistScreen() {
  const {
    data,
    addEventInvitees,
    addExpense,
    addTodo,
    addVendor,
    toggleEventInvitee,
    removeEventInvitee,
    removeGuestEvent,
  } = useWedding()

  const [selectedEventId, setSelectedEventId] = useState('')
  const [activeComposer, setActiveComposer] = useState<ComposerKind | null>(null)
  const [composerError, setComposerError] = useState('')

  const [todoTitle, setTodoTitle] = useState('')
  const [todoDueDate, setTodoDueDate] = useState(getCurrentDateString())
  const [todoPriority, setTodoPriority] = useState<TodoPriority>('Medium')

  const [paymentTitle, setPaymentTitle] = useState('')
  const [paymentCategory, setPaymentCategory] = useState<ExpenseCategory>('Venue')
  const [paymentTotal, setPaymentTotal] = useState('')
  const [paymentPaid, setPaymentPaid] = useState('0')
  const [paymentDueDate, setPaymentDueDate] = useState(getCurrentDateString())

  const [vendorName, setVendorName] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')
  const [vendorTotalContract, setVendorTotalContract] = useState('')
  const [vendorPaidAmount, setVendorPaidAmount] = useState('0')
  const [vendorNotes, setVendorNotes] = useState('')

  const [inviteeInput, setInviteeInput] = useState('')
  const [inviteeChips, setInviteeChips] = useState<string[]>([])

  const events = data.guests.events
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  useEffect(() => {
    if (!activeComposer) {
      return
    }
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [activeComposer])

  function resetComposer() {
    const today = getCurrentDateString()
    setComposerError('')
    setActiveComposer(null)
    setTodoTitle('')
    setTodoDueDate(today)
    setTodoPriority('Medium')
    setPaymentTitle('')
    setPaymentCategory('Venue')
    setPaymentTotal('')
    setPaymentPaid('0')
    setPaymentDueDate(today)
    setVendorName('')
    setVendorPhone('')
    setVendorTotalContract('')
    setVendorPaidAmount('0')
    setVendorNotes('')
    setInviteeInput('')
    setInviteeChips([])
  }

  function openComposer(kind: ComposerKind) {
    resetComposer()
    setActiveComposer(kind)
  }

  function normalizeName(value: string) {
    return value.trim().replace(/\s+/g, ' ')
  }

  function addInviteeChip(rawName: string) {
    const normalized = normalizeName(rawName)
    if (!normalized) {
      return
    }
    setInviteeChips((current) => {
      if (current.some((name) => name.toLowerCase() === normalized.toLowerCase())) {
        return current
      }
      return [...current, normalized]
    })
    setInviteeInput('')
  }

  function handleInviteInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    addInviteeChip(inviteeInput)
  }

  function submitComposer() {
    if (!selectedEvent || !activeComposer) {
      return
    }
    setComposerError('')

    if (activeComposer === 'todo') {
      if (!todoTitle.trim()) {
        setComposerError('Please add a to-do title.')
        return
      }
      addTodo(
        {
          title: todoTitle,
          dueDate: todoDueDate,
          priority: todoPriority,
        },
        selectedEvent.id,
      )
      resetComposer()
      return
    }

    if (activeComposer === 'payment') {
      const totalAmount = Number(paymentTotal)
      const paidAmount = Number(paymentPaid || 0)
      if (!paymentTitle.trim()) {
        setComposerError('Please add payment title.')
        return
      }
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        setComposerError('Total amount should be greater than 0.')
        return
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
        setComposerError('Paid amount must be between 0 and total amount.')
        return
      }
      addExpense(
        {
          title: paymentTitle,
          vendorName: '',
          category: paymentCategory,
          totalAmount,
          paidAmount,
          dueDate: paymentDueDate,
        },
        selectedEvent.id,
      )
      resetComposer()
      return
    }

    if (activeComposer === 'vendor') {
      const totalContract = Number(vendorTotalContract || 0)
      const paidAmount = Number(vendorPaidAmount || 0)
      if (!vendorName.trim()) {
        setComposerError('Please add vendor name.')
        return
      }
      if (!Number.isFinite(totalContract) || totalContract < 0 || !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalContract) {
        setComposerError('Invalid contract or paid amount.')
        return
      }
      addVendor(
        {
          name: vendorName,
          role: '',
          phone: vendorPhone,
          email: '',
          totalContract,
          paidAmount,
          notes: vendorNotes,
        },
        selectedEvent.id,
      )
      resetComposer()
      return
    }

    const pendingName = normalizeName(inviteeInput)
    const members = pendingName ? inviteeChips.concat(pendingName) : inviteeChips
    if (members.length === 0) {
      setComposerError('Please add at least one invitee.')
      return
    }
    addEventInvitees(selectedEvent.id, members)
    resetComposer()
  }

  if (!selectedEvent) {
    return (
      <section className="screen-animate">
        <PageHeader kicker="Ceremonies" title="Events" rightMeta={`${events.length} rituals`} />
        <div className="space-y-3 px-1 pb-2">
          {events.length === 0 ? (
            <EmptyStateCard
              title="Plan Your Ceremonies"
              subtitle="Organize Nischayathartham, Pellikuthuru, Muhurtham, and Reception with dedicated guest and vendor checklists."
            />
          ) : (
            events.map((event) => (
              <EventSummaryCard
                key={event.id}
                event={event}
                todoCount={data.todos.filter((todo) => todo.eventId === event.id).length}
                paymentCount={data.expenses.filter((expense) => expense.eventId === event.id).length}
                vendorCount={data.vendors.filter((vendor) => vendor.eventId === event.id).length}
                onSelect={() => setSelectedEventId(event.id)}
              />
            ))
          )}
        </div>
      </section>
    )
  }

  const selectedEventTodos = data.todos.filter((todo) => todo.eventId === selectedEvent.id)
  const selectedEventPayments = data.expenses.filter((expense) => expense.eventId === selectedEvent.id)
  const selectedEventVendors = data.vendors.filter((vendor) => vendor.eventId === selectedEvent.id)

  return (
    <section className="screen-animate space-y-5 px-2 pt-4 pb-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setSelectedEventId('')
            resetComposer()
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-taupe hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>
        <button
          type="button"
          onClick={() => {
            removeGuestEvent(selectedEvent.id)
            setSelectedEventId('')
          }}
          className="text-[11px] font-medium text-blush-deep"
        >
          Remove Event
        </button>
      </div>

      <div>
        <span className="tabular-nums text-[11px] font-medium uppercase tracking-widest text-champagne">
          {selectedEvent.date ? formatDate(selectedEvent.date) : 'Date pending'}
        </span>
        <h1 className="mt-0.5 font-display text-[42px] font-semibold leading-tight text-charcoal">{selectedEvent.name}</h1>
        {selectedEvent.details ? <p className="mt-1 text-xs text-muted-taupe">{selectedEvent.details}</p> : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => openComposer('invite')} className="rounded-full bg-charcoal px-3 py-1.5 text-[11px] font-medium text-ivory">
          + Invitee
        </button>
        <button type="button" onClick={() => openComposer('todo')} className="rounded-full border border-brass-line bg-silk px-3 py-1.5 text-[11px] font-medium text-charcoal">
          + To-Do
        </button>
        <button type="button" onClick={() => openComposer('payment')} className="rounded-full border border-brass-line bg-silk px-3 py-1.5 text-[11px] font-medium text-charcoal">
          + Payment
        </button>
        <button type="button" onClick={() => openComposer('vendor')} className="rounded-full border border-brass-line bg-silk px-3 py-1.5 text-[11px] font-medium text-charcoal">
          + Vendor
        </button>
      </div>

      {activeComposer ? (
        <div className="fixed inset-0 z-[2147483200] flex items-end justify-center bg-charcoal/35 p-3 backdrop-blur-[2px]">
          <article className="animate-modal-in w-full max-w-xl rounded-[28px] border border-brass-line bg-silk shadow-device">
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-3xl font-semibold text-charcoal">
                  {activeComposer === 'invite'
                    ? 'Add Invitee'
                    : activeComposer === 'todo'
                      ? 'Add Linked To-Do'
                      : activeComposer === 'payment'
                        ? 'Add Linked Payment'
                        : 'Add Linked Vendor'}
                </h3>
                <button type="button" onClick={resetComposer} className="p-1 text-muted-taupe">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto clean-scroll">
                {([
                  ['invite', 'Invitee'],
                  ['todo', 'To-Do'],
                  ['payment', 'Payment'],
                  ['vendor', 'Vendor'],
                ] as const).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setActiveComposer(kind)
                      setComposerError('')
                    }}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium ${activeComposer === kind ? 'bg-charcoal text-ivory' : 'border border-brass-line bg-silk text-charcoal'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-taupe">
                    {activeComposer === 'invite' ? 'Guest / Family Name *' : activeComposer === 'todo' ? 'To-Do Title *' : activeComposer === 'payment' ? 'Payment Title *' : 'Vendor Name *'}
                  </label>
                  <input
                    value={activeComposer === 'invite' ? inviteeInput : activeComposer === 'todo' ? todoTitle : activeComposer === 'payment' ? paymentTitle : vendorName}
                    onChange={(event) => {
                      const value = event.target.value
                      if (activeComposer === 'invite') setInviteeInput(value)
                      if (activeComposer === 'todo') setTodoTitle(value)
                      if (activeComposer === 'payment') setPaymentTitle(value)
                      if (activeComposer === 'vendor') setVendorName(value)
                    }}
                    onKeyDown={activeComposer === 'invite' ? handleInviteInputKeyDown : undefined}
                    placeholder={activeComposer === 'invite' ? 'Enter invitee name...' : ''}
                    className="bg-ivory"
                  />
                </div>

                {activeComposer === 'todo' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Due Date</label>
                      <input type="date" value={todoDueDate} onChange={(event) => setTodoDueDate(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Priority</label>
                      <select value={todoPriority} onChange={(event) => setTodoPriority(event.target.value as TodoPriority)} className="bg-ivory text-xs">
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {activeComposer === 'payment' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Total Amount (₹)</label>
                      <input type="number" min={1} value={paymentTotal} onChange={(event) => setPaymentTotal(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Category</label>
                      <select value={paymentCategory} onChange={(event) => setPaymentCategory(event.target.value as ExpenseCategory)} className="bg-ivory text-xs">
                        {expenseCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Paid Amount (₹)</label>
                      <input type="number" min={0} value={paymentPaid} onChange={(event) => setPaymentPaid(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Due Date</label>
                      <input type="date" value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                    </div>
                  </div>
                ) : null}

                {activeComposer === 'vendor' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Phone (Optional)</label>
                      <input value={vendorPhone} onChange={(event) => setVendorPhone(event.target.value)} className="bg-ivory" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Contract Amount (₹)</label>
                        <input type="number" min={0} value={vendorTotalContract} onChange={(event) => setVendorTotalContract(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Paid Amount (₹)</label>
                        <input type="number" min={0} value={vendorPaidAmount} onChange={(event) => setVendorPaidAmount(event.target.value)} className="bg-ivory text-xs tabular-nums" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-taupe">Notes</label>
                      <input value={vendorNotes} onChange={(event) => setVendorNotes(event.target.value)} className="bg-ivory" />
                    </div>
                  </div>
                ) : null}

                {activeComposer === 'invite' && inviteeChips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {inviteeChips.map((member) => (
                      <span
                        key={member}
                        className="inline-flex items-center gap-1 rounded-full border border-brass-line bg-ivory px-2.5 py-1 text-xs text-charcoal"
                      >
                        {member}
                        <button
                          type="button"
                          onClick={() => setInviteeChips((current) => current.filter((name) => name !== member))}
                          className="text-muted-taupe"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                {composerError ? <p className="text-xs text-blush-deep">{composerError}</p> : null}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetComposer}
                  className="flex-1 rounded-xl border border-brass-line py-2.5 text-xs font-medium text-muted-taupe"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitComposer}
                  className="flex-1 rounded-xl bg-charcoal py-2.5 text-xs font-medium text-ivory"
                >
                  Add
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-brass-line bg-silk p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-charcoal">Invitees ({selectedEvent.invitees.length})</h3>
          <span className="tabular-nums text-[11px] text-muted-taupe">
            {selectedEvent.invitees.filter((invitee) => invitee.completed).length} confirmed
          </span>
        </div>
        {selectedEvent.invitees.length === 0 ? (
          <p className="py-2 text-xs text-muted-taupe">No invitees added yet.</p>
        ) : (
          <div className="divide-y divide-brass-line/60">
            {selectedEvent.invitees.map((invitee) => (
              <div key={invitee.id} className="flex items-center justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => toggleEventInvitee(selectedEvent.id, invitee.id)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      invitee.completed ? 'border-sage bg-sage text-white' : 'border-champagne/60'
                    }`}
                  >
                    {invitee.completed ? <Check className="h-2.5 w-2.5 stroke-[2.5]" /> : null}
                  </span>
                  <span className={`truncate text-xs ${invitee.completed ? 'text-muted-taupe line-through' : 'text-charcoal'}`}>
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

      <div className="space-y-2.5">
        <div className="rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <p className="mb-1.5 text-[11px] font-semibold text-charcoal">Linked To-Dos ({selectedEventTodos.length})</p>
          {selectedEventTodos.length === 0 ? (
            <p className="text-[11px] text-muted-taupe">None linked</p>
          ) : (
            selectedEventTodos.map((todo) => (
              <p key={todo.id} className="truncate text-xs text-muted-taupe">
                · {todo.title}
              </p>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <p className="mb-1.5 text-[11px] font-semibold text-charcoal">Linked Payments ({selectedEventPayments.length})</p>
          {selectedEventPayments.length === 0 ? (
            <p className="text-[11px] text-muted-taupe">None linked</p>
          ) : (
            selectedEventPayments.map((expense) => (
              <p key={expense.id} className="truncate text-xs text-muted-taupe tabular-nums">
                · {expense.title} ({formatCurrencyInr(expense.paidAmount)}/{formatCurrencyInr(expense.totalAmount)})
              </p>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <p className="mb-1.5 text-[11px] font-semibold text-charcoal">Linked Vendors ({selectedEventVendors.length})</p>
          {selectedEventVendors.length === 0 ? (
            <p className="text-[11px] text-muted-taupe">None linked</p>
          ) : (
            selectedEventVendors.map((vendor) => (
              <p key={vendor.id} className="truncate text-xs text-muted-taupe">
                · {vendor.name}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
