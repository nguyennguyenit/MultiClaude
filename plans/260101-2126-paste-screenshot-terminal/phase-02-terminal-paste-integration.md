# Phase 2: Terminal Paste Integration

## Context

- Plan: [plan.md](./plan.md)
- Phase 1: [IPC Handler](./phase-01-ipc-clipboard-handler.md)
- Existing: [use-file-drop.ts](../../src/renderer/hooks/use-file-drop.ts)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Done ✓ 2026-01-01 |
| Effort | 2h |

Intercept paste events in terminal, detect clipboard content type, and handle images by saving and inserting path.

## Requirements

### Functional
- Intercept Ctrl+V / Cmd+V in terminal
- Smart detection: text → paste normally, image → save & insert path
- Reuse path formatting from `use-file-drop.ts`
- Works alongside existing right-click paste

### Non-functional
- No latency on text paste (must be instant)
- Image save < 200ms perceived latency
- No UI flicker during operation

## Architecture

```
terminal-view.tsx
└── useClipboardPaste hook (NEW)
    ├── onPaste callback
    │   ├── Check if clipboard has image
    │   │   ├── Yes: Call IPC saveImage → get path → format → write to PTY
    │   │   └── No: Let event propagate (xterm handles text paste)
    │   └── Return
    └── Effect: Add/remove paste event listener

Alternative: Modify use-terminal.ts
└── Add paste handler alongside existing contextmenu handler
```

**Decision**: Create new hook `use-clipboard-paste.ts` for separation of concerns, similar to `use-file-drop.ts`.

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `src/renderer/hooks/use-clipboard-paste.ts` | Clipboard paste handler hook |

### Modify
| File | Description |
|------|-------------|
| `src/renderer/components/terminal/terminal-view.tsx` | Integrate paste hook |

## Implementation Steps

### Step 1: Create Clipboard Paste Hook

Create `src/renderer/hooks/use-clipboard-paste.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react'

interface UseClipboardPasteOptions {
  /** Terminal ID to write to */
  terminalId: string
  /** Container element ref to attach listener */
  containerRef: React.RefObject<HTMLElement>
  /** Whether this terminal is active */
  isActive: boolean
}

/**
 * Format file path - quote if contains spaces or special chars
 * Shared logic with use-file-drop.ts
 */
function formatFilePath(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/**
 * Hook for handling clipboard paste with image detection
 * - If clipboard has image: save to temp, insert path
 * - If clipboard has text: let xterm handle normally
 */
export function useClipboardPaste({
  terminalId,
  containerRef,
  isActive
}: UseClipboardPasteOptions) {
  const isProcessingRef = useRef(false)

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Only handle paste when terminal is active
    if (!isActive) return

    // Prevent double processing
    if (isProcessingRef.current) return

    // Check if clipboard has image
    const items = e.clipboardData?.items
    if (!items) return

    // Look for image in clipboard items
    let hasImage = false
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true
        break
      }
    }

    // If no image, let xterm handle text paste normally
    if (!hasImage) return

    // Prevent default text paste
    e.preventDefault()
    e.stopPropagation()

    isProcessingRef.current = true

    try {
      // Call main process to save clipboard image
      const filePath = await window.electron.clipboard.saveImage()

      if (filePath) {
        // Format path and write to terminal
        const formattedPath = formatFilePath(filePath)
        window.electron.terminal.write(terminalId, formattedPath)
      }
    } catch (error) {
      console.error('Failed to save clipboard image:', error)
    } finally {
      isProcessingRef.current = false
    }
  }, [terminalId, isActive])

  // Attach paste listener to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('paste', handlePaste)
    return () => container.removeEventListener('paste', handlePaste)
  }, [containerRef, handlePaste])
}
```

**Key details:**
- Uses `ClipboardEvent.clipboardData.items` to detect image
- Only intercepts when image is present, otherwise xterm handles text
- Uses `isProcessingRef` to prevent double paste
- Reuses path formatting logic

---

### Step 2: Integrate in TerminalView

Modify `src/renderer/components/terminal/terminal-view.tsx`:

