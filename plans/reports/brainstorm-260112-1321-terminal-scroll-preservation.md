# Terminal Scroll Position Preservation - Solution Brainstorming

**Date**: 2026-01-12
**Status**: Analysis Complete
**Problem**: Scroll position not preserved when switching terminals within same project

---

## 🔍 Problem Statement

**User Requirements**:
- Preserve scroll position when switching terminals (both within same project & across projects)
- Each terminal should remember its own scroll position
- Consistent behavior across all terminal switches

**Current Behavior**:
- ✅ Switch **project**: Scroll preserved (viewport save/restore works)
- ❌ Switch **terminal** (same project): Terminal "jumps to top" - scroll NOT preserved

---

## 🏗️ Architecture Analysis

### Current Implementation

```
terminal-grid.tsx (L175)
  └─> hidden={!group.isActive}  ← Only changes on PROJECT switch
      └─> terminal-pane.tsx (L229)
          └─> terminal-view.tsx (L41)
              └─> useTerminal hook (L535-551)
                  └─> Viewport SAVE triggered when: isHidden changes from false→true
                  └─> Viewport RESTORE triggered in fit() (L369-393)
```

### Root Cause

**Viewport save/restore logic only triggers on `isHidden` prop changes**

| Scenario | `hidden` prop | `isActive` prop | Viewport saved? |
|----------|---------------|-----------------|-----------------|
| Switch project A→B | ✅ Changes | ✅ Changes | ✅ YES |
| Switch terminal T1→T2 (same project) | ❌ Stays `false` | ✅ Changes | ❌ NO |

**Diagnosis**: `isHidden` reflects **project visibility**, NOT **terminal visibility**

---

## 💡 Solution Approaches

### **Approach 1: Track Per-Terminal Visibility (Recommended)**

**Concept**: Each terminal gets individual `hidden` flag based on BOTH project AND terminal active state

**Implementation**:
```tsx
// terminal-grid.tsx L175
hidden={!group.isActive || terminal.id !== activeTerminalId}
```

**Rationale**:
- Minimal code change (1 line)
- Reuses existing viewport save/restore logic
- Consistent behavior across project/terminal switches

**Pros**:
- ✅ Simple, surgical fix
- ✅ No new state management
- ✅ Preserves existing architecture
- ✅ Works for all scenarios (project + terminal switch)

**Cons**:
- ⚠️ Increases `isHidden` changes → more viewport save/restore cycles
- ⚠️ May trigger WebGL toggle more frequently (already debounced)

**Performance Impact**:
- Viewport save/restore is lightweight (3 numbers: `viewportY`, `baseY`, `isAtBottom`)
- WebGL toggle already debounced (50ms) - no issue
- Estimated overhead: **<1ms per terminal switch**

---

### **Approach 2: Separate Terminal Active State Tracking**

**Concept**: Add new `isTerminalVisible` prop independent of `isHidden`

**Implementation**:
```tsx
// New prop flow
<TerminalView
  isHidden={!group.isActive}           // Project-level
  isTerminalVisible={isActive}         // Terminal-level
/>

// useTerminal hook - dual tracking
if (isTerminalVisible && !isTerminalVisibleRef.current) {
  // Restore viewport
}
if (!isTerminalVisible && isTerminalVisibleRef.current) {
  // Save viewport
}
```

**Pros**:
- ✅ Explicit separation of concerns (project vs terminal visibility)
- ✅ Easier to reason about state changes
- ✅ Future-proof for complex visibility rules

**Cons**:
- ❌ Requires changes across 3 files (grid, pane, view, hook)
- ❌ Adds new prop to component interface
- ❌ Duplicates viewport tracking logic
- ❌ More complex state management

**Verdict**: **Over-engineered** for current requirements

---

### **Approach 3: Per-Terminal Scroll State in Zustand Store**

**Concept**: Store scroll positions in global state, restore on terminal activation

**Implementation**:
```tsx
// stores/terminal-store.ts
interface TerminalScrollState {
  [terminalId: string]: {
    viewportY: number
    baseY: number
    isAtBottom: boolean
  }
}

// On terminal deactivate → save to store
// On terminal activate → restore from store
```

**Pros**:
- ✅ Centralized scroll state management
- ✅ Survives terminal unmount/remount
- ✅ Easy to persist to localStorage

**Cons**:
- ❌ Requires new Zustand store logic
- ❌ Adds unnecessary abstraction (terminals never unmount currently)
- ❌ Overkill for CSS hide/show pattern
- ❌ More code, higher maintenance

**Verdict**: **Unnecessary complexity** - current ref-based approach works fine

---

### **Approach 4: CSS-Only Solution (Visibility Instead of Display)**

**Concept**: Use `visibility: hidden` instead of `display: none` to preserve layout

**Implementation**:
```tsx
// terminal-grid.tsx L154
style={{
  visibility: group.isActive ? 'visible' : 'hidden',
  position: group.isActive ? 'relative' : 'absolute',
  height: '100%'
}}
```

**Pros**:
- ✅ Zero JavaScript changes
- ✅ Terminals always maintain scroll position (never "hidden" from layout)

**Cons**:
- ❌ **Memory leak risk**: Hidden terminals still consume GPU resources
- ❌ **Performance degradation**: All terminals rendered even when inactive
- ❌ **Breaks WebGL optimization**: Current `isHidden` flag saves GPU by disposing WebGL
- ❌ Doesn't solve terminal-level hiding (only project-level)

