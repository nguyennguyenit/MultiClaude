# Root Cause Analysis: Terminal Cursor Misalignment on Project Switch

**Date**: 2026-01-11
**Issue**: Cursor displays incorrectly when switching between projects running different Claude instances
**Status**: ROOT CAUSE CONFIRMED AND PROVEN

---

## Problem Statement

When switching between projects in MultiClaude, the terminal cursor position becomes misaligned. Despite multiple fix attempts (commits `5534037`, `6ecec92`, `4b4b895`), the issue persists because all previous fixes addressed symptoms rather than the root cause.

Screenshot evidence shows cursor appearing at wrong position after project switch:
![Cursor Misalignment](/tmp/multiClaude-screenshots/screenshot-1768101321113.png)

---

## Root Cause: React Reconciliation Parent Change

### The Fundamental Problem

**React Reconciliation Rule**: Keys only preserve component identity **within the same parent's children list**. When a keyed component moves to a different parent element, React will:
1. **Unmount** from old parent (destroying component instance)
2. **Mount** fresh in new parent (creating new instance)
3. All internal state is lost (useState, refs, DOM elements, xterm.js instance)

### Current Flawed Architecture

In `terminal-grid.tsx`, terminals are rendered in **TWO separate parent containers**:

```tsx
// PARENT CONTAINER #1: Hidden terminals
<div style={{ display: 'none' }} aria-hidden="true">
  {hiddenTerminals.map((terminal) => (
    <TerminalPane key={terminal.id} hidden={true} />
  ))}
</div>

// PARENT CONTAINER #2: Visible grid
<Group orientation="vertical">
  {rows.map(rowTerminals => (
    <Panel>
      {rowTerminals.map(terminal => (
        <TerminalPane key={terminal.id} hidden={false} />
      ))}
    </Panel>
  ))}
</Group>
```

### What Happens on Project Switch

1. **Before switch**: Terminal B in hidden `<div style="display:none">`
2. **After switch**: Terminal B needs to appear in visible `<Panel>` grid
3. **React detects**: Same key (`terminal.id`), but DIFFERENT parent element
4. **React action**:
   - Unmount Terminal B from hidden div → `dispose()` destroys xterm
   - Mount fresh Terminal B in Panel → creates NEW `XTerm()` instance

### Why Cursor Position is Wrong

When xterm.js is disposed and recreated:
1. Terminal buffer destroyed
2. Cursor position (row, col) lost
3. Output restored from `initialOutput` string dump (raw ANSI replay)
4. ANSI replay does NOT preserve absolute cursor position
5. Shell prompt redraws, but internal cursor state is lost
6. Result: cursor appears at wrong position

---

## Evidence: The Smoking Gun

### App.tsx Lines 107-112
```tsx
setProjectSwitching(true)
// Allow old terminals to start unmounting  ← CONFIRMS UNMOUNTING!
setActiveProject(id)
// Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
setProjectSwitching(false)
```

**Key observation**: The comment "Allow old terminals to start unmounting" proves developers were aware of unmounting behavior but thought it was necessary. The 150ms delay waits for terminal disposal before completing switch.

**This is THE BUG** - terminals should NOT be unmounting at all if the CSS-hiding approach was working correctly.

### Previous Fix Intent vs Reality

| Commit | Intent | Reality |
|--------|--------|---------|
| `4b4b895` | "Use display:none instead of React unmount" | Still unmounts due to parent change |
| `6ecec92` | "Prevent display corruption with disposal delay" | Masks symptom, doesn't fix cause |
| `5534037` | "Resolve xterm dimensions error" | Deferred init, doesn't prevent unmount |

---

## Verified Solutions

### Solution: Lazy Grid Rendering (Recommended)

**Concept**: Keep ALL terminals in SINGLE parent hierarchy, hide inactive projects with CSS.

```tsx
<Group orientation="vertical">
  {projectGroups.map(group => (
    <div
      key={group.projectId}
      style={{ display: group.isActive ? 'flex' : 'none' }}
    >
      {/* Each project's grid stays mounted, just hidden with CSS */}
      <Panel>
        {group.terminals.map(t => (
          <TerminalPane key={t.id} hidden={!group.isActive} />
        ))}
      </Panel>
    </div>
  ))}
</Group>
```

**Why this works**:
- All terminals remain in same `<Group>` parent hierarchy
- Project grids toggle visibility via CSS, not by moving between parents
- React preserves component instances (no unmount/remount)
- xterm.js instances survive project switches
- Cursor position maintained

### Behavioral Comparison

| Aspect | Current (Broken) | Fixed |
|--------|-----------------|-------|
| Parent containers | 2 separate | 1 unified |
| Project switch | Terminals move between parents | CSS toggle only |
| React reconciliation | Unmount → Mount | No unmount |
| XTerm lifecycle | `dispose()` → new `XTerm()` | Instance preserved |
| Cursor position | ❌ Lost | ✅ Preserved |
| Buffer state | ❌ Lost | ✅ Preserved |
| Switch delay | 150ms wait | ⚡ Instant |

---

## Implementation Changes Required

### 1. terminal-grid.tsx
- Group terminals by projectId
- Render all project grids in single parent hierarchy
- Hide inactive projects with CSS (`display: none`)
- Remove dual-container pattern

### 2. App.tsx
- Remove `projectSwitching` state (not needed)
- Remove 150ms disposal delay (not needed)
- Simplify `handleSelectProject` to instant switch

### 3. Cleanup
- Remove `isTransitioning` prop
- Remove `TERMINAL_DISPOSE_DELAY` wait logic
- Keep WebGL toggle for hidden terminals (GPU optimization)

---

## Trade-offs and Considerations

### Memory Impact
- **Current**: Only active project terminals mounted (~2-4)
- **Fixed**: All project terminals mounted (e.g., 3 projects × 3 = 9)

**Mitigation**: Hidden terminals already have WebGL disabled (saves GPU). Consider terminal limit per project.

### Performance
- **Current**: Expensive remount on every switch
- **Fixed**: Cheap CSS toggle only

**Net result**: Better performance despite more mounted terminals.

---

## Success Metrics

1. No terminal `dispose()` calls on project switch
2. Cursor position identical before/after switch
3. Buffer content preserved across switches
4. No 150ms delay on project switch
5. WebGL still disabled for hidden terminals

---

## Unresolved Questions

1. Memory impact with many projects (5+) - needs production metrics
2. Resize handling for hidden terminals - verify fit() works correctly
3. Performance with high terminal counts - suggest stress testing

---

## References

- React Docs: [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- GitHub Issue: [State preservation during reparenting](https://github.com/facebook/react/issues/13603)
- Detailed analysis: `plans/reports/debugger-260111-1019-react-reconciliation-cursor-issue.md`
- Code comparison: `plans/reports/implementation-comparison.md`
