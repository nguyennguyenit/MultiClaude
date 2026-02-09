# Terminal Refresh vs Resume - State Management Analysis

## Executive Summary

Phát hiện cơ chế quản lý terminal state và scrollback:
- **Refresh button**: Chỉ redraw WebGL - KHÔNG restore buffer/scrollback
- **Resume command**: Restore đầy đủ từ session save (bao gồm buffer)
- **Switch project**: Buffer được lưu trong state nhưng không restore đầy đủ khi quay lại

## Core Problem

Khi bấm **Refresh Terminal button**, user mất dữ liệu chat cũ vì:
1. Refresh chỉ gọi `terminal.refresh()` - redraw rows hiện tại
2. KHÔNG restore `initialOutput` buffer
3. KHÔNG có mechanism để reload scrollback history

## Architecture Flow

### 1. Terminal Buffer Management

**File: `src/renderer/stores/app-store.ts`**
```typescript
interface TerminalWithOutput extends Terminal {
  output: string  // Stores last 100KB of output
}

appendOutput: (id, data) => {
  // Keep last 100KB in memory
  output: (t.output + data).slice(-100000)
}
```

**Vấn đề**: Buffer được lưu trong state nhưng chỉ dùng khi mount lần đầu.

---

### 2. Refresh Button Flow

**File: `src/renderer/components/terminal/terminal-pane.tsx` (Line 54-57)**
```typescript
const handleRefreshClick = useCallback(() => {
  terminalRefreshRef.current?.()
}, [])
```

**File: `src/renderer/hooks/use-terminal.ts` (Line 428-481)**
```typescript
const refresh = useCallback((showNotification = false) => {
  // 1. Save viewport position
  const savedViewportY = terminalRef.current.buffer.active.viewportY

  // 2. Dispose WebGL
  webglAddonRef.current?.dispose()

  // 3. Redraw visible rows ONLY
  terminalRef.current.refresh(0, terminalRef.current.rows - 1)

  // 4. Reload WebGL
  const webglAddon = new WebglAddon()
  terminalRef.current.loadAddon(webglAddon)

  // 5. Restore scroll position
  terminalRef.current.scrollToLine(savedViewportY)
}, [])
```

**Root Cause**: `terminal.refresh(0, rows - 1)` chỉ redraw **visible rows** (24-50 rows), KHÔNG restore scrollback buffer (50,000 lines).

---

### 3. Initial Mount Flow (Working Case)

**File: `src/renderer/components/terminal/terminal-grid.tsx` (Line 190)**
```typescript
<TerminalPane
  initialOutput={terminal.output}  // ← Pass saved buffer
/>
```

**File: `src/renderer/hooks/use-terminal.ts` (Line 204-206)**
```typescript
if (initialOutput) {
  terminal.write(initialOutput)  // ← Restore buffer on mount
}
```

**Working Flow**:
1. Component mount → pass `initialOutput` prop
2. `initTerminal()` writes buffer to xterm
3. Scrollback history restored

---

### 4. Project Switch Flow (Partial Restore)

**File: `src/renderer/App.tsx` (Line 108-115)**
```typescript
switchToProject: (projectId, terminalId) => {
  const projectTerminals = state.terminals.filter(t => t.projectId === projectId)
  return {
    activeProjectId: projectId,
    activeTerminalId: terminalId ?? projectTerminals[0]?.id ?? null
  }
}
```

**File: `src/renderer/components/terminal/terminal-grid.tsx` (Line 153-164)**
```typescript
style={{
  visibility: group.isActive ? 'visible' : 'hidden',
  position: group.isActive ? 'relative' : 'absolute',
}}
```

