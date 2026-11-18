import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PaymentCard } from '../components/Cards'
import { DetailHeader, EmptyStateCard, FieldLabel, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import type { OpenItem } from '../navigation'
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseItem } from '../types/wedding'
import { formatCurrencyInr, formatDate, resolvePaidAmount, todayString } from '../utils/weddingFormat'

type CategoryFilter = ExpenseCategory | 'All' | 'Vendors'
const filters: CategoryFilter[] = ['All', ...EXPENSE_CATEGORIES, 'Vendors']

interface PaymentRow {
  key: string
  source: 'expense' | 'vendor'
  id: string
  title: string
  category: ExpenseCategory | 'Vendors'
  dueDate?: string
  eventId?: string
  totalAmount: number
  paidAmount: number
}

interface PaymentFormState {
  title: string
  category: ExpenseCategory
  dueDate: string
  totalAmount: string
  paidAmount: string
  eventId: string
}

function emptyForm(): PaymentFormState {
  return { title: '', category: 'Others', dueDate: todayString(), totalAmount: '', paidAmount: '', eventId: '' }
}

function formFromExpense(expense: ExpenseItem): PaymentFormState {
  return {
    title: expense.title,
    category: EXPENSE_CATEGORIES.includes(expense.category) ? expense.category : 'Others',
    dueDate: expense.dueDate,
    totalAmount: String(expense.totalAmount),
    paidAmount: String(expense.paidAmount),
    eventId: expense.eventId ?? '',
  }
}

interface BudgetScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
  initialItemId?: string
  onOpenItem?: OpenItem
}

