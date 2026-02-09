# Implementation Plan: Project Tabs + Terminal Grid Redesign

**Date:** 2026-01-01
**Brainstorm Report:** `plans/reports/brainstorm-260101-0253-project-tabs-ui-redesign.md`
**Status:** COMPLETE - All Phases Done

## Overview

Major UI redesign:
1. Project tabs at top (Alt+1~9 shortcuts)
2. Sidebar for features only (remove projects)
3. Remove terminal tabs → per-project terminal grid
4. Per-project terminal layout persistence
5. Terminals paused when switching projects

## Implementation Phases

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Data model + types | `shared/types/index.ts`, `app-store.ts` |
| 2 | ProjectTabs component | `project-tabs.tsx` (new) |
| 3 | Terminal cell with header | `terminal-pane.tsx` |
| 4 | Sidebar refactor | `sidebar.tsx` |
| 5 | App layout + keyboard shortcuts | `App.tsx`, `use-keyboard-shortcuts.ts` |
| 6 | Session persistence | `main/project/project-store.ts` |

## File Changes Summary

### New Files
- `src/renderer/components/project-tabs/project-tabs.tsx` - Horizontal project tabs
- `src/renderer/components/project-tabs/index.ts` - Export
- `src/renderer/hooks/use-keyboard-shortcuts.ts` - Global shortcuts

### Modified Files
- `src/shared/types/index.ts` - Add ProjectTerminalState type
- `src/renderer/stores/app-store.ts` - Per-project terminal state
- `src/renderer/components/terminal/terminal-pane.tsx` - Add header bar
- `src/renderer/components/terminal/terminal-grid.tsx` - Add empty cell placeholder
- `src/renderer/components/sidebar/sidebar.tsx` - Remove projects, add Tools
- `src/renderer/App.tsx` - New layout structure
- `src/main/project/project-store.ts` - Persist terminal layouts

### Deleted Files
- `src/renderer/components/terminal/terminal-tabs.tsx` - No longer needed

---

## Phase 1: Data Model + Types

**Status:** ✅ DONE (2026-01-01)
**Changed Files:** `src/shared/types/index.ts`, `src/renderer/stores/app-store.ts`

**Goal:** Update types and store for per-project terminals

### 1.1 Update Types (`src/shared/types/index.ts`)

Add after `TerminalSession`:

```typescript
// Per-project terminal state
export interface ProjectTerminalLayout {
  projectId: string
  terminals: ProjectTerminal[]
}

export interface ProjectTerminal {
  id: string
  title: string
  position: number // 0-8 for grid position
}
```

### 1.2 Update App Store (`src/renderer/stores/app-store.ts`)

Add to state:
```typescript
// Per-project terminals
projectTerminals: Record<string, ProjectTerminalLayout>
setProjectTerminals: (projectId: string, layout: ProjectTerminalLayout) => void
getProjectTerminals: (projectId: string) => ProjectTerminalLayout | undefined
```

Key changes:
- `terminals` array stays global (all running terminals)
- `projectTerminals` maps projectId → layout
- When switching project: show only that project's terminals

---

## Phase 2: ProjectTabs Component

**Status:** ✅ DONE (2026-01-01)
**Created Files:** `src/renderer/components/project-tabs/project-tabs.tsx`, `src/renderer/components/project-tabs/index.ts`

**Goal:** Horizontal tabs bar below title bar

### 2.1 Create `src/renderer/components/project-tabs/project-tabs.tsx`

Structure:
```
┌─────────────────────────────────────────────────────────────────┐
│ [1] Project1 │ [2] Project2 │ [3] Project3 │ [+] │     [▼ More] │
└─────────────────────────────────────────────────────────────────┘
```

Features:
- Show number badge [1] to [9] on visible tabs
- Active project highlighted
- Overflow dropdown for projects 10+
- "+" button to add project
- Click to switch project

Props:
```typescript
interface ProjectTabsProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onAddProject: () => void
}
```

### 2.2 Create `src/renderer/components/project-tabs/index.ts`

```typescript
export { ProjectTabs } from './project-tabs'
```

---

## Phase 3: Terminal Cell with Header

**Status:** ✅ DONE (2026-01-01)
**Modified Files:** `src/renderer/components/terminal/terminal-pane.tsx`, `src/renderer/components/terminal/terminal-grid.tsx`

**Goal:** Add header bar to each terminal pane

### 3.1 Modify `src/renderer/components/terminal/terminal-pane.tsx`

Add header bar above xterm:
```
┌─────────────────────────────────────┐
│ Terminal 1              [⚡] [✕]   │ ← Header bar (24px)
├─────────────────────────────────────┤
│                                     │
│  $ claude                           │
│                                     │
└─────────────────────────────────────┘
```

Header elements:
- Title (editable on double-click)
- Claude button (⚡) - start Claude
- Close button (✕)

### 3.2 Modify `src/renderer/components/terminal/terminal-grid.tsx`

Add "+" cell when terminals < 9:
```
[ Terminal 1 ] [ Terminal 2 ]
[ Terminal 3 ] [    + Add    ]  ← Clickable to add terminal
```

---

## Phase 4: Sidebar Refactor

**Status:** ✅ DONE (2026-01-01)
**Changed Files:** `src/renderer/components/sidebar/sidebar.tsx`

