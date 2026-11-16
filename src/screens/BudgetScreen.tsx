import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { EmptyStateCard, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import type { ExpenseCategory, ExpenseItem, ExpenseStatus } from '../types/wedding'
import { formatCurrencyInr, formatDate } from '../utils/weddingFormat'

const categories: Array<ExpenseCategory | 'All'> = [
  'All',
  'Venue',
  'Catering',
  'Attire',
  'Photography',
  'Decor',
]

const paymentFormCategories: ExpenseCategory[] = ['Venue', 'Catering', 'Attire', 'Photography', 'Decor']

const statusBadgeMap: Record<ExpenseStatus, string> = {
  Paid: 'text-sage bg-sage-light',
  'Deposit Paid': 'text-champagne bg-champagne-light',
  'Due Soon': 'text-blush-deep bg-blush-soft',
}

type PaymentView = 'list' | 'add' | 'edit'

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

interface BudgetScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
}

export function BudgetScreen({ onQuickActionVisibilityChange }: BudgetScreenProps) {
  const { budgetMetrics, data, addExpense, updateExpenseAmounts } = useWedding()
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory | 'All'>('All')
  const [paymentView, setPaymentView] = useState<PaymentView>('list')
  const [paymentError, setPaymentError] = useState('')
  const [selectedExpenseId, setSelectedExpenseId] = useState('')

  const [addTitle, setAddTitle] = useState('')
  const [addCategory, setAddCategory] = useState<ExpenseCategory>('Venue')
  const [addTotalAmount, setAddTotalAmount] = useState('')
  const [addPaidAmount, setAddPaidAmount] = useState('0')
  const [addDueDate, setAddDueDate] = useState(getCurrentDateString())

  const [editTotalAmount, setEditTotalAmount] = useState('')
  const [editPaidAmount, setEditPaidAmount] = useState('')

  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )

  const selectedExpense = useMemo(
    () => data.expenses.find((expense) => expense.id === selectedExpenseId) ?? null,
    [data.expenses, selectedExpenseId],
  )

  const filteredExpenses = useMemo(() => {
    if (activeCategory === 'All') {
      return data.expenses
    }
    return data.expenses.filter((expense) => expense.category === activeCategory)
  }, [activeCategory, data.expenses])

  const plannedSpend =
    budgetMetrics.totalBudget > 0
      ? budgetMetrics.totalBudget
      : data.expenses.reduce((sum, expense) => sum + expense.totalAmount, 0)
  const outstandingAmount = Math.max(0, plannedSpend - budgetMetrics.totalPaid)

  useEffect(() => {
    if (!onQuickActionVisibilityChange) {
      return
    }
    onQuickActionVisibilityChange(paymentView === 'list')
    return () => onQuickActionVisibilityChange(true)
  }, [onQuickActionVisibilityChange, paymentView])

  function openAddScreen() {
    setPaymentError('')
    setAddTitle('')
    setAddCategory('Venue')
    setAddTotalAmount('')
    setAddPaidAmount('0')
    setAddDueDate(getCurrentDateString())
    setPaymentView('add')
  }

  function openEditScreen(expense: ExpenseItem) {
    setPaymentError('')
    setSelectedExpenseId(expense.id)
    setEditTotalAmount(String(expense.totalAmount))
    setEditPaidAmount(String(expense.paidAmount))
    setPaymentView('edit')
  }

  function goToListScreen() {
    setPaymentError('')
    setPaymentView('list')
  }

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPaymentError('')

    if (!addTitle.trim()) {
      setPaymentError('Payment title is required.')
      return
    }
    if (!addDueDate) {
      setPaymentError('Please select a due date.')
      return
    }

    const totalAmount = Number(addTotalAmount)
    const paidAmount = Number(addPaidAmount || 0)
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setPaymentError('Total amount must be greater than ₹0.')
      return
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      setPaymentError('Paid amount must be between ₹0 and total amount.')
      return
    }

    addExpense({
      title: addTitle.trim(),
      vendorName: '',
      category: addCategory,
      totalAmount,
      paidAmount,
      dueDate: addDueDate,
    })
    goToListScreen()
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedExpense) {
      setPaymentError('Payment not found. Please return and select again.')
      return
    }
    setPaymentError('')

    const totalAmount = Number(editTotalAmount)
    const paidAmount = Number(editPaidAmount || 0)
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setPaymentError('Total amount must be greater than ₹0.')
      return
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      setPaymentError('Paid amount must be between ₹0 and total amount.')
      return
    }

    updateExpenseAmounts(selectedExpense.id, totalAmount, paidAmount)
    goToListScreen()
  }

  if (paymentView === 'add') {
    return (
      <section className="screen-animate space-y-5 px-2 pt-4">
        <button
          type="button"
          onClick={goToListScreen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-taupe hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </button>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-champagne">New Ledger Entry</p>
          <h1 className="mt-0.5 font-display text-[42px] font-semibold leading-none text-charcoal">Add Payment</h1>
        </div>

        <form onSubmit={handleAddSubmit} className="space-y-4 rounded-3xl border border-brass-line bg-silk p-5 shadow-soft">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Title *</label>
            <input
              value={addTitle}
              onChange={(event) => setAddTitle(event.target.value)}
              placeholder="e.g., Kalyana Mandapam Advance"
              className="bg-ivory"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Category *</label>
              <select value={addCategory} onChange={(event) => setAddCategory(event.target.value as ExpenseCategory)} className="bg-ivory text-xs">
                {paymentFormCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Due Date *</label>
              <input type="date" value={addDueDate} onChange={(event) => setAddDueDate(event.target.value)} className="bg-ivory text-xs tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Total Amount (₹) *</label>
              <input
                type="number"
                min={1}
                value={addTotalAmount}
                onChange={(event) => setAddTotalAmount(event.target.value)}
                placeholder="100000"
                className="bg-ivory tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Paid Amount (₹)</label>
              <input
                type="number"
                min={0}
                value={addPaidAmount}
                onChange={(event) => setAddPaidAmount(event.target.value)}
                className="bg-ivory tabular-nums"
              />
            </div>
          </div>

          {paymentError ? (
            <div className="rounded-xl bg-blush-soft px-3.5 py-2.5 text-xs text-blush-deep">{paymentError}</div>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToListScreen}
              className="flex-1 rounded-2xl border border-brass-line py-3 text-xs font-medium text-muted-taupe"
            >
              Back
            </button>
            <button type="submit" className="flex-1 rounded-2xl bg-charcoal py-3 text-xs font-medium text-ivory">
              Save Payment
            </button>
          </div>
        </form>
      </section>
    )
  }

  if (paymentView === 'edit' && selectedExpense) {
    const completion = Math.min(
      100,
      Math.round((selectedExpense.paidAmount / selectedExpense.totalAmount) * 100),
    )

    return (
      <section className="screen-animate space-y-5 px-2 pt-4">
        <button
          type="button"
          onClick={goToListScreen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-taupe hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </button>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-champagne">
            {selectedExpense.category} · {formatDate(selectedExpense.dueDate)}
          </p>
          <h1 className="mt-0.5 font-display text-[42px] font-semibold leading-none text-charcoal">
            {selectedExpense.title}
          </h1>
          {selectedExpense.eventId && eventNameById.get(selectedExpense.eventId) ? (
            <p className="mt-1 text-xs text-muted-taupe">{eventNameById.get(selectedExpense.eventId)}</p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-2xl border border-brass-line bg-silk p-4 shadow-soft">
          <div className="flex justify-between text-xs tabular-nums">
            <span className="text-muted-taupe">Settlement Progress</span>
            <span className="font-semibold text-charcoal">{completion}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3EFE8]">
            <div className="h-full rounded-full bg-sage" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <form onSubmit={handleEditSubmit} className="space-y-4 rounded-3xl border border-brass-line bg-silk p-5 shadow-soft">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Total Amount (₹)</label>
            <input
              type="number"
              min={1}
              value={editTotalAmount}
              onChange={(event) => setEditTotalAmount(event.target.value)}
              className="bg-ivory tabular-nums"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Paid So Far (₹)</label>
            <input
              type="number"
              min={0}
              value={editPaidAmount}
              onChange={(event) => setEditPaidAmount(event.target.value)}
              className="bg-ivory tabular-nums"
            />
          </div>

          {paymentError ? (
            <div className="rounded-xl bg-blush-soft px-3.5 py-2 text-xs text-blush-deep">{paymentError}</div>
          ) : null}

          <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-xs font-medium text-ivory">
            Save Amounts
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="screen-animate">
      <PageHeader kicker="Vivaha Ledger" title="Payments" rightMeta={`${data.expenses.length} entries`} />

      <div className="space-y-4 px-1 pb-2">
        <div className="grid grid-cols-3 gap-2">
          <article className="rounded-2xl border border-brass-line bg-silk p-3 shadow-soft">
            <p className="mb-1 text-[10px] text-muted-taupe">Planned</p>
            <p className="truncate text-xs font-semibold tabular-nums text-charcoal">{formatCurrencyInr(plannedSpend)}</p>
          </article>
          <article className="rounded-2xl border border-brass-line bg-silk p-3 shadow-soft">
            <p className="mb-1 text-[10px] text-muted-taupe">Paid So Far</p>
            <p className="truncate text-xs font-semibold tabular-nums text-sage">{formatCurrencyInr(budgetMetrics.totalPaid)}</p>
          </article>
          <article className="rounded-2xl border border-brass-line bg-silk p-3 shadow-soft">
            <p className="mb-1 text-[10px] text-muted-taupe">Outstanding</p>
            <p className="truncate text-xs font-semibold tabular-nums text-blush-deep">{formatCurrencyInr(outstandingAmount)}</p>
          </article>
        </div>

        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((category) => {
            const active = activeCategory === category
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  active ? 'bg-charcoal text-ivory' : 'border border-brass-line bg-silk text-muted-taupe hover:text-charcoal'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>

        {data.expenses.length > 0 ? (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-muted-taupe">{filteredExpenses.length} showing</span>
            <button type="button" onClick={openAddScreen} className="text-[11px] font-medium text-blush-deep">
              + Add new payment
            </button>
          </div>
        ) : null}

        {filteredExpenses.length > 0 ? (
          <div className="space-y-2.5">
            {filteredExpenses.map((expense) => {
              const completion = Math.min(
                100,
                Math.round((expense.paidAmount / expense.totalAmount) * 100),
              )
              return (
                <article
                  key={expense.id}
                  onClick={() => openEditScreen(expense)}
                  className="cursor-pointer space-y-2.5 rounded-2xl border border-brass-line bg-silk p-4 shadow-soft transition-all hover:border-champagne/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold text-charcoal">{expense.title}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-taupe">
                        {expense.category} · {formatDate(expense.dueDate)}
                        {expense.eventId && eventNameById.get(expense.eventId) ? (
                          <span className="text-champagne"> · {eventNameById.get(expense.eventId)}</span>
                        ) : null}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusBadgeMap[expense.status]}`}>
                      {expense.status === 'Paid' ? 'Settled' : expense.status === 'Deposit Paid' ? 'Partial' : 'Due'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs tabular-nums">
                    <span className="font-semibold text-charcoal">
                      {formatCurrencyInr(expense.paidAmount)}{' '}
                      <span className="font-normal text-muted-taupe">/ {formatCurrencyInr(expense.totalAmount)}</span>
                    </span>
                    <span className="text-[11px] text-muted-taupe">{completion}%</span>
                  </div>

                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#F3EFE8]">
                    <div className="h-full rounded-full bg-champagne transition-all" style={{ width: `${completion}%` }} />
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}

        {data.expenses.length === 0 ? (
          <EmptyStateCard
            title="Track Wedding Expenses"
            subtitle="Keep Mandapam advances, silk attire, and catering milestones clear and organized."
          />
        ) : null}
      </div>
    </section>
  )
}
