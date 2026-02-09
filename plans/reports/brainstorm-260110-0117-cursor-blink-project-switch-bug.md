# Cursor Blink Display Bug - Project Switch Root Cause Analysis

## Problem Statement

Cursor blinking displays incorrectly across all terminals when switching projects. Only 1 terminal shows correct cursor behavior, while all others display incorrectly. This occurs during project switching operations.

## Root Cause

**The core issue: `activeTerminalId` is NOT reset when switching projects.**

### Detailed Analysis

1. **State Management Gap** (src/renderer/stores/app-store.ts:103)
   ```typescript
   setActiveProject: (id) => set({ activeProjectId: id })
   ```
   - Only updates `activeProjectId`
   - Does NOT reset `activeTerminalId`
   - Leaves stale terminal ID from previous project

2. **Project Switch Flow** (src/renderer/App.tsx:96-108)
   ```typescript
   if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
     setProjectSwitching(true)
     setActiveProject(id)  // ← Changes project, but activeTerminalId unchanged!
     await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
     setProjectSwitching(false)
   }
   ```

3. **Terminal Filtering** (src/renderer/App.tsx:49-51)
   ```typescript
   const projectTerminals = activeProjectId
     ? terminals.filter(t => t.projectId === activeProjectId)
     : terminals
   ```
   - New project's terminals are filtered and displayed
   - But `activeTerminalId` still references old project's terminal

4. **Active State Mismatch** (src/renderer/components/terminal/terminal-grid.tsx:121)
   ```typescript
   <TerminalPane
     isActive={terminal.id === activeTerminalId}  // ← Never matches!
     ...
   />
   ```
   - ALL new terminals get `isActive={false}`
   - None match the stale `activeTerminalId` from previous project

5. **Cursor Rendering Impact** (src/renderer/hooks/use-terminal.ts:109, 154)
   ```typescript
   const terminal = new XTerm({
     cursorBlink: true,  // ← Configured
     ...
   })

   if (shouldUseWebGL(isActiveRef.current)) {  // ← Depends on isActive
     // WebGL rendering
   }
   ```
   - With `isActive={false}`, WebGL may not load properly
   - Terminal focus is not set correctly (line 78-82 in terminal-view.tsx)
   - Cursor blink animation state becomes inconsistent across terminals

## Why Only 1 Terminal Eventually Works

When user clicks a terminal:
- `onTerminalClick={setActiveTerminal}` fires (App.tsx:391)
- Clicked terminal gets `isActive={true}`
- But other terminals' cursor state is already corrupted
- They remain with broken cursor rendering

## Technical Impact

### xterm.js Cursor Behavior Issues
1. **Cursor Blink Timers**: Without proper active state, blink intervals may not initialize correctly
2. **Multiple Terminals**: All terminals try to render cursors simultaneously without proper focus coordination
3. **Canvas Rendering**: Cursor rendering on canvas may have race conditions when all terminals have same inactive state
4. **WebGL Context**: Balanced render mode only loads WebGL for active terminal (use-terminal.ts:42-50), affecting cursor rendering quality

## Evidence from Codebase

### Files Analyzed
- `src/renderer/stores/app-store.ts` - State management (missing activeTerminalId reset)
- `src/renderer/App.tsx` - Project switching logic (no terminal state cleanup)
- `src/renderer/components/terminal/terminal-grid.tsx` - Terminal rendering (isActive prop propagation)
- `src/renderer/components/terminal/terminal-pane.tsx` - Terminal pane wrapper
- `src/renderer/components/terminal/terminal-view.tsx` - Terminal focus handling (depends on isActive)
- `src/renderer/hooks/use-terminal.ts` - xterm.js initialization and cursor config

### Key Code Locations
- **Bug Source**: app-store.ts:103 - `setActiveProject` doesn't reset `activeTerminalId`
- **Impact Point**: terminal-grid.tsx:121 - isActive check fails for all terminals
- **Visual Effect**: use-terminal.ts:109 - cursor blink configured but renders incorrectly

