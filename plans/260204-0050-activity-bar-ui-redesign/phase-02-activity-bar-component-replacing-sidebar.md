# Phase 2: Activity Bar Component Replacing Sidebar

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 2h

Create VS Code-style vertical activity bar to replace current sidebar. Support 3 states: collapsed (default), expanded, hidden.

## Key Insights

- Current sidebar: 240px expanded, 60px collapsed, with header/navigation/account/settings
- VS Code activity bar: ~48px collapsed, ~200px expanded
- Need badge support for terminal count and git changes count
- UserAccountCard logic can be simplified for activity bar context

## Requirements

### Functional
- Vertical icon bar with icons for: Terminals, GitHub, Account, Settings, Toggle
- Badges showing counts (terminal count, changes count)
- 3 states: collapsed (48px), expanded (200px), hidden (0px)
- Tooltips on hover when collapsed
- Account shows GitHub avatar/status when expanded

### Non-Functional
- Smooth transition between states
- Icons use existing SVGs from navigation-item
- Consistent with existing theme variables

## Architecture

```
Activity Bar Layout:

Collapsed (48px):          Expanded (200px):
+--------+                 +------------------+
| 📺 (3) |                 | 📺 Terminals (3) |
| 🐙 (2) |                 | 🐙 GitHub (2)    |
|        |                 |                  |
|        |                 |                  |
| [space]|                 | [spacer]         |
|        |                 |                  |
| 👤     |                 | 👤 Account Info  |
| ⚙      |                 | ⚙ Settings       |
| [><]   |                 | [<] Collapse     |
+--------+                 +------------------+
```

## Related Code Files

### Files to Create
- `src/renderer/components/activity-bar/activity-bar.tsx` - Main component
- `src/renderer/components/activity-bar/activity-bar-item.tsx` - Icon button with badge
- `src/renderer/components/activity-bar/activity-bar-account.tsx` - Simplified account display
- `src/renderer/components/activity-bar/index.ts` - Barrel export

### Files to Reference
- `src/renderer/components/sidebar/sidebar.tsx` - Current implementation
- `src/renderer/components/sidebar/navigation-item.tsx` - Icon pattern
- `src/renderer/components/sidebar/user-account-card.tsx` - Account logic

### Files to Delete (after migration)
- `src/renderer/components/sidebar/sidebar.tsx`
- `src/renderer/components/sidebar/sidebar-header.tsx`
- `src/renderer/components/sidebar/navigation-item.tsx`
- `src/renderer/components/sidebar/user-account-card.tsx`
- `src/renderer/components/sidebar/index.ts`

## Implementation Steps

### Step 1: Create ActivityBarItem component
```typescript
// src/renderer/components/activity-bar/activity-bar-item.tsx
interface ActivityBarItemProps {
  icon: ReactNode
  label: string
  badge?: number
  active?: boolean
  collapsed: boolean
  onClick: () => void
}

export function ActivityBarItem({ icon, label, badge, active, collapsed, onClick }: ActivityBarItemProps) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5
          ${collapsed ? 'justify-center' : ''}
          ${active
            ? 'bg-[var(--mc-bg-active)] text-[var(--mc-accent)] border-l-2 border-[var(--mc-accent)]'
            : 'text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] hover:bg-[var(--mc-bg-hover)] border-l-2 border-transparent'}
        `}
      >
        <span className="w-5 h-5 flex-shrink-0 relative">
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 text-[10px] font-medium bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded-full flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {!collapsed && <span className="text-sm">{label}</span>}
      </button>

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
          {label}{badge ? ` (${badge})` : ''}
        </div>
      )}
    </div>
  )
}
```

### Step 2: Create ActivityBarAccount component
```typescript
// src/renderer/components/activity-bar/activity-bar-account.tsx
// Simplified version of UserAccountCard for activity bar context
// Shows: avatar, connection status dot
// Expanded: avatar + username + status
// Tooltip on collapsed shows full info
```

### Step 3: Create main ActivityBar component
```typescript
// src/renderer/components/activity-bar/activity-bar.tsx
export function ActivityBar() {
  const {
    activityBarState,
    activeView,
    setActiveView,
    terminals,
    activeProjectId,
    projects
  } = useAppStore()

  const { setSettingsModalOpen } = useSettingsStore()

  const activeProject = projects.find(p => p.id === activeProjectId)
  const terminalCount = terminals.filter(t => t.projectId === activeProjectId).length

  // Git changes count from git status (need to fetch)
  const [changesCount, setChangesCount] = useState(0)

  if (activityBarState === 'hidden') return null

  const collapsed = activityBarState === 'collapsed'
  const width = collapsed ? 'w-12' : 'w-[200px]'

  return (
    <div className={`${width} bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full transition-[width] duration-200`}>
      {/* Top Icons */}
      <div className="py-2">
        <ActivityBarItem
          icon={<TerminalIcon />}
          label="Terminals"
          badge={terminalCount}
          active={activeView === 'terminals'}
          collapsed={collapsed}
          onClick={() => setActiveView('terminals')}
        />
        <ActivityBarItem
          icon={<GitHubIcon />}
          label="GitHub"
          badge={changesCount}
          active={activeView === 'github'}
          collapsed={collapsed}
          onClick={() => setActiveView('github')}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="py-2 border-t border-[var(--mc-border)]">
        <ActivityBarAccount collapsed={collapsed} projectPath={activeProject?.path} />
        <ActivityBarItem
          icon={<SettingsIcon />}
          label="Settings"
          collapsed={collapsed}
          onClick={() => setSettingsModalOpen(true)}
        />
        <ActivityBarItem
          icon={collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          label={collapsed ? 'Expand' : 'Collapse'}
          collapsed={collapsed}
          onClick={toggleActivityBar}
        />
      </div>
    </div>
  )
}
```

### Step 4: Update App.tsx to use ActivityBar
- Replace `<Sidebar />` with `<ActivityBar />`
- Update imports

## Todo List

- [ ] Create activity-bar folder structure
- [ ] Implement ActivityBarItem with badge support
- [ ] Implement ActivityBarAccount (simplified UserAccountCard)
- [ ] Implement main ActivityBar component
- [ ] Create barrel export index.ts
- [ ] Update App.tsx imports
- [ ] Test all 3 states visually
- [ ] Test terminal/GitHub view switching

## Success Criteria

- Activity bar renders with correct icons
- Badges show terminal count and changes count
- Collapsed state shows icons only with tooltips
- Expanded state shows icons + labels + account info
- Active view highlighted with accent color
- Smooth width transition

## Security Considerations

- None (UI-only changes)

## Next Steps

- Phase 3: State management for 3-state toggle and persistence
