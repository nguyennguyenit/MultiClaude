# Code Review: Terminal File Drop Feature

**Date**: 2026-01-01 20:48
**Reviewer**: code-reviewer
**Scope**: Terminal drag-drop file path insertion

---

## Code Review Summary

### Scope
- Files reviewed: 4 (use-file-drop.ts, hooks/index.ts, terminal-view.tsx, globals.css)
- Lines analyzed: ~220
- Focus: New feature implementation

### Overall Assessment

Clean, focused implementation. No critical security issues. Follows existing codebase patterns. Minor API design concern.

---

## Critical Issues

**None found.**

---

## High Priority Findings

**None found.**

---

## Medium Priority Improvements

### 1. API Design Inconsistency (use-file-drop.ts:89)

**Issue**: Hook joins paths with separator, wraps in array, but signature suggests `string[]` of individual paths.

```typescript
// Current: Joins paths into single string, wraps in array
const text = paths.join(separator)
onDrop([text]) // Pass as single joined string

// Consumer accesses [0] which works but is semantically confusing
onDrop: (paths) => {
  window.electron.terminal.write(terminalId, paths[0])
}
```

**Recommendation**: Either:
- Change callback signature to `onDrop: (text: string) => void`
- Or pass individual paths: `onDrop(paths)` and let consumer join

**Impact**: Low - functional but confusing for future maintainers.

---

## Low Priority Suggestions

### 1. Consider Windows Path Handling

`defaultFormatPath` escapes for Unix shells. Windows paths with backslashes may need different handling if cross-platform is expected.

```typescript
// Current: Escapes " but not Windows-specific concerns
return `"${path.replace(/"/g, '\\"')}"`
```

### 2. Newline-in-Path Edge Case

Paths containing literal newlines (rare but possible on some filesystems) would create unexpected output when multiple files dropped.

---

## Positive Observations

1. **dragCounter pattern** - Correctly handles child element drag bubbling. Industry-standard technique.

2. **Security-conscious** - Only extracts `file.path`, no file content reading. No XSS vectors.

3. **Performance-neutral** - Memoized callbacks, no terminal render impact.

4. **CSS integration** - Uses theme variables (`--mc-accent`), `color-mix` for subtle highlight.

5. **Clean hook pattern** - Matches `useTerminal` and `useKeyboardShortcuts` patterns:
   - Options interface
   - Return interface with handlers
   - Proper memoization

6. **KISS compliance** - ~100 lines, single responsibility, no over-engineering.

---

## Security Checklist

| Check | Status |
|-------|--------|
| No file content read | PASS |
| Path quoting for shell chars | PASS |
| XSS/injection vectors | PASS (PTY input, same as keyboard) |
| Electron IPC boundary | PASS (uses existing write API) |

---

## Metrics

- Type coverage: 100% (interfaces defined)
- Linting: Not run (no issues apparent)
- Test coverage: Unknown (no tests visible for new hook)

---

## Recommended Actions

1. **Optional**: Clarify `onDrop` callback API - either single string or array of paths, not joined-then-wrapped
2. **Future**: Add test coverage for `useFileDrop` hook
3. **Consider**: Platform-aware path formatting if Windows support needed

---

## Unresolved Questions

1. Is Windows platform support required? Path formatting differs.
2. Should there be unit tests for `useFileDrop` before merge?
