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
  return dateFormatter.format(new Date(value))
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
