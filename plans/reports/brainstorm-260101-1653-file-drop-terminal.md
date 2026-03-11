# Brainstorm Report: File Drop into Terminal

**Date**: 2026-01-01
**Session**: 260101-1653
**Status**: Agreed

---

## Problem Statement

Build a drag-and-drop feature that allows users to drop files (any type) into the terminal, inserting the file path(s) as text input.

## Requirements

| Requirement | Specification |
|-------------|---------------|
| **Action** | Drag & drop files into terminal |
| **Result** | Insert file path as text |
| **File types** | All file types supported |
| **Multiple files** | Separated by newline |
| **Paths with spaces** | Auto-quote: `"/path/my file.png"` |
| **Visual feedback** | Drop zone highlight on drag over |

## Current Architecture

```
src/renderer/
├── hooks/use-terminal.ts      # xterm.js initialization & control
├── components/terminal/
│   ├── terminal-view.tsx      # Terminal display component
│   ├── terminal-pane.tsx      # Tab management
│   └── terminal-grid.tsx      # Grid layout
```

- Uses `xterm.js` for terminal emulation
- Uses `node-pty` in main process for PTY
- IPC communication via `window.electron.terminal.write()`

## Evaluated Approaches

### Option A: Hook Level (`use-terminal.ts`)
- **Pros**: Simple, 1 file change
- **Cons**: Hook bloat (160+ lines), hard to add visual feedback

### Option B: Component Level (`terminal-view.tsx`)
- **Pros**: Easy visual feedback, component is small
- **Cons**: Less reusable, tight coupling

### Option C: Custom Hook (Recommended) ✓
- **Pros**: Modular, reusable, testable, separation of concerns
- **Cons**: New file

## Final Solution

**Chosen**: Option C - Custom Hook `use-file-drop.ts`

### New Files
```
src/renderer/hooks/use-file-drop.ts    # Drag-drop logic hook
```

### Modified Files
```
src/renderer/components/terminal/terminal-view.tsx   # Integrate hook
```

### Hook API Design

```typescript
interface UseFileDropOptions {
  onDrop: (paths: string[]) => void
  formatPath?: (path: string) => string  // Default: auto-quote
  separator?: string                      // Default: '\n'
}

interface UseFileDropReturn {
  isDragOver: boolean
  dropHandlers: {
    onDragEnter: DragEventHandler
    onDragOver: DragEventHandler
    onDragLeave: DragEventHandler
    onDrop: DragEventHandler
  }
}

function useFileDrop(options: UseFileDropOptions): UseFileDropReturn
```

### Path Formatting Logic

```typescript
function formatFilePath(path: string): string {
  // Quote paths containing spaces or special characters
  if (/[\s"'`$\\]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}
```

### Integration in TerminalView

```tsx
export const TerminalView = memo(function TerminalView({ ... }) {
  const { containerRef, write, ... } = useTerminal({ ... })

  const { isDragOver, dropHandlers } = useFileDrop({
    onDrop: (paths) => {
      const text = paths.join('\n')
      window.electron.terminal.write(terminalId, text)
    }
  })

  return (
    <div
      ref={containerRef}
      className={cn('terminal-container', isDragOver && 'drop-active')}
      {...dropHandlers}
    />
  )
})
```

### CSS for Drop Zone

```css
.terminal-container.drop-active {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
  background: rgba(var(--accent-rgb), 0.05);
}
```

## Implementation Considerations

1. **Electron File API**: Use `e.dataTransfer.files[i].path` to get native file paths
2. **Security**: No file content is read, only paths - no security concern
3. **Edge cases**:
   - Empty drop (no files) - ignore
   - Folder drop - include folder path same as file
4. **Performance**: No heavy operations, just string manipulation

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Path encoding issues on Windows | Test with Unicode paths, backslash handling |
| Drop not detected in WebGL canvas | Attach handlers to container, not terminal canvas |
| Visual feedback not visible on dark theme | Use theme-aware colors |

## Success Metrics

- [ ] Single file drop inserts path correctly
- [ ] Multiple files separated by newlines
- [ ] Paths with spaces are quoted
- [ ] Visual feedback appears on drag over
- [ ] Works in both dark and light themes
- [ ] No performance impact on terminal

## Next Steps

1. Create `use-file-drop.ts` hook
2. Add drop zone CSS styles
3. Integrate hook in `terminal-view.tsx`
4. Test with various file types and paths
5. Test on Windows/macOS/Linux

---

## Future Enhancement: Paste Screenshot Support

*Identified during brainstorm but deferred to future phase*

| Feature | Specification |
|---------|---------------|
| **Trigger** | Ctrl+V / Cmd+V with image in clipboard |
| **Behavior** | Auto-save to temp folder → insert path |
| **Save location** | `/tmp/multiClaude-screenshots/` (Linux/macOS), `%TEMP%` (Windows) |
| **Filename** | `screenshot-{timestamp}.png` |
| **Requires** | New IPC handler for saving clipboard image |

## Unresolved Questions

None at this time.
