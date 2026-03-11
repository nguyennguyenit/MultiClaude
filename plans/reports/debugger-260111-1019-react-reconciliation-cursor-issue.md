# React Reconciliation Root Cause: Terminal Cursor Misalignment

**Date**: 2026-01-11
**Issue**: Cursor misalignment when switching between projects running different Claude instances
**Status**: ROOT CAUSE CONFIRMED

---

## Executive Summary

**Confirmed root cause**: The `display: none` optimization in commit 4b4b895 DOES NOT prevent remounting. Terminals are placed in **two separate parent containers** (hidden div vs. visible Panel grid), causing React to unmount/remount terminals on every project switch. This destroys and recreates xterm.js instances, losing cursor position and buffer state.

**Impact**: Every project switch triggers full terminal teardown/recreation, defeating the intended optimization and causing cursor position bugs.

**Fix required**: Consolidate all terminals into single parent container with CSS-based visibility control.

---

## Technical Analysis

### 1. React Reconciliation Rules (Confirmed via React 19 Docs)

**Key Finding**: Keys only preserve component identity **within the same parent's children list**.

When a component with identical `key` moves to a different parent element in the React tree:
1. React **unmounts** from old parent (destroying component instance)
2. React **mounts** fresh in new parent (creating new component instance)
3. All internal state is lost (useState, refs, DOM elements)
4. DOM nodes are destroyed and recreated

This is fundamental React behavior - keys do NOT work across different parents.

### 2. Current Implementation Architecture

**File**: `src/renderer/components/terminal/terminal-grid.tsx`

```tsx
// Lines 124-142: PARENT CONTAINER #1 - Hidden terminals
<div style={{ display: 'none' }} aria-hidden="true">
  {hiddenTerminals.map((terminal) => (
    <TerminalPane key={terminal.id} ... hidden={true} />
  ))}
</div>

// Lines 145-184: PARENT CONTAINER #2 - Visible terminals
<Group orientation="vertical">
  {rows.map(rowTerminals => (
    <Panel>
      {rowTerminals.map(terminal => (
        <TerminalPane key={terminal.id} ... hidden={false} />
      ))}
    </Panel>
  ))}
</Group>
```

**The Fatal Flaw**: Two separate parent containers.

### 3. What Happens on Project Switch

**Scenario**: Switch from Project A (visible) to Project B (hidden)

#### React Reconciliation Steps:
1. **Previous render**: Terminal B in hidden `<div>` container
2. **Next render**: Terminal B needs to appear in visible `<Panel>` grid
3. **React detects**: Same key, but DIFFERENT parent element
4. **React action**:
   - Unmount Terminal B from `<div style={{ display: 'none' }}>`
   - Mount fresh Terminal B in `<Panel>` grid

#### Component Lifecycle:
```
TerminalPane (Terminal B)
  → TerminalView
    → useTerminal hook
      → UNMOUNT EFFECT RUNS (lines 440-484)
        → terminalRef.current?.dispose()
        → xterm instance destroyed
        → Buffer, cursor state, DOM all destroyed

      → MOUNT EFFECT RUNS (lines 49-51)
        → initTerminal() called (lines 100-348)
        → Creates NEW XTerm instance
        → Restores from initialOutput string (line 194)
        → Cursor position NOT preserved
```

### 4. XTerm.js State Loss Details

**File**: `src/renderer/hooks/use-terminal.ts`

#### On Unmount (lines 440-484):
```tsx
useEffect(() => {
  return () => {
    disposedRef.current = true
    // ...
    setTimeout(() => {
      terminal?.dispose()  // ← DESTROYS EVERYTHING
    }, TERMINAL_DISPOSE_DELAY)
  }
}, [])
```

**What dispose() destroys**:
- Terminal buffer (scrollback + active viewport)
- Cursor position (row, col, style)
- Selection state
- All DOM elements
- WebGL context
- Event listeners
- Internal xterm state machine

#### On Remount (lines 100-348):
```tsx
const initTerminal = useCallback(() => {
  const terminal = new XTerm({ ... })  // ← FRESH INSTANCE

  // Line 194: Restore from string dump
  if (initialOutput) {
    terminal.write(initialOutput)  // ← Raw ANSI replay
  }
})
```

**Why cursor position is wrong**:
- `initialOutput` is just a string dump of terminal output
- Writing raw ANSI doesn't preserve cursor absolute position
- Shell prompt might redraw, but internal cursor state is lost
- Relative cursor movements in ANSI codes may accumulate incorrectly

### 5. Previous "Fix" Analysis

**Commit**: 4b4b895 - "fix(terminal): prevent hanging on project switch with CSS visibility hide"

**Intent**: Use `display: none` instead of React unmount to keep xterm mounted

**Implementation**:
- Pass all terminals to TerminalGrid ✓
- Hidden terminals in `display: none` container ✓
- Visible terminals in Panel grid ✓

**Critical Error**: Put hidden and visible terminals in **different parent elements**

**Result**: React still unmounts/remounts due to parent change. Fix didn't work.

