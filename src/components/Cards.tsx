import { Check, CheckCircle2, ChevronRight, Copy, Phone, Plus, ShoppingBag } from 'lucide-react'
import { useState, type MouseEvent, type ReactNode } from 'react'
import type { TodoItem, TodoPriority, VendorItem } from '../types/wedding'
import { formatCurrencyInr, formatDate, telHref } from '../utils/weddingFormat'

const cardClass =
  'rounded-2xl border border-brass-line bg-silk p-3 shadow-soft transition-colors hover:border-champagne/60'

function stop(event: MouseEvent) {
  event.stopPropagation()
}

export function MarkPaidButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        stop(event)
        onClick()
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-sage/30 bg-sage-light font-semibold text-sage ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      Mark paid
    </button>
  )
}

interface PaymentCardProps {
  title: string
  subtitle: ReactNode
  totalAmount: number
  paidAmount: number
  onOpen?: () => void
  onMarkPaid?: () => void
}

export function PaymentCard({ title, subtitle, totalAmount, paidAmount, onOpen, onMarkPaid }: PaymentCardProps) {
  const completion = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
  const settled = totalAmount > 0 && paidAmount >= totalAmount
  const badge = settled
    ? { label: 'Paid', className: 'bg-sage-light text-sage' }
    : paidAmount > 0
      ? { label: 'Partial', className: 'bg-champagne-light text-champagne' }
      : { label: 'Due', className: 'bg-blush-soft text-blush-deep' }

  return (
    <article
      onClick={onOpen}
      className={`${cardClass} space-y-2 ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-charcoal">{title}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-taupe">{subtitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
      </div>
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span className="font-semibold text-charcoal">
          {formatCurrencyInr(paidAmount)} <span className="font-normal text-muted-taupe">/ {formatCurrencyInr(totalAmount)}</span>
        </span>
        <span className="text-muted-taupe">{completion}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#F3EFE8]">
        <div className={`h-full rounded-full ${settled ? 'bg-sage' : 'bg-champagne'}`} style={{ width: `${completion}%` }} />
      </div>
      {!settled && onMarkPaid ? (
        <div className="flex justify-end">
          <MarkPaidButton onClick={onMarkPaid} compact />
        </div>
      ) : null}
    </article>
  )
}

function priorityBadge(priority: TodoPriority) {
  if (priority === 'High') return 'bg-blush-soft text-blush-deep'
  if (priority === 'Medium') return 'bg-champagne-light text-champagne'
  return 'bg-sage-light text-sage'
}

interface TodoCardProps {
  todo: TodoItem
  eventName?: string
  onToggle: () => void
  onOpen?: () => void
}

export function TodoCard({ todo, eventName, onToggle, onOpen }: TodoCardProps) {
  const isBuy = todo.kind === 'buy'
  return (
    <article className={`${cardClass} flex items-start gap-3`}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.completed ? `Mark ${todo.title} not done` : `Mark ${todo.title} done`}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          todo.completed ? 'border-sage bg-sage text-white' : 'border-champagne/60 hover:border-charcoal'
        }`}
      >
        {todo.completed ? <Check className="h-3 w-3 stroke-[2.5]" /> : null}
      </button>
      <button type="button" onClick={onOpen} disabled={!onOpen} className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-medium leading-snug ${todo.completed ? 'text-muted-taupe line-through' : 'text-charcoal'}`}>
          {todo.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {isBuy ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EFE8] px-2 py-0.5 font-semibold text-charcoal">
              <ShoppingBag className="h-3 w-3" />
              To buy
            </span>
          ) : null}
          <span className={`rounded-full px-2 py-0.5 font-semibold ${priorityBadge(todo.priority)}`}>{todo.priority}</span>
          {todo.dueDate ? <span className="tabular-nums text-muted-taupe">{formatDate(todo.dueDate)}</span> : null}
          {eventName ? <span className="max-w-[140px] truncate text-champagne">· {eventName}</span> : null}
        </div>
      </button>
      {onOpen ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-taupe" /> : null}
    </article>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function PhoneActions({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false)

  async function copy(event: MouseEvent) {
    stop(event)
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={telHref(phone)}
        onClick={stop}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sage px-3 py-2 text-xs font-semibold text-white"
        aria-label={`Call ${phone}`}
      >
        <Phone className="h-3.5 w-3.5" />
        Call {phone}
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-xl border border-brass-line bg-ivory px-3 py-2 text-xs font-medium text-charcoal"
        aria-label="Copy phone number"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

interface VendorCardProps {
  vendor: VendorItem
  eventName?: string
  onOpen?: () => void
  onMarkPaid?: () => void
  footer?: ReactNode
}

export function VendorCard({ vendor, eventName, onOpen, onMarkPaid, footer }: VendorCardProps) {
  const settled = vendor.totalContract > 0 && vendor.paidAmount >= vendor.totalContract
  return (
    <article onClick={onOpen} className={`${cardClass} space-y-2.5 ${onOpen ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass-line bg-champagne-light text-xs font-bold text-charcoal">
          {getInitials(vendor.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-charcoal">{vendor.name}</h3>
            {vendor.totalContract > 0 ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${settled ? 'bg-sage-light text-sage' : 'bg-champagne-light text-champagne'}`}>
                {settled ? 'Paid' : 'Due'}
              </span>
            ) : null}
          </div>
          {eventName ? <p className="mt-0.5 text-xs text-champagne">{eventName}</p> : null}
          {vendor.notes ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-taupe">{vendor.notes}</p> : null}
        </div>
      </div>
      {vendor.totalContract > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-brass-line/60 pt-2 text-xs tabular-nums text-muted-taupe">
          <span>
            <span className="font-semibold text-charcoal">{formatCurrencyInr(vendor.paidAmount)}</span> / {formatCurrencyInr(vendor.totalContract)} paid
          </span>
          {!settled && onMarkPaid ? <MarkPaidButton onClick={onMarkPaid} compact /> : null}
        </div>
      ) : null}
      {vendor.phone ? <PhoneActions phone={vendor.phone} /> : null}
      {footer}
    </article>
  )
}

export function SectionTitle({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-center justify-between px-0.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-taupe">
        {title}
        {typeof count === 'number' ? <span className="ml-1.5 tabular-nums text-charcoal">{count}</span> : null}
      </h3>
      {action}
    </div>
  )
}

// Full-width, thumb-friendly "add" action placed at the bottom of a section.
export function SectionAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-champagne/50 bg-silk/60 px-3 text-sm font-semibold text-charcoal active:bg-champagne-light"
    >
      <Plus className="h-4 w-4 text-champagne" />
      {label}
    </button>
  )
}
