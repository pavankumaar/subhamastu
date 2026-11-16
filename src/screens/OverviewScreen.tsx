import {
  CalendarHeart,
  Landmark,
  MapPin,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWedding } from '../context/useWedding'
import {
  calculateCountdown,
  calculateTimelineProgress,
  formatCurrencyInr,
  formatDate,
} from '../utils/weddingFormat'

export function OverviewScreen() {
  const [now, setNow] = useState(() => Date.now())
  const {
    data,
    budgetMetrics,
    markExpensePaid,
    readinessPercent,
    taskCompletion,
    upcomingPayments,
  } = useWedding()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const countdown = calculateCountdown(data.event.weddingDate, now)
  const timelineProgress = calculateTimelineProgress(
    data.event.planningStartDate,
    data.event.weddingDate,
    now,
  )
  const venueLabel =
    [data.event.venueName, data.event.venueCity].filter(Boolean).join(', ') || 'Venue to be finalized'
  const pendingTasks = Math.max(0, taskCompletion.total - taskCompletion.completed)
  const duePaymentsCount = data.expenses.filter((expense) => expense.status !== 'Paid').length
  const hasBudgetTarget = budgetMetrics.totalBudget > 0
  const ringRadius = 42
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference - (timelineProgress / 100) * ringCircumference

  return (
    <section className="screen-animate space-y-5">
      <article className="editorial-card overflow-hidden p-4 sm:p-6">
        <div className="absolute -right-20 -top-14 h-44 w-44 rounded-full bg-gradient-to-br from-[#ffd39d]/70 to-champagne-light/40 blur-2xl" />
        <div className="absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-gradient-to-tr from-[#d9f2df]/75 to-ivory-bg blur-2xl" />

        <div className="relative space-y-5 sm:space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-champagne">Shaadi Priority Dashboard</p>
              <h2 className="font-display text-2xl font-semibold leading-none text-charcoal sm:text-4xl md:text-5xl">
                <span className="italic">{data.event.coupleNames}</span>
              </h2>
              <div className="inline-flex items-center gap-2 rounded-full border border-border-warm bg-white/80 px-3 py-1 text-sm text-muted-taupe">
                <MapPin className="h-3.5 w-3.5 text-champagne" />
                {venueLabel}
              </div>
            </div>

            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[1fr_auto]">
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border-warm bg-white/90 p-3 text-center shadow-card-warm">
                <div>
                  <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">
                    {countdown.days}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-taupe">Days</p>
                </div>
                <div>
                  <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">
                    {String(countdown.hours).padStart(2, '0')}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-taupe">Hours</p>
                </div>
                <div>
                  <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">
                    {String(countdown.minutes).padStart(2, '0')}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-taupe">Mins</p>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-2xl border border-border-warm bg-white/90 px-4 py-2 shadow-card-warm">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      className="fill-none stroke-border-warm"
                      strokeWidth="8"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      className="fill-none stroke-champagne transition-[stroke-dashoffset] duration-500 ease-out"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">
                      {timelineProgress}%
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-muted-taupe">Progress</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border-warm bg-white/85 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-taupe">Days Left</p>
              <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">{countdown.days}</p>
            </div>
            <div className="rounded-xl border border-border-warm bg-white/85 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-taupe">Pending Tasks</p>
              <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">{pendingTasks}</p>
            </div>
            <div className="rounded-xl border border-border-warm bg-white/85 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-taupe">Payments Due</p>
              <p className="tabular-nums font-display text-2xl font-semibold text-charcoal">{duePaymentsCount}</p>
            </div>
            <div className="rounded-xl border border-border-warm bg-white/85 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-taupe">Remaining Budget</p>
              <p className="tabular-nums font-display text-lg font-semibold text-charcoal">
                {formatCurrencyInr(budgetMetrics.remainingBalance)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-warm bg-white/85 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <WalletCards className="h-4 w-4 text-champagne" />
                Budget Health
              </p>
              <p className="text-xs text-muted-taupe">
                Readiness <span className="tabular-nums font-semibold text-charcoal">{readinessPercent}%</span>
              </p>
            </div>
            <p className="mb-3 text-sm text-muted-taupe">
              <span className="tabular-nums font-display text-2xl font-semibold text-charcoal">
                {formatCurrencyInr(budgetMetrics.totalPaid)}
              </span>{' '}
              {hasBudgetTarget
                ? `paid out of ${formatCurrencyInr(budgetMetrics.totalBudget)}`
                : 'paid (set a total budget to track progress)'}
            </p>
            <div className="relative h-3 overflow-hidden rounded-full border border-border-warm bg-ivory-bg">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-champagne transition-[width] duration-500 ease-out"
                style={{ width: `${budgetMetrics.committedPercent}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-sage transition-[width] duration-500 ease-out"
                style={{ width: `${budgetMetrics.paidPercent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-taupe">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sage" /> Paid
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-champagne" /> Committed / Deposit
              </span>
              <span className="tabular-nums">
                Tasks done: {taskCompletion.completed}/{taskCompletion.total}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-warm bg-white/85 px-4 py-3 text-sm text-muted-taupe">
            <span className="inline-flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-blush-deep" />
              Wedding date: {formatDate(data.event.weddingDate)}
            </span>
            <span className="tabular-nums text-charcoal">Progress: {timelineProgress}%</span>
          </div>
        </div>
      </article>

      <article className="editorial-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-charcoal">Upcoming Payments</h3>
          <Landmark className="h-4 w-4 text-champagne" />
        </div>

        <div className="space-y-3">
          {upcomingPayments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-warm px-4 py-6 text-center text-sm text-muted-taupe">
              No payments yet. Add your first expense from the floating quick action button.
            </p>
          ) : (
            upcomingPayments.map((payment) => {
              const balance = payment.totalAmount - payment.paidAmount
              return (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-border-warm bg-white/85 p-3 transition-transform duration-200 ease-out hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-champagne">
                        {payment.category}
                      </p>
                      <h4 className="font-semibold text-charcoal">{payment.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => markExpensePaid(payment.id)}
                      className="rounded-xl border border-sage/30 bg-sage-light px-3 py-1.5 text-xs font-semibold text-sage"
                    >
                      Mark Paid
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-taupe">
                    <span>Due {formatDate(payment.dueDate)}</span>
                    <span className="tabular-nums font-semibold text-charcoal">
                      {formatCurrencyInr(Math.max(0, balance))}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </article>
    </section>
  )
}