export function BudgetScreen({ onQuickActionVisibilityChange, initialItemId, onOpenItem }: BudgetScreenProps) {
  const { data, addExpense, updateExpense, removeExpense, markExpensePaid, markVendorPaid } = useWedding()
  const initialExpense = initialItemId ? data.expenses.find((expense) => expense.id === initialItemId) : undefined

  const [filter, setFilter] = useState<CategoryFilter>('All')
  const [view, setView] = useState<'list' | 'add' | 'edit'>(initialExpense ? 'edit' : 'list')
  const [selectedId, setSelectedId] = useState(initialExpense?.id ?? '')
  const [form, setForm] = useState<PaymentFormState>(() => (initialExpense ? formFromExpense(initialExpense) : emptyForm()))
  const [error, setError] = useState('')

  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )

  const rows = useMemo<PaymentRow[]>(() => {
    const expenseRows: PaymentRow[] = data.expenses.map((expense) => ({
      key: `expense-${expense.id}`,
      source: 'expense',
      id: expense.id,
      title: expense.title,
      category: expense.category,
      dueDate: expense.dueDate,
      eventId: expense.eventId,
      totalAmount: expense.totalAmount,
      paidAmount: expense.paidAmount,
    }))
    const vendorRows: PaymentRow[] = data.vendors
      .filter((vendor) => vendor.totalContract > 0)
      .map((vendor) => ({
        key: `vendor-${vendor.id}`,
        source: 'vendor',
        id: vendor.id,
        title: vendor.name,
        category: 'Vendors',
        eventId: vendor.eventId,
        totalAmount: vendor.totalContract,
        paidAmount: vendor.paidAmount,
      }))
    return [...expenseRows, ...vendorRows]
  }, [data.expenses, data.vendors])

  const filteredRows = filter === 'All' ? rows : rows.filter((row) => row.category === filter)
  const planned = rows.reduce((sum, row) => sum + row.totalAmount, 0)
  const paid = rows.reduce((sum, row) => sum + Math.min(row.paidAmount, row.totalAmount), 0)
  const outstanding = Math.max(0, planned - paid)
  const selectedExpense = data.expenses.find((expense) => expense.id === selectedId) ?? null

  useEffect(() => {
    if (!onQuickActionVisibilityChange) return
    onQuickActionVisibilityChange(view === 'list')
    return () => onQuickActionVisibilityChange(true)
  }, [onQuickActionVisibilityChange, view])

  function openAdd() {
    setForm(emptyForm())
    setError('')
    setView('add')
  }

  function openEdit(expense: ExpenseItem) {
    setSelectedId(expense.id)
    setForm(formFromExpense(expense))
    setError('')
    setView('edit')
  }

  function backToList() {
    setError('')
    setView('list')
  }

  function readForm() {
    const title = form.title.trim()
    const totalAmount = Number(form.totalAmount)
    const paidAmount = resolvePaidAmount(form.paidAmount, totalAmount)
    if (!title) return { error: 'Please add a payment title.' }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return { error: 'Total amount must be greater than ₹0.' }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return { error: 'Paid amount must be between ₹0 and the total.' }
    }
    if (!form.dueDate) return { error: 'Please choose a due date.' }
    return { title, totalAmount, paidAmount }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = readForm()
    if ('error' in parsed) {
      setError(parsed.error ?? '')
      return
    }
    if (view === 'add') {
      addExpense(
        {
          title: parsed.title,
          vendorName: '',
          category: form.category,
          totalAmount: parsed.totalAmount,
          paidAmount: parsed.paidAmount,
          dueDate: form.dueDate,
        },
        form.eventId || undefined,
      )
    } else if (selectedExpense) {
      updateExpense(selectedExpense.id, {
        title: parsed.title,
        category: form.category,
        totalAmount: parsed.totalAmount,
        paidAmount: parsed.paidAmount,
        dueDate: form.dueDate,
        eventId: form.eventId || undefined,
      })
    }
    backToList()
  }

  if (view === 'add' || (view === 'edit' && selectedExpense)) {
    const isEdit = view === 'edit' && selectedExpense
    const total = Number(form.totalAmount) || 0
    const isSettled = isEdit && selectedExpense.paidAmount >= selectedExpense.totalAmount

    return (
      <section className="screen-animate space-y-3 pb-4">
        <DetailHeader
          backLabel="Payments"
          onBack={backToList}
          title={isEdit ? selectedExpense.title : 'New payment'}
          subtitle={
            isEdit
              ? `${selectedExpense.category} · due ${formatDate(selectedExpense.dueDate)}`
              : 'Leave "paid" blank if it is already fully paid.'
          }
          action={
            isEdit ? (
              <button
                type="button"
                onClick={() => {
                  removeExpense(selectedExpense.id)
                  backToList()
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blush-deep"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null
          }
        />

        {isEdit ? (
          <PaymentCard
            title="Settlement"
            subtitle={selectedExpense.eventId ? eventNameById.get(selectedExpense.eventId) ?? '' : 'Not linked to an event'}
            totalAmount={selectedExpense.totalAmount}
            paidAmount={selectedExpense.paidAmount}
          />
        ) : null}

        {isEdit && !isSettled ? (
          <button
            type="button"
            onClick={() => {
              markExpensePaid(selectedExpense.id)
              setForm((current) => ({ ...current, paidAmount: String(selectedExpense.totalAmount) }))
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-sage/30 bg-sage-light py-2.5 text-sm font-semibold text-sage"
          >
            Mark as fully paid
          </button>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <div>
            <FieldLabel>Title *</FieldLabel>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Kalyana Mandapam advance"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Category</FieldLabel>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Due date</FieldLabel>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="tabular-nums"
              />
            </div>
            <div>
              <FieldLabel>Total (₹) *</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={form.totalAmount}
                onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))}
                placeholder="100000"
                className="tabular-nums"
              />
            </div>
            <div>
              <FieldLabel>Paid (₹)</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.paidAmount}
                onChange={(event) => setForm((current) => ({ ...current, paidAmount: event.target.value }))}
                placeholder={total > 0 ? `${total} (fully paid)` : 'Blank = fully paid'}
                className="tabular-nums"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Event</FieldLabel>
            <select value={form.eventId} onChange={(event) => setForm((current) => ({ ...current, eventId: event.target.value }))}>
              <option value="">Not linked</option>
              {data.guests.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{error}</p> : null}
          <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-sm font-semibold text-ivory">
            {isEdit ? 'Save changes' : 'Save payment'}
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="screen-animate space-y-3">
      <PageHeader title="Payments" rightMeta={`${rows.length} entries`} />

      <div className="grid grid-cols-3 gap-2">
        <article className="rounded-2xl border border-brass-line bg-silk p-2.5 shadow-soft">
          <p className="text-[11px] text-muted-taupe">Planned</p>
          <p className="truncate text-sm font-bold tabular-nums text-charcoal">{formatCurrencyInr(planned)}</p>
        </article>
        <article className="rounded-2xl border border-brass-line bg-silk p-2.5 shadow-soft">
          <p className="text-[11px] text-muted-taupe">Paid</p>
          <p className="truncate text-sm font-bold tabular-nums text-sage">{formatCurrencyInr(paid)}</p>
        </article>
        <article className="rounded-2xl border border-brass-line bg-silk p-2.5 shadow-soft">
          <p className="text-[11px] text-muted-taupe">Outstanding</p>
          <p className="truncate text-sm font-bold tabular-nums text-blush-deep">{formatCurrencyInr(outstanding)}</p>
        </article>
      </div>

      <div className="no-scrollbar -mx-0.5 flex items-center gap-1.5 overflow-x-auto px-0.5">
        {filters.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === category ? 'bg-charcoal text-ivory' : 'border border-brass-line bg-silk text-muted-taupe hover:text-charcoal'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs text-muted-taupe">{filteredRows.length} showing</span>
          <button type="button" onClick={openAdd} className="text-xs font-semibold text-blush-deep">
            + Add payment
          </button>
        </div>
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="space-y-2">
          {filteredRows.map((row) => {
            const eventName = row.eventId ? eventNameById.get(row.eventId) : undefined
            const subtitle = [
              row.source === 'vendor' ? 'Vendor contract' : row.category,
              row.dueDate ? formatDate(row.dueDate) : '',
              eventName ?? '',
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <PaymentCard
                key={row.key}
                title={row.title}
                subtitle={subtitle}
                totalAmount={row.totalAmount}
                paidAmount={row.paidAmount}
                onOpen={() => {
                  if (row.source === 'vendor') {
                    onOpenItem?.('vendors', row.id)
                    return
                  }
                  const expense = data.expenses.find((entry) => entry.id === row.id)
                  if (expense) openEdit(expense)
                }}
                onMarkPaid={() => (row.source === 'vendor' ? markVendorPaid(row.id) : markExpensePaid(row.id))}
              />
            )
          })}
        </div>
      ) : rows.length > 0 ? (
        <p className="py-6 text-center text-xs text-muted-taupe">No payments in {filter}.</p>
      ) : (
        <EmptyStateCard
          title="Track wedding expenses"
          subtitle="Mandapam advances, silk attire, catering and vendor contracts — all in one place."
        />
      )}
    </section>
  )
}
