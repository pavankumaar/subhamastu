import { AlertTriangle, CalendarCheck2, CirclePlus, Landmark, LogOut, NotepadText, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { FieldLabel, SheetModal } from './components/ScreenChrome'
import { useWedding } from './context/useWedding'
import { useBackLayer } from './hooks/useBackLayer'
import type { ItemOrigin, ItemTab } from './navigation'
import { BudgetScreen } from './screens/BudgetScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DirectoryScreen } from './screens/DirectoryScreen'
import { InviteChecklistScreen } from './screens/InviteChecklistScreen'
import { TodoTimelineScreen } from './screens/TodoTimelineScreen'
import { EXPENSE_CATEGORIES, type ExpenseCategory, type TodoKind, type TodoPriority } from './types/wedding'
import { resolvePaidAmount, sanitizePhone, todayString } from './utils/weddingFormat'

export type AppTab = 'todos' | 'payments' | 'chat' | 'invites' | 'vendors'

const tabs: Array<{ key: ItemTab; label: string; addLabel: string; icon: typeof CalendarCheck2 }> = [
  { key: 'todos', label: 'To-Do', addLabel: 'Task', icon: CalendarCheck2 },
  { key: 'payments', label: 'Payments', addLabel: 'Payment', icon: Landmark },
  { key: 'invites', label: 'Events', addLabel: 'Event', icon: Users },
  { key: 'vendors', label: 'Vendors', addLabel: 'Vendor', icon: NotepadText },
]

interface QuickForm {
  title: string
  dueDate: string
  priority: TodoPriority
  kind: TodoKind
  eventId: string
  category: ExpenseCategory
  total: string
  paid: string
  phone: string
  notes: string
  memberInput: string
  members: string[]
  copyFromEventIds: string[]
}

function emptyQuickForm(): QuickForm {
  return {
    title: '',
    dueDate: todayString(),
    priority: 'Medium',
    kind: 'task',
    eventId: '',
    category: 'Others',
    total: '',
    paid: '',
    phone: '',
    notes: '',
    memberInput: '',
    members: [],
    copyFromEventIds: [],
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function DiyaIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
      <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
      <path d="M8 20H16" />
    </svg>
  )
}

interface AppProps {
  profile: { id: string; name: string }
  onLogout: () => void
}

function App({ profile, onLogout }: AppProps) {
  const { data, addExpense, addTodo, addGuestEvent, addVendor, syncError } = useWedding()
  const [activeTab, setActiveTab] = useState<AppTab>('todos')
  const [focus, setFocus] = useState<{ tab: ItemTab; id: string; nonce: number; origin?: ItemOrigin } | null>(null)
  const [isQuickActionOpen, setQuickActionOpen] = useState(false)
  const [isQuickActionVisible, setQuickActionVisible] = useState(true)
  const [quickError, setQuickError] = useState('')
  const [form, setForm] = useState<QuickForm>(emptyQuickForm)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const activeTabConfig = tabs.find((tab) => tab.key === activeTab)

  const openItem = useCallback((tab: ItemTab, id: string, origin?: ItemOrigin) => {
    setFocus((current) => ({ tab, id, origin, nonce: (current?.nonce ?? 0) + 1 }))
    setActiveTab(tab)
  }, [])

  function switchTab(tab: AppTab) {
    setFocus(null)
    setActiveTab(tab)
    setQuickActionVisible(tab !== 'chat')
  }

  // Closing a detail page opened from elsewhere (an event, a chat card) returns to where it came from.
  function returnFromItem() {
    const origin = focus?.origin
    if (!origin) return
    if (origin.id && origin.tab !== 'chat') {
      setFocus((current) => ({ tab: origin.tab as ItemTab, id: origin.id ?? '', nonce: (current?.nonce ?? 0) + 1 }))
      setActiveTab(origin.tab)
    } else {
      switchTab(origin.tab)
    }
  }

  // Back from any other tab returns to the To-Do home tab before leaving the site.
  useBackLayer(activeTab !== 'todos', () => switchTab('todos'), 0)

  useEffect(() => {
    if (!confirmLogout) return
    const timer = window.setTimeout(() => setConfirmLogout(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmLogout])

  function openQuickAction() {
    setForm(emptyQuickForm())
    setQuickError('')
    setQuickActionOpen(true)
  }

  const closeQuickAction = useCallback(() => {
    setQuickActionOpen(false)
    setQuickError('')
  }, [])

  function addMemberChip(raw: string) {
    const name = normalizeName(raw)
    if (!name) return
    setForm((current) =>
      current.members.some((entry) => entry.toLowerCase() === name.toLowerCase())
        ? { ...current, memberInput: '' }
        : { ...current, memberInput: '', members: [...current.members, name] },
    )
  }

  function handleMemberKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addMemberChip(form.memberInput)
  }

  function handleQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuickError('')
    const title = form.title.trim()

    if (activeTab === 'todos') {
      if (!title) return setQuickError(form.kind === 'buy' ? 'What do you need to buy?' : 'Please add a task title.')
      if (!form.dueDate) return setQuickError('Please choose a due date.')
      addTodo({ title, dueDate: form.dueDate, priority: form.priority, kind: form.kind }, form.eventId || undefined)
    } else if (activeTab === 'payments') {
      const total = Number(form.total)
      const paid = resolvePaidAmount(form.paid, total)
      if (!title) return setQuickError('Please add a payment title.')
      if (!Number.isFinite(total) || total <= 0) return setQuickError('Total must be greater than ₹0.')
      if (!Number.isFinite(paid) || paid < 0 || paid > total) return setQuickError('Paid amount must be between ₹0 and the total.')
      if (!form.dueDate) return setQuickError('Please choose a due date.')
      addExpense(
        { title, vendorName: '', category: form.category, totalAmount: total, paidAmount: paid, dueDate: form.dueDate },
        form.eventId || undefined,
      )
    } else if (activeTab === 'invites') {
      if (!title) return setQuickError('Please add an event name.')
      const pending = normalizeName(form.memberInput)
      addGuestEvent({
        name: title,
        date: form.dueDate,
        details: form.notes,
        members: pending ? [...form.members, pending] : form.members,
        quickAddEventIds: form.copyFromEventIds,
      })
    } else if (activeTab === 'vendors') {
      const contract = Number(form.total || 0)
      const paid = Number(form.paid || 0)
      if (!title) return setQuickError('Please add the vendor name.')
      if (!Number.isFinite(contract) || contract < 0 || !Number.isFinite(paid) || paid < 0) return setQuickError('Amounts cannot be negative.')
      if (paid > contract) return setQuickError('Paid amount cannot exceed the contract amount.')
      addVendor(
        { name: title, role: '', phone: form.phone, email: '', totalContract: contract, paidAmount: paid, notes: form.notes },
        form.eventId || undefined,
      )
    }
    closeQuickAction()
  }

  const focusFor = (tab: ItemTab) => (focus?.tab === tab ? focus : null)
  const screenKey = (tab: ItemTab) => `${tab}-${focusFor(tab)?.nonce ?? 0}`
  const closedFor = (tab: ItemTab) => (focusFor(tab)?.origin ? returnFromItem : undefined)

  const activeScreen =
    activeTab === 'payments' ? (
      <BudgetScreen
        key={screenKey('payments')}
        initialItemId={focusFor('payments')?.id}
        onOpenItem={openItem}
        onItemClosed={closedFor('payments')}
        onQuickActionVisibilityChange={setQuickActionVisible}
      />
    ) : activeTab === 'chat' ? (
      <ChatScreen onOpenItem={openItem} />
    ) : activeTab === 'invites' ? (
      <InviteChecklistScreen
        key={screenKey('invites')}
        initialItemId={focusFor('invites')?.id}
        onOpenItem={openItem}
        onItemClosed={closedFor('invites')}
        onQuickActionVisibilityChange={setQuickActionVisible}
      />
    ) : activeTab === 'vendors' ? (
      <DirectoryScreen
        key={screenKey('vendors')}
        initialItemId={focusFor('vendors')?.id}
        onItemClosed={closedFor('vendors')}
        onQuickActionVisibilityChange={setQuickActionVisible}
      />
    ) : (
      <TodoTimelineScreen
        key={screenKey('todos')}
        initialItemId={focusFor('todos')?.id}
        onItemClosed={closedFor('todos')}
        onQuickActionVisibilityChange={setQuickActionVisible}
      />
    )

  const eventOptions = data.guests.events.map((event) => (
    <option key={event.id} value={event.id}>
      {event.name}
    </option>
  ))

  const navButton = (key: ItemTab) => {
    const tab = tabs.find((entry) => entry.key === key)
    if (!tab) return null
    const Icon = tab.icon
    const isActive = activeTab === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => switchTab(key)}
        className={`flex w-14 flex-col items-center justify-center py-1 ${isActive ? 'text-charcoal' : 'text-muted-taupe hover:text-charcoal'}`}
        aria-label={`Open ${tab.label}`}
      >
        <Icon className="mb-1 h-[18px] w-[18px]" />
        <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
      </button>
    )
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#F4F0E8]">
      <div className="relative mx-auto flex h-full w-full max-w-[460px] flex-col px-1.5 sm:px-3">
        <header className="flex shrink-0 items-center gap-2 border-b border-brass-line/70 px-1.5 pb-2 pt-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brass-line bg-champagne-light">
            <DiyaIcon className="h-4 w-4 text-champagne" />
          </span>
          <span className="text-lg font-extrabold leading-none tracking-tight text-charcoal">Subhamastu</span>
          <span className="border-l border-brass-line pl-2 text-[11px] font-medium leading-none text-muted-taupe">Wedding Planner</span>
          <div className="ml-auto flex items-center gap-1">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brass-line bg-silk text-sm font-bold text-charcoal"
              title={`Signed in as ${profile.name}`}
              aria-label={`Signed in as ${profile.name}`}
            >
              {profile.name.charAt(0).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => (confirmLogout ? onLogout() : setConfirmLogout(true))}
              className={`flex h-10 items-center justify-center gap-1 rounded-full ${
                confirmLogout ? 'bg-blush-soft px-3 text-xs font-semibold text-blush-deep' : 'w-10 text-muted-taupe hover:bg-silk hover:text-charcoal'
              }`}
              aria-label={confirmLogout ? 'Tap again to log out' : 'Log out'}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
              {confirmLogout ? 'Log out?' : null}
            </button>
          </div>
        </header>

        {syncError ? (
          <div
            role="status"
            className="mx-1.5 mt-2 flex shrink-0 items-start gap-2 rounded-xl border border-blush-deep/30 bg-blush-soft px-3 py-2 text-xs leading-snug text-blush-deep"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Not synced.</span> Changes aren't being saved right now — retrying automatically.
            </span>
          </div>
        ) : null}

        {activeTab === 'chat' ? (
          <div className="flex min-h-0 flex-1 flex-col px-1.5 pt-1.5">{activeScreen}</div>
        ) : (
          <div className="clean-scroll min-h-0 flex-1 overflow-y-auto pb-20">
            <div className="px-1.5 pb-2 pt-1.5">{activeScreen}</div>
          </div>
        )}

        {isQuickActionVisible && activeTab !== 'chat' ? (
          <button
            type="button"
            onClick={openQuickAction}
            className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-[2147483100] inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-sindoor px-4 text-sm font-semibold text-white shadow-float"
            aria-label={`Add ${activeTabConfig?.addLabel ?? 'item'}`}
          >
            <CirclePlus className="h-4 w-4" />
            Add {activeTabConfig?.addLabel}
          </button>
        ) : null}

        <nav className="z-[2147483000] flex shrink-0 items-center justify-around rounded-t-[22px] border border-b-0 border-brass-line bg-silk/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md [min-height:calc(68px+env(safe-area-inset-bottom))]">
          {navButton('todos')}
          {navButton('payments')}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => switchTab('chat')}
              className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-ivory bg-charcoal text-ivory shadow-md"
              aria-label="Open Mitra AI chat"
            >
              <DiyaIcon className="h-5 w-5 text-champagne" />
            </button>
            <span className={`mt-1 text-[11px] ${activeTab === 'chat' ? 'font-bold text-charcoal' : 'font-medium text-muted-taupe'}`}>
              Mitra AI
            </span>
          </div>
          {navButton('invites')}
          {navButton('vendors')}
        </nav>
      </div>

      {isQuickActionOpen && activeTabConfig ? (
        <SheetModal title={`New ${activeTabConfig.addLabel.toLowerCase()}`} onClose={closeQuickAction}>
          <form onSubmit={handleQuickSubmit} className="space-y-3">
            <div>
              <FieldLabel>
                {activeTab === 'invites' ? 'Event name *' : activeTab === 'vendors' ? 'Vendor name *' : activeTab === 'payments' ? 'Payment title *' : 'Title *'}
              </FieldLabel>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={
                  activeTab === 'invites'
                    ? 'e.g. Pellikuthuru'
                    : activeTab === 'vendors'
                      ? 'e.g. Sai Florists'
                      : activeTab === 'payments'
                        ? 'e.g. Kalyana Mandapam advance'
                        : 'e.g. Confirm Purohit availability'
                }
                autoFocus
              />
            </div>

            {activeTab === 'todos' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel>Due date</FieldLabel>
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                </div>
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TodoPriority })}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as TodoKind })}>
                    <option value="task">Task</option>
                    <option value="buy">Item to buy</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Event</FieldLabel>
                  <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
                    <option value="">Not linked</option>
                    {eventOptions}
                  </select>
                </div>
              </div>
            ) : null}

            {activeTab === 'payments' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel>Total (₹) *</FieldLabel>
                  <input type="number" inputMode="numeric" min={1} value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
                </div>
                <div>
                  <FieldLabel>Paid (₹)</FieldLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.paid}
                    onChange={(event) => setForm({ ...form, paid: event.target.value })}
                    placeholder="Blank = fully paid"
                  />
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Due date</FieldLabel>
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                </div>
                <div className="col-span-2">
                  <FieldLabel>Event</FieldLabel>
                  <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
                    <option value="">Not linked</option>
                    {eventOptions}
                  </select>
                </div>
              </div>
            ) : null}

            {activeTab === 'invites' ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Details</FieldLabel>
                    <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Venue, timing" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Invitees</FieldLabel>
                  <input
                    value={form.memberInput}
                    onChange={(event) => setForm({ ...form, memberInput: event.target.value })}
                    onKeyDown={handleMemberKeyDown}
                    placeholder="Type a name and press Enter"
                  />
                </div>
                {form.members.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.members.map((member) => (
                      <span key={member} className="inline-flex items-center gap-1 rounded-full border border-brass-line bg-ivory px-2.5 py-1 text-xs text-charcoal">
                        {member}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, members: form.members.filter((entry) => entry !== member) })}
                          className="-my-2 -mr-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-taupe active:bg-silk"
                          aria-label={`Remove ${member}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {data.guests.events.length > 0 ? (
                  <div>
                    <FieldLabel>Copy guests from</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {data.guests.events.map((event) => {
                        const selected = form.copyFromEventIds.includes(event.id)
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                copyFromEventIds: selected
                                  ? form.copyFromEventIds.filter((id) => id !== event.id)
                                  : [...form.copyFromEventIds, event.id],
                              })
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              selected ? 'bg-charcoal text-ivory' : 'border border-brass-line bg-ivory text-charcoal'
                            }`}
                          >
                            {event.name} ({event.invitees.length})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'vendors' ? (
              <div className="space-y-2.5">
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: sanitizePhone(event.target.value) })}
                    placeholder="9849000000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>Contract (₹)</FieldLabel>
                    <input type="number" inputMode="numeric" min={0} value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Paid (₹)</FieldLabel>
                    <input type="number" inputMode="numeric" min={0} value={form.paid} onChange={(event) => setForm({ ...form, paid: event.target.value })} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Event</FieldLabel>
                  <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
                    <option value="">Not linked</option>
                    {eventOptions}
                  </select>
                </div>
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} className="resize-y" />
                </div>
              </div>
            ) : null}

            {quickError ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{quickError}</p> : null}
            <button type="submit" className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-sindoor py-3 text-sm font-semibold text-white">
              <CirclePlus className="h-4 w-4" />
              Save {activeTabConfig.addLabel.toLowerCase()}
            </button>
          </form>
        </SheetModal>
      ) : null}
    </main>
  )
}

export default App
