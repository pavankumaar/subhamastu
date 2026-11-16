import {
  AlertTriangle,
  CalendarCheck2,
  CirclePlus,
  Landmark,
  LogOut,
  NotepadText,
  ReceiptText,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { StyledDropdown } from './components/StyledDropdown'
import { useWedding } from './context/useWedding'
import { BudgetScreen } from './screens/BudgetScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DirectoryScreen } from './screens/DirectoryScreen'
import { InviteChecklistScreen } from './screens/InviteChecklistScreen'
import { TodoTimelineScreen } from './screens/TodoTimelineScreen'
import type { ExpenseCategory, TodoPriority } from './types/wedding'

type AppTab = 'todos' | 'payments' | 'chat' | 'invites' | 'vendors'

const tabs: Array<{
  key: AppTab
  label: string
  addLabel: string
  icon: typeof CalendarCheck2
}> = [
  { key: 'todos', label: 'To-Do', addLabel: 'Task', icon: CalendarCheck2 },
  { key: 'payments', label: 'Payments', addLabel: 'Payment', icon: Landmark },
  { key: 'invites', label: 'Events', addLabel: 'Event', icon: Users },
  { key: 'vendors', label: 'Vendors', addLabel: 'Vendor', icon: NotepadText },
]

const expenseCategories: ExpenseCategory[] = ['Venue', 'Catering', 'Attire', 'Photography', 'Decor']
const expenseCategoryOptions = expenseCategories.map((category) => ({
  value: category,
  label: category,
}))

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

interface TaskFormState {
  title: string
  dueDate: string
  priority: TodoPriority
  eventId: string
}

interface InviteFormState {
  eventName: string
  eventDate: string
  eventDetails: string
  memberInput: string
  members: string[]
  quickAddEventIds: string[]
}

interface ExpenseFormState {
  title: string
  category: ExpenseCategory
  totalAmount: string
  paidAmount: string
  dueDate: string
}

interface VendorFormState {
  name: string
  phone: string
  totalContract: string
  paidAmount: string
  notes: string
}

function createEmptyTaskForm(): TaskFormState {
  return {
    title: '',
    dueDate: getCurrentDateString(),
    priority: 'Medium',
    eventId: '',
  }
}

function createEmptyInviteForm(): InviteFormState {
  return {
    eventName: '',
    eventDate: getCurrentDateString(),
    eventDetails: '',
    memberInput: '',
    members: [],
    quickAddEventIds: [],
  }
}

function createEmptyExpenseForm(): ExpenseFormState {
  return {
    title: '',
    category: 'Venue',
    totalAmount: '',
    paidAmount: '',
    dueDate: getCurrentDateString(),
  }
}

function createEmptyVendorForm(): VendorFormState {
  return {
    name: '',
    phone: '',
    totalContract: '',
    paidAmount: '',
    notes: '',
  }
}

interface AppProps {
  profile: { id: string; name: string }
  onLogout: () => void
}

function App({ profile, onLogout }: AppProps) {
  const { data, addExpense, addTodo, addGuestEvent, addVendor, syncError } = useWedding()
  const [activeTab, setActiveTab] = useState<AppTab>('todos')
  const [isQuickActionOpen, setQuickActionOpen] = useState(false)
  const [isQuickActionVisible, setQuickActionVisible] = useState(true)
  const [quickActionError, setQuickActionError] = useState('')

  const [taskForm, setTaskForm] = useState<TaskFormState>(createEmptyTaskForm())
  const [inviteForm, setInviteForm] = useState<InviteFormState>(createEmptyInviteForm())
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(createEmptyExpenseForm())
  const [vendorForm, setVendorForm] = useState<VendorFormState>(createEmptyVendorForm())

  const activeTabConfig = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab])

  useEffect(() => {
    if (!isQuickActionOpen) {
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
  }, [isQuickActionOpen])

  function openQuickActionModal() {
    setQuickActionError('')
    if (activeTab === 'todos') {
      setTaskForm(createEmptyTaskForm())
    } else if (activeTab === 'payments') {
      setExpenseForm(createEmptyExpenseForm())
    } else if (activeTab === 'invites') {
      setInviteForm(createEmptyInviteForm())
    } else if (activeTab === 'vendors') {
      setVendorForm(createEmptyVendorForm())
    }
    setQuickActionOpen(true)
  }

  function closeQuickActionModal() {
    setQuickActionOpen(false)
    setQuickActionError('')
  }

  function normalizeInviteeName(rawName: string) {
    return rawName.trim().replace(/\s+/g, ' ')
  }

  function addInviteeChip(rawName: string) {
    const normalized = normalizeInviteeName(rawName)
    if (!normalized) {
      return
    }

    setInviteForm((current) => {
      const alreadyExists = current.members.some(
        (name) => name.toLowerCase() === normalized.toLowerCase(),
      )
      if (alreadyExists) {
        return { ...current, memberInput: '' }
      }
      return {
        ...current,
        memberInput: '',
        members: [...current.members, normalized],
      }
    })
  }

  function removeInviteeChip(nameToRemove: string) {
    setInviteForm((current) => ({
      ...current,
      members: current.members.filter((name) => name !== nameToRemove),
    }))
  }

  function toggleQuickAddEventSelection(eventId: string) {
    setInviteForm((current) => {
      const alreadySelected = current.quickAddEventIds.includes(eventId)
      return {
        ...current,
        quickAddEventIds: alreadySelected
          ? current.quickAddEventIds.filter((id) => id !== eventId)
          : [...current.quickAddEventIds, eventId],
      }
    })
  }

  function handleInviteMemberInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    addInviteeChip(inviteForm.memberInput)
  }

  function handleQuickActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuickActionError('')

    if (activeTab === 'todos') {
      if (!taskForm.title.trim()) {
        setQuickActionError('Please add a task title first.')
        return
      }
      if (!taskForm.dueDate) {
        setQuickActionError('Please select a due date.')
        return
      }

      addTodo(
        {
          title: taskForm.title,
          dueDate: taskForm.dueDate,
          priority: taskForm.priority,
        },
        taskForm.eventId || undefined,
      )
      closeQuickActionModal()
      return
    }

    if (activeTab === 'payments') {
      const totalAmount = Number(expenseForm.totalAmount)
      const paidAmount = Number(expenseForm.paidAmount || 0)

      if (!expenseForm.title.trim()) {
        setQuickActionError('Please add payment title.')
        return
      }
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        setQuickActionError('Total amount should be greater than 0.')
        return
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        setQuickActionError('Paid amount cannot be negative.')
        return
      }
      if (paidAmount > totalAmount) {
        setQuickActionError('Paid amount cannot exceed total amount.')
        return
      }
      if (!expenseForm.dueDate) {
        setQuickActionError('Please choose a due date.')
        return
      }

      addExpense({
        title: expenseForm.title,
        vendorName: '',
        category: expenseForm.category,
        totalAmount,
        paidAmount,
        dueDate: expenseForm.dueDate,
      })
      closeQuickActionModal()
      return
    }

    if (activeTab === 'invites') {
      const pendingName = normalizeInviteeName(inviteForm.memberInput)
      const members = pendingName
        ? inviteForm.members.concat(pendingName)
        : inviteForm.members
      const hasQuickAddMembers = inviteForm.quickAddEventIds.some((eventId) =>
        data.guests.events.some((event) => event.id === eventId && event.invitees.length > 0),
      )

      if (!inviteForm.eventName.trim()) {
        setQuickActionError('Please add an event name first.')
        return
      }
      if (!inviteForm.eventDate) {
        setQuickActionError('Please select an event date.')
        return
      }
      if (members.length === 0 && !hasQuickAddMembers) {
        addGuestEvent({
          name: inviteForm.eventName,
          date: inviteForm.eventDate,
          details: inviteForm.eventDetails,
          members: [],
          quickAddEventIds: [],
        })
        closeQuickActionModal()
        return
      }

      addGuestEvent({
        name: inviteForm.eventName,
        date: inviteForm.eventDate,
        details: inviteForm.eventDetails,
        members,
        quickAddEventIds: inviteForm.quickAddEventIds,
      })
      closeQuickActionModal()
      return
    }

    if (activeTab === 'vendors') {
      const totalContract = Number(vendorForm.totalContract || 0)
      const paidAmount = Number(vendorForm.paidAmount || 0)

      if (!vendorForm.name.trim()) {
        setQuickActionError('Please add vendor name.')
        return
      }
      if (!Number.isFinite(totalContract) || totalContract < 0) {
        setQuickActionError('Contract amount cannot be negative.')
        return
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        setQuickActionError('Paid amount cannot be negative.')
        return
      }
      if (paidAmount > totalContract) {
        setQuickActionError('Paid amount cannot exceed contract amount.')
        return
      }

      addVendor({
        name: vendorForm.name,
        role: '',
        phone: vendorForm.phone,
        email: '',
        totalContract,
        paidAmount,
        notes: vendorForm.notes,
      })
      closeQuickActionModal()
    }
  }

  const quickActionTitle =
    activeTab === 'todos'
      ? 'New Task'
      : activeTab === 'payments'
        ? 'Add Payment'
        : activeTab === 'chat'
          ? ''
        : activeTab === 'invites'
          ? 'Add Event'
          : 'Add Vendor'

  const quickActionSubmitLabel =
    activeTab === 'todos'
      ? 'Save Task'
      : activeTab === 'payments'
        ? 'Save Payment'
        : activeTab === 'chat'
          ? ''
        : activeTab === 'invites'
          ? 'Save Event'
          : 'Save Vendor'

  const activeScreen =
    activeTab === 'payments' ? (
      <BudgetScreen onQuickActionVisibilityChange={setQuickActionVisible} />
    ) : activeTab === 'chat' ? (
      <ChatScreen />
    ) : activeTab === 'invites' ? (
      <InviteChecklistScreen />
    ) : activeTab === 'vendors' ? (
      <DirectoryScreen />
    ) : (
      <TodoTimelineScreen onQuickActionVisibilityChange={setQuickActionVisible} />
    )

  return (
    <main className="h-dvh overflow-hidden bg-[#F4F0E8]">
      <div className="relative mx-auto flex h-full w-full max-w-[460px] flex-col px-2 sm:px-3">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-brass-line/70 px-2 pb-2.5 pt-3 sm:px-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-line bg-champagne-light">
            <svg className="h-[18px] w-[18px] text-champagne" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
              <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
              <path d="M8 20H16" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold leading-none tracking-tight text-charcoal">Subhamastu</span>
          <span className="hidden border-l border-brass-line pl-2 text-[11px] leading-none text-muted-taupe min-[420px]:inline">Telugu Wedding Atelier</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-line bg-silk font-display text-base font-semibold text-charcoal"
              title={`Signed in as ${profile.name}`}
              aria-label={`Signed in as ${profile.name}`}
            >
              {profile.name.charAt(0).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-taupe hover:bg-silk hover:text-charcoal"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {syncError ? (
          <div
            role="status"
            className="mx-2 mt-2 flex shrink-0 items-start gap-2 rounded-xl border border-blush-deep/30 bg-blush-soft px-3 py-2 text-[11px] leading-snug text-blush-deep sm:mx-2.5"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Not synced.</span> Changes aren't being saved right now — retrying
              automatically.
            </span>
          </div>
        ) : null}

        {activeTab === 'chat' ? (
          <div className="flex min-h-0 flex-1 flex-col px-2 pt-2 sm:px-2.5">{activeScreen}</div>
        ) : (
          <div className="clean-scroll min-h-0 flex-1 overflow-y-auto pb-20">
            <div className="px-2 pb-2 pt-2 sm:px-2.5">
              <section>{activeScreen}</section>
            </div>
          </div>
        )}

        {isQuickActionVisible && activeTab !== 'chat' ? (
          <button
            type="button"
            onClick={openQuickActionModal}
            className="absolute bottom-[84px] right-4 z-[2147483100] inline-flex items-center gap-1.5 rounded-full bg-sindoor px-4 py-2.5 text-xs font-medium tracking-wide text-white shadow-float"
            aria-label={`Add ${activeTabConfig?.addLabel || 'Item'}`}
          >
            <CirclePlus className="h-3.5 w-3.5" />
            Add {activeTabConfig?.addLabel || 'Item'}
          </button>
        ) : null}

        <nav className="z-[2147483000] flex h-[72px] shrink-0 items-center justify-around rounded-t-[22px] border border-b-0 border-brass-line bg-silk/95 px-2 backdrop-blur-md">
            {tabs.slice(0, 2).map((tab) => {
              const isActive = tab.key === activeTab
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key)
                    setQuickActionVisible(true)
                  }}
                  className={`flex w-14 flex-col items-center justify-center py-1 ${
                    isActive ? 'text-charcoal' : 'text-muted-taupe hover:text-charcoal'
                  }`}
                  aria-label={`Open ${tab.label}`}
                >
                  <Icon className="mb-1 h-[18px] w-[18px]" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            })}

            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat')
                  setQuickActionVisible(false)
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-ivory bg-charcoal text-ivory shadow-md"
                aria-label="Open AI chat"
              >
                <svg className="h-5 w-5 text-champagne" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
                  <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
                </svg>
              </button>
              <span className={`mt-1 text-[10px] font-medium ${activeTab === 'chat' ? 'text-charcoal' : 'text-muted-taupe'}`}>Mitra</span>
            </div>

            {tabs.slice(2).map((tab) => {
              const isActive = tab.key === activeTab
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key)
                    setQuickActionVisible(true)
                  }}
                  className={`flex w-14 flex-col items-center justify-center py-1 ${
                    isActive ? 'text-charcoal' : 'text-muted-taupe hover:text-charcoal'
                  }`}
                  aria-label={`Open ${tab.label}`}
                >
                  <Icon className="mb-1 h-[18px] w-[18px]" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            })}
        </nav>
      </div>

      {isQuickActionOpen ? (
        <div className="fixed inset-0 z-[2147483200] flex items-end justify-center bg-charcoal/35 px-2 pb-2 pt-8 sm:items-center sm:px-4 sm:pb-4 sm:pt-4">
          <div className="animate-modal-in flex max-h-[88dvh] w-full max-w-[500px] flex-col overflow-hidden rounded-[26px] border border-champagne-border bg-ivory-card shadow-card-warm sm:rounded-2xl">
              <div className="gopuram-divider" />
              <div className="p-3.5 sm:p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-champagne">
                    Quick Add
                  </p>
                  <h3 className="font-display text-2xl font-semibold text-charcoal sm:text-3xl">
                    {quickActionTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeQuickActionModal}
                  className="rounded-full border border-border-warm bg-white p-2 text-muted-taupe"
                  aria-label="Close add form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleQuickActionSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="space-y-2.5 overflow-y-auto pr-1 sm:space-y-3">
                  {activeTab === 'todos' ? (
                    <>
                      <input
                        value={taskForm.title}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="e.g., Confirm Purohit Garu availability"
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              dueDate: event.target.value,
                            }))
                          }
                        />
                        <select
                          value={taskForm.priority}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              priority: event.target.value as TodoPriority,
                            }))
                          }
                          className="rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-charcoal"
                          aria-label="Task priority"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <select
                        value={taskForm.eventId}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            eventId: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-charcoal"
                        aria-label="Link task to ceremony"
                      >
                        <option value="">No ceremony link</option>
                        {data.guests.events.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}

                  {activeTab === 'payments' ? (
                    <>
                      <input
                        value={expenseForm.title}
                        onChange={(event) =>
                          setExpenseForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="e.g., Kalyana Mandapam advance"
                      />
                      <StyledDropdown
                        value={expenseForm.category}
                        options={expenseCategoryOptions}
                        onChange={(value) =>
                          setExpenseForm((current) => ({
                            ...current,
                            category: value,
                          }))
                        }
                        ariaLabel="Payment category"
                      />
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <input
                          type="number"
                          min={1}
                          value={expenseForm.totalAmount}
                          onChange={(event) =>
                            setExpenseForm((current) => ({
                              ...current,
                              totalAmount: event.target.value,
                            }))
                          }
                          placeholder="Total amount"
                        />
                        <input
                          type="number"
                          min={0}
                          value={expenseForm.paidAmount}
                          onChange={(event) =>
                            setExpenseForm((current) => ({
                              ...current,
                              paidAmount: event.target.value,
                            }))
                          }
                          placeholder="Paid amount"
                        />
                        <input
                          type="date"
                          value={expenseForm.dueDate}
                          onChange={(event) =>
                            setExpenseForm((current) => ({
                              ...current,
                              dueDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  {activeTab === 'invites' ? (
                    <>
                      <input
                        value={inviteForm.eventName}
                        onChange={(event) =>
                          setInviteForm((current) => ({
                            ...current,
                            eventName: event.target.value,
                          }))
                        }
                        placeholder="Event name (e.g. Pellikuthuru)"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="date"
                          value={inviteForm.eventDate}
                          onChange={(event) =>
                            setInviteForm((current) => ({
                              ...current,
                              eventDate: event.target.value,
                            }))
                          }
                        />
                        <input
                          value={inviteForm.eventDetails}
                          onChange={(event) =>
                            setInviteForm((current) => ({
                              ...current,
                              eventDetails: event.target.value,
                            }))
                          }
                          placeholder="Basic details (notes)"
                        />
                      </div>
                      <input
                        value={inviteForm.memberInput}
                        onChange={(event) =>
                          setInviteForm((current) => ({
                            ...current,
                            memberInput: event.target.value,
                          }))
                        }
                        onKeyDown={handleInviteMemberInputKeyDown}
                        placeholder="Type invitee name and press Enter"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => addInviteeChip(inviteForm.memberInput)}
                          className="rounded-lg border border-border-warm bg-white px-3 py-1.5 text-xs font-semibold text-charcoal"
                        >
                          Add member
                        </button>
                      </div>

                      {inviteForm.members.length > 0 ? (
                        <div className="flex flex-wrap gap-2 rounded-xl border border-border-warm bg-white px-3 py-3">
                          {inviteForm.members.map((member) => (
                            <span
                              key={member}
                              className="inline-flex items-center gap-1 rounded-full border border-champagne/35 bg-champagne-light px-2.5 py-1 text-xs font-semibold text-charcoal"
                            >
                              {member}
                              <button
                                type="button"
                                onClick={() => removeInviteeChip(member)}
                                className="rounded-full p-0.5 text-muted-taupe hover:bg-white"
                                aria-label={`Remove ${member}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-taupe">
                          Press Enter after each name to create removable chips.
                        </p>
                      )}

                      <div className="space-y-2 rounded-xl border border-border-warm bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-taupe">
                          Quick add from previous events
                        </p>
                        {data.guests.events.length === 0 ? (
                          <p className="text-xs text-muted-taupe">
                            No previous events available yet.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {data.guests.events.map((event) => {
                              const isSelected = inviteForm.quickAddEventIds.includes(event.id)
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={() => toggleQuickAddEventSelection(event.id)}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                    isSelected
                                      ? 'border-charcoal bg-charcoal text-ivory-bg'
                                      : 'border-border-warm bg-ivory-bg text-charcoal'
                                  }`}
                                >
                                  {event.name} ({event.invitees.length})
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeTab === 'vendors' ? (
                    <>
                      <input
                        value={vendorForm.name}
                        onChange={(event) =>
                          setVendorForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Vendor or artist name"
                      />
                      <input
                        value={vendorForm.phone}
                        onChange={(event) =>
                          setVendorForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="Phone"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="number"
                          min={0}
                          value={vendorForm.totalContract}
                          onChange={(event) =>
                            setVendorForm((current) => ({
                              ...current,
                              totalContract: event.target.value,
                            }))
                          }
                          placeholder="Contract amount"
                        />
                        <input
                          type="number"
                          min={0}
                          value={vendorForm.paidAmount}
                          onChange={(event) =>
                            setVendorForm((current) => ({
                              ...current,
                              paidAmount: event.target.value,
                            }))
                          }
                          placeholder="Paid amount"
                        />
                      </div>
                      <textarea
                        value={vendorForm.notes}
                        onChange={(event) =>
                          setVendorForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="Notes"
                        className="min-h-[88px] w-full resize-y rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-charcoal shadow-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20"
                      />
                    </>
                  ) : null}

                  {quickActionError ? (
                    <p className="rounded-xl border border-blush-deep/30 bg-blush-soft px-3 py-2 text-sm text-blush-deep">
                      {quickActionError}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blush-deep py-2.5 text-sm font-semibold text-ivory-bg"
                >
                  {activeTab === 'payments' ? (
                    <ReceiptText className="h-4 w-4" />
                  ) : activeTab === 'vendors' ? (
                    <UserRound className="h-4 w-4" />
                  ) : (
                    <CirclePlus className="h-4 w-4" />
                  )}
                  {quickActionSubmitLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  )
}

export default App
