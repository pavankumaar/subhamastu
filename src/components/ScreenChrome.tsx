import { ArrowLeft, ChevronDown, LogOut, Plus, Unlink, X, type LucideIcon } from 'lucide-react'
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

// Shared open state for dropdowns: closes on outside tap, Escape and the phone Back button.
function useDropdown() {
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

  return { isOpen, setOpen, containerRef }
}

const menuPanelClass =
  'animate-modal-in absolute right-0 top-full z-[2147483150] mt-2 overflow-hidden rounded-2xl border border-brass-line bg-silk py-1 shadow-device'
const menuItemClass =
  'flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm font-medium active:bg-champagne-light hover:bg-ivory'

// Compact trigger button with a right-aligned dropdown; closes on outside tap, Escape, or selection.
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const { isOpen, setOpen, containerRef } = useDropdown()

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
        <div role="menu" className={`${menuPanelClass} w-56`}>
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
                className={`${menuItemClass} text-charcoal`}
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

export interface ProfileMenuProfile {
  name: string
  displayName?: string
  email?: string
  picture?: string
  google?: boolean
  hasPin?: boolean
}

function Avatar({ profile, size }: { profile: ProfileMenuProfile; size: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  if (profile.picture && !imageFailed) {
    return (
      <img
        src={profile.picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={`${size} rounded-full object-cover`}
      />
    )
  }
  return <>{(profile.displayName || profile.name).charAt(0).toUpperCase()}</>
}

// Avatar button in the app header; its menu shows who is signed in, Google connection and Log out.
export function ProfileMenu({
  profile,
  onLogout,
  onConnectGoogle,
  onDisconnectGoogle,
}: {
  profile: ProfileMenuProfile
  onLogout: () => void
  onConnectGoogle?: () => void
  onDisconnectGoogle?: () => void
}) {
  const { isOpen, setOpen, containerRef } = useDropdown()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const title = profile.displayName || profile.name

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setConfirmDisconnect(false)
          setOpen((open) => !open)
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Profile menu for ${profile.name}`}
        title={`Signed in as ${profile.name}`}
        className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-silk text-sm font-bold text-charcoal transition-colors ${
          isOpen ? 'border-champagne ring-2 ring-champagne/25' : 'border-brass-line'
        }`}
      >
        <Avatar profile={profile} size="h-full w-full" />
      </button>
      {isOpen ? (
        <div role="menu" className={`${menuPanelClass} w-64`}>
          <div className="border-b border-brass-line/70 px-4 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-taupe">Signed in as</p>
            <p className="truncate text-sm font-bold text-charcoal">{title}</p>
            {title !== profile.name ? <p className="truncate text-xs text-muted-taupe">@{profile.name}</p> : null}
            {profile.google && profile.email ? (
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-taupe">
                <GoogleMark className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </p>
            ) : null}
          </div>
          {!profile.google && onConnectGoogle ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onConnectGoogle()
              }}
              className={`${menuItemClass} text-charcoal`}
            >
              <GoogleMark className="h-4 w-4 shrink-0" />
              Connect Google
            </button>
          ) : null}
          {profile.google && profile.hasPin && onDisconnectGoogle ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (!confirmDisconnect) {
                  setConfirmDisconnect(true)
                  return
                }
                setOpen(false)
                onDisconnectGoogle()
              }}
              className={`${menuItemClass} ${confirmDisconnect ? 'bg-blush-soft text-blush-deep' : 'text-charcoal'}`}
            >
              <Unlink className="h-4 w-4 shrink-0 text-muted-taupe" />
              {confirmDisconnect ? 'Tap again to disconnect' : 'Disconnect Google'}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className={`${menuItemClass} text-blush-deep`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

// Google "G" logo (brand colours), used next to Google account details.
export function GoogleMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
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
