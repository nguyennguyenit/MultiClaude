# Code Review: WSL Terminal Support Implementation

**Score: 8/10**

## Scope
- Files reviewed: 9 (settings-store.ts, App.tsx, terminal-settings.tsx, shell-selector-dropdown.tsx, terminal-action-bar.tsx, preload/index.ts, terminal-manager.ts, wsl-detector.ts, types/index.ts)
- Lines analyzed: ~800
- Focus: WSL terminal support feature
- Branch: beta

## Overall Assessment

Implementation is solid with proper type safety, error handling, and architecture patterns. TypeScript compiles cleanly. No critical security issues. Main improvement: DRY violation with duplicated utility function.

---

## Critical Issues
None found.

---

## High Priority (Warnings)

### 1. DRY Violation - Duplicated `getShellKey()` function
- `src/renderer/components/settings/terminal-settings.tsx:21-24`
- `src/renderer/components/terminal/shell-selector-dropdown.tsx:12-15`

Both files contain identical implementation:
```typescript
function getShellKey(shell: WindowsShell): string {
  if (shell.type === 'wsl') return `wsl:${shell.distro}`
  return shell.type
}
```

**Recommendation**: Extract to `src/shared/utils/shell.ts` or `src/renderer/utils/shell.ts`

---

## Medium Priority (Suggestions)

### 2. Missing Loading State for WSL Detection
- `src/renderer/App.tsx:188-191`

WSL detection is async but no loading indicator. Settings panel could render before `wslInfo` is populated.

```typescript
// Current: no loading state
useEffect(() => {
  loadSettings()
  detectWsl()
}, [])
```

**Recommendation**: Add `wslDetecting: boolean` state or ensure UI gracefully handles `wslInfo: null`

### 3. Missing Accessibility Labels
- `src/renderer/components/terminal/shell-selector-dropdown.tsx:89-106`

Shell selector buttons lack `aria-label` attributes for screen readers.

```typescript
// Add aria-label
<button
  key={key}
  aria-label={`Select ${option.label} shell`}
  ...
```

---

## Positive Observations

1. **Security**: WSL detector uses hardcoded commands only, no user input injection risk. Proper timeout (5000ms) and `windowsHide: true`.

2. **Type Safety**: WindowsShell discriminated union type is well-designed:
   ```typescript
   export type WindowsShell =
     | { type: 'cmd' }
     | { type: 'powershell' }
     | { type: 'wsl'; distro: string }
   ```

3. **Validation**: Saved shell preference is validated on startup (settings-store.ts:114-122). Falls back to 'cmd' if saved WSL distro no longer exists.

4. **React Hooks**: Proper use of `useMemo` for shell options, `useCallback` for handlers. Hooks called before early returns (terminal-action-bar.tsx:66).

5. **Platform Detection**: Backend `detectWsl()` returns early on non-Windows. Frontend checks API existence before calling.

6. **UX**: Shell settings only shown when WSL is available. Right-click shell selector is discoverable via tooltip.

7. **Error Handling**: Both WSL detection and preference validation have proper try/catch with fallback to unavailable state.

---

## Metrics

- TypeScript: Pass (no errors)
- ESLint: Pass (no new warnings in WSL-related files)
- Test Coverage: N/A (no unit tests for new code)

---

## Recommended Actions

1. **P1**: Extract `getShellKey()` to shared utility to fix DRY violation
2. **P2**: Consider adding loading state for WSL detection
3. **P3**: Add aria-labels for accessibility
4. **P3**: Add unit tests for `wsl-detector.ts` and `getShellCommand()` method

---

## Files Summary

| File | Status | Notes |
|------|--------|-------|
| settings-store.ts | Good | wslInfo state, detectWsl(), shell validation |
| App.tsx | Good | detectWsl() on mount, shell param to terminal |
| terminal-settings.tsx | Good | Shell selector UI, DRY violation |
| shell-selector-dropdown.tsx | Good | New component, DRY violation |
| terminal-action-bar.tsx | Good | Right-click shell selector |
| preload/index.ts | Good | API type updated correctly |
| terminal-manager.ts | Good | getShellCommand() implementation |
| wsl-detector.ts | Good | Safe command execution |
| types/index.ts | Good | WslInfo, WindowsShell types |