Add import:
```typescript
import { useClipboardPaste } from '../../hooks/use-clipboard-paste'
```

Add hook usage inside component (after `useFileDrop`):
```typescript
  // Reference to wrapper for paste events
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Clipboard paste handler - save image and insert path
  useClipboardPaste({
    terminalId,
    containerRef: wrapperRef,
    isActive
  })
```

Update the wrapper div to use ref:
```tsx
  return (
    <div
      ref={wrapperRef}
      className="terminal-container-wrapper"
      style={{ height: '100%', width: '100%', position: 'relative' }}
      {...dropHandlers}
    >
      {/* ... existing content ... */}
    </div>
  )
```

---

### Step 3: Add Missing Import

In `terminal-view.tsx`, ensure `useRef` is imported:
```typescript
import { useEffect, memo, useRef } from 'react'
```

---

## Full Updated terminal-view.tsx

```tsx
import { useEffect, memo, useRef } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useFileDrop } from '../../hooks/use-file-drop'
import { useClipboardPaste } from '../../hooks/use-clipboard-paste'
import { useAppStore } from '../../stores'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  initialOutput?: string
  onFitReady?: (fit: () => void) => void
}

export const TerminalView = memo(function TerminalView({
  terminalId,
  isActive,
  initialOutput,
  onFitReady
}: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus } = useTerminal({
    terminalId,
    initialOutput
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // File drop handler - write dropped file paths to PTY
  const { isDragOver, dropHandlers } = useFileDrop({
    onDrop: (paths) => {
      window.electron.terminal.write(terminalId, paths[0])
    }
  })

  // Clipboard paste handler - save image and insert path
  useClipboardPaste({
    terminalId,
    containerRef: wrapperRef,
    isActive
  })

  // Initialize terminal on mount
  useEffect(() => {
    initTerminal()
  }, [initTerminal])

  // Listen for terminal output
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onOutput(({ terminalId: id, data }) => {
      if (id === terminalId) {
        write(data)
        appendOutput(terminalId, data)
      }
    })
    return unsubscribe
  }, [terminalId, write, appendOutput])

  // Focus when becomes active
  useEffect(() => {
    if (isActive) {
      focus()
      fit()
    }
  }, [isActive, focus, fit])

  // Expose fit function to parent for resize handling
  useEffect(() => {
    onFitReady?.(fit)
  }, [fit, onFitReady])

  return (
    <div
      ref={wrapperRef}
      className="terminal-container-wrapper"
      style={{ height: '100%', width: '100%', position: 'relative' }}
      {...dropHandlers}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ height: '100%', width: '100%' }}
      />
      {isDragOver && (
        <div
          className="terminal-drop-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'all'
          }}
        />
      )}
    </div>
  )
})
```

---

## Todo List

- [ ] Create `src/renderer/hooks/use-clipboard-paste.ts`
- [ ] Update `terminal-view.tsx` with wrapperRef and hook
- [ ] Add `useRef` to imports in terminal-view.tsx
- [ ] Test: Ctrl+V with image → path inserted
- [ ] Test: Ctrl+V with text → text pasted normally
- [ ] Test: Right-click paste still works
- [ ] Test: Paste in inactive terminal → no action
- [ ] Test: Rapid paste → no double processing

## Success Criteria

- [ ] Paste screenshot from clipboard inserts file path
- [ ] Paste text works as before (no regression)
- [ ] Path is quoted if contains spaces
- [ ] Only active terminal responds to paste
- [ ] No console errors or warnings
- [ ] Works on Linux, macOS, Windows

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Event listener conflicts with xterm | Low | Medium | Only prevent default when image detected |
| Slow image save blocks UI | Low | Low | Async operation, ref-based debounce |
| Focus issues on paste | Low | Low | Check isActive before processing |

## Security Considerations

- **No arbitrary code execution** - Path is just inserted as text
- **User-initiated action** - Requires explicit paste action
- **Sandboxed save location** - Uses OS temp directory

## Next Steps

After completion:
1. Consider visual feedback during image save (optional)
2. Consider cleanup of old screenshots (separate feature)
