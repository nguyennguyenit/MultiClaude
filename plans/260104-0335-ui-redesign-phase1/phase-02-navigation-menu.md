# Phase 2: Navigation Menu

## Context

- Plan: `plans/260104-0335-ui-redesign-phase1/plan.md`
- Design Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 84-143)
- Depends on: Phase 1 (Collapsible Sidebar)

## Overview

- **Priority**: P1
- **Status**: Completed
- **Effort**: 1.5h

Replace current flat sections with navigation menu items (Terminals, GitHub) with proper active states and view switching.

## Requirements

### Functional
- Two navigation items: Terminals, GitHub
- Active item shows: left accent border, bold text, accent color
- Clicking item switches main content view
- When collapsed: icon only with tooltip

### Design Spec

```
Navigation Item States:
- NORMAL:  text-muted, transparent bg
- HOVER:   text-normal, hover-bg
- ACTIVE:  left-border accent, text accent, bold
```

## Architecture

### New View State

```typescript
// app-store.ts
type ActiveView = 'terminals' | 'github'

interface AppState {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
}
```

### Component Structure

```
NavigationSection
├── NavigationItem (Terminals) - icon: 📟
└── NavigationItem (GitHub) - icon: 🔀
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/stores/app-store.ts` | Add `activeView` state |
| `src/renderer/components/sidebar/sidebar.tsx` | Replace sections with nav items |
| `src/renderer/App.tsx` | Switch content based on activeView |

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/sidebar/navigation-item.tsx` | Reusable nav item component |

## Implementation Steps

### Step 1: Update Store

```typescript
// src/renderer/stores/app-store.ts
type ActiveView = 'terminals' | 'github'

interface AppState {
  // ... existing
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
}

// Add to store
activeView: 'terminals' as ActiveView,
setActiveView: (view) => set({ activeView: view }),
```

### Step 2: Create Navigation Item Component

```tsx
// src/renderer/components/sidebar/navigation-item.tsx
interface NavigationItemProps {
  icon: React.ReactNode
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
      className={`
        w-full flex items-center gap-2 px-3 py-2 rounded-r-md
        transition-colors duration-150
        ${active
          ? 'border-l-2 border-[var(--mc-accent)] bg-[var(--mc-bg-active)] text-[var(--mc-accent)] font-medium'
          : 'text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text-primary)]'
        }
      `}
    >
      <span className="text-base">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
```

### Step 3: Update Sidebar Navigation Section

```tsx
// Inside sidebar.tsx
<div className="px-1 py-2">
  {!sidebarCollapsed && (
    <div className="px-2 py-1 text-xs text-[var(--mc-text-muted)] uppercase">
      Navigation
    </div>
  )}

  <NavigationItem
    icon="📟"
    label="Terminals"
    active={activeView === 'terminals'}
    collapsed={sidebarCollapsed}
    onClick={() => setActiveView('terminals')}
  />

  <NavigationItem
    icon="🔀"
    label="GitHub"
    active={activeView === 'github'}
    collapsed={sidebarCollapsed}
    onClick={() => setActiveView('github')}
  />
</div>
```

### Step 4: Update App.tsx Content Switching

```tsx
// src/renderer/App.tsx
const { activeView } = useAppStore()

// In main content area
{activeView === 'terminals' && (
  <TerminalGrid ... />
)}
{activeView === 'github' && (
  <GitPanel ... />  // Will expand in Phase 3
)}
```

## Todo List

- [x] Add `ActiveView` type to types
- [x] Add `activeView` and `setActiveView` to store
- [x] Create navigation-item.tsx component
- [x] Replace sidebar sections with navigation items
- [x] Add navigation section header (hide when collapsed)
- [x] Update App.tsx for view switching
- [x] Style active/hover/normal states
- [x] Add tooltips for collapsed mode
- [x] Test view switching functionality

## Success Criteria

- [x] Terminals nav item shows as active by default
- [x] Clicking GitHub switches to GitHub view
- [x] Active item has left accent border and accent text
- [x] Hover state works on inactive items
- [x] Collapsed mode shows icons only with tooltips
- [x] View content switches correctly in main area

## Next Steps

After completing this phase:
1. Proceed to Phase 3: User Account Card
2. Card will be placed between navigation and settings
