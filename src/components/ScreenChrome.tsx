import { ArrowLeft, ChevronDown, Plus, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackLayer } from '../hooks/useBackLayer'

interface PageHeaderProps {
  title: string
  rightMeta?: string
}

// Compact single-row screen header: title on the left, a small summary chip on the right.
export function PageHeader({ title, rightMeta = '' }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 px-0.5 pb-2.5 pt-1">
      <h1 className="text-xl font-bold tracking-tight text-charcoal">{title}</h1>
      {rightMeta ? (
        <span className="rounded-full border border-brass-line bg-silk px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-taupe">
          {rightMeta}
        </span>
      ) : null}
    </header>
  )
}

interface DetailHeaderProps {
  backLabel: string
  onBack: () => void
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  titleAction?: ReactNode
}

export function DetailHeader({ backLabel, onBack, title, subtitle, action, titleAction }: DetailHeaderProps) {
  return (
    <header className="space-y-1.5 pb-1 pt-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-sm font-semibold text-muted-taupe hover:text-charcoal active:bg-silk"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
        {action}
      </div>
      <div className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold leading-tight tracking-tight text-charcoal">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-taupe">{subtitle}</p> : null}
        </div>
        {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
      </div>
    </header>
  )
}

export interface ActionMenuItem {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

// Compact trigger button with a right-aligned dropdown; closes on outside tap, Escape, or selection.
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [isOpen, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useBackLayer(isOpen, () => setOpen(false))

  useEffect(() => {
    if (!isOpen) return
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-sindoor pl-3 pr-2.5 text-sm font-semibold text-white shadow-float"
      >
        <Plus className="h-4 w-4" />
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? (
        <div
          role="menu"
          className="animate-modal-in absolute right-0 top-full z-[2147483150] mt-2 w-56 overflow-hidden rounded-2xl border border-brass-line bg-silk py-1 shadow-device"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm font-medium text-charcoal active:bg-champagne-light hover:bg-ivory"
              >
                <Icon className="h-4 w-4 shrink-0 text-champagne" />
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

interface EmptyStateCardProps {
  title: string
  subtitle: string
}

export function EmptyStateCard({ title, subtitle }: EmptyStateCardProps) {
  return (
    <article className="mt-1 rounded-2xl border border-brass-line bg-silk p-5 text-center shadow-soft">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-brass-line bg-champagne-light text-champagne">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden>
          <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
          <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-charcoal">{title}</h3>
      <p className="mx-auto mt-1 max-w-[250px] text-xs leading-relaxed text-muted-taupe">{subtitle}</p>
    </article>
  )
}

interface SheetModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// Bottom sheet on phones, centered dialog on larger screens. Tapping the backdrop or pressing Escape closes it.
export function SheetModal({ title, onClose, children }: SheetModalProps) {
  useBackLayer(true, onClose)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2147483200] flex items-end justify-center bg-charcoal/40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-modal-in flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-3xl border border-brass-line bg-silk shadow-device"
      >
        <div className="flex items-center justify-between gap-2 border-b border-brass-line/70 py-2 pl-4 pr-2">
          <h3 className="text-base font-bold text-charcoal">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-taupe hover:bg-ivory hover:text-charcoal"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="clean-scroll overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-muted-taupe">{children}</label>
}
