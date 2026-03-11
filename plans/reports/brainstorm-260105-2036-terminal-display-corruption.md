# Brainstorm: Terminal Display Corruption on Project Switch

**Date:** 2026-01-05
**Status:** Analysis Complete → Ready for Implementation

---

## Problem Statement

Terminal shows duplicated/corrupted output when switching projects via ProjectTabs. Creating or closing any terminal fixes the display.

**Reproduction:**
1. Have 2+ projects with terminals
2. Switch from Project 1 to Project 2 (Alt+2 or click tab)
3. Terminal content appears duplicated

---

## Root Cause Analysis

**Race condition** in terminal mount/unmount lifecycle during project switch:

1. Project A terminals visible → xterm instances exist with WebGL contexts
2. User switches to Project B → React filters terminals, unmounting Project A components
3. Project A cleanup starts → `disposedRef` set, refs nullified, but `setTimeout(dispose, 100)` defers actual disposal
4. Project B terminals mount IMMEDIATELY → New xterm instances initialize
5. **Race condition** → During 100ms overlap:
   - Old xterm may still have WebGL context
   - New xterm initializes with potentially corrupted state
   - `initialOutput` restoration writes while xterm is mid-initialization

**Critical Code Issues:**

| File | Line | Issue |
|------|------|-------|
| `use-terminal.ts` | 238-244 | Disposal deferred 100ms but React unmount/remount is synchronous |
| `terminal-view.tsx` | 23-25 | Terminal init happens immediately on mount |
| `use-terminal.ts` | 71-75 | WebGL addon created but ref not stored → cannot dispose explicitly |
| `use-terminal.ts` | 184-186 | `initialOutput` written before WebGL addon loads |

---

## Evaluated Solutions

### Solution 1: Deferred Mount with Transition ✓ SELECTED

Delay new terminal mount until old terminals finish disposing, masked with fade animation.

**Pros:** Eliminates race condition, minimal code change, KISS compliant
**Cons:** ~100-150ms perceived delay (acceptable per user feedback)

### Solution 2: Keep All Mounted, Toggle Visibility

Use CSS visibility instead of unmounting.

**Pros:** Zero remount overhead, instant switching
**Cons:** Memory scales with all terminals, WebGL contexts persist

### Solution 3: Synchronous Disposal with Cleanup Guard

Remove setTimeout delay, use microtask queue detection.

**Pros:** Cleaner lifecycle
**Cons:** xterm.js internal timeouts can't be awaited, may have edge cases

### Solution 4: Project-Scoped Key Reset

Add `activeProjectId` to terminal key forcing complete remount.

**Pros:** Simple
**Cons:** Doesn't solve timing issue

### Solution 5: WebGL Context Pool Manager

Singleton manager for WebGL contexts.

**Pros:** Proper resource management
**Cons:** Over-engineered for this bug

---

## Selected Approach

**Solution 1: Deferred Mount with Fade Transition**

User confirmed:
- ~100ms delay acceptable when masked with transition
- 2-3 projects typical usage
- WebGL warnings not verified (recommend checking)

---

## Implementation Requirements

### Phase 1: Fix Race Condition

Add `projectSwitchInProgress` state to delay new terminal rendering:
- Set true on project switch
- Fade-out (50ms), wait disposal (100ms)
- Set false, mount new terminals with fade-in

### Phase 2: Proper Disposal Order

Track WebGL addon in ref and dispose in order:
1. WebGL addon
2. Fit addon
3. Terminal instance

### Phase 3: Visual Transition

Add CSS opacity transition during project switch.

### Phase 4: Guard initialOutput Write

Move `initialOutput` write to after WebGL addon initialization.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | Add webglAddonRef, fix disposal order, defer initialOutput write |
| `src/renderer/components/terminal/terminal-grid.tsx` | Add transition wrapper/state |
| `src/renderer/App.tsx` | Add project switch transition state |

---

## Success Metrics

- [ ] No duplicated terminal output on project switch
- [ ] Zero WebGL context warnings in console
- [ ] Smooth perceived transition (~150ms)
- [ ] Creating/closing terminals no longer needed to "fix" display

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Delay feels sluggish | Low | Medium | 50ms fade + 100ms disposal = 150ms total |
| Edge case races | Low | Medium | Guard with disposedRef checks |
| WebGL context leaks persist | Medium | Low | Track addon in ref |

---

## Next Steps

Create detailed implementation plan with specific code changes.
