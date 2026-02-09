# Phase 1: Collapsible Sidebar

## Context

- Plan: `plans/260104-0335-ui-redesign-phase1/plan.md`
- Design Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 50-130)

## Overview

- **Priority**: P1
- **Status**: Completed
- **Effort**: 2h

Transform fixed-width sidebar into collapsible sidebar with smooth transitions between expanded (240px) and collapsed (60px) states.

## Requirements

### Functional
- Sidebar toggle via collapse button (◀/▶) in sidebar header
- Expanded state: 240px width, full text + icons
- Collapsed state: 60px width, icons only
- Smooth CSS transition (200-300ms)
- Tooltips on hover when collapsed

### Non-Functional
- No layout shift in main content area
- Maintain keyboard accessibility
- Preserve existing functionality (Git, GitHub, Tools, Settings)

## Architecture

```
Sidebar Component
├── SidebarHeader (logo + collapse button)
├── NavigationSection (Terminals, GitHub menu items)
├── Spacer
├── UserAccountCard
└── SettingsButton
```

### State Changes

```typescript
// app-store.ts - Add new state
interface AppState {
  // Existing
  sidebarOpen: boolean      // Show/hide (keep for hamburger menu)
  // New
  sidebarCollapsed: boolean // Expanded/collapsed state
  toggleSidebarCollapse: () => void
}
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/stores/app-store.ts` | Add `sidebarCollapsed` state + toggle action |
| `src/renderer/components/sidebar/sidebar.tsx` | Refactor for collapsible layout |
| `src/renderer/styles/globals.css` | Add sidebar transition CSS variables |
| `src/renderer/App.tsx` | Pass collapsed state to main content layout |

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/sidebar/sidebar-header.tsx` | Logo + collapse toggle button |

## Implementation Steps

### Step 1: Update Zustand Store

```typescript
// src/renderer/stores/app-store.ts
interface AppState {
  // ... existing
  sidebarCollapsed: boolean
  toggleSidebarCollapse: () => void
}

// Add to store
sidebarCollapsed: false,
toggleSidebarCollapse: () => set((state) => ({
  sidebarCollapsed: !state.sidebarCollapsed
})),
```

### Step 2: Add CSS Variables

```css
/* src/renderer/styles/globals.css */
:root {
  --mc-sidebar-width-expanded: 240px;
  --mc-sidebar-width-collapsed: 60px;
  --mc-sidebar-transition: 200ms ease-in-out;
}
```

### Step 3: Create Sidebar Header Component

```tsx
// src/renderer/components/sidebar/sidebar-header.tsx
interface SidebarHeaderProps {
  collapsed: boolean
  onToggle: () => void
}

export function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--mc-border)]">
      {!collapsed && (
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-medium">MultiClaude</span>
        </div>
      )}
      {collapsed && <span className="text-lg mx-auto">🤖</span>}
      <button
        onClick={onToggle}
        className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? '▶' : '◀'}
      </button>
    </div>
  )
}
```

### Step 4: Refactor Sidebar Component

Key changes:
1. Import `sidebarCollapsed` and `toggleSidebarCollapse` from store
2. Add conditional width class based on collapsed state
3. Conditionally render text labels (hide when collapsed)
4. Add transition class for smooth animation
5. Add tooltips for icons when collapsed

```tsx
// src/renderer/components/sidebar/sidebar.tsx
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapse, sidebarOpen } = useAppStore()

  if (!sidebarOpen) return null

  const width = sidebarCollapsed
    ? 'w-[var(--mc-sidebar-width-collapsed)]'
    : 'w-[var(--mc-sidebar-width-expanded)]'

  return (
    <div className={`
      ${width}
      bg-[var(--mc-bg-secondary)]
      border-r border-[var(--mc-border)]
      flex flex-col h-full
      transition-[width] duration-200 ease-in-out
    `}>
      <SidebarHeader
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebarCollapse}
      />
      {/* ... rest of sidebar */}
    </div>
  )
}
```

### Step 5: Update App Layout

```tsx
// src/renderer/App.tsx - Main content area
<div className="flex-1 flex overflow-hidden">
  <Sidebar />  {/* Sidebar manages its own width */}
  <div className="flex-1 min-w-0">
    {/* Terminal grid / content */}
  </div>
</div>
```

## Todo List

- [x] Add `sidebarCollapsed` state to app-store.ts
- [x] Add `toggleSidebarCollapse` action
- [x] Add CSS variables for sidebar widths
- [x] Create sidebar-header.tsx component
- [x] Refactor sidebar.tsx with collapsible layout
- [x] Add width transition CSS
- [x] Update App.tsx layout if needed
- [x] Test expand/collapse animation
- [x] Test existing functionality still works

## Success Criteria

- [x] Sidebar toggles between 240px and 60px widths
- [x] Smooth 200ms CSS transition on width change
- [x] Collapse button shows ◀ when expanded, ▶ when collapsed
- [x] No visual glitches during transition
- [x] Main content area adjusts properly
- [x] Existing Git/GitHub/Tools/Settings functionality preserved

## Security Considerations

N/A - UI only changes, no security implications.

## Next Steps

After completing this phase:
1. Proceed to Phase 2: Navigation Menu
2. Navigation items will use collapsed state to show/hide text
