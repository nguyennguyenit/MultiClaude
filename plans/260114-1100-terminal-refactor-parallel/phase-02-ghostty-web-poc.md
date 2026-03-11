# Phase 2: ghostty-web PoC

**Priority**: MEDIUM
**Effort**: 5h
**Risk**: Medium
**Package**: `ghostty-web@0.4.0`

## Objective

Evaluate ghostty-web as xterm.js replacement. Create parallel implementation to:
1. Verify API compatibility
2. Test cursor behavior on resize
3. Benchmark performance
4. Identify missing features

## Prerequisites

- Track 1 not required (parallel tracks)
- ghostty-web package inspection

## Step 1: Install and Inspect (30min)

### Installation

```bash
npm install ghostty-web@0.4.0
```

### Type Inspection

```bash
# Check TypeScript definitions
ls node_modules/ghostty-web/dist/*.d.ts
cat node_modules/ghostty-web/dist/index.d.ts
```

### Critical APIs to Verify

| API | Required | xterm.js equivalent |
|-----|----------|---------------------|
| `new Terminal(options)` | Yes | Same |
| `.open(element)` | Yes | Same |
| `.write(data)` | Yes | Same |
| `.onData(callback)` | Yes | Same |
| `.resize(cols, rows)` | Yes | Same |
| `.dispose()` | Yes | Same |
| `.scrollToLine(line)` | Yes | Same |
| `.buffer.active` | Yes | Same |
| Fit functionality | Yes | FitAddon |
| Web links | Nice-to-have | WebLinksAddon |

## Step 2: Create Parallel Hook (2h)

### File: `src/renderer/hooks/use-terminal-ghostty.ts`

```typescript
import { useEffect, useRef, useCallback, useState } from 'react'
import { init, Terminal } from 'ghostty-web'
import { useSettingsStore, useToastStore } from '../stores'
import { getTerminalTheme, isAllowedExternalUrl } from '@shared/constants'

// Timing constants
const TERMINAL_INIT_DELAY = 50
export const TERMINAL_DISPOSE_DELAY = 100

interface UseTerminalGhosttyOptions {
  terminalId: string
  initialOutput?: string
  isActive?: boolean
  isHidden?: boolean
  onResize?: (cols: number, rows: number) => void
}

// Track WASM init state
let wasmInitialized = false
let wasmInitPromise: Promise<void> | null = null

async function ensureWasmInit(): Promise<void> {
  if (wasmInitialized) return
  if (wasmInitPromise) return wasmInitPromise
  wasmInitPromise = init().then(() => {
    wasmInitialized = true
  })
  return wasmInitPromise
}

function getCurrentTerminalTheme() {
  const { settings } = useSettingsStore.getState()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && prefersDark)
  return getTerminalTheme(settings.colorTheme, isDark)
}

export function useTerminalGhostty({
  terminalId,
  initialOutput,
  isActive = true,
  isHidden = false,
  onResize
}: UseTerminalGhosttyOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const disposedRef = useRef(false)
  const isAtBottomRef = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const savedViewportRef = useRef<{ viewportY: number; baseY: number; isAtBottom: boolean } | null>(null)

  const initTerminal = useCallback(async () => {
    if (disposedRef.current) return
    if (!containerRef.current || terminalRef.current) return

    const container = containerRef.current
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      requestAnimationFrame(() => {
        if (!disposedRef.current) initTerminal()
      })
      return
    }

    // CRITICAL: Initialize WASM before Terminal creation
    await ensureWasmInit()

    const terminal = new Terminal({
      fontSize: 14,
      theme: getCurrentTerminalTheme(),
    })

    terminal.open(container)
    terminalRef.current = terminal

    // TODO: Implement fit functionality
    // Check if terminal has .resize() or need custom ResizeObserver

    setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return

      // TODO: Fit terminal to container
      // fitTerminal()

      if (initialOutput) {
        terminal.write(initialOutput)
      } else {
        // TODO: Get cols/rows and notify PTY
        // window.electron.terminal.resize(terminalId, cols, rows)
      }
    }, TERMINAL_INIT_DELAY)

    // Handle input
    terminal.onData((data: string) => {
      window.electron.terminal.write(terminalId, data)
    })

    // TODO: Handle resize event if supported
    // terminal.onResize?.(({ cols, rows }) => { ... })
  }, [terminalId, initialOutput, onResize])

  const write = useCallback((data: string) => {
    terminalRef.current?.write(data)
    if (isAtBottomRef.current) {
      // TODO: scrollToBottom if supported
    }
  }, [])

  // Custom fit implementation using ResizeObserver
  const fit = useCallback(() => {
    if (!terminalRef.current || !containerRef.current) return

    const container = containerRef.current
    const terminal = terminalRef.current

    // TODO: Calculate cols/rows from container dimensions
    // This requires knowing cell dimensions from terminal
    // const { width, height } = container.getBoundingClientRect()
    // const cols = Math.floor(width / cellWidth)
    // const rows = Math.floor(height / cellHeight)
    // terminal.resize?.(cols, rows)
  }, [])

  const focus = useCallback(() => {
    terminalRef.current?.focus?.()
  }, [])

  const clear = useCallback(() => {
    terminalRef.current?.clear?.()
  }, [])

  const scrollToBottom = useCallback(() => {
    // TODO: Implement if supported
  }, [])

  const refresh = useCallback(() => {
    // TODO: ghostty-web may not need refresh (no WebGL context loss)
  }, [])

  // Cleanup
  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      const terminal = terminalRef.current
      terminalRef.current = null

      setTimeout(() => {
        try {
          terminal?.dispose?.()
        } catch { /* ignore */ }
      }, TERMINAL_DISPOSE_DELAY)
    }
  }, [])

  // Window resize handler
  useEffect(() => {
    const handleResize = () => fit()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [fit])

  return {
    containerRef,
    initTerminal,
    write,
    fit,
    focus,
    clear,
    scrollToBottom,
    isAtBottom,
    refresh,
    terminal: terminalRef.current
  }
}
```

