# Code Review: Phase 1 Terminal Hanging Hybrid Fix

## Scope
- Files reviewed: 5 core files
  - `src/renderer/App.tsx`
  - `src/renderer/components/terminal/terminal-grid.tsx`
  - `src/renderer/components/terminal/terminal-pane.tsx`
  - `src/renderer/components/terminal/terminal-view.tsx`
  - `src/renderer/hooks/use-terminal.ts`
- Lines of code analyzed: ~800 LOC
- Review focus: Phase 1 implementation - CSS-hidden terminal mounting strategy
- Updated plans: N/A (no plan file provided)

## Overall Assessment

**Score: 8.5/10**

Implementation successfully achieves stated goal of fixing terminal "hanging" during project switches via CSS-based hiding instead of React unmounting. Architecture is clean, follows existing patterns, and includes proper performance optimizations (WebGL disabled for hidden terminals). Type safety excellent, build passes, no security vulnerabilities detected.

Primary concerns: memory accumulation risk, missing cleanup edge cases, React memo may prevent necessary re-renders.

## Critical Issues

**NONE FOUND** - No security vulnerabilities, breaking changes, or data loss risks detected.

## High Priority Findings

### 1. Memory Accumulation Risk (SHOULD FIX)
**File:** `terminal-grid.tsx` lines 124-142
**Issue:** Hidden terminals accumulate indefinitely in `display: none` container. No lifecycle cleanup when projects deleted or app runs for extended periods.

**Impact:** Memory leak potential - each terminal holds:
- XTerm instance (~2-5 MB)
- PTY process (OS resources)
- Event listeners (scroll, keyboard, clipboard)
- Buffer history

**Evidence:**
```tsx
{hiddenTerminals.length > 0 && (
  <div style={{ display: 'none' }} aria-hidden="true">
    {hiddenTerminals.map((terminal) => (
      <TerminalPane key={terminal.id} hidden={true} ... />
    ))}
  </div>
)}
```

**Recommendation:**
Add lifecycle limit - unmount terminals hidden > 30 minutes OR implement LRU cache (keep 3 most recent projects mounted, unmount older).

```tsx
// Suggested implementation
const HIDDEN_TERMINAL_TTL = 30 * 60 * 1000; // 30 min
const lastAccessTime = useRef<Record<string, number>>({});

useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    hiddenTerminals.forEach(t => {
      if (now - lastAccessTime.current[t.id] > HIDDEN_TERMINAL_TTL) {
        onCloseTerminal?.(t.id);
      }
    });
  }, 60000); // Check every minute
  return () => clearInterval(interval);
}, [hiddenTerminals]);
```

### 2. React Memo May Suppress Re-renders (SHOULD FIX)
**File:** `terminal-grid.tsx` line 41, `terminal-pane.tsx` line 18, `terminal-view.tsx` line 36
**Issue:** All terminal components wrapped in `memo()` but `hidden` prop not in dependency comparisons.

**Impact:** When terminal transitions hidden→visible, React may skip re-render if other props unchanged. Could cause:
- WebGL not re-enabling
- Focus not restoring
- Terminal appearing blank

**Evidence:**
```tsx
export const TerminalGrid = memo(function TerminalGrid({ ... }) {
  // No custom comparison function - uses shallow equality
  // If `terminals` array identity unchanged, may skip render even if hidden status changed
});
```

**Recommendation:**
Either remove memo or add custom comparator:

```tsx
export const TerminalView = memo(
  function TerminalView({ ... }) { ... },
  (prev, next) => {
    return prev.terminalId === next.terminalId &&
           prev.isActive === next.isActive &&
           prev.hidden === next.hidden; // CRITICAL: must compare hidden
  }
);
```

### 3. Missing Cleanup on Project Deletion (SHOULD FIX)
**File:** `App.tsx` lines 66-70
**Issue:** `handleDeleteProject` doesn't trigger terminal disposal for deleted project.

**Current:**
```tsx
const handleDeleteProject = useCallback(async (id: string) => {
  await window.electron.project.delete(id)
  removeProject(id)
  // Missing: clean up terminals for deleted project
}, [removeProject])
```

**Impact:** Orphaned terminals stay in hidden container, PTY processes continue running, consuming resources.

**Recommendation:**
```tsx
const handleDeleteProject = useCallback(async (id: string) => {
  // Close all terminals for this project
  const projectTerminals = terminals.filter(t => t.projectId === id);
  for (const terminal of projectTerminals) {
    await window.electron.terminal.destroy(terminal.id);
    removeTerminal(terminal.id);
  }

  await window.electron.project.delete(id);
  removeProject(id);
}, [removeProject, removeTerminal, terminals]);
```

### 4. WebGL Toggle Race Condition (SHOULD FIX)
**File:** `use-terminal.ts` lines 506-562
**Issue:** `isHidden` state change triggers debounced WebGL toggle (50ms), but rapid hidden→visible→hidden transitions could cause:
- WebGL loading while terminal hidden (wasted GPU)
- WebGL enabled on hidden terminal (violates line 45 contract)

**Current:**
```tsx
useEffect(() => {
  isHiddenRef.current = isHidden;
  // Debounced toggle - doesn't check final state
  webglToggleTimerRef.current = setTimeout(toggleWebGL, WEBGL_TOGGLE_DEBOUNCE);
}, [isActive, isHidden, ...]);
```

**Recommendation:**
Check refs in toggle function to use final state:

```tsx
const toggleWebGL = () => {
  // Use refs to get CURRENT state at execution time
  const needsWebGL = shouldUseWebGL(isActiveRef.current, isHiddenRef.current);
  // ... existing logic
};
```

