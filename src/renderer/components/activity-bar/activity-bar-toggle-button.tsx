import type { ActivityBarState } from '@shared/types'

interface ActivityBarToggleButtonProps {
  state: ActivityBarState
  onCycle: () => void
  collapsed: boolean
}

export function ActivityBarToggleButton({ state, onCycle, collapsed }: ActivityBarToggleButtonProps) {
  // Don't render in hidden state (hover zone handles reveal)
  if (state === 'hidden') return null

  const icon = state === 'collapsed' ? (
    // Expand icon (chevron right)
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ) : (
    // Collapse icon (chevron left)
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )

  const label = state === 'collapsed' ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'

  return (
    <div className="relative group">
      <button
        onClick={onCycle}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded text-sm
          transition-colors duration-150
          ${collapsed ? 'justify-center' : ''}
          text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text-primary)]
        `}
        title={collapsed ? label : undefined}
      >
        {icon}
        {!collapsed && <span className="truncate">{state === 'collapsed' ? 'Expand' : 'Collapse'}</span>}
      </button>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
          {label}
        </div>
      )}
    </div>
  )
}