**Goal:** Remove projects, add Tools section

### 4.1 Modify `src/renderer/components/sidebar/sidebar.tsx`

New structure:
```
┌──────────────┐
│ FEATURES     │
│ ─────────────│
│ 📂 Git       │
│   master     │
│   2 dirty    │
│ ─────────────│
│ 🐙 GitHub    │
│   @username  │
│ ─────────────│
│ 🔧 Tools     │ ← NEW SECTION
│   + Terminal │
│   ▶ Claude   │
│   ✕ Kill All │
├──────────────┤
│ ⚙ Settings   │
└──────────────┘
```

Remove:
- Projects section
- Add project button
- Project list

Add Tools section:
- "+ New Terminal" - creates terminal in active project
- "▶ Start Claude" - starts Claude in active terminal
- "✕ Kill All" - kills all terminals in active project

---

## Phase 5: App Layout + Keyboard Shortcuts

**Status:** ✅ DONE (2026-01-01)
**Changed Files:** `src/renderer/App.tsx`, `src/renderer/hooks/use-keyboard-shortcuts.ts`, `src/renderer/hooks/index.ts`

**Goal:** New layout structure, global shortcuts

### 5.1 Modify `src/renderer/App.tsx`

New structure:
```tsx
<div className="h-screen flex flex-col">
  {/* Title Bar */}
  <TitleBar />

  {/* Project Tabs */}
  <ProjectTabs
    projects={projects}
    activeProjectId={activeProjectId}
    onSelectProject={setActiveProject}
    onAddProject={handleAddProject}
  />

  {/* Main Content */}
  <div className="flex-1 flex overflow-hidden">
    <Sidebar />
    <div className="flex-1">
      <TerminalGrid
        terminals={projectTerminals}
        activeTerminalId={activeTerminalId}
        onTerminalClick={setActiveTerminal}
        onAddTerminal={handleAddTerminal}
      />
    </div>
  </div>
</div>
```

Remove:
- TerminalTabs component
- Import of TerminalTabs

### 5.2 Create `src/renderer/hooks/use-keyboard-shortcuts.ts`

Global shortcuts:
```typescript
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Alt+1~9: Switch project
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        const projects = useAppStore.getState().projects
        if (projects[index]) {
          useAppStore.getState().setActiveProject(projects[index].id)
        } else {
          showNotification('warning', `No project at position ${e.key}`)
        }
      }

      // Ctrl+N: New terminal
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleAddTerminal()
      }

      // Ctrl+W: Close terminal
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        handleCloseTerminal()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
```

---

## Phase 6: Session Persistence

**Status:** ✅ DONE (2026-01-01)
**Changed Files:** `src/main/project/project-store.ts`, `src/renderer/components/terminal/terminal-tabs.tsx` (deleted), `src/renderer/components/terminal/index.ts`

**Goal:** Save/restore per-project terminal layouts

### 6.1 Modify `src/main/project/project-store.ts`

Add terminal layout persistence:
```typescript
interface ProjectData {
  projects: Project[]
  terminalLayouts: Record<string, ProjectTerminalLayout>
}
```

Methods:
- `saveTerminalLayout(projectId, layout)`
- `loadTerminalLayout(projectId)`

### 6.2 Modify session save/restore in App.tsx

On project switch:
1. Save current project's terminal layout
2. Load new project's terminal layout
3. Create default terminal if new project

---

## Delete Files

After implementation complete:

```bash
rm src/renderer/components/terminal/terminal-tabs.tsx
```

Update `src/renderer/components/terminal/index.ts`:
```typescript
// Remove: export { TerminalTabs } from './terminal-tabs'
export { TerminalGrid } from './terminal-grid'
export { TerminalPane } from './terminal-pane'
export { TerminalView } from './terminal-view'
```

---

## Testing Checklist

### Functional Tests
- [ ] Project tabs display correctly (max 9 visible)
- [ ] Alt+1~9 switches projects
- [ ] Overflow dropdown shows 10+ projects
- [ ] Sidebar Tools section works
- [ ] Terminal header bar displays title
- [ ] Terminal close button works
- [ ] Start Claude button works
- [ ] Ctrl+N creates new terminal
- [ ] Right-click context menu (if implemented)
- [ ] Session persistence on restart

### Edge Cases
- [ ] No projects → show empty state
- [ ] No terminals in project → show add button
- [ ] Switch project with unsaved terminals
- [ ] Alt+5 when only 3 projects (notification)
- [ ] Close last terminal in project

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Implement phases incrementally, test each |
| Memory with many terminals | Keep max 9 per project, warn at limit |
| Alt key Linux conflicts | Test on Linux, add Ctrl+Shift fallback if needed |
| Store migration | Auto-migrate old store format on first load |

---

## Implementation Order

```
Phase 1 (Types) ─┬─→ Phase 2 (ProjectTabs) ─┬─→ Phase 5 (App + Shortcuts)
                 │                           │
                 └─→ Phase 3 (Terminal Cell) ─┘
                 │
                 └─→ Phase 4 (Sidebar) ─────────→ Phase 6 (Persistence)
```

Recommended order: 1 → 2 → 3 → 4 → 5 → 6

Each phase should be testable independently.
