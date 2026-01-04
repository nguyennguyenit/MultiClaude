import logoImg from '../../assets/logo.png'

interface SidebarHeaderProps {
  collapsed: boolean
  onToggle: () => void
}

export function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div className="relative flex items-center justify-between px-3 py-3 border-b border-[var(--mc-border)]">
      {!collapsed && (
        <div className="flex items-center gap-2">
          <img
            src={logoImg}
            alt="MultiClaude"
            className="w-5 h-5 object-contain"
          />
          <span className="font-semibold text-[var(--mc-text-primary)]">MultiClaude</span>
        </div>
      )}
      {collapsed && (
        <img
          src={logoImg}
          alt="MultiClaude"
          className="w-5 h-5 object-contain mx-auto"
        />
      )}
      <button
        onClick={onToggle}
        className={`
          p-1.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-secondary)]
          transition-colors duration-150
          ${collapsed ? 'absolute right-2' : ''}
        `}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </button>
    </div>
  )
}
