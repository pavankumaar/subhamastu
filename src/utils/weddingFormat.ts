const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatCurrencyInr(value: number) {
  return inrFormatter.format(value)
}

export function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'No date' : dateFormatter.format(parsed)
}

// Device-local calendar date (toISOString would give the UTC date, which is yesterday before 5:30 AM in India).
export function todayString() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function daysFromToday(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return null
  const target = new Date(year, month - 1, day).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86400000)
}

export function relativeDayLabel(date?: string) {
  if (!date) return ''
  const days = daysFromToday(date)
  if (days === null) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return days > 0 ? `In ${days} days` : `${-days} days ago`
}

// Phone fields accept digits only, with an optional leading "+" for country codes.
export function sanitizePhone(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '').slice(0, 15)
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function telHref(phone: string) {
  return `tel:${sanitizePhone(phone)}`
}

export function expenseStatusFor(totalAmount: number, paidAmount: number) {
  if (paidAmount >= totalAmount) return 'Paid' as const
  if (paidAmount > 0) return 'Deposit Paid' as const
  return 'Due Soon' as const
}

// A blank "paid" field means the payment is already settled in full.
export function resolvePaidAmount(rawPaid: string, totalAmount: number) {
  if (!rawPaid.trim()) return totalAmount
  return Number(rawPaid)
}

// Upcoming events first (soonest at the top), then past events (most recent first), undated last.
export function compareEventsNearestFirst(left: { date?: string }, right: { date?: string }) {
  const today = todayString()
  const rank = (date?: string) => (!date ? 2 : date >= today ? 0 : 1)
  const leftRank = rank(left.date)
  const rightRank = rank(right.date)
  if (leftRank !== rightRank) return leftRank - rightRank
  if (leftRank === 0) return (left.date ?? '').localeCompare(right.date ?? '')
  if (leftRank === 1) return (right.date ?? '').localeCompare(left.date ?? '')
  return 0
}

export function calculateCountdown(targetDate: string, nowValue: number) {
  const target = new Date(targetDate).getTime()
  const difference = Math.max(0, target - nowValue)
  const totalMinutes = Math.floor(difference / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes }
}

export function calculateTimelineProgress(
  startDate: string,
  targetDate: string,
  nowValue: number,
) {
  const start = new Date(startDate).getTime()
  const target = new Date(targetDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(target) || target <= start) {
    return 0
  }
  if (nowValue <= start) {
    return 0
  }
  if (nowValue >= target) {
    return 100
  }
  const elapsed = nowValue - start
  const total = target - start
  return Math.round((elapsed / total) * 100)
}
