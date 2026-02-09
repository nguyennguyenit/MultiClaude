# Code Review: Terminal Rendering Mode Feature

**Date:** 2026-01-06
**Reviewer:** code-reviewer subagent
**Branch:** feature/terminal-rendering-mode
**Score:** 8/10

---

## Scope

- **Files reviewed:** 6 files
- **Lines changed:** +129 / -13
- **Review focus:** Security, performance, architecture, YAGNI/KISS/DRY

| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | +4 (TerminalRenderMode type) |
| `src/shared/constants/themes.ts` | +2 (default setting) |
| `src/renderer/stores/settings-store.ts` | +8 (setter) |
| `src/renderer/hooks/use-terminal.ts` | +61 (WebGL toggle logic) |
| `src/renderer/components/terminal/terminal-view.tsx` | +2 (prop pass) |
| `src/renderer/components/settings/theme-selector.tsx` | +55 (UI) |

---

## Overall Assessment

Clean, well-structured implementation following existing patterns. TypeScript compiles without errors. Build succeeds. The feature adds a sensible performance/quality tradeoff for xterm.js WebGL rendering. A few medium-priority concerns around reactivity and potential race conditions.

---

## Critical Issues

**None**

---

## High Priority Findings

### 1. Missing Settings Reactivity for Render Mode Changes (H)

**Location:** `src/renderer/hooks/use-terminal.ts`

**Issue:** `shouldUseWebGL()` reads `terminalRenderMode` from store snapshot but hook doesn't subscribe to render mode changes. When user changes mode in settings, existing terminals won't update until `isActive` changes.

**Impact:** User changes "Performance" to "Quality" in settings, but background terminals don't load WebGL until focused.

**Fix:** Add subscription to settings store for `terminalRenderMode` changes, similar to existing theme subscription (lines 284-293).

---

## Medium Priority Improvements

### 2. Potential Race Condition on Rapid Active Changes (M)

**Location:** `src/renderer/hooks/use-terminal.ts` lines 303-314

**Issue:** WebGL loading uses `requestAnimationFrame` but lacks guard against multiple pending loads if `isActive` toggles rapidly.

```typescript
if (needsWebGL && !hasWebGL) {
  requestAnimationFrame(() => {
    // Could execute multiple times if isActive flips rapidly
    const webglAddon = new WebglAddon()
    webglAddonRef.current = webglAddon // No check if already loaded
```

**Fix:** Add check inside rAF callback: `if (webglAddonRef.current !== null) return`

### 3. RENDER_MODES Array Could Be Shared (M)

**Location:** `src/renderer/components/settings/theme-selector.tsx` lines 6-10

**Issue:** Render mode definitions hardcoded in UI component. Could be shared constant for consistency with types.

**Note:** Low impact; current approach acceptable for KISS.

---

## Low Priority Suggestions

### 4. Consider Debouncing WebGL Toggle (L)

When switching between terminals rapidly, WebGL addon create/dispose cycles could cause minor GPU overhead. Consider debouncing the toggle effect.

### 5. Default Case in Switch Uses Fallback (L)

**Location:** `src/renderer/hooks/use-terminal.ts` line 43

```typescript
default:
  return isActive // fallback to balanced behavior
```

Type system ensures this won't happen, but exhaustive switch preferred. Consider `satisfies TerminalRenderMode` or type assertion.

---

## Positive Observations

1. **Type Safety:** Proper `TerminalRenderMode` union type with exhaustive switch
2. **Backwards Compatibility:** Settings migration handled with spread `{ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }`
3. **Defensive Coding:** Guards for `disposedRef.current` before WebGL operations
4. **UI Consistency:** RenderModeCard follows existing ModeCard/ThemeCard pattern
5. **KISS:** Simple 3-mode approach instead of complex slider
6. **Performance:** Uses `requestAnimationFrame` for smooth WebGL toggle
7. **Build Success:** TypeScript passes, production build completes

---

## Recommended Actions

1. **[High]** Add settings store subscription to react to `terminalRenderMode` changes
2. **[Medium]** Add null-check inside rAF callback to prevent double WebGL loading
3. **[Low]** Optional: Move RENDER_MODES to shared constants

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript | Pass |
| Build | Pass |
| ESLint | Config issue (pre-existing) |
| Security Issues | 0 |
| Performance Concerns | 1 minor |

---

## Unresolved Questions

1. Should render mode changes apply immediately to all terminals, or only on next focus? (UX decision)
2. Is debouncing worth the added complexity for edge case of rapid terminal switching?
