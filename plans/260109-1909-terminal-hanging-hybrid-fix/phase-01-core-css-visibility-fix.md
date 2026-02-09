# Phase 1: Core CSS Visibility Fix

## Context Links

- [Parent Plan](./plan.md)
- [Root Cause Analysis](../reports/brainstorm-260109-1909-terminal-hanging-rootcause.md)

## Overview

- **Date:** 2026-01-09
- **Priority:** P1
- **Status:** Done (2026-01-11)
- **Effort:** 2-3h

Keep terminals mounted with CSS visibility instead of unmount. This prevents xterm.js disposal when switching projects, allowing ESC to always work and preserving terminal state.

## Key Insights

1. Current behavior: `TerminalGrid` filters terminals by `activeProjectId`, causing React unmount → `xterm.dispose()` → IPC listener removed
2. PTY continues running in main process while renderer has no xterm instance
3. On switch back: NEW xterm instance created with state mismatch → ESC may not work
4. Fix: Render ALL terminals, use CSS `display: none` to hide inactive project terminals

## Requirements

### Functional
- All terminals stay mounted regardless of active project
- Only terminals for active project are visible
- ESC interrupt works immediately after project switch
- Scrollback preserved when switching projects

### Non-Functional
- No visual regression
- Memory overhead acceptable (< 20% increase)
- WebGL properly disabled for hidden terminals (Quality mode fix)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ App.tsx                                                      │
│ ├── activeProjectId (state)                                 │
│ └── ALL terminals passed to TerminalGrid                    │
├─────────────────────────────────────────────────────────────┤
│ TerminalGrid                                                 │
│ ├── Receives ALL terminals (not filtered)                   │
│ └── Passes hidden prop to TerminalPane                      │
├─────────────────────────────────────────────────────────────┤
│ TerminalPane                                                 │
│ ├── hidden prop → style={{ display: hidden ? 'none' : 'flex' }}
│ └── Passes hidden to TerminalView                          │
├─────────────────────────────────────────────────────────────┤
│ TerminalView                                                 │
│ └── Passes isHidden to useTerminal                          │
├─────────────────────────────────────────────────────────────┤
│ useTerminal                                                  │
│ └── shouldUseWebGL(isActive, isHidden) - disable WebGL when hidden
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/App.tsx` | Modify | Pass `activeProjectId` to TerminalGrid instead of filtering |
| `src/renderer/components/terminal/terminal-grid.tsx` | Modify | Render all terminals, calculate hidden state, pass to TerminalPane |
| `src/renderer/components/terminal/terminal-pane.tsx` | Modify | Add `hidden` prop, apply `display: none` style, pass to TerminalView |
| `src/renderer/components/terminal/terminal-view.tsx` | Modify | Add `hidden` prop, pass `isHidden` to useTerminal |
| `src/renderer/hooks/use-terminal.ts` | Modify | Add `isHidden` param, update `shouldUseWebGL()` logic |

## Implementation Steps

### Step 1: Update App.tsx

**File:** `src/renderer/App.tsx`

Find the terminal filtering logic and change to pass `activeProjectId` to TerminalGrid:

```typescript
// BEFORE (around line 49-51)
const projectTerminals = activeProjectId
  ? terminals.filter(t => t.projectId === activeProjectId)
  : terminals

// AFTER
// Pass ALL terminals and activeProjectId - let TerminalGrid handle hiding
<TerminalGrid
  terminals={terminals}
  activeProjectId={activeProjectId}
  // ... other props
/>
```

### Step 2: Update TerminalGrid

**File:** `src/renderer/components/terminal/terminal-grid.tsx`

Add `activeProjectId` prop and pass `hidden` state:

```typescript
interface TerminalGridProps {
  terminals: TerminalWithOutput[]
  activeProjectId: string | null  // NEW
  activeTerminalId: string | null
  // ... other props
}

export const TerminalGrid = memo(function TerminalGrid({
  terminals,
  activeProjectId,  // NEW
  activeTerminalId,
  // ...
}: TerminalGridProps) {
  // Calculate which terminals to show based on activeProjectId
  const visibleTerminals = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId)
    : terminals

  // But render ALL terminals - just hide the ones not in visibleTerminals
  // ... in the render:
  <TerminalPane
    key={terminal.id}
    terminalId={terminal.id}
    hidden={activeProjectId !== null && terminal.projectId !== activeProjectId}  // NEW
    // ... other props
  />
})
```

**Important:** Grid layout calculation should use `visibleTerminals.length` for proper sizing, but render all terminals.

### Step 3: Update TerminalPane

**File:** `src/renderer/components/terminal/terminal-pane.tsx`

Add `hidden` prop:

```typescript
interface TerminalPaneProps {
  // ... existing props
  hidden?: boolean  // NEW
}