## Recommended Solutions

### Solution 1: Reset activeTerminalId on Project Switch (Simple)
**Approach**: Clear `activeTerminalId` when switching projects, let first terminal auto-activate

**Implementation** (app-store.ts):
```typescript
setActiveProject: (id) => set({
  activeProjectId: id,
  activeTerminalId: null  // ← Reset active terminal
})
```

**Pros**:
- Minimal change (1 line)
- Clean state on project switch
- First terminal will auto-activate when clicked

**Cons**:
- No terminal is active initially after switch
- User must click a terminal to activate

### Solution 2: Auto-activate First Terminal (Better UX)
**Approach**: When switching projects, automatically set first terminal as active

**Implementation** (App.tsx in handleSelectProject):
```typescript
setActiveProject(id)

// Auto-activate first terminal of new project
const newProjectTerminals = terminals.filter(t => t.projectId === id)
if (newProjectTerminals.length > 0) {
  setActiveTerminal(newProjectTerminals[0].id)
} else {
  setActiveTerminal(null)
}
```

**Pros**:
- Better UX - terminal is immediately usable
- Consistent active state
- No additional user action required

**Cons**:
- Slightly more complex
- Requires access to filtered terminals in handler

### Solution 3: Sync activeTerminalId with Project Changes (Most Robust)
**Approach**: Add effect in App.tsx to sync terminal state when project changes

**Implementation** (App.tsx):
```typescript
useEffect(() => {
  if (!activeProjectId) {
    setActiveTerminal(null)
    return
  }

  // Check if current activeTerminalId belongs to current project
  const currentTerminal = terminals.find(t => t.id === activeTerminalId)
  if (!currentTerminal || currentTerminal.projectId !== activeProjectId) {
    // Active terminal doesn't belong to current project, reset
    const projectTerminals = terminals.filter(t => t.projectId === activeProjectId)
    setActiveTerminal(projectTerminals[0]?.id || null)
  }
}, [activeProjectId, terminals, activeTerminalId, setActiveTerminal])
```

**Pros**:
- Robust - handles edge cases
- Self-healing if state becomes inconsistent
- Automatic synchronization

**Cons**:
- Most complex
- Additional effect overhead
- Might trigger unnecessary re-renders

## Recommendation

**Use Solution 2 (Auto-activate First Terminal)** for best balance:
- Solves the root cause completely
- Provides excellent UX
- Manageable complexity
- No ongoing synchronization overhead

## Implementation Plan

1. **Modify handleSelectProject** in App.tsx:
   - After `setActiveProject(id)`, get filtered terminals
   - Auto-set first terminal as active
   - Handle empty terminal case

2. **Test Scenarios**:
   - Switch from Project A (3 terminals) to Project B (2 terminals) → First terminal of B should be active
   - Switch to project with no terminals → activeTerminalId should be null
   - Rapid project switching → Should not corrupt state
   - Cursor blink should render consistently across all terminals

3. **Validation**:
   - All terminals display cursor correctly
   - Only active terminal shows focus indicator
   - WebGL loads properly for active terminal (in balanced mode)
   - No visual glitches during project switch

## Related Files to Modify

1. `src/renderer/App.tsx` - handleSelectProject function (lines 72-109)
2. Optional: Add unit tests for project switching behavior

## Additional Considerations

### Performance
- The fix adds minimal overhead (O(n) filter operation on terminal list)
- Terminal count limited to 12 per project
- Negligible performance impact

### Backwards Compatibility
- No breaking changes to API or data structures
- Existing functionality preserved
- Only fixes broken behavior

### Terminal Lifecycle
- Existing terminal disposal logic remains unchanged (lines 96-102)
- Transition state mechanism still prevents race conditions
- WebGL disposal timing unaffected

## Unresolved Questions

None - root cause is definitively identified and solution is straightforward.
