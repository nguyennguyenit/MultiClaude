# Phase 1: Terminal Action Bar

## Context

- Plan: `plans/260104-0354-ui-redesign-phase2/plan.md`
- Design: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 221-252)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 2h

Create terminal action bar component positioned above terminal grid.

## Key Insights

From codebase analysis:
- Terminal handlers exist in `App.tsx`: `handleAddTerminal`, `handleCloseTerminal`
- Terminal limit from `useSettingsStore().getTerminalLimitValue()`
- Terminal count: filter by `activeProjectId`
- YOLO toggle currently in sidebar with `handleYoloToggle`

## Requirements

### Design Spec
```
┌─────────────────────────────────┬───────────────────────────────────┐
│  📟 1 / 12 terminals            │  + New Terminal  ⚡ YOLO ○  ✕ Kill │
└─────────────────────────────────┴───────────────────────────────────┘
```

### Functional
- Left: Terminal icon + count (current / max)
- Right: New Terminal (accent), YOLO toggle (warning when on), Kill All (red)
- Fixed height ~40px above terminal grid

## Architecture

```tsx
interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  onAddTerminal: () => void
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  disabled?: boolean  // When no project selected
}
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/terminal/terminal-action-bar.tsx` | Action bar component |

### Modify
| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Integrate action bar above TerminalGrid |
| `src/renderer/components/terminal/index.ts` | Export new component |

## Implementation Steps

### Step 1: Create Component

```tsx
// src/renderer/components/terminal/terminal-action-bar.tsx
interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  onAddTerminal: () => void
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  disabled?: boolean
}

export function TerminalActionBar({
  terminalCount,
  terminalLimit,
  yoloEnabled,
  onAddTerminal,
  onToggleYolo,
  onKillAll,
  disabled
}: TerminalActionBarProps) {
  return (
    <div className="h-10 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Left: Status */}
      <div className="flex items-center gap-2 text-sm text-[var(--mc-text-secondary)]">
        <span>📟</span>
        <span>{terminalCount} / {terminalLimit} terminals</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* New Terminal */}
        <button
          onClick={onAddTerminal}
          disabled={disabled || terminalCount >= terminalLimit}
          className="px-3 py-1 text-xs rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50"
        >
          + New
        </button>

        {/* YOLO Toggle */}
        <YoloToggle enabled={yoloEnabled} onChange={onToggleYolo} disabled={disabled} />

        {/* Kill All */}
        <button
          onClick={onKillAll}
          disabled={disabled || terminalCount === 0}
          className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          ✕ Kill All
        </button>
      </div>
    </div>
  )
}

// Reuse YoloToggle from sidebar or create inline
function YoloToggle({ enabled, onChange, disabled }: {...}) {
  // ... toggle implementation
}
```

### Step 2: Integrate in App.tsx

```tsx
// In App.tsx main content area
{activeProjectId ? (
  <>
    <Sidebar />
    <div className="flex-1 min-w-0 flex flex-col">
      {/* NEW: Action bar above grid */}
      <TerminalActionBar
        terminalCount={projectTerminals.length}
        terminalLimit={settings.terminalLimit.preset === 'custom'
          ? settings.terminalLimit.customValue || 9
          : settings.terminalLimit.preset}
        yoloEnabled={yoloEnabled}  // Need to lift state
        onAddTerminal={handleAddTerminal}
        onToggleYolo={handleYoloToggle}  // Need to create
        onKillAll={handleKillAll}  // Need to create
      />
      <div className="flex-1 min-h-0">
        <TerminalGrid ... />
      </div>
    </div>
  </>
)}
```

### Step 3: Lift YOLO State to App

Move YOLO state from Sidebar to App.tsx:
- Add `yoloEnabled` state
- Add `handleYoloToggle` handler
- Load YOLO status when project changes

### Step 4: Add Kill All Handler

```tsx
const handleKillAll = useCallback(async () => {
  const terminalsToKill = projectTerminals
  for (const terminal of terminalsToKill) {
    await window.electron.terminal.destroy(terminal.id)
    removeTerminal(terminal.id)
  }
}, [projectTerminals, removeTerminal])
```

## Todo List

- [ ] Create terminal-action-bar.tsx component
- [ ] Style left side with terminal count
- [ ] Style right side with action buttons
- [ ] Create/reuse YoloToggle component
- [ ] Export from terminal/index.ts
- [ ] Lift YOLO state to App.tsx
- [ ] Add handleYoloToggle handler
- [ ] Add handleKillAll handler
- [ ] Integrate action bar in App.tsx layout
- [ ] Test all button states

## Success Criteria

- [ ] Action bar displays above terminal grid
- [ ] Terminal count shows current/max correctly
- [ ] New Terminal button works, disabled at limit
- [ ] YOLO toggle changes color when active
- [ ] Kill All terminates all project terminals
- [ ] All buttons disabled when no project selected

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Layout shift | Low | Use fixed height (h-10) |
| State management | Medium | Lift state to App.tsx |

## Security Considerations

N/A - UI only changes.

## Next Steps

After completing:
1. Phase 2: Remove YOLO from sidebar Tools section
2. Phase 3: Add copy button to terminal pane header
