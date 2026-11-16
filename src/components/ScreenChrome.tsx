interface PageHeaderProps {
  kicker: string
  title: string
  rightMeta?: string
}

export function PageHeader({ kicker, title, rightMeta = '' }: PageHeaderProps) {
  return (
    <header className="px-1 pb-4 pt-3.5">
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-taupe">
        <span className="font-medium uppercase tracking-widest text-champagne">{kicker}</span>
        <span className="tabular-nums">{rightMeta}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <h1 className="font-display text-[40px] font-semibold leading-none tracking-tight text-charcoal">
          {title}
        </h1>
        <svg
          className="mb-0.5 h-5 w-5 shrink-0 text-champagne/70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden
        >
          <path d="M12 4C12 4 9.8 6.8 9.8 8.6C9.8 9.8 10.8 10.8 12 10.8C13.2 10.8 14.2 9.8 14.2 8.6C14.2 6.8 12 4 12 4Z" />
          <path d="M5 14.5C5 17.6 8.1 19.8 12 19.8C15.9 19.8 19 17.6 19 14.5H5Z" />
        </svg>
      </div>
      <div className="mt-4 h-px bg-brass-line" />
    </header>
  )
}

interface EmptyStateCardProps {
  title: string
  subtitle: string
}

export function EmptyStateCard({ title, subtitle }: EmptyStateCardProps) {
  return (
    <article className="mx-1 mt-1.5 rounded-3xl border border-brass-line bg-silk p-6 text-center shadow-soft">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-brass-line bg-champagne-light text-champagne">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
          <path d="M12 3C12 3 9.5 6.2 9.5 8.2C9.5 9.6 10.6 10.7 12 10.7C13.4 10.7 14.5 9.6 14.5 8.2C14.5 6.2 12 3 12 3Z" />
          <path d="M4 14C4 17.5 7.6 20 12 20C16.4 20 20 17.5 20 14H4Z" />
        </svg>
      </div>
      <h3 className="font-display text-3xl font-semibold text-charcoal">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[230px] text-xs leading-relaxed text-muted-taupe">{subtitle}</p>
    </article>
  )
}