**File: `src/renderer/hooks/use-terminal.ts` (Line 663-738)**
```typescript
useLayoutEffect(() => {
  // SAVE scroll when becoming hidden
  if (!wasHidden && isHidden) {
    savedViewportYRef.current = terminalRef.current.buffer.active.viewportY
  }

  // RESTORE scroll when becoming visible
  if (wasHidden && !isHidden && isActive) {
    terminalRef.current.refresh(0, terminalRef.current.rows - 1)
    terminalRef.current.scrollToLine(savedViewportY)
  }
}, [isHidden, isActive])
```

**Vấn đề**: 
- Terminal không unmount khi switch project (giữ buffer trong memory)
- Chỉ save/restore scroll position
- **KHÔNG** restore buffer content nếu xterm instance bị corrupt

---

### 5. Session Save/Restore Flow (/resume - Working)

**File: `src/main/terminal/terminal-manager.ts` (Line 312-321)**
```typescript
getSessions(): TerminalSession[] {
  return terminals.map(t => ({
    outputBuffer: t.outputBuffer.slice(-100000)  // Last 100KB
  }))
}
```

**File: `src/main/ipc/handlers.ts` (Line 315-323)**
```typescript
ipcMain.handle('session:save', async () => {
  const sessions = terminalManager.getSessions()
  projectStore.saveSession({
    terminals: sessions,
    windowBounds: bounds
  })
})
```

**Working Flow**:
1. Save session → persist buffer to disk
2. Restart app → load session
3. Create new terminal → pass `initialOutput`
4. Full buffer restore ✓

---

## Problem Comparison Table

| Scenario | Buffer Persisted? | Buffer Restored? | Why? |
|----------|------------------|------------------|------|
| **Refresh Button** | ✓ (in state) | ✗ | Only redraws visible rows |
| **Switch Project** | ✓ (in xterm) | ~ (partial) | No unmount, but no explicit restore |
| **/resume** | ✓ (on disk) | ✓ | Creates new terminal with initialOutput |
| **New Terminal** | N/A | N/A | Fresh start |

---

## Root Cause Analysis

### Refresh Button Issue

```typescript
// Current implementation (WRONG)
refresh: () => {
  terminal.refresh(0, terminal.rows - 1)  // Only visible rows
}

// Should be (FIXED)
refresh: () => {
  // Option 1: Write buffer back to terminal
  const buffer = appStore.getState().terminals.find(t => t.id === terminalId)?.output
  if (buffer) {
    terminal.clear()
    terminal.write(buffer)
  }

  // Option 2: Force re-render all scrollback
  terminal.refresh(0, terminal.buffer.active.length)
}
```

### Switch Project Issue

```typescript
// Current: Terminal stays mounted, buffer stays in xterm
// Problem: If xterm corrupts, buffer lost

// Fix: Explicitly restore buffer on visibility change
useLayoutEffect(() => {
  if (wasHidden && !isHidden && isActive) {
    const savedBuffer = appStore.getState().terminals.find(t => t.id === terminalId)?.output
    if (savedBuffer) {
      terminal.clear()
      terminal.write(savedBuffer)
    }
  }
}, [isHidden, isActive])
```

---

## Solution Recommendations

### Option 1: Fix Refresh Button (Simple)

**File**: `src/renderer/hooks/use-terminal.ts`

```typescript
const refresh = useCallback((showNotification = false) => {
  if (disposedRef.current || !terminalRef.current) return

  // Get saved buffer from store
  const { terminals } = useAppStore.getState()
  const terminalData = terminals.find(t => t.id === terminalId)
  const savedBuffer = terminalData?.output || ''

  // Clear and restore buffer
  terminalRef.current.clear()
  if (savedBuffer) {
    terminalRef.current.write(savedBuffer)
  }

  // Refit and reload WebGL
  webglAddonRef.current?.dispose()
  const webglAddon = new WebglAddon()
  terminalRef.current.loadAddon(webglAddon)
  fitAddonRef.current?.fit()

  if (showNotification) {
    useToastStore.getState().addToast('Terminal display refreshed', 'info')
  }
}, [terminalId])
```

**Pros**:
- Simple fix
- Reuse existing buffer in state
- No API changes

