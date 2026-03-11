---
status: done
created: 2026-01-08
completed: 2026-01-08
title: Terminal Refresh Button + Auto-recovery
brainstorm: plans/reports/brainstorm-260108-1410-terminal-refresh-button.md
---

# Implementation Plan: Terminal Refresh Button + Auto-recovery

## Problem Statement

Terminal display bị lỗi mất chữ khi WebGL context lost (GPU driver issues, resource exhaustion, tab switching). User hiện phải đóng/mở terminal để fix.

## Solution Overview

1. **Manual Refresh Button**: Thay nút "Start Claude" bằng nút Refresh trong header
2. **Auto-detect WebGL Context Lost**: Listen event và auto-recover với debounce
3. **Show Notification**: Toast message khi auto-recovery

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | Add `refresh()`, listen `webglcontextlost`, call toast |
| `src/renderer/components/terminal/terminal-view.tsx` | Expose refresh callback, pass to parent |
| `src/renderer/components/terminal/terminal-pane.tsx` | Replace Claude button → Refresh button |

## Implementation Details

### Phase 1: Add refresh() to useTerminal (use-terminal.ts)

**New refs:**
```typescript
const webglContextLostHandlerRef = useRef<(() => void) | null>(null)
const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

**New constant:**
```typescript
const REFRESH_DEBOUNCE = 100  // Debounce refresh to prevent spam
```

**New callback - `refresh()`:**
```typescript
const refresh = useCallback((showNotification = false) => {
  if (disposedRef.current || !terminalRef.current) return

  // Clear pending refresh
  if (refreshDebounceRef.current) {
    clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = null
  }

  refreshDebounceRef.current = setTimeout(() => {
    if (disposedRef.current || !terminalRef.current) return

    // 1. Dispose current WebGL addon
    try {
      webglAddonRef.current?.dispose()
    } catch { /* ignore */ }
    webglAddonRef.current = null

    // 2. Redraw all terminal rows (canvas fallback)
    terminalRef.current.refresh(0, terminalRef.current.rows - 1)

    // 3. Re-init WebGL if needed
    if (shouldUseWebGL(isActiveRef.current)) {
      try {
        const webglAddon = new WebglAddon()
        webglAddonRef.current = webglAddon
        terminalRef.current.loadAddon(webglAddon)
        // Re-attach context lost listener
        attachContextLostListener(webglAddon)
      } catch (e) {
        console.warn('WebGL addon failed to load:', e)
      }
    }

    // 4. Refit
    try {
      fitAddonRef.current?.fit()
    } catch { /* ignore */ }

    // 5. Show notification if auto-triggered
    if (showNotification) {
      useToastStore.getState().addToast('Terminal display refreshed', 'info')
    }
  }, REFRESH_DEBOUNCE)
}, [])
```

**Helper function - `attachContextLostListener()`:**
```typescript
const attachContextLostListener = useCallback((addon: WebglAddon) => {
  // WebGL addon uses textureAtlas which has canvas
  // Access internal canvas via addon's internal API
  const canvas = (addon as any)._renderer?._renderLayers?.[0]?._canvas
  if (!canvas) return

  const handleContextLost = () => {
    console.warn('WebGL context lost, auto-refreshing terminal...')
    refresh(true)  // Show notification on auto-refresh
  }

  canvas.addEventListener('webglcontextlost', handleContextLost)
  webglContextLostHandlerRef.current = handleContextLost

  // Cleanup on dispose
  const originalDispose = addon.dispose.bind(addon)
  addon.dispose = () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    webglContextLostHandlerRef.current = null
    originalDispose()
  }
}, [refresh])
```

**Modifications to initTerminal:**
- After WebGL addon loads successfully (line ~125), call `attachContextLostListener(webglAddon)`

**Modifications to cleanup:**
- Clear refreshDebounceRef in cleanup effect

**Update return object:**
```typescript
return {
  containerRef,
  initTerminal,
  write,
  fit,
  focus,
  clear,
  scrollToBottom,
  isAtBottom,
  refresh,  // NEW
  terminal: terminalRef.current
}
```

---

### Phase 2: Expose refresh in TerminalView (terminal-view.tsx)

**Update interface:**
```typescript
interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  initialOutput?: string
  onFitReady?: (fit: () => void) => void
  onRefreshReady?: (refresh: () => void) => void  // NEW
}
```

**Update useTerminal destructuring:**
```typescript
const { containerRef, initTerminal, write, fit, focus, scrollToBottom, isAtBottom, refresh } = useTerminal({...})
```

**Add useEffect to expose refresh:**
```typescript
useEffect(() => {
  onRefreshReady?.(refresh)
}, [refresh, onRefreshReady])
```

---

### Phase 3: Replace Claude button with Refresh (terminal-pane.tsx)

**Remove from props interface:**
```typescript
// REMOVE: onStartClaude: () => void
```

**Add new ref:**
```typescript
const terminalRefreshRef = useRef<(() => void) | null>(null)
```

**Add callback:**
```typescript
const handleTerminalRefresh = useCallback((refreshFn: () => void) => {
  terminalRefreshRef.current = refreshFn
}, [])

const handleRefreshClick = useCallback(() => {
  terminalRefreshRef.current?.()
}, [])
```

**Update TerminalView:**
```tsx
<TerminalView
  terminalId={terminalId}
  isActive={isActive}
  initialOutput={initialOutput}
  onFitReady={handleTerminalFit}
  onRefreshReady={handleTerminalRefresh}  // NEW
/>
```

**Replace Claude button with Refresh button (line 163-177):**
```tsx
{/* Refresh terminal button */}
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    handleRefreshClick()
  }}
  className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
  title="Refresh terminal display"
  aria-label="Refresh terminal display"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
</button>
```

---

### Phase 4: Update TerminalGrid to remove onStartClaude

Check `terminal-grid.tsx` to see if it passes `onStartClaude` to `TerminalPane`:

```typescript
// If TerminalGrid passes onStartClaude, remove it from the props
```

---

## Import Changes

**use-terminal.ts:**
```typescript
import { useToastStore } from '../stores'  // ADD if not already imported
```

---

## Test Cases

1. **Manual refresh**: Click Refresh button → terminal redraws correctly
2. **Auto-refresh**: Simulate WebGL context lost → auto-refresh + toast notification
3. **Debounce**: Rapid clicks → only one refresh executes
4. **No regression**: Terminal still works normally (input, output, scroll, resize)
5. **Memory leak**: Refresh repeatedly → no memory growth

---

## Success Criteria

- [x] Refresh button visible in header (replaces Claude button)
- [x] Manual refresh works
- [x] Auto-detect WebGL context lost triggers refresh
- [x] Toast notification shows on auto-refresh
- [x] No flicker or visual glitches
- [x] No memory leaks

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebGL internal canvas not accessible | Fallback: manual button still works |
| Context lost event unreliable | Manual button as backup |
| Refresh causes flicker | requestAnimationFrame batching |

---

## Estimated Complexity

- **Lines of code**: ~80 new/modified
- **Risk level**: Low
- **Affected areas**: Terminal rendering only
