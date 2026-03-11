# Documentation Update Report: Terminal Scroll Position Preservation Fix

**Date**: 2026-01-12
**Plan Phase**: Terminal Scroll Position Preservation Fix
**Severity**: Minor (architectural clarification)
**Status**: Complete

## Summary

Updated documentation to reflect new terminal viewport preservation pattern that prevents scroll position loss when switching between terminals within the same project. Implementation uses render-phase save and ratio-based restore mechanism.

## Changes Made

### 1. `docs/codebase-summary.md`

**Added**: Viewport Preservation subsection under Terminal Management (lines 59-67)

Details:
- Save trigger: Render phase when `isHidden` transitions false → true
- Save mechanism: Captures `viewportY`, `baseY`, `isAtBottom` to `savedViewportRef`
- Restore trigger: After fit() called during terminal show
- Restore algorithm: Ratio-based positioning with clamping
- isAtBottom tracking: Preserved to prevent smart-scroll override
- Thread safety: Render-phase capture ensures timing before CSS update

**Why Significant**: Establishes formal architecture pattern for viewport state preservation, critical for understanding terminal lifecycle in multi-terminal scenarios.

### 2. `docs/system-architecture.md`

**Updated**: Terminal Lifecycle section (added lines 159-168)

New subsection "Viewport Scroll Position Preservation" documents:
- **Save Phase** (Render): Synchronous buffer state capture
- **Hide Phase** (DOM): CSS display:none applied
- **Show Phase** (Fit): Ratio-based proportional restoration
- **Clamping**: Handles buffer growth/shrinkage
- **Benefit**: Seamless switching without scroll jump

**Why Significant**: Terminal lifecycle is core architectural component; viewport preservation is essential behavior affecting UX in multi-project workflows.

## Technical Context

### Implementation Details Captured

```
savedViewportRef: { viewportY, baseY, isAtBottom } | null

Render Phase Save:
  if (isHidden && !wasHidden) {
    savedViewportRef = { viewportY, baseY, isAtBottom }
  }

Restore Phase:
  savedRatio = savedViewportY / savedBaseY
  newViewportY = round(savedRatio * newBaseY)
  clampedPosition = max(0, min(newViewportY, baseY))
  terminal.scrollToLine(clampedPosition)
```

### Why This Pattern Matters

1. **Preserve User Context**: Scrollback position restoration during terminal switching
2. **Smart Scroll Interaction**: isAtBottom flag prevents auto-scroll from fighting restore
3. **Render Phase Timing**: Synchronous capture before DOM visibility change
4. **Proportional Restoration**: Handles dynamic buffer size changes during hide period

### Code References

- **Capture**: `src/renderer/hooks/use-terminal.ts` lines 535-551 (render phase)
- **Restore**: `src/renderer/hooks/use-terminal.ts` lines 362-398 (fit callback)
- **JSDoc**: `src/renderer/components/terminal/terminal-grid.tsx` lines 171-176 (hidden prop usage)

## File Sizes

| File | Before | After | Status |
|------|--------|-------|--------|
| `docs/codebase-summary.md` | 645 LOC | 671 LOC | ✓ Under 800 LOC limit |
| `docs/system-architecture.md` | 361 LOC | 376 LOC | ✓ Under 800 LOC limit |

## Architectural Significance

**Pattern Classification**: Terminal State Management > Viewport Preservation

This fix solidifies the **Single-Parent Lifecycle Pattern** (Phase 1 of Terminal Cursor Fix) by formally documenting how viewport state persists across terminal visibility transitions. Essential for understanding:

- Multi-terminal user experience
- React reconciliation prevention
- xterm.js state persistence patterns
- Scroll position as part of terminal state identity

## Verification

- ✓ Code references verified in implementation files
- ✓ Variable names (viewportY, baseY, savedViewportRef) confirmed in actual code
- ✓ JSDoc comment in terminal-grid.tsx matches implementation
- ✓ Render-phase timing documented accurately
- ✓ Math operations (ratio, clamping) verified

## Gaps Identified

None. Documentation updates comprehensively cover the viewport preservation pattern with sufficient technical detail for developers to:
- Understand the why (preserve scroll context)
- Understand the when (render save, fit restore)
- Understand the how (proportional restoration with clamping)
- Locate implementation details in source code

## Recommendations

1. **Consider**: Add viewport preservation to TERMINAL_MANAGEMENT_PATTERNS.md if created for advanced patterns reference
2. **Monitor**: If buffer dynamics change (e.g., max buffer size limits), may need to update clamping logic documentation
3. **Future**: When terminal layout persistence becomes persistent across app restarts, may need to serialize savedViewportRef

## Related Issues/Plans

- Phase 1: Terminal Cursor Position Fix (completed)
- Dependency: Single-Parent Pattern (required for this fix to work)
- Related: Smart Scroll behavior documentation (already exists)

---

**Prepared by**: Docs Manager
**Verification**: Technical accuracy verified against source code
**Ready for**: Production documentation
