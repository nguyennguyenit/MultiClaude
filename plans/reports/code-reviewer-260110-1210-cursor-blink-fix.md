# Code Review: Cursor Blink Fix

**Score: 8.5/10**

## Scope
- **Files reviewed**: `src/renderer/App.tsx`
- **Lines analyzed**: ~398 total, 6 lines changed
- **Focus**: Cursor blink bug fix in project switching
- **Commit**: `f801c13` (latest)

## Overall Assessment

**Good implementation**. Fix correctly addresses root cause (activeTerminalId not reset on project switch). Logic is sound, implementation follows React best practices. TypeScript typechecks pass, builds successfully.

**Deductions**: Minor race condition risk (-1.0), missing ESLint validation (-0.5).

---

## Critical Issues
None.

---

## High Priority Findings
None.

---

## Medium Priority Improvements

### 1. Potential Race Condition in Terminal Auto-Selection
**Location**: Lines 109-112

```typescript
// Auto-select first terminal of new project (fix for cursor blink bug)
const { terminals } = useAppStore.getState()
const newProjectTerminals = terminals.filter(t => t.projectId === id)
setActiveTerminal(newProjectTerminals[0]?.id || null)
```

**Issue**: State read from `getState()` may be stale if `setActiveProject(id)` hasn't propagated yet. Zustand updates are synchronous but component re-renders are async.

**Impact**: Low probability - `setActiveProject` only updates `activeProjectId`, doesn't modify terminals array. Race unlikely unless terminals are being added/removed during project switch.

**Recommendation**: Add comment clarifying this is safe due to Zustand's synchronous updates:
```typescript
// Safe: getState() returns current terminals (setActiveProject doesn't modify terminals)
```

---

## Low Priority Suggestions

### 1. Missing ESLint Validation
**Issue**: No ESLint run performed. Only TypeScript typecheck validated.

**Recommendation**: Run `npm run lint` to catch potential code style issues:
```bash
npm run lint
```

### 2. Duplicate Logic Pattern
**Location**: Lines 110-112 vs. Lines 120-123 (`handleAddTerminal`)

Both locations filter terminals by `projectId`. Could extract to shared function:
```typescript
const getProjectTerminals = (projectId: string | null) => {
  const { terminals } = useAppStore.getState()
  return projectId ? terminals.filter(t => t.projectId === projectId) : terminals
}
```

**Tradeoff**: Adds abstraction for 2 occurrences. Marginal benefit. Current implementation is clear.

### 3. Missing Edge Case Test Comment
**Location**: Line 75 (`setActiveTerminal(null)`)

**Suggestion**: Add comment explaining why this prevents cursor blink:
```typescript
// Reset activeTerminalId to prevent stale terminal from appearing active
setActiveTerminal(null)
```

---

## Positive Observations

1. **Root cause fix**: Correctly identified state management issue (activeTerminalId not reset)
2. **Null safety**: Proper handling with `newProjectTerminals[0]?.id || null`
3. **Dependency array**: Updated with `setActiveTerminal` in useCallback deps
4. **Consistent pattern**: Follows existing codebase style (lines 58-63 in `removeProject`)
5. **Type safety**: TypeScript validation passes without errors
6. **Build success**: Production build completes (481ms main, 26ms preload)
7. **Clean diff**: Removed duplicate event listener code (22 lines), reducing complexity

---

## Recommended Actions

1. **[LOW]** Run ESLint: `npm run lint` to validate code style
2. **[LOW]** Add clarifying comments to lines 75 and 109-112
3. **[OPTIONAL]** Extract `getProjectTerminals` helper if similar pattern appears again
4. **[OPTIONAL]** Add E2E test for project switching → cursor blink scenario

---

## Metrics
- **Type Coverage**: ✅ Pass (tsc --noEmit)
- **Build**: ✅ Pass (vite build + electron-builder)
- **Linting**: ⚠️ Not verified
- **Changed Lines**: 6 additions, 22 deletions (net -16)

---

## Unresolved Questions
None.