### 6. Evidence Trail

#### Smoking Gun: App.tsx Lines 107-112
```tsx
setProjectSwitching(true)
// Allow old terminals to start unmounting  ← CONFIRMS UNMOUNTING!
setActiveProject(id)
// Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
setProjectSwitching(false)
```

**Critical evidence**: Comment "Allow old terminals to start unmounting" proves developers were aware of unmounting behavior but thought it was necessary. The 150ms delay (`TERMINAL_DISPOSE_DELAY + 50`) waits for terminals to fully dispose before completing project switch.

This is THE BUG - terminals should NOT be unmounting at all.

#### Test File Created: `reconciliation-test.html`
- Confirms React behavior with same key, different parents
- Shows unmount → mount cycle in lifecycle logs
- Demonstrates state loss on parent change

#### Git History:
```bash
4b4b895 fix(terminal): prevent hanging on project switch with CSS visibility hide
```

Commit message claims to use CSS hiding, but implementation uses different parents, defeating the optimization.

#### Related Code Comments:
- `terminal-grid.tsx:113` - "Get hidden terminals (other projects) - these stay mounted but hidden"
  - Comment claims terminals stay mounted, but React unmounts them due to parent change
- `terminal-grid.tsx:123` - "Hidden terminals container - keeps terminals mounted but invisible"
  - Intent was correct, implementation was wrong

---

## Architectural Solutions

### Solution 1: Single Parent Container (Recommended)

**Concept**: Keep all terminals in ONE parent, control visibility with CSS

```tsx
<div className="terminal-container">
  {terminals.map(terminal => {
    const isVisible = terminal.projectId === activeProjectId

    return (
      <div
        key={terminal.id}
        style={{
          display: isVisible ? 'block' : 'none',
          // OR: visibility: isVisible ? 'visible' : 'hidden'
        }}
      >
        <TerminalPane
          terminalId={terminal.id}
          hidden={!isVisible}
          ...
        />
      </div>
    )
  })}
</div>
```

**Pros**:
- No remounting (same parent for all terminals)
- xterm.js instances preserved
- Cursor position maintained
- PTY connection stays alive

**Cons**:
- Cannot use react-resizable-panels grid layout for visible terminals
- Would need custom grid layout implementation

### Solution 2: React Portal Pattern

**Concept**: Render hidden terminals via portal to keep them in React tree

```tsx
// Hidden terminals stay in same React tree position
<div className="terminal-storage">
  {hiddenTerminals.map(terminal => (
    <TerminalPane key={terminal.id} ... />
  ))}
</div>

// Visible terminals in grid (sibling to storage)
<Group orientation="vertical">
  {visibleTerminals.map(terminal => (
    <TerminalPane key={terminal.id} ... />
  ))}
</Group>
```

**Pros**:
- Keeps terminals in same React tree level (siblings)
- May preserve component identity

**Cons**:
- Still different immediate parents - React may still remount
- More complex implementation

### Solution 3: Lazy Grid Rendering

**Concept**: Render ALL terminals in grid, hide inactive rows/cols with CSS

```tsx
<Group orientation="vertical">
  {allTerminalsGroupedByProject.map(projectGroup => (
    <div
      key={projectGroup.projectId}
      style={{ display: projectGroup.isActive ? 'flex' : 'none' }}
    >
      <Panel>
        {projectGroup.terminals.map(terminal => (
          <TerminalPane key={terminal.id} ... />
        ))}
      </Panel>
    </div>
  ))}
</Group>
```

**Pros**:
- All terminals in same parent hierarchy (Group)
- Preserves grid layout
- No remounting on project switch

**Cons**:
- Renders all project grids upfront
- May impact initial load performance
- Complexity in grid calculations

---

## Recommended Fix: Solution 3 (Lazy Grid Rendering)

**Implementation steps**:

1. Restructure TerminalGrid to render all projects
2. Group terminals by projectId
3. Render each project's grid, hide inactive with `display: none`
4. Keep terminals in stable parent hierarchy

**Code changes required**:
- `src/renderer/components/terminal/terminal-grid.tsx`: Restructure rendering logic
- `src/renderer/App.tsx`: No changes needed (already passes all terminals)

**Testing**:
1. Create 2 projects with terminals
2. Switch between projects
3. Verify terminals stay mounted (no dispose logs)
4. Verify cursor position preserved
5. Check PTY connections stay alive

---

## Unresolved Questions

1. **Memory impact**: How many project grids can be reasonably kept mounted?
2. **WebGL resources**: Current code disables WebGL for hidden terminals - verify this still works
3. **Resize handling**: Do hidden terminals need size updates when window resizes?
4. **Performance**: Impact of rendering all project grids vs. current selective rendering?

---

## References

- React Docs: [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- React 19 Blog: [Official Release](https://react.dev/blog/2024/04/25/react-19)
- GitHub: [State preservation during reparenting](https://github.com/facebook/react/issues/13603)
- MultiClaude commit: `4b4b895` - Previous fix attempt
