# Code Review: Phase 3 - Terminal Pane & Grid

## Scope
- Files reviewed: `terminal-pane.tsx`, `terminal-grid.tsx`, `terminal-view.tsx`
- Lines: ~210
- Focus: Phase 3 header bar + add-cell implementation

## Overall Assessment
Clean implementation. Good use of React patterns (memo, refs, cleanup). A few performance and DRY issues to address.

---

## Critical Issues
None found.

---

## High Priority Findings

### 1. Title Edit State Not Persisted (terminal-pane.tsx:27-91)
`editTitle` state changes are discarded on blur. No `onTitleChange` callback to persist.
```tsx
// Missing: onTitleChange?: (newTitle: string) => void
onBlur={() => setIsEditing(false)} // editTitle value is lost
```

### 2. Title Prop Desync (terminal-pane.tsx:28)
`editTitle` initialized from `title` but never updates when prop changes.
```tsx
const [editTitle, setEditTitle] = useState(title)
// Missing: useEffect to sync when title prop changes
```

### 3. Inline Arrow Functions Breaking Memo (terminal-grid.tsx:96-98)
New function refs created each render, defeating TerminalPane's memo:
```tsx
onActivate={() => onTerminalClick(terminal.id)}  // new fn each render
onClose={() => onCloseTerminal?.(terminal.id)}
onStartClaude={() => onStartClaude?.(terminal.id)}
```
**Fix**: Use useCallback with terminal.id or refactor to pass id as prop.

---

## Medium Priority Improvements

### 4. DRY Violation - Add Cell Duplicate (terminal-grid.tsx:115-125, 144-154)
Add-cell JSX duplicated. Extract to component:
```tsx
const AddTerminalCell = memo(({ onClick }) => (
  <div className="h-full flex items-center..." onClick={onClick}>...</div>
))
```

### 5. onFitReady Effect Dependency (terminal-view.tsx:40-42)
Effect runs whenever `fit` changes, which may create new reference each render:
```tsx
useEffect(() => {
  onFitReady?.(fit)
}, [fit, onFitReady])
```
Consider: Verify `fit` is stable (via useCallback in useTerminal).

---

## Low Priority Suggestions

### 6. Magic Number (terminal-grid.tsx:47)
`terminals.length < 9` - extract to constant:
```tsx
const MAX_TERMINALS = 9
```

### 7. Button Type Redundancy
`type="button"` is correct but could use shared ButtonIcon component.

---

## Security Assessment
- No XSS vectors (no dangerouslySetInnerHTML)
- No dynamic script execution
- Event handlers properly scoped
- **Pass**

## Performance Summary
| Concern | Severity | Status |
|---------|----------|--------|
| Inline arrow props | High | Fix recommended |
| ResizeObserver debounce | - | Good |
| memo usage | - | Good |
| Cleanup on unmount | - | Good |

---

## Positive Observations
- Proper cleanup of ResizeObserver and timeout refs
- Good accessibility (aria-labels, button types)
- Clean grid calculation logic extracted as pure functions
- stopPropagation on nested button clicks

---

## Recommended Actions
1. **High**: Add `onTitleChange` callback and sync editTitle with prop
2. **High**: Memoize terminal-specific callbacks in TerminalGrid
3. **Med**: Extract AddTerminalCell component
4. **Low**: Add MAX_TERMINALS constant

---

## Unresolved Questions
- Is the title editing feature intended to persist? If yes, needs callback prop.
- Should TerminalPane handle title updates via IPC directly vs callback?