## Medium Priority Improvements

### 5. Hidden Terminal Still Receives DOM Events (NICE TO HAVE)
**File:** `use-terminal.ts` lines 227-254
**Issue:** `display: none` prevents rendering but event listeners (mouseup, contextmenu, keydown) still registered and active. Not a bug but unnecessary CPU cycles.

**Recommendation:** Add `if (isHidden) return;` guards in event handlers, or conditionally register listeners based on hidden state.

### 6. Transition Delay Calculation Fragile (NICE TO HAVE)
**File:** `App.tsx` line 104
**Issue:** Manual calculation `TERMINAL_DISPOSE_DELAY + 50` hardcoded. If constant changes, must update in 2 places.

**Current:**
```tsx
await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50));
```

**Recommendation:**
```tsx
const TERMINAL_SWITCH_BUFFER = 50;
const TERMINAL_SWITCH_DELAY = TERMINAL_DISPOSE_DELAY + TERMINAL_SWITCH_BUFFER;
await new Promise(resolve => setTimeout(resolve, TERMINAL_SWITCH_DELAY));
```

### 7. Type Safety for Hidden Prop (NICE TO HAVE)
**Files:** `terminal-pane.tsx` line 8, `terminal-view.tsx` line 28
**Issue:** `hidden` prop optional with default `false`, but Phase 1 requires explicit hidden management. Consumers could forget to pass it.

**Recommendation:** Make required or add JSDoc warning:
```tsx
interface TerminalPaneProps {
  /** @critical Must be true for off-screen terminals to prevent rendering/WebGL */
  hidden: boolean; // Remove `?` optional marker
  // ...
}
```

### 8. Missing Performance Metrics (NICE TO HAVE)
**Issue:** No telemetry to validate fix effectiveness. Can't measure:
- Average project switch time before/after
- Memory delta with hidden terminals
- ESC key responsiveness improvement

**Recommendation:** Add dev-mode console.time measurements around critical paths:
```tsx
console.time('[MultiClaude] Project Switch');
setActiveProject(id);
await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50));
console.timeEnd('[MultiClaude] Project Switch');
```

## Low Priority Suggestions

### 9. Comment Clarity (NICE TO HAVE)
**File:** `terminal-grid.tsx` line 49
**Comment:** "Note: All terminals are passed to TerminalGrid which handles hiding via CSS"

**Issue:** Technically accurate but doesn't explain *why* (prevents hanging). New developers may refactor without understanding intent.

**Recommendation:**
```tsx
// CRITICAL: Pass ALL terminals (not just visible) to prevent "hanging" bug.
// Hidden terminals stay mounted with CSS display:none to keep PTY/xterm synced.
// Unmounting during project switch causes ESC key delay + rendering artifacts.
```

### 10. Accessibility Enhancement (NICE TO HAVE)
**File:** `terminal-grid.tsx` line 125
**Issue:** Hidden container has `aria-hidden="true"` but individual terminals not marked as inert.

**Recommendation:**
```tsx
<div style={{ display: 'none' }} aria-hidden="true" inert>
```
(Note: `inert` attribute prevents focus/interaction even if CSS fails)

## Positive Observations

1. **Excellent WebGL Optimization**: Lines 44-46 in `use-terminal.ts` - disabling WebGL for hidden terminals saves significant GPU memory (verified via `shouldUseWebGL()` logic).

2. **Proper Type Safety**: All TypeScript strict mode checks pass, no `any` types detected.

3. **Consistent Naming**: Follows project conventions from `code-standards.md` (kebab-case files, PascalCase components).

4. **Clean Separation of Concerns**:
   - `App.tsx` handles project switching logic
   - `terminal-grid.tsx` manages layout + hiding strategy
   - `use-terminal.ts` handles xterm lifecycle (unaware of hiding)

5. **Performance-Conscious**: Debounce patterns, memoization, requestAnimationFrame usage demonstrates understanding of React/DOM performance.

6. **Defensive Coding**: Multiple disposal guards (`disposedRef.current` checks), try-catch blocks, cleanup functions in all effects.

## Recommended Actions

**Immediate (Before Merge):**
1. Fix project deletion cleanup (Issue #3) - prevents resource leak
2. Validate memo comparators include `hidden` prop (Issue #2) - prevents render bugs
3. Add TTL or LRU cleanup for hidden terminals (Issue #1) - prevents unbounded memory growth

**Short-term (Next Sprint):**
4. Fix WebGL race condition (Issue #4) - edge case but violates design contract
5. Add performance telemetry (Issue #8) - validate fix effectiveness
6. Update comments with intent/rationale (Issue #9) - maintainability

**Long-term (Future Optimization):**
7. Consider virtualization library for terminal list (if >50 terminals common)
8. Implement "suspend" mode for hidden terminals (pause PTY output buffering)

## Metrics

- Type Coverage: 100% (TypeScript strict mode, no `any` detected)
- Test Coverage: N/A (no tests in scope, see `__tests__/` pattern in code-standards.md)
- Linting Issues: 0 (build passes cleanly)
- Build Status: ✅ PASS (Vite build completed successfully)

## Unresolved Questions

1. **Memory Budget**: What's acceptable memory footprint for 10 projects × 3 terminals each (30 total, 27 hidden at any time)?
2. **Session Restore**: Does `initialOutput` restoration work correctly for terminals that were hidden during last session save?
3. **Stress Testing**: Has implementation been tested with rapid project switching (10+ switches in 5 seconds)?
4. **Mobile/Touchscreen**: Do hidden terminals interfere with touch event handling on Electron apps with touch support?
