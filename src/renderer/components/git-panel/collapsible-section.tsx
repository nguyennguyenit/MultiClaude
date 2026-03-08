import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
  icon?: React.ReactNode
  actionIcon?: React.ReactNode
  actionTitle?: string
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
  actionTitle,
  onAction,
  countColor,
  children
}: CollapsibleSectionProps) {
  const storageKey = `git-panel-section-${id}`

  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultOpen
    } catch {
      return defaultOpen
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(isOpen))
    } catch {
      // Ignore storage errors
    }
  }, [isOpen, storageKey])

  const toggleOpen = () => setIsOpen(prev => !prev)

  return (
    <div className="group/section border-b border-[var(--mc-border)]/60">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-2.5 py-1 cursor-pointer select-none hover:bg-[var(--mc-bg-hover)]/50 transition-colors"
        onClick={toggleOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Chevron */}
          <svg
            className={`w-2.5 h-2.5 text-[var(--mc-text-muted)] transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>

          {icon && <span className="flex-shrink-0 text-[var(--mc-text-muted)]">{icon}</span>}

          <span className="text-[10.5px] font-semibold text-[var(--mc-text-muted)] truncate uppercase tracking-widest">
            {title}
          </span>

          {count !== undefined && (
            <span className={`
              text-[10px] font-semibold px-1.5 py-0 rounded-full leading-[16px] flex-shrink-0
              ${countColor
                ? `${countColor} bg-current/10`
                : 'text-[var(--mc-text-muted)] bg-[var(--mc-bg-tertiary)]'
              }
            `}>
              {count}
            </span>
          )}
        </div>

        {/* Action button — appears on hover */}
        {actionTitle && actionIcon && onAction && (
          <button
            title={actionTitle}
            onClick={(e) => { e.stopPropagation(); onAction() }}
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              color: 'var(--mc-text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              padding: 0,
              flexShrink: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--mc-accent, #58a6ff)'
              e.currentTarget.style.background = 'var(--mc-bg-tertiary, rgba(255,255,255,0.05))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--mc-text-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
            className="opacity-0 group-hover/section:opacity-100"
          >
            {actionIcon}
          </button>
        )}
      </div>

      {/* Collapsible content with smooth animation */}
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