export const TerminalPane = memo(function TerminalPane({
  hidden = false,  // NEW
  // ... other props
}: TerminalPaneProps) {
  return (
    <div
      ref={containerRef}
      onClick={onActivate}
      className={`terminal-pane h-full w-full flex flex-col ${isActive ? 'terminal-pane-active' : ''}`}
      style={{ display: hidden ? 'none' : 'flex' }}  // NEW
    >
      {/* ... content */}
      <TerminalView
        terminalId={terminalId}
        isActive={isActive}
        hidden={hidden}  // NEW - pass to TerminalView
        initialOutput={initialOutput}
        // ...
      />
    </div>
  )
})
```

### Step 4: Update TerminalView

**File:** `src/renderer/components/terminal/terminal-view.tsx`

Add `hidden` prop and pass to hook:

```typescript
interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  hidden?: boolean  // NEW
  initialOutput?: string
  onFitReady?: (fit: () => void) => void
  onRefreshReady?: (refresh: () => void) => void
}

export const TerminalView = memo(function TerminalView({
  terminalId,
  isActive,
  hidden = false,  // NEW
  initialOutput,
  onFitReady,
  onRefreshReady
}: TerminalViewProps) {
  const { ... } = useTerminal({
    terminalId,
    initialOutput,
    isActive,
    isHidden: hidden  // NEW
  })
  // ...
})
```

### Step 5: Update useTerminal Hook

**File:** `src/renderer/hooks/use-terminal.ts`

Modify `shouldUseWebGL` and add `isHidden` option:

```typescript
interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string
  isActive?: boolean
  isHidden?: boolean  // NEW
  onResize?: (cols: number, rows: number) => void
}

/**
 * Determine if WebGL should be used based on render mode, active state, and hidden state
 */
function shouldUseWebGL(isActive: boolean, isHidden: boolean): boolean {
  // Never use WebGL for hidden terminals (saves GPU resources)
  if (isHidden) return false

  const mode = useSettingsStore.getState().settings.terminalRenderMode ?? 'balanced'
  switch (mode) {
    case 'performance':
      return false
    case 'balanced':
      return isActive
    case 'quality':
      return true
  }
}

export function useTerminal({
  terminalId,
  initialOutput,
  isActive = true,
  isHidden = false,  // NEW
  onResize
}: UseTerminalOptions) {
  // Update refs
  const isHiddenRef = useRef(isHidden)

  // ... existing code

  // Update all shouldUseWebGL calls to pass isHiddenRef.current
  // Lines ~154, ~391, ~502, ~551
  if (shouldUseWebGL(isActiveRef.current, isHiddenRef.current)) { ... }
}
```

Also add effect to track `isHidden` changes:

```typescript
// Add near line 490 (where isActive effect is)
useEffect(() => {
  isHiddenRef.current = isHidden
  // Trigger WebGL toggle check when hidden state changes
  // ... similar logic to isActive effect
}, [isHidden, attachContextLostListener])
```

## Todo List

- [x] Update App.tsx to pass activeProjectId to TerminalGrid
- [x] Update TerminalGrid to receive activeProjectId and pass hidden to TerminalPane
- [x] Update TerminalPane to add hidden prop with display:none style
- [x] Update TerminalView to pass hidden to useTerminal
- [x] Update useTerminal to add isHidden option and update shouldUseWebGL
- [x] Test ESC works after project switch
- [x] Test scrollback preserved
- [x] Test all 3 rendering modes
- [x] Verify memory usage acceptable

## Success Criteria

1. **ESC works after switch:** User can immediately interrupt Claude CLI after switching projects back
2. **No output loss:** Terminal scrollback preserved across project switches
3. **No terminal stuck:** No "Reviewing code..." infinite loop after switch
4. **WebGL disabled for hidden:** Quality mode doesn't waste GPU on hidden terminals
5. **Grid layout correct:** Visible terminals still have proper grid sizing

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Memory increase with many hidden terminals | Medium | Low | Hidden terminals have WebGL disabled, reducing GPU memory |
| CSS `display: none` breaks xterm rendering | Low | High | Test thoroughly; xterm should handle this gracefully |
| Grid layout breaks with hidden terminals | Medium | Medium | Use visibleTerminals.length for grid calculation |

## Security Considerations

None - this is a renderer-side UI change with no security implications.

## Next Steps

After Phase 1 complete:
1. Test extensively with multiple projects and terminals
2. Monitor memory usage
3. If CPU overhead is high, implement Phase 2 (output throttling)
