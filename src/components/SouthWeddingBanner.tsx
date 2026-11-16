import type { LucideIcon } from 'lucide-react'

interface SouthWeddingBannerProps {
  label: string
  title: string
  description: string
  icon: LucideIcon
  badgeText?: string
  emojiLine?: string
}

export function SouthWeddingBanner({
  label,
  title,
  description,
  icon: Icon,
  badgeText,
  emojiLine,
}: SouthWeddingBannerProps) {
  return (
    <article className="editorial-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne">
            {label}
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold text-charcoal sm:text-3xl">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-taupe">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badgeText ? (
            <span className="rounded-full border border-brass-line bg-champagne-light px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-champagne">
              {badgeText}
            </span>
          ) : null}
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brass-line bg-ivory text-champagne">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </div>
      {emojiLine ? <p className="mt-3 text-xs tracking-[0.16em] text-muted-taupe">{emojiLine}</p> : null}
    </article>
  )
}
