# Phase 1: Intercept Keyboard Shortcuts in xterm

## Context Links
- Parent plan: [plan.md](./plan.md)
- Brainstorm: [brainstorm-260109-0900-keyboard-shortcuts-fix.md](../reports/brainstorm-260109-0900-keyboard-shortcuts-fix.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P2 |
| Effort | 45m |
| Implementation | ✅ DONE |
| Review | ✅ DONE |

## Key Insights
- xterm's `attachCustomKeyEventHandler` receives keyboard events BEFORE window event listener
- Currently only handles `Ctrl+V` for paste, all other keys return `true` (pass through)
- Need to intercept: `Alt+1~9`, `Ctrl+N`, `Ctrl+T`, `Ctrl+W`
- Return `false` prevents xterm from sending key to shell

## Requirements
1. Intercept `Alt+1~9` → switch project by index
2. Intercept `Ctrl+N` → create new terminal
3. Intercept `Ctrl+T` → create new terminal (alternative)
4. Intercept `Ctrl+W` → close active terminal
5. Also add `Ctrl+T` to global shortcuts hook for non-terminal focus cases

## Architecture
```
Keyboard Event Flow (BEFORE):
[Key Press] → xterm handler → (return true) → xterm processes → shell receives

Keyboard Event Flow (AFTER):
[Key Press] → xterm handler → intercept shortcuts → (return false) → blocked
                           → other keys → (return true) → shell receives
```

## Related Code Files
| File | Purpose |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | xterm key handler - MODIFY |
| `src/renderer/hooks/use-keyboard-shortcuts.ts` | Global shortcuts - ADD Ctrl+T |
| `src/renderer/stores/app-store.ts` | Store actions (already exists) |

## Implementation Steps

### Step 1: Modify use-terminal.ts
Refactor `attachCustomKeyEventHandler` in `initTerminal` function:

```typescript
// Replace existing handler (lines 207-266)
terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
  if (e.type !== 'keydown') return true

  // Alt+1~9: Switch project by index
  if (e.altKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault()
    const index = parseInt(e.key) - 1
    const { projects, setActiveProject } = useAppStore.getState()
    if (projects[index]) {
      setActiveProject(projects[index].id)
    }
    return false
  }

  // Ctrl+N or Ctrl+T: New terminal
  if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 't')) {
    e.preventDefault()
    // Dispatch custom event for App.tsx to handle
    window.dispatchEvent(new CustomEvent('mc:add-terminal'))
    return false
  }

  // Ctrl+W: Close active terminal
  if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('mc:close-terminal'))
    return false
  }

  // Ctrl+V: Existing paste logic...
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    // ... existing code
  }

  return true
})
```

### Step 2: Add Custom Event Listeners in App.tsx
Add listeners for custom events in useEffect:

```typescript
// In App.tsx, after useKeyboardShortcuts
useEffect(() => {
  const handleAddTerminal = () => handleAddTerminal()
  const handleCloseTerminal = () => handleCloseTerminal()

  window.addEventListener('mc:add-terminal', handleAddTerminal)
  window.addEventListener('mc:close-terminal', handleCloseTerminal)

  return () => {
    window.removeEventListener('mc:add-terminal', handleAddTerminal)
    window.removeEventListener('mc:close-terminal', handleCloseTerminal)
  }
}, [handleAddTerminal, handleCloseTerminal])
```

### Step 3: Add Ctrl+T to use-keyboard-shortcuts.ts
```typescript
// Add after Ctrl+N handler (line 44)
// Ctrl+T: New terminal (alternative)
if (e.ctrlKey && e.key === 't') {
  e.preventDefault()
  onAddTerminal()
  return
}
```

## Todo List
- [x] Modify `attachCustomKeyEventHandler` in use-terminal.ts
- [x] Add custom event listeners in App.tsx
- [x] Add Ctrl+T to use-keyboard-shortcuts.ts
- [x] Test all shortcuts with terminal focused
- [x] Test all shortcuts with focus outside terminal

## Success Criteria
- [x] Alt+1~9 switches project when terminal focused
- [x] Ctrl+N creates terminal when terminal focused
- [x] Ctrl+T creates terminal (both focused and unfocused)
- [x] Ctrl+W closes terminal when terminal focused
- [x] No key events leak to shell for intercepted shortcuts

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Custom events not received | Low | Medium | Use capture phase if needed |
| Store state stale | Low | Low | Use getState() for fresh state |
| macOS Cmd key handling | Medium | Low | Use `e.metaKey` alongside `e.ctrlKey` |

## Security Considerations
- No security concerns - pure UI keyboard handling
