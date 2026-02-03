import { ReactNode, useEffect, useRef, useState } from 'react'

interface ActivityBarNavigationItemProps {
  icon: ReactNode
  label: string
  badge?: number
  active: boolean
  collapsed: boolean
  iconSize?: 'sm' | 'md' | 'lg'  // sm=4, md=5, lg=6
  onClick: () => void
}

export function ActivityBarNavigationItem({
  icon,
  label,
  badge,
  active,
  collapsed,
  iconSize = 'sm',
  onClick
}: ActivityBarNavigationItemProps) {
  const [shouldPulse, setShouldPulse] = useState(false)
  const prevBadge = useRef(badge)

  // Badge pulse animation on count change
  useEffect(() => {
    if (badge !== prevBadge.current && badge !== undefined && prevBadge.current !== undefined) {
      setShouldPulse(true)
      const timer = setTimeout(() => setShouldPulse(false), 150)
      return () => clearTimeout(timer)
    }
    prevBadge.current = badge
  }, [badge])

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded text-sm relative
          transition-colors duration-150
          ${collapsed ? 'justify-center' : ''}
          ${active
            ? 'bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
            : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text-primary)]'
          }
        `}
        title={collapsed ? label : undefined}
      >
        {/* Active indicator bar */}
        {active && (
          <span
            className="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--mc-accent)] rounded-full activity-bar-indicator-animate"
          />
        )}

        {/* Icon with badge */}
        <span className={`relative flex-shrink-0 ${iconSize === 'lg' ? '[&>svg]:w-6 [&>svg]:h-6' : iconSize === 'md' ? '[&>svg]:w-5 [&>svg]:h-5' : '[&>svg]:w-4 [&>svg]:h-4'}`}>
          {icon}
          {badge !== undefined && badge > 0 && (
            <span
              className={`
                absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1
                flex items-center justify-center
                text-[10px] font-medium
                bg-[var(--mc-accent)] text-white rounded-full
                ${shouldPulse ? 'activity-bar-badge-pulse' : ''}
              `}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>

        {/* Label */}
        {!collapsed && (
          <span className="truncate">{label}</span>
        )}
      </button>

      {/* Tooltip on hover when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="ml-1 text-[var(--mc-accent)]">({badge})</span>
          )}
        </div>
      )}
    </div>
  )
}