## Step 3: Implement Missing Features (2h)

### 3.1 Custom Fit Implementation

If no built-in fit API:

```typescript
// Add to use-terminal-ghostty.ts
const FIT_MIN_COLS = 10
const FIT_MIN_ROWS = 2

function calculateDimensions(
  container: HTMLElement,
  fontSize: number
): { cols: number; rows: number } {
  // Approximate character dimensions
  // ghostty-web may expose actual metrics
  const charWidth = fontSize * 0.6  // Monospace approx
  const charHeight = fontSize * 1.2  // Line height approx

  const { width, height } = container.getBoundingClientRect()

  const cols = Math.max(FIT_MIN_COLS, Math.floor(width / charWidth))
  const rows = Math.max(FIT_MIN_ROWS, Math.floor(height / charHeight))

  return { cols, rows }
}

const fit = useCallback(() => {
  if (!terminalRef.current || !containerRef.current) return

  try {
    const { cols, rows } = calculateDimensions(containerRef.current, 14)

    // Try resize API
    if (typeof terminalRef.current.resize === 'function') {
      terminalRef.current.resize(cols, rows)
    }
  } catch { /* ignore */ }
}, [])
```

### 3.2 Web Links Implementation

If no addon support:

```typescript
// Add URL detection regex
const URL_REGEX = /https?:\/\/[^\s<>[\](){}'"]+/g

// After terminal.open(), add click handler
container.addEventListener('click', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return

  // Get clicked position and extract text
  // This requires access to terminal buffer content
  // Implementation depends on ghostty-web API
})
```

### 3.3 Viewport Position API

Check for buffer access:

```typescript
// Verify these APIs exist
const buffer = terminal.buffer?.active
const viewportY = buffer?.viewportY
const baseY = buffer?.baseY

// If not, may need alternative approach
```

## Step 4: Benchmark Performance (30min)

### Test Setup

```typescript
// Create benchmark component
function TerminalBenchmark() {
  const [results, setResults] = useState<{
    initTime: number
    writeTime: number
    resizeTime: number
  }>()

  // Measure init time
  const start = performance.now()
  // ... init terminal
  const initTime = performance.now() - start

  // Measure write performance (1000 lines)
  const writeStart = performance.now()
  for (let i = 0; i < 1000; i++) {
    terminal.write(`Line ${i}: Lorem ipsum dolor sit amet\n`)
  }
  const writeTime = performance.now() - writeStart

  // Measure resize performance
  const resizeStart = performance.now()
  for (let i = 0; i < 100; i++) {
    terminal.resize?.(80 + i, 24 + i)
  }
  const resizeTime = performance.now() - resizeStart
}
```

### Metrics to Compare

| Metric | xterm.js | ghostty-web |
|--------|----------|-------------|
| Init time (ms) | ? | ? |
| Write 1000 lines (ms) | ? | ? |
| Resize 100x (ms) | ? | ? |
| Bundle size (KB) | ~200 | ~400 |
| Memory usage (MB) | ? | ? |

## Step 5: Decision Criteria

### Go Criteria (proceed with migration)

- [ ] Core API compatible (Terminal, write, onData, resize)
- [ ] Cursor position stable on resize
- [ ] Performance equal or better
- [ ] Web links implementable
- [ ] No major missing features

### No-Go Criteria (stay with xterm.js)

- [ ] Missing critical APIs (resize, buffer access)
- [ ] Performance significantly worse
- [ ] Unstable/breaking behavior
- [ ] Excessive implementation effort (>16h)

## File Structure

```
src/renderer/hooks/
├── use-terminal.ts           # Existing (Track 1 fixes)
├── use-terminal-ghostty.ts   # New (this phase)
└── __tests__/
    └── use-terminal-ghostty.spec.ts
```

## Success Criteria

- [ ] ghostty-web package installed
- [ ] TypeScript types inspected and documented
- [ ] use-terminal-ghostty.ts created
- [ ] Basic terminal functionality working
- [ ] Resize behavior tested
- [ ] Performance benchmarked
- [ ] Decision documented

## Rollback

Remove ghostty-web if evaluation fails:

```bash
npm uninstall ghostty-web
rm src/renderer/hooks/use-terminal-ghostty.ts
```

## Unresolved Questions

1. Does ghostty-web expose cell dimensions for fit calculation?
2. Is .buffer.active API compatible?
3. Does .resize(cols, rows) trigger onResize callback?
4. What's the WASM init overhead on cold start?
5. Cross-browser compatibility (Safari, Firefox)?
6. Does link detection require custom implementation?
7. How does disposal/cleanup work?
8. Is there scrollToLine() equivalent?
