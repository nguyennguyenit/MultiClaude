# Phase 1: File Drop Hook & Integration

## Context

- Plan: [plan.md](./plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260101-1653-file-drop-terminal.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Done |
| Effort | 2h |

Implement custom React hook for file drag-drop, integrate into terminal-view component with visual feedback.

## Requirements

### Functional
- Drag files from file manager into terminal
- Insert file path(s) as text
- Multiple files separated by newline
- Paths with spaces/special chars auto-quoted
- Visual drop zone highlight

### Non-functional
- No performance impact
- Works with WebGL terminal addon
- Theme-aware visual feedback

## Architecture

```
┌─────────────────────────────────────────────┐
│  terminal-view.tsx                          │
│  ┌───────────────────────────────────────┐  │
│  │  useFileDrop hook                     │  │
│  │  - isDragOver state                   │  │
│  │  - dropHandlers (onDragEnter/Over/    │  │
│  │    Leave/Drop)                        │  │
│  └───────────────────────────────────────┘  │
│                      │                      │
│                      ▼                      │
│  ┌───────────────────────────────────────┐  │
│  │  onDrop callback                      │  │
│  │  - Extract paths from DataTransfer    │  │
│  │  - Format paths (quote if needed)     │  │
│  │  - Join with newline                  │  │
│  │  - Write to PTY via IPC               │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `src/renderer/hooks/use-file-drop.ts` | Custom hook for drag-drop logic |

### Modify
| File | Description |
|------|-------------|
| `src/renderer/components/terminal/terminal-view.tsx` | Integrate hook, add drop handlers |
| `src/renderer/styles/globals.css` | Add drop zone visual styles |

## Implementation Steps

### Step 1: Create `use-file-drop.ts` hook

Create new file at `src/renderer/hooks/use-file-drop.ts`:

```typescript
import { useState, useCallback, DragEvent } from 'react'

interface UseFileDropOptions {
  onDrop: (paths: string[]) => void
  formatPath?: (path: string) => string
  separator?: string
}

interface UseFileDropReturn {
  isDragOver: boolean
  dropHandlers: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

/**
 * Format file path - quote if contains spaces or special chars
 */
function defaultFormatPath(path: string): string {
  // Quote paths containing spaces or shell-special characters
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    // Escape existing double quotes and wrap in quotes
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/**
 * Hook for handling file drag-drop into a component
 */
export function useFileDrop(options: UseFileDropOptions): UseFileDropReturn {
  const {
    onDrop,
    formatPath = defaultFormatPath,
    separator = '\n'
  } = options

  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      if (prev === 0) setIsDragOver(true)
      return prev + 1
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const next = prev - 1
      if (next === 0) setIsDragOver(false)
      return next
    })
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    // Extract paths from dropped files (Electron provides .path)
    const paths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { path?: string }
      if (file.path) {
        paths.push(formatPath(file.path))
      }
    }

    if (paths.length > 0) {
      const text = paths.join(separator)
      onDrop([text]) // Pass as single joined string
    }
  }, [onDrop, formatPath, separator])

  return {
    isDragOver,
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  }
}
```

**Key details:**
- `dragCounter` prevents false `isDragOver` toggle when dragging over child elements
- Electron's File object has `.path` property for native file path
- Default `formatPath` quotes paths with special chars for shell safety

---

### Step 2: Update `terminal-view.tsx`

Modify `src/renderer/components/terminal/terminal-view.tsx`:

```typescript
import { useEffect, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useFileDrop } from '../../hooks/use-file-drop'
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

  // File drop handler
  const { isDragOver, dropHandlers } = useFileDrop({
    onDrop: (paths) => {
      // Write dropped file paths to terminal PTY
      window.electron.terminal.write(terminalId, paths[0])
    }
  })

  // ... existing useEffect hooks unchanged ...

  return (
    <div
      ref={containerRef}
      className={`terminal-container${isDragOver ? ' terminal-drop-active' : ''}`}
      style={{ height: '100%', width: '100%' }}
      {...dropHandlers}
    />
  )
})
```

**Changes:**
- Import `useFileDrop`
- Add file drop handler that writes paths to PTY
- Add `terminal-drop-active` class when dragging
- Spread `dropHandlers` on container div

---

### Step 3: Add CSS for drop zone

Add to `src/renderer/styles/globals.css` (after `.terminal-container` block):

```css
/* Terminal drop zone highlight */
.terminal-container.terminal-drop-active {
  outline: 2px solid var(--mc-accent);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--mc-accent) 8%, transparent);
}
```

**Notes:**
- Uses `color-mix()` for semi-transparent accent (modern CSS, supported in Electron)
- `outline-offset: -2px` keeps outline inside container
- Uses theme variable `--mc-accent` for consistency

---

## Todo List

- [x] Create `src/renderer/hooks/use-file-drop.ts`
- [x] Update `src/renderer/components/terminal/terminal-view.tsx`
- [x] Add drop zone styles to `src/renderer/styles/globals.css`
- [x] Test single file drop
- [x] Test multiple files (newline separated)
- [x] Test paths with spaces (should be quoted)
- [x] Test in light and dark themes
- [x] Test in different color themes (Dusk, Ocean, etc.)

## Success Criteria

- [x] Dropping file inserts quoted path if contains special chars
- [x] Dropping multiple files inserts newline-separated paths
- [x] Visual highlight appears during drag over
- [x] Highlight uses current theme accent color
- [x] No console errors or warnings
- [x] WebGL addon still works correctly

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WebGL canvas blocks drop events | Low | High | Attach handlers to container, not canvas |
| Path encoding issues (Windows backslash) | Medium | Medium | Electron provides normalized paths |
| `color-mix()` CSS not supported | Very Low | Low | Fallback to rgba if needed |

## Security Considerations

- **No file content read** - only paths extracted
- **No arbitrary code execution** - paths just inserted as text
- **User must explicitly drop** - no automatic file access

## Next Steps

After completion:
1. Consider paste screenshot support (separate phase)
2. Consider folder drop behavior (currently works same as file)
