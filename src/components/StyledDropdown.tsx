import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'

export interface StyledDropdownOption<T extends string> {
  value: T
  label: string
}

interface StyledDropdownProps<T extends string> {
  value: T
  options: StyledDropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

export function StyledDropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: StyledDropdownProps<T>) {
  const [isOpen, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function updateMenuPosition() {
      if (!buttonRef.current) {
        return
      }

      const rect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spacing = 6
      const screenEdge = 8
      const availableBelow = viewportHeight - rect.bottom - screenEdge
      const availableAbove = rect.top - screenEdge
      const openUpward = availableBelow < 170 && availableAbove > availableBelow
      const maxHeight = Math.max(
        120,
        Math.min(224, (openUpward ? availableAbove : availableBelow) - spacing),
      )

      setMenuStyle({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(openUpward
          ? { bottom: viewportHeight - rect.top + spacing }
          : { top: rect.bottom + spacing }),
      })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current) {
        return
      }
      const target = event.target as Node
      const clickedInsideWrapper = wrapperRef.current.contains(target)
      const clickedInsideMenu = menuRef.current?.contains(target) ?? false
      if (!clickedInsideWrapper && !clickedInsideMenu) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex w-full items-center justify-between rounded-xl border border-border-warm bg-white px-3 py-2 text-left text-sm text-charcoal shadow-sm transition-colors duration-200 hover:border-champagne/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/25"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-taupe transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && menuStyle
        ? createPortal(
            <div
              id={listboxId}
              ref={menuRef}
              role="listbox"
              style={menuStyle}
              className="fixed z-[2147483400] overflow-y-auto rounded-xl border border-border-warm bg-white py-1 shadow-card-warm"
            >
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      isSelected
                        ? 'bg-blush-soft/70 font-semibold text-charcoal'
                        : 'text-charcoal hover:bg-ivory-bg'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
