import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
  icon?: React.ReactNode
  actionIcon?: React.ReactNode
  onAction?: () => void
  countColor?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = true,
  icon,
  actionIcon,
  onAction,
  countColor,
  children
}: CollapsibleSectionProps) {
  const storageKey = `git-panel-section-${id}`

  // Initialize from localStorage or defaultOpen
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultOpen
    } catch {
      return defaultOpen
    }
  })

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(isOpen))
    } catch {
      // Ignore storage errors
    }
  }, [isOpen, storageKey])

  const toggleOpen = () => setIsOpen(prev => !prev)

  return (
    <div className="border-b border-[var(--mc-border)]">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-3 py-1 cursor-pointer select-none hover:bg-[var(--mc-bg-hover)] transition-colors"
        onClick={toggleOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Chevron */}
          <svg
            className={`w-3 h-3 text-[var(--mc-text-muted)] transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {icon && <span className="flex-shrink-0">{icon}</span>}

          <span className="text-xs font-semibold text-[var(--mc-text-secondary)] truncate">
            {title}
          </span>

          {count !== undefined && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--mc-bg-tertiary)] flex-shrink-0 ${countColor || 'text-[var(--mc-text-muted)]'}`}>
              {count}
            </span>
          )}
        </div>

        {/* Action button (e.g. +/- for stage all / unstage all) */}
        {actionIcon && onAction && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction() }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors flex-shrink-0"
          >
            {actionIcon}
          </button>
        )}
      </div>

      {/* Collapsible content using grid trick for smooth animation */}
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
