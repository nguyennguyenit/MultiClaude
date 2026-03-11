# Code Review: Phase 3 - Focus Detection & Deduplication

**Date:** 2026-01-06
**Score:** 8.5/10
**Reviewer:** code-reviewer (a1f6856)

## Scope

- Files reviewed: 9 (5 new, 4 modified)
- LOC analyzed: ~450
- Tests: 26 (12 focus-detector, 14 task-tracker)
- Focus: Phase 3 implementation

## Overall Assessment

Solid implementation. Clean abstractions, good test coverage, proper TypeScript typing. Minor issues around memory management and missing event listener cleanup.

---

## Critical Issues

**None found.**

---

## High Priority

### 1. Memory Leak - Event Listener Cleanup in FocusDetector (focus-detector.ts:16-22)

```typescript
window.on('focus', () => { ... })
window.on('blur', () => { ... })
```

**Issue:** Event listeners registered on BrowserWindow are never removed in `destroy()`.

**Impact:** If window is replaced/recreated, old listeners remain attached to previous window reference.

**Fix:** Store listener refs and call `window.removeListener()` in destroy.

### 2. TaskTracker - Inconsistent Behavior in Test Comment (task-tracker.spec.ts:31-33)

```typescript
it('returns true for same task in different terminal', () => {
  tracker.shouldNotify('term-1', 'task-abc123')
  expect(tracker.shouldNotify('term-2', 'task-abc123')).toBe(false) // Comment says "different terminal" but behavior is global
})
```

**Issue:** Test name says "returns true" but assertion expects `false`. The comment clarifies intent but name is misleading.

**Impact:** Confusing for maintainers.

---

## Medium Priority

### 3. No Input Validation for terminalId (focus-detector.ts, task-tracker.ts)

Both classes accept any string as terminalId. Empty strings or special chars are not validated.

**Impact:** Low - internal API. Consider defensive check if exposed externally.

### 4. Cleanup Interval Not Configurable (notification-manager.ts:34)

```typescript
this.cleanupInterval = setInterval(() => { ... }, 60000)
```

Hardcoded 60s interval. TTL is 5min in TaskTracker.

**Suggestion:** Consider aligning or making configurable for testing.

### 5. FocusDetector.destroy() Preserves windowFocused State

```typescript
destroy(): void {
  this.window = null
}
```

After destroy, `isWindowFocused()` returns last known value (true by default). Could be confusing.

**Suggestion:** Either reset to safe default or document behavior.

---

## Low Priority

### 6. IPC Handler Uses `ipcMain.on` vs `ipcMain.handle` (handlers.ts:358)

```typescript
ipcMain.on(IPC_CHANNELS.NOTIFICATION_SET_ACTIVE_TERMINAL, ...)
```

Most other handlers use `ipcMain.handle`. Using `.on` is correct here (fire-and-forget), but inconsistency may confuse.

**Suggestion:** Add comment explaining why `.on` is used.

### 7. TTL Magic Number (task-tracker.ts:8)

```typescript
private ttlMs = 5 * 60 * 1000 // 5 minutes
```

Consider moving to shared constants with other timing values.

---

## Positive Observations

1. **Clean separation of concerns** - FocusDetector handles window state, TaskTracker handles dedup
2. **Good test coverage** - 26 tests covering edge cases, TTL behavior, cleanup
3. **Proper TypeScript** - No `any` types, good inference
4. **Integration done right** - NotificationManager cleanly composes both new classes
5. **Periodic cleanup** - Both pattern detector and task tracker cleaned in same interval
6. **IPC channel follows naming convention** - `notification:set-active-terminal`

---

## Security Analysis

- **XSS:** N/A - No DOM/HTML manipulation in main process
- **Injection:** Safe - terminalId used as Map key, not in queries
- **Secrets:** N/A - No credential handling in these files
- **OWASP:** No issues identified

---

## Performance Analysis

- **Map operations:** O(1) lookups/inserts - efficient
- **Cleanup complexity:** O(n*m) where n=tasks, m=terminals - acceptable for expected data sizes
- **Memory:** Bounded by 5min TTL auto-cleanup

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript | Pass |
| Lint | 0 errors |
| Tests | 26/26 passing |
| Test coverage | Good (edge cases, timing) |

---

## Recommended Actions

1. **[HIGH]** Add event listener cleanup in FocusDetector.destroy()
2. **[MEDIUM]** Fix misleading test name in task-tracker.spec.ts:31
3. **[LOW]** Add comment explaining `ipcMain.on` choice for active terminal
4. **[LOW]** Consider extracting TTL to constants file

---

## Unresolved Questions

None.