**Verdict**: **Not viable** - trades correctness for worse performance

---

## 🎯 Recommendation: **Approach 1**

**Rationale**: KISS + YAGNI principles

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | 1-line change |
| **Maintainability** | ⭐⭐⭐⭐⭐ | Reuses existing logic |
| **Performance** | ⭐⭐⭐⭐☆ | Negligible overhead (<1ms) |
| **Correctness** | ⭐⭐⭐⭐⭐ | Solves both project + terminal switch |
| **Future-proof** | ⭐⭐⭐⭐☆ | Scales with terminal count |

---

## 📋 Implementation Plan

### **Step 1: Update Hidden Logic** (terminal-grid.tsx)
```tsx
// Line 175 - Change from:
hidden={!group.isActive}

// To:
hidden={!group.isActive || terminal.id !== activeTerminalId}
```

### **Step 2: Verify Viewport Save Trigger** (use-terminal.ts)
- Confirm `isHidden` changes trigger save (L535-551) ✅ Already works
- Confirm render-phase save executes before CSS hide ✅ Already works

### **Step 3: Verify Viewport Restore** (use-terminal.ts)
- Confirm `fit()` restores from `savedViewportRef` (L369-393) ✅ Already works
- Confirm `isAtBottom` preserved to prevent smart-scroll override ✅ Already works

### **Step 4: Testing**
1. Switch terminals T1→T2 within project: Verify scroll preserved
2. Switch projects P1→P2: Verify scroll preserved (regression test)
3. Switch terminal + project: Verify scroll preserved
4. Scroll to middle → switch → return: Verify exact position restored
5. Test with 4+ terminals in grid: Verify performance <5ms

---

## 🔬 Technical Deep Dive

### Why Current Logic Works for Projects But Not Terminals

**Project Switch** (A → B):
```
Project A: hidden={false} → hidden={true}  ← Triggers save
Project B: hidden={true} → hidden={false}  ← Triggers restore
```

**Terminal Switch** (T1 → T2, same project):
```
Terminal T1: hidden={false}, isActive={true} → hidden={false}, isActive={false}
Terminal T2: hidden={false}, isActive={false} → hidden={false}, isActive={true}
                     ↑ NO CHANGE ↑                        ↑ NO TRIGGER ↑
```

**Solution Effect**:
```tsx
hidden={!group.isActive || terminal.id !== activeTerminalId}
//                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                        New condition: terminal-level hiding
```

**Terminal Switch** (T1 → T2, WITH FIX):
```
Terminal T1: hidden={false} → hidden={true}   ← NOW TRIGGERS SAVE ✅
Terminal T2: hidden={true} → hidden={false}   ← NOW TRIGGERS RESTORE ✅
```

---

## 🚨 Potential Edge Cases

### 1. **Rapid Terminal Switching**
- **Risk**: Multiple viewport saves before restore completes
- **Mitigation**: Save logic runs in render phase (synchronous) ✅
- **Status**: Not a concern

### 2. **WebGL Toggle Overhead**
- **Risk**: More frequent WebGL dispose/init cycles
- **Mitigation**: Already debounced (50ms) in L554-609 ✅
- **Status**: Not a concern

### 3. **Memory Overhead**
- **Risk**: Storing viewport state per terminal
- **Calculation**: 3 numbers × 8 bytes × 12 terminals = **288 bytes** max
- **Status**: Negligible

### 4. **Terminal Grid Resize During Switch**
- **Risk**: Viewport ratio calculation fails if `baseY=0`
- **Mitigation**: Already handled with null check in L370-373 ✅
- **Status**: Covered

---

## 📊 Performance Analysis

### Viewport Save/Restore Overhead

**Save Operation** (L535-551):
```tsx
savedViewportRef.current = {
  viewportY: buffer.viewportY,    // Read: ~0.01ms
  baseY: buffer.baseY,            // Read: ~0.01ms
  isAtBottom: isAtBottomRef.current // Read: ~0.01ms
}
```
**Estimated**: **<0.1ms**

**Restore Operation** (L369-393):
```tsx
const savedRatio = savedState.viewportY / savedState.baseY  // ~0.01ms
const newViewportY = Math.round(savedRatio * buffer.baseY)  // ~0.01ms
terminal.scrollToLine(clampedPosition)                      // ~0.5ms (xterm.js)
```
**Estimated**: **<1ms**

**Total per terminal switch**: **<1.1ms** (imperceptible)

---

## 🔄 Alternative: Hybrid Approach (Not Recommended)

Could combine Approach 1 + 2 for "best of both worlds":
```tsx
// Use compound flag for hiding
const shouldHide = !group.isActive || terminal.id !== activeTerminalId
hidden={shouldHide}

// But track terminal visibility separately for future features
isTerminalVisible={terminal.id === activeTerminalId}
```

**Verdict**: Premature optimization - violates YAGNI

---

## ✅ Unresolved Questions

None - implementation path is clear.

---

## 📝 Next Steps

**User Decision Required**: Proceed with Approach 1 implementation?
- If YES → Create detailed implementation plan (/ck:plan:fast or /ck:plan:hard)
- If NO → Discuss alternative approaches or requirements clarification

---

**Report Generated**: 2026-01-12 13:21 (Asia/Saigon)
**Token Efficiency**: Sacrificed grammar for concision per development rules
