# Phase 2: WebGL Conditional Logic

## Objective

Implement conditional WebGL loading based on render mode setting.

## Tasks

### 2.1 Update useTerminal Hook Interface

**File**: `src/renderer/hooks/use-terminal.ts`

Update `UseTerminalOptions` interface (line 8-12):

```typescript
interface UseTerminalOptions {
  terminalId: string
  isActive: boolean  // NEW - required for balanced mode
  initialOutput?: string
  onResize?: (cols: number, rows: number) => void
}
```

### 2.2 Add WebGL Decision Logic

**File**: `src/renderer/hooks/use-terminal.ts`

Add helper function after `getCurrentTerminalTheme()` (after line 23):

```typescript
/**
 * Determine if WebGL should be used based on render mode and active state
 */
function shouldUseWebGL(isActive: boolean): boolean {
  const { terminalRenderMode } = useSettingsStore.getState().settings

  switch (terminalRenderMode) {
    case 'performance':
      return false  // Never use WebGL
    case 'balanced':
      return isActive  // Only active terminal gets WebGL
    case 'quality':
      return true  // All terminals use WebGL
  }
}
```

### 2.3 Add WebGL Addon Reference

**File**: `src/renderer/hooks/use-terminal.ts`

Add ref for WebGL addon tracking (after line 29):

```typescript
const webglAddonRef = useRef<WebglAddon | null>(null)
```

### 2.4 Modify Terminal Initialization

**File**: `src/renderer/hooks/use-terminal.ts`

Update the function signature to include `isActive`:

```typescript
export function useTerminal({ terminalId, isActive, initialOutput, onResize }: UseTerminalOptions) {
```

Replace WebGL loading block (lines 65-75) with:

```typescript
setTimeout(() => {
  // Guard against disposed terminal
  if (disposedRef.current || !terminalRef.current) return

  // Conditionally load WebGL based on render mode
  if (shouldUseWebGL(isActive)) {
    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch (e) {
      console.warn('WebGL addon failed to load:', e)
    }
  }

  try {
    fitAddon.fit()
  } catch {
    // Ignore fit errors
  }
}, 50)
```

### 2.5 Add WebGL Toggle for Balanced Mode

**File**: `src/renderer/hooks/use-terminal.ts`

Add effect to handle active state changes (after line 259, before the return):

```typescript
// Handle WebGL toggle for balanced mode
useEffect(() => {
  const { terminalRenderMode } = useSettingsStore.getState().settings
  if (terminalRenderMode !== 'balanced') return
  if (!terminalRef.current) return

  if (isActive && !webglAddonRef.current) {
    // Becoming active: load WebGL
    try {
      const webglAddon = new WebglAddon()
      terminalRef.current.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch (e) {
      console.warn('WebGL addon failed to load on activate:', e)
    }
  } else if (!isActive && webglAddonRef.current) {
    // Becoming inactive: dispose WebGL
    try {
      webglAddonRef.current.dispose()
    } catch {
      // Ignore disposal errors
    }
    webglAddonRef.current = null
  }
}, [isActive])
```

### 2.6 Update Cleanup Logic

**File**: `src/renderer/hooks/use-terminal.ts`

Update cleanup effect to include webglAddon (around line 219-240):

```typescript
useEffect(() => {
  disposedRef.current = false

  return () => {
    disposedRef.current = true

    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const webglAddon = webglAddonRef.current  // NEW
    terminalRef.current = null
    fitAddonRef.current = null
    webglAddonRef.current = null  // NEW

    setTimeout(() => {
      try {
        webglAddon?.dispose()  // NEW - dispose WebGL first
        fitAddon?.dispose()
        terminal?.dispose()
      } catch {
        // Terminal may already be disposed
      }
    }, 100)
  }
}, [])
```

### 2.7 Update TerminalView Component

**File**: `src/renderer/components/terminal/terminal-view.tsx`

The `isActive` prop is already passed but not forwarded to hook. Update hook call (line 14):

```typescript
const { containerRef, initTerminal, write, fit, focus } = useTerminal({
  terminalId,
  isActive,  // NEW - forward isActive to hook
  initialOutput
})
```

## Verification

After Phase 2:
- [ ] Performance mode: No WebGL contexts (check DevTools → More tools → Layers)
- [ ] Balanced mode: WebGL only on active terminal tab
- [ ] Quality mode: WebGL on all terminals (current behavior)
- [ ] Switching tabs in balanced mode toggles WebGL without errors
- [ ] No console errors when switching between terminals

## Code Diff Preview

### src/renderer/hooks/use-terminal.ts

```diff
 interface UseTerminalOptions {
   terminalId: string
+  isActive: boolean
   initialOutput?: string
   onResize?: (cols: number, rows: number) => void
 }

+/**
+ * Determine if WebGL should be used based on render mode and active state
+ */
+function shouldUseWebGL(isActive: boolean): boolean {
+  const { terminalRenderMode } = useSettingsStore.getState().settings
+
+  switch (terminalRenderMode) {
+    case 'performance':
+      return false
+    case 'balanced':
+      return isActive
+    case 'quality':
+      return true
+  }
+}

-export function useTerminal({ terminalId, initialOutput, onResize }: UseTerminalOptions) {
+export function useTerminal({ terminalId, isActive, initialOutput, onResize }: UseTerminalOptions) {
   const containerRef = useRef<HTMLDivElement>(null)
   const terminalRef = useRef<XTerm | null>(null)
   const fitAddonRef = useRef<FitAddon | null>(null)
+  const webglAddonRef = useRef<WebglAddon | null>(null)
   const disposedRef = useRef(false)

   ...

     setTimeout(() => {
       if (disposedRef.current || !terminalRef.current) return

-      try {
-        const webglAddon = new WebglAddon()
-        terminal.loadAddon(webglAddon)
-      } catch (e) {
-        console.warn('WebGL addon failed to load:', e)
+      if (shouldUseWebGL(isActive)) {
+        try {
+          const webglAddon = new WebglAddon()
+          terminal.loadAddon(webglAddon)
+          webglAddonRef.current = webglAddon
+        } catch (e) {
+          console.warn('WebGL addon failed to load:', e)
+        }
       }

   ...

+  // Handle WebGL toggle for balanced mode
+  useEffect(() => {
+    const { terminalRenderMode } = useSettingsStore.getState().settings
+    if (terminalRenderMode !== 'balanced') return
+    if (!terminalRef.current) return
+
+    if (isActive && !webglAddonRef.current) {
+      try {
+        const webglAddon = new WebglAddon()
+        terminalRef.current.loadAddon(webglAddon)
+        webglAddonRef.current = webglAddon
+      } catch (e) {
+        console.warn('WebGL addon failed to load on activate:', e)
+      }
+    } else if (!isActive && webglAddonRef.current) {
+      try {
+        webglAddonRef.current.dispose()
+      } catch {}
+      webglAddonRef.current = null
+    }
+  }, [isActive])
```

### src/renderer/components/terminal/terminal-view.tsx

```diff
 const { containerRef, initTerminal, write, fit, focus } = useTerminal({
   terminalId,
+  isActive,
   initialOutput
 })
```

---

*Phase 2 of 4*
