import type { ReactNode } from 'react'

interface ToolbarButtonProps {
  icon: ReactNode
  title: string
  onClick: () => void
  active?: boolean
  badge?: number
  highlight?: boolean
  testId?: string
}

/** Compact icon button for the toolbar (28px, opacity-based states) */
export function ToolbarButton({
  icon,
  title,
  onClick,
  active = false,
  badge,
  highlight = false,
  testId
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        'toolbar-btn',
        'relative',
        active ? 'active' : '',
        highlight ? 'highlight' : ''
      ].filter(Boolean).join(' ')}
      aria-pressed={active}
      data-testid={testId}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="toolbar-btn-badge">{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  )
}
