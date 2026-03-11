# Code Review: Phase 2 - Output Parser Infrastructure

**Reviewer:** code-reviewer
**Date:** 2026-01-06
**Score:** 8/10

---

## Scope

- **Files reviewed:** 5 (output-parser.ts, json-stream-parser.ts, plain-text-parser.ts, index.ts, output-parser.spec.ts)
- **LOC analyzed:** ~350
- **Focus:** Security, performance, architecture patterns

---

## Overall Assessment

Solid implementation with good separation of concerns. Parsers follow EventEmitter pattern correctly. Tests cover main functionality (20 tests, all passing). Minor security and performance improvements needed.

---

## Critical Issues (MUST FIX)

None.

---

## High Priority (SHOULD FIX)

### H1. Potential ReDoS in ENHANCED_DETECTION_PATTERNS

**File:** `src/shared/constants/notification.ts:42-46`

```typescript
taskComplete: /✓\s+(?<taskName>.+?)(?:\s*\(completed\)|$)/i
taskFailed: /✗\s+(?<taskName>.+?)(?:\s*\(failed\)|$)|exit...
```

**Issue:** `.+?` followed by optional groups with `\s*` can cause backtracking on malformed input.

**Recommendation:** Add input length check before regex matching in PlainTextParser:
```typescript
if (data.length > 1000) return // Skip overly long chunks
```

### H2. Double JSON.parse in Auto-Detection

**File:** `src/main/notification/output-parser.ts:54-65`

```typescript
const isJson = lines.some(line => {
  try { JSON.parse(line); return true } catch { return false }
})
// Then jsonParser.parse() parses again
```

**Issue:** Parses same JSON twice - once for detection, once for processing.

**Recommendation:** Cache parse result or use regex heuristic for detection (`/^\s*\{/`).

### H3. DRY Violation - Duplicated generateId()

**Files:** json-stream-parser.ts:103-107, plain-text-parser.ts:49-53

Same implementation in both parsers.

**Recommendation:** Extract to shared utility in `@shared/utils/hash.ts`.

---

## Medium Priority (NICE TO HAVE)

### M1. Missing EventEmitter Cleanup

**Files:** All parsers

No `destroy()` or `removeAllListeners()` method. Potential memory leak if parser is recreated.

**Recommendation:** Add destroy method:
```typescript
destroy(): void {
  this.removeAllListeners()
  this.buffers.clear()
}
```

### M2. Inefficient clearTerminal() in PlainTextParser

**File:** `src/main/notification/plain-text-parser.ts:56-62`

```typescript
for (const [key] of this.debounceMap) {
  if (key.startsWith(`${terminalId}:`)) {
    this.debounceMap.delete(key)
  }
}
```

**Issue:** Iterates all keys. O(n) where n = total keys across all terminals.

**Recommendation:** Use nested Map structure: `Map<terminalId, Map<type, timestamp>>`

### M3. Type Assertion Without Validation in processEvent

**File:** `src/main/notification/json-stream-parser.ts:35`

```typescript
const todos = (event.input as Record<string, unknown>)?.todos as Array<{...}>
```

**Observation:** Runtime validation exists at line 64-72. Good defense-in-depth. Consider adding similar validation at extraction point.

---

## Low Priority (SUGGESTIONS)

### L1. Missing Test for cleanup()

No tests verify cleanup() behavior or memory limits (100 -> 50 entries).

### L2. Magic Numbers

- `debounceMs = 5000` - consider moving to constants
- `> 100` and `slice(-50)` in cleanup - document rationale

### L3. Consider Typed EventEmitter

Use typed event emitter for better type safety:
```typescript
interface ParserEvents {
  taskEvent: (event: TaskEvent) => void
}
```

---

## Positive Observations

1. Good separation: router (OutputParser) delegates to specialized parsers
2. Auto-detection with terminal locking prevents mode flapping
3. Proper buffer handling for incomplete JSON lines
4. Debouncing prevents notification spam
5. Cleanup methods prevent unbounded memory growth
6. Comprehensive test coverage (20 tests)
7. Named capture groups for rich task name extraction
8. All 78 tests passing, type check clean

---

## Summary Table

| Category | Count |
|----------|-------|
| Critical | 0 |
| High | 3 |
| Medium | 3 |
| Low | 3 |

---

## Recommended Actions

1. Add input length guard before regex matching (H1)
2. Use regex heuristic for JSON detection instead of parsing (H2)
3. Extract generateId() to shared utility (H3)
4. Add destroy() method to EventEmitter classes (M1)

---

## Unresolved Questions

1. Is 5s debounce window appropriate for all use cases?
2. Should cleanup() be called on a timer, or only manually?
3. Is the handlers.ts change (`defaultMode: "bypassPermissions"`) related or incidental?
