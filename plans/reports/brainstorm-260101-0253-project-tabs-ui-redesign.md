# Brainstorm Report: Project Tabs + Terminal Grid Redesign

**Date:** 2026-01-01
**Type:** UI/UX Redesign
**Status:** Approved

## Problem Statement

Current layout issues:
1. Project list mixed with features in sidebar
2. Terminal tabs don't support per-project layouts
3. No session persistence per project

User wants:
1. **Project tabs at top** with Alt+1~9 shortcuts
2. **Sidebar for features only** (Git, GitHub, Tools)
3. **Remove terminal tabs** - each project has its own terminal grid
4. **Per-project terminal layout** saved between sessions

## Final Design Summary

| Aspect | Decision |
|--------|----------|
| Project tabs | Row below title bar, horizontal tabs |
| Max visible project tabs | 9 (matches Alt+1~9) |
| Overflow handling | Dropdown for 10+ projects |
| Shortcut | Alt+1~9 |
| Invalid shortcut | Toast notification |
| Sidebar content | Git, GitHub, Terminal Tools |
| Terminal tabs | **Removed** |
| Max terminals per project | 9 (3x3 grid) |
| Terminal title | Header bar on each terminal cell |
| Project switch behavior | **Pause** (keep running background) |
| New terminal creation | Sidebar button + Right-click + Ctrl+N |
| Session persistence | Per-project layout saved |

## Proposed Layout

```
┌────────────────────────────────────────────────────────────────┐
│ ☰  MultiClaude                                    [Title Bar] │
├────────────────────────────────────────────────────────────────┤
│ [1]Proj1 │ [2]Proj2 │ [3]Proj3 │ [+Add] │            [▼ More] │ ← Project Tabs (Alt+1~9)
├──────────┬─────────────────────────────────────────────────────┤
│ FEATURES │ ┌─────────────────┬─────────────────┐              │
│ ─────────│ │ [Terminal 1]    │ [Terminal 2]    │              │
│ 📂 Git   │ │ $ claude         │ $ npm run dev   │              │
│   master │ │                  │                 │              │
│   2 dirty│ │                  │                 │              │
│ ─────────│ ├─────────────────┼─────────────────┤              │
│ 🐙 GitHub│ │ [Terminal 3]    │                 │              │
│   @user  │ │ $ git log        │    [+ Add]      │              │
│ ─────────│ │                  │                 │              │
│ 🔧 Tools │ └─────────────────┴─────────────────┘              │
│  + Term  │                                                     │
│  ▶ Claude│         ↑ Per-project terminal grid                 │
│  ✕ Kill  │           (layout saved per project)               │
├──────────┤                                                     │
│ ⚙ Settings                                                    │
└──────────┴─────────────────────────────────────────────────────┘
```

## Terminal Grid Behavior

### Layout Options
```
1 terminal: [1x1]     ████████████████████

2 terminals: [1x2]    ████████ │ ████████

3 terminals: [2+1]    ████████ │ ████████
                      ───────────────────
                      ████████████████████

4 terminals: [2x2]    ████ │ ████
                      ─────┼─────
                      ████ │ ████

...up to 9 (3x3)
```

### Terminal Cell Structure
```
┌─────────────────────────────────────┐
│ [Title: "Terminal 1"] [✕] [⚡Claude]│ ← Header bar
├─────────────────────────────────────┤
│                                     │
│  $ claude                           │  ← xterm.js
│  > How can I help?                  │
│                                     │
└─────────────────────────────────────┘
```

### New Terminal Creation
1. **Sidebar button** - "New Terminal" in Tools section
2. **Right-click** - Context menu on empty grid area
3. **Ctrl+N** - Keyboard shortcut

### Project Switching
When switching from Project A to Project B:
1. Project A terminals continue running (paused state)
2. Project B terminals loaded from saved layout
3. If Project B is new, create 1 default terminal
4. Resume Project A terminals when switching back

## Data Model

### Project State (per project)
```typescript
interface ProjectTerminalState {
  projectId: string
  terminals: {
    id: string
    title: string
    position: { row: number; col: number }
    size?: { width: number; height: number }
  }[]
  gridLayout: '1x1' | '1x2' | '2x1' | '2x2' | '3x2' | '2x3' | '3x3'
}
```

### Persistence
```typescript
// electron-store structure
{
  projects: Project[],
  projectTerminals: {
    [projectId: string]: ProjectTerminalState
  }
}
```

## Components Changes

| Component | Action | Description |
|-----------|--------|-------------|
| `project-tabs.tsx` | **New** | Horizontal project tabs with shortcuts |
| `terminal-cell.tsx` | **New** | Single terminal with header bar |
| `terminal-grid.tsx` | **Modify** | Per-project grid, no tabs |
| `sidebar.tsx` | **Modify** | Remove projects, add Tools section |
| `App.tsx` | **Modify** | New layout structure |
| `useKeyboardShortcuts.ts` | **New** | Alt+1~9, Ctrl+N handlers |
| `project-terminal-store.ts` | **New** | Per-project terminal state |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+1~9 | Switch to project 1-9 |
| Ctrl+N | New terminal in current project |
| Ctrl+W | Close active terminal |
| Ctrl+1~9 | Focus terminal 1-9 (within project) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory usage with many paused terminals | High | Limit total terminals across all projects |
| Complex state management | Medium | Use Zustand slices for separation |
| Grid resize complexity | Medium | Use CSS Grid with predefined layouts |
| Alt key conflicts (Linux menu) | Low | Provide Ctrl+Shift fallback |

## Success Metrics

1. Project switch < 0.5s (layout restore)
2. Terminal layout persisted 100% accurately
3. Paused terminals resume without data loss
4. No shortcut conflicts reported

## Next Steps

1. Update data model for per-project terminals
2. Create ProjectTabs component
3. Create TerminalCell component (with header)
4. Refactor TerminalGrid for new layout
5. Implement session persistence
6. Add keyboard shortcuts
7. Refactor sidebar

---

**Approved by:** User
**Implementation ready:** Yes