**Cons**:
- Limited to last 100KB
- Async write may cause flicker

---

### Option 2: Store Full Scrollback in xterm (Current - Keep It)

**File**: `src/renderer/hooks/use-terminal.ts` (Line 130)

```typescript
scrollback: 50000  // Already configured
```

**Refresh should only fix WebGL, not touch buffer**:

```typescript
const refresh = useCallback((showNotification = false) => {
  // Dispose and reload WebGL ONLY
  webglAddonRef.current?.dispose()
  const webglAddon = new WebglAddon()
  terminalRef.current.loadAddon(webglAddon)
  
  // Force full buffer redraw (not just visible rows)
  const bufferLength = terminalRef.current.buffer.active.length
  terminalRef.current.refresh(0, bufferLength)
}, [])
```

**Pros**:
- No buffer clearing
- Preserves full 50K scrollback
- Fast, no flicker

**Cons**:
- Relies on xterm internal state
- If xterm corrupts, still lost

---

### Option 3: Hybrid - Buffer Backup + Smart Restore

**File**: `src/renderer/hooks/use-terminal.ts`

```typescript
const bufferBackupRef = useRef<string>('')

// Backup buffer periodically
useEffect(() => {
  const interval = setInterval(() => {
    if (terminalRef.current) {
      const { terminals } = useAppStore.getState()
      const currentBuffer = terminals.find(t => t.id === terminalId)?.output || ''
      bufferBackupRef.current = currentBuffer
    }
  }, 5000)
  return () => clearInterval(interval)
}, [terminalId])

const refresh = useCallback((forceRestore = false) => {
  const bufferLength = terminalRef.current.buffer.active.length
  
  if (forceRestore || bufferLength < 100) {
    // Corrupted buffer - restore from backup
    terminalRef.current.clear()
    terminalRef.current.write(bufferBackupRef.current)
  } else {
    // Normal refresh - just redraw
    terminalRef.current.refresh(0, bufferLength)
  }

  // Reload WebGL
  webglAddonRef.current?.dispose()
  const webglAddon = new WebglAddon()
  terminalRef.current.loadAddon(webglAddon)
}, [])
```

**Pros**:
- Best of both worlds
- Detects corruption
- Fast normal case

**Cons**:
- More complex
- 5s backup interval

---

## Recommended Fix

**Use Option 2** (simple and effective):

1. Change refresh to redraw full buffer:
   ```typescript
   terminal.refresh(0, terminal.buffer.active.length)
   ```

2. Keep existing scrollback (50,000 lines)

3. Add buffer length check for safety:
   ```typescript
   if (bufferLength < 100) {
     // Fallback to state restore
     terminal.write(stateBuffer)
   }
   ```

---

## Related Files

### Core Files
- `/src/renderer/hooks/use-terminal.ts` - Terminal lifecycle
- `/src/renderer/stores/app-store.ts` - Buffer state
- `/src/renderer/components/terminal/terminal-pane.tsx` - Refresh button
- `/src/renderer/components/terminal/terminal-grid.tsx` - Project grouping
- `/src/main/terminal/terminal-manager.ts` - Session save

### Test Files
- `/src/__tests__/e2e/tests/terminal-pane.spec.ts`
- `/src/__tests__/e2e/tests/project-switching.spec.ts`

---

## Unresolved Questions

1. **Why does WebGL context loss trigger refresh?**
   - Auto-refresh on context lost works (Line 90-93)
   - But manual refresh doesn't restore buffer?
   - Need to unify behavior

2. **Should we persist full 50K scrollback to state?**
   - Currently only 100KB
   - May need compression or chunking

3. **Should refresh button have two modes?**
   - Normal: Redraw WebGL only
   - Force: Clear + restore from backup
   - Add Shift+Click modifier?

4. **Performance impact of full buffer redraw?**
   - Need benchmarking on 50K lines
   - May need progressive rendering

