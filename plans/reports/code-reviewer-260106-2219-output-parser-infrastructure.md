# Code Review: Output Parser Infrastructure

**Score: 7.5/10**

## Summary

| Metric | Value |
|--------|-------|
| Files reviewed | 4 (+ 3 types/constants) |
| Lines analyzed | ~200 |
| Test coverage | 0% (new files) |
| Lint issues | 0 in new files |
| Type safety | Pass |

## Critical Issues (MUST FIX)

None.

## Warnings (SHOULD FIX)

### 1. No Unit Tests
- New parsers have **0% test coverage**
- Code standards require 60% minimum
- Risk: Regressions, untested edge cases
- **Action**: Add `__tests__/output-parser.spec.ts` covering:
  - Auto-detection logic
  - Terminal locking
  - JSON parsing with malformed lines
  - Debounce behavior
  - Cleanup routines

### 2. Memory Leak - terminalModes Map
**File**: `output-parser.ts:14`
```typescript
private terminalModes: Map<string, 'json' | 'text'> = new Map()
```
- Map grows indefinitely if `clearTerminal()` never called
- **Action**: Add TTL or max-size limit, or document cleanup requirement

### 3. Memory Leak - previousTodos Map
**File**: `json-stream-parser.ts:11`
```typescript
private previousTodos: Map<string, Set<string>> = new Map()
```
- Same issue: unbounded growth per terminal
- **Action**: Include in clearTerminal or add periodic cleanup

### 4. Cleanup Never Called
**File**: `plain-text-parser.ts:66`
- `cleanup()` method exists but nothing invokes it
- **Action**: Add interval timer or hook to existing lifecycle

### 5. Weak Input Validation
**File**: `json-stream-parser.ts:35`
```typescript
const todos = (event.input as Record<string, unknown>)?.todos as Array<...>
```
- No runtime check if `todos` array has expected shape
- **Action**: Add type guard or validate before iteration

## Suggestions (NICE TO HAVE)

### 1. Auto-Detection False Positives
- Single JSON line (e.g., minified config in output) can false-lock terminal
- Consider requiring N consecutive JSON lines before locking

### 2. Duplicated Code
- `generateId()` and `emitTaskEvent()` identical in both parsers
- Could extract to shared base class or utility

### 3. Hardcoded Timeouts
- 5000ms debounce, 60000ms cleanup could be configurable
- Low priority: current values are sensible defaults

### 4. SHA256 for 16-char ID
- Overkill; simpler hash or UUID would suffice
- Not a problem, just noting over-engineering

## Positive Observations

1. Clean EventEmitter pattern with proper event forwarding
2. NDJSON buffer handling is correct (keeps incomplete lines)
3. Debouncing prevents notification spam effectively
4. Terminal locking prevents parser switching mid-session
5. Content truncation (100 chars) prevents memory bloat
6. Follows project naming conventions (kebab-case files, PascalCase classes)
7. Types well-defined in shared module
8. YAGNI/KISS: Focused implementation, no over-engineering
9. No security concerns (no injection vectors)

## Architecture

```
OutputParser (Router)
    ├── setMode(mode)
    ├── parse(terminalId, data, project)
    │   └── autoDetectAndParse() → locks terminal to parser type
    ├── JsonStreamParser (NDJSON)
    │   ├── buffer management
    │   ├── TodoWrite → taskComplete
    │   ├── tool_result.is_error → taskFailed
    │   └── AskUserQuestion → reviewNeeded
    └── PlainTextParser (Regex)
        ├── pattern matching (ENHANCED_DETECTION_PATTERNS)
        └── debouncing per terminal:type
```

Good separation of concerns. Router pattern appropriate.

## Recommended Actions

1. **HIGH**: Add unit tests for new parsers (60%+ coverage)
2. **HIGH**: Add cleanup call for terminalModes in app lifecycle
3. **MED**: Add type guard for todos array in JsonStreamParser
4. **MED**: Wire up periodic cleanup() call
5. **LOW**: Consider extracting shared generateId() utility

---
*Generated: 2026-01-06 22:19*
