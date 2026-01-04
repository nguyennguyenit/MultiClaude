import type { ReactNode } from 'react'

interface NavigationItemProps {
  icon: ReactNode
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}

export function NavigationItem({
  icon,
  label,
  active,
  collapsed,
  onClick
}: NavigationItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`
        w-full flex items-center gap-2 px-3 py-2 rounded-r-md
        transition-colors duration-150
        ${active
          ? 'border-l-2 border-[var(--mc-accent)] bg-[var(--mc-bg-active)] text-[var(--mc-accent)] font-medium'
          : 'border-l-2 border-transparent text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text-primary)]'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
    </button>
  )
}
