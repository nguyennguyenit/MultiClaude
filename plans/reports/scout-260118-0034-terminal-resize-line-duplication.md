# Terminal Resize Line Duplication Analysis

**Date:** 2026-01-18  
**Issue:** Terminal resize causes line duplication (e.g., "Flowing... (ctrl+c to interrupt)" repeats 15+ times)

---

## Root Cause Analysis

### 1. Xterm.js Reflow Behavior

**Location:** `@xterm/xterm@5.5.0` (internal behavior)

**Problem:** When terminal dimensions change (via `FitAddon.fit()`), xterm.js **automatically reflows** the scrollback buffer to match the new column width. This is by design to maintain content readability.

**What happens during resize:**
- FitAddon calculates new cols/rows based on container dimensions
- Terminal resizes internal buffer (triggers `terminal.onResize`)
- **Xterm.js reflows existing lines** to fit new column width
- Lines that were wrapped at old width get re-wrapped at new width
- This can cause **visual line duplication** if the same content appears multiple times in buffer

### 2. No Debouncing on Resize Events

**Files:**
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx` (lines 82-105)
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` (lines 542-547)

**Current Implementation:**

```typescript
// terminal-pane.tsx - ResizeObserver with 100ms debounce
const resizeObserver = new ResizeObserver(() => {
  if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
  resizeTimeoutRef.current = window.setTimeout(() => {
    terminalFitRef.current?.()  // Calls fit()
  }, 100)
})

// use-terminal.ts - Window resize (NO debounce)
useEffect(() => {
  const handleResize = () => fit()
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [fit])
```

**Issue:** 
- ResizeObserver has 100ms debounce (good)
- Window resize has **NO debounce** (bad - fires on every pixel change)
- During continuous resize, `fit()` can be called **dozens of times per second**

### 3. PTY Resize Floods

**File:** `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` (lines 359-363)

```typescript
// Handle resize
terminal.onResize(({ cols, rows }) => {
  window.electron.terminal.resize(terminalId, cols, rows)  // IPC call to PTY
  onResize?.(cols, rows)
})
```

**Problem:**
- Every `fit()` call triggers `terminal.onResize`
- Each resize sends IPC message to main process to resize PTY
- **No throttling or deduplication** of resize calls
- PTY resize can trigger shell redraw of prompt/status lines

### 4. Streaming Output + Resize Race Condition

**Files:**
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx` (lines 72-84)
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` (lines 366-384)

**Flow:**
```
PTY output → onOutput event → write(data) → terminal.write() → xterm buffer
```

**Race Condition:**
1. CLI tool writes "Flowing... (ctrl+c to interrupt)" with carriage return (`\r`)
2. User starts resizing window
3. Xterm reflows buffer while new output arrives
4. **Reflow duplicates existing lines** because buffer contains multiple copies from in-place updates
5. Each resize triggers another reflow, multiplying duplicates

**Specific Issue with In-Place Updates:**
- CLI spinners/progress use `\r` to overwrite same line
- Xterm buffer may store each overwrite as separate buffer entry
- Reflow processes ALL buffer entries, making duplicates visible

---

## Key Findings

### Configuration
- **Scrollback:** 50,000 lines (very large - more data to reflow)
- **convertEol:** false (correct - preserves cursor positioning)
- **windowsMode:** false (correct - preserves `\r` for in-place updates)

### Reflow Triggers
1. **FitAddon.fit()** - Primary trigger
2. **Window resize** - Unbounded frequency
3. **ResizeObserver** - 100ms debounce (good but insufficient)
4. **Font load** - One-time refit after font loads (lines 217-238)

### Missing Safeguards
- No resize debouncing on window resize
- No PTY resize throttling
- No reflow suppression during streaming output
- No duplicate line detection in buffer

---

## Proposed Solutions

### 1. **Add Debouncing to Window Resize** (Quick Win)

```typescript
// use-terminal.ts
const RESIZE_DEBOUNCE = 150  // ms

useEffect(() => {
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => fit(), RESIZE_DEBOUNCE)
  }
  
  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimer) clearTimeout(resizeTimer)
  }
}, [fit])
```

### 2. **Throttle PTY Resize Calls** (Prevents Flood)

```typescript
// use-terminal.ts
const lastResizeRef = useRef<{ cols: number; rows: number } | null>(null)

terminal.onResize(({ cols, rows }) => {
  // Skip if dimensions unchanged (reflow without actual resize)
  if (lastResizeRef.current?.cols === cols && lastResizeRef.current?.rows === rows) {
    return
  }
  lastResizeRef.current = { cols, rows }
  
  // IPC call
  window.electron.terminal.resize(terminalId, cols, rows)
  onResize?.(cols, rows)
})
```

### 3. **Reduce Scrollback Buffer** (Less Data to Reflow)

Consider reducing from 50,000 to 10,000 lines:

```typescript
// use-terminal.ts
scrollback: 10000  // Reduced from 50000
```

**Impact:** Faster reflows, less memory, but shorter history.

### 4. **Disable Reflow During Active Output** (Advanced)

Detect streaming output and temporarily skip resize:

```typescript
const isStreamingRef = useRef(false)
const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const write = useCallback((data: string) => {
  terminalRef.current?.write(data)
  
  // Mark as streaming
  isStreamingRef.current = true
  if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current)
  
  // Clear flag after 500ms of no output
  streamingTimerRef.current = setTimeout(() => {
    isStreamingRef.current = false
  }, 500)
}, [])

const fit = useCallback(() => {
  // Skip resize during active streaming
  if (isStreamingRef.current) return
  
  if (!terminalRef.current || !fitAddonRef.current) return
  try {
    fitAddonRef.current.fit()
  } catch (e) {
    // Terminal not ready
  }
}, [])
```

### 5. **Use Xterm.js `reflow: false` Option** (If Available)

Check if xterm.js 5.5.0 supports disabling reflow:

```typescript
const terminal = new XTerm({
  // ... existing options
  // reflow: false  // Check API docs
})
```

**Note:** May not exist in this version. Requires research.

---

## Priority Recommendations

**Implement immediately:**
1. ✅ Add debouncing to window resize handler (Solution #1)
2. ✅ Throttle PTY resize calls (Solution #2)

**Consider for next iteration:**
3. ⚠️ Reduce scrollback buffer to 10,000 (Solution #3)
4. ⚠️ Implement streaming detection (Solution #4)

**Research required:**
5. 🔍 Check xterm.js 5.5.0 API for reflow control (Solution #5)

---

## Related Code Files

### Primary Files
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` - Core terminal logic, resize handling
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx` - ResizeObserver implementation
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx` - Output handling

### Supporting Files
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/terminal-manager.ts` - PTY management
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/preload/index.ts` - IPC interface

---

## Unresolved Questions

1. Does xterm.js 5.5.0 support disabling reflow via options?
2. Should we add a user setting for scrollback size?
3. Can we detect spinner/progress patterns and handle differently?
4. Should ResizeObserver debounce be increased from 100ms to 150ms for consistency?

---

**End of Report**
