# Phase 2: Output Throttling for Hidden Terminals (Optional)

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Core CSS Visibility Fix](./phase-01-core-css-visibility-fix.md)
- [Root Cause Analysis](../reports/brainstorm-260109-1909-terminal-hanging-rootcause.md)

## Overview

- **Date:** 2026-01-09
- **Priority:** P3 (Optional)
- **Status:** Pending
- **Effort:** 2-3h
- **Prerequisite:** Phase 1 complete

Throttle IPC output for hidden terminals to reduce CPU overhead from frequent state updates when terminals are not visible.

## Key Insights

1. Current behavior: Every PTY output chunk → IPC → Zustand update → potential React re-render
2. With Phase 1, hidden terminals still receive IPC messages and update Zustand state
3. This can cause CPU overhead with many active hidden terminals
4. Fix: Buffer output in main process for hidden terminals, send batched updates every 2s

## Requirements

### Functional
- Hidden terminals receive output updates (just throttled)
- Visible terminals receive immediate output (no change)
- No output lost during throttling

### Non-Functional
- Reduce CPU usage for hidden terminals by ~80%
- Batch interval: 2 seconds (configurable)
- Buffer limit: 50KB per hidden terminal

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Main Process                                                 │
├─────────────────────────────────────────────────────────────┤
│ handlers.ts                                                  │
│ ├── visibleTerminals: Set<string>                           │
│ ├── hiddenOutputBuffers: Map<string, string>                │
│ └── Interval timer: flush buffers every 2s                  │
├─────────────────────────────────────────────────────────────┤
│ IPC: terminal:set-visibility                                │
│ ├── Renderer sends visibility changes                       │
│ └── Main process updates visibleTerminals Set               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Renderer                                                     │
├─────────────────────────────────────────────────────────────┤
│ TerminalView                                                 │
│ ├── useEffect: send visibility change on hidden prop change │
│ └── IPC: terminal:set-visibility(terminalId, visible)       │
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/shared/constants/ipc-channels.ts` | Modify | Add `TERMINAL_SET_VISIBILITY` channel |
| `src/main/ipc/handlers.ts` | Modify | Add visibility tracking and output throttling |
| `src/renderer/components/terminal/terminal-view.tsx` | Modify | Send visibility changes via IPC |
| `src/preload/index.ts` | Modify | Expose setVisibility method |

## Implementation Steps

### Step 1: Add IPC Channel

**File:** `src/shared/constants/ipc-channels.ts`

```typescript
export const IPC_CHANNELS = {
  // Terminal channels
  TERMINAL_CREATE: 'terminal:create',
  // ...
  TERMINAL_SET_VISIBILITY: 'terminal:set-visibility',  // NEW
  // ...
}
```

### Step 2: Update Preload

**File:** `src/preload/index.ts`

Add setVisibility method to terminal API:

```typescript
terminal: {
  // ... existing methods
  setVisibility: (terminalId: string, visible: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_SET_VISIBILITY, { terminalId, visible })
}
```

### Step 3: Add Throttling Logic in Main Process

**File:** `src/main/ipc/handlers.ts`

```typescript
// Track visible terminals
const visibleTerminals = new Set<string>()
const hiddenOutputBuffers = new Map<string, string>()
const THROTTLE_INTERVAL = 2000  // 2 seconds
const HIDDEN_BUFFER_LIMIT = 50000  // 50KB

// Handle visibility changes from renderer
ipcMain.on(IPC_CHANNELS.TERMINAL_SET_VISIBILITY, (_, { terminalId, visible }) => {
  if (visible) {
    visibleTerminals.add(terminalId)
    // Flush any buffered output immediately
    const buffered = hiddenOutputBuffers.get(terminalId)
    if (buffered) {
      window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, {
        terminalId,
        data: buffered
      })
      hiddenOutputBuffers.delete(terminalId)
    }
  } else {
    visibleTerminals.delete(terminalId)
  }
})

// Flush hidden terminal buffers periodically
setInterval(() => {
  for (const [terminalId, buffer] of hiddenOutputBuffers) {
    if (buffer) {
      window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, {
        terminalId,
        data: buffer
      })
      hiddenOutputBuffers.set(terminalId, '')
    }
  }
}, THROTTLE_INTERVAL)

// Modify output handler
terminalManager.on('output', ({ terminalId, data }) => {
  // Process notifications regardless of visibility
  notificationManager.processOutput(terminalId, data)

  if (!visibleTerminals.has(terminalId)) {
    // Buffer output for hidden terminals
    const current = hiddenOutputBuffers.get(terminalId) || ''
    hiddenOutputBuffers.set(terminalId, (current + data).slice(-HIDDEN_BUFFER_LIMIT))
    return
  }

  // Immediate send for visible terminals
  window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, {
    terminalId,
    data
  })
})

// Cleanup when terminal destroyed
terminalManager.on('exit', ({ terminalId }) => {
  visibleTerminals.delete(terminalId)
  hiddenOutputBuffers.delete(terminalId)
})
```

### Step 4: Send Visibility Changes from Renderer

**File:** `src/renderer/components/terminal/terminal-view.tsx`

```typescript
// Add effect to notify main process of visibility changes
useEffect(() => {
  window.electron.terminal.setVisibility(terminalId, !hidden)

  return () => {
    // On unmount, mark as not visible
    window.electron.terminal.setVisibility(terminalId, false)
  }
}, [terminalId, hidden])
```

## Todo List

- [ ] Add TERMINAL_SET_VISIBILITY IPC channel
- [ ] Expose setVisibility in preload
- [ ] Add visibility tracking in handlers.ts
- [ ] Add output buffering for hidden terminals
- [ ] Add periodic flush interval
- [ ] Send visibility changes from TerminalView
- [ ] Clean up on terminal destroy
- [ ] Test throttled output appears correctly
- [ ] Verify immediate flush on becoming visible

## Success Criteria

1. **CPU reduction:** ~80% less CPU for hidden terminals with active output
2. **No output lost:** All output eventually arrives (within 2s)
3. **Immediate on visible:** No delay when terminal becomes visible
4. **Notifications work:** Pattern matching still processes all output

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Output delay noticeable | Low | Low | 2s batch interval is reasonable |
| Buffer overflow | Low | Low | 50KB limit with slice |
| Memory leak on terminal destroy | Low | Medium | Cleanup in 'exit' handler |

## Security Considerations

None - internal IPC communication only.

## Next Steps

- Monitor CPU usage in production
- Consider making throttle interval configurable in settings
- Add visual indicator for hidden terminals with activity (Phase 3 from original plan)
