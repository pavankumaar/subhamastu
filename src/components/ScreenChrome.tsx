import { ArrowLeft, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

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
}

export function DetailHeader({ backLabel, onBack, title, subtitle, action }: DetailHeaderProps) {
  return (
    <header className="space-y-1.5 pb-1 pt-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-taupe hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
        {action}
      </div>
      <div className="px-0.5">
        <h1 className="text-xl font-bold leading-tight tracking-tight text-charcoal">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-taupe">{subtitle}</p> : null}
      </div>
    </header>
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
      className="fixed inset-0 z-[2147483200] flex items-end justify-center bg-charcoal/40 px-2 pb-2 pt-10 sm:items-center sm:p-4"
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
        <div className="flex items-center justify-between gap-2 border-b border-brass-line/70 px-4 py-3">
          <h3 className="text-base font-bold text-charcoal">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-taupe hover:bg-ivory hover:text-charcoal"
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
