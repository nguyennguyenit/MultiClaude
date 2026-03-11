# Phase 1: Modify handleSelectProject Function

## Context

- **Plan**: `plans/260110-0132-cursor-blink-fix/plan.md`
- **Root Cause Report**: `plans/reports/brainstorm-260110-0117-cursor-blink-project-switch-bug.md`
- **Evidence**: `plans/reports/proof-260110-0127-cursor-blink-root-cause-evidence.md`
- **Codebase**: `docs/codebase-summary.md`, `docs/system-architecture.md`
- **Standards**: `docs/code-standards.md`

## Overview

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-10 |
| Description | Auto-activate first terminal when switching projects |
| Priority | P1 |
| Status | done |
| Effort | 1h |

## Key Insights (from Root Cause Analysis)

1. `setActiveProject(id)` only updates `activeProjectId`, NOT `activeTerminalId`
2. After switch, `activeTerminalId` still references old project's terminal
3. NO terminal in new project matches old ID → ALL get `isActive={false}`
4. `terminal-view.tsx:76-82`: focus() only called when `isActive={true}`
5. xterm.js design: cursor ONLY blinks when terminal is focused

## Requirements

1. After `setActiveProject(id)`, auto-select first terminal of new project
2. Handle empty project case (no terminals) → set `activeTerminalId=null`
3. Maintain existing transition logic (projectSwitching state)
4. Keep disposal delay intact
5. No debug logs in final code

## Architecture

### Current State Flow (Buggy)

```
handleSelectProject(id)
    → setActiveProject(id)        // projectId changes
    → activeTerminalId unchanged  // BUG: stale reference
    → ALL terminals: isActive=false
    → focus() never called
```

### Fixed State Flow

```
handleSelectProject(id)
    → setActiveProject(id)
    → Get filtered terminals for new project
    → setActiveTerminal(firstTerminal?.id || null)  // FIX
    → First terminal: isActive=true
    → focus() called automatically
```

## Related Code Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/renderer/App.tsx` | 72-109 | handleSelectProject function |
| `src/renderer/App.tsx` | 49-51 | projectTerminals filtering logic |
| `src/renderer/stores/app-store.ts` | 65 | setActiveTerminal action |
| `src/renderer/components/terminal/terminal-view.tsx` | 76-82 | focus() effect |

## Implementation Steps

### Step 1: Locate handleSelectProject

**File**: `src/renderer/App.tsx`
**Lines**: 72-109

Current implementation:
```typescript
const handleSelectProject = useCallback(async (id: string | null) => {
  if (!id) {
    setActiveProject(null)
    return
  }

  // Guard against rapid switching
  if (projectSwitching) return

  const project = projects.find(p => p.id === id)
  if (!project) return

  // Validate folder exists
  const result = await window.electron.project.checkFolder(project.path)
  if (!result.exists) {
    // ... error handling
    return
  }

  // Start transition if switching between projects
  if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
    setProjectSwitching(true)
    setActiveProject(id)
    await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
    setProjectSwitching(false)
  } else {
    setActiveProject(id)
  }

  prevProjectIdRef.current = id
}, [projects, projectSwitching, setActiveProject, removeProject])
```

### Step 2: Add setActiveTerminal to Destructured Store Actions

**Location**: App.tsx, where store is destructured
**Action**: Ensure `setActiveTerminal` is available in callback

Check existing destructuring (around line 30-40):
```typescript
const {
  terminals,
  activeTerminalId,
  // ... other state
  setActiveTerminal,  // Ensure this is included
  // ... other actions
} = useAppStore()
```

### Step 3: Modify handleSelectProject

**Changes**:
1. After `setActiveProject(id)`, get terminals for new project
2. Auto-select first terminal (or null if empty)
3. Add `setActiveTerminal` to dependency array

**Modified Implementation**:
```typescript
const handleSelectProject = useCallback(async (id: string | null) => {
  if (!id) {
    setActiveProject(null)
    setActiveTerminal(null)  // Clear terminal when no project
    return
  }

  // Guard against rapid switching
  if (projectSwitching) return

  const project = projects.find(p => p.id === id)
  if (!project) return

  // Validate folder exists
  const result = await window.electron.project.checkFolder(project.path)
  if (!result.exists) {
    useToastStore.getState().addToast(
      `Project "${project.name}" folder no longer exists. Removing from list.`,
      'warning'
    )
    await window.electron.project.delete(id)
    removeProject(id)
    return
  }

  // Start transition if switching between projects
  if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
    setProjectSwitching(true)
    setActiveProject(id)
    await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
    setProjectSwitching(false)
  } else {
    setActiveProject(id)
  }

  // Auto-select first terminal of new project (FIX for cursor blink bug)
  const { terminals } = useAppStore.getState()
  const newProjectTerminals = terminals.filter(t => t.projectId === id)
  setActiveTerminal(newProjectTerminals[0]?.id || null)

  prevProjectIdRef.current = id
}, [projects, projectSwitching, setActiveProject, setActiveTerminal, removeProject])
```

### Step 4: Verify Dependencies

Ensure `setActiveTerminal` is in useCallback dependency array:
```typescript
}, [projects, projectSwitching, setActiveProject, setActiveTerminal, removeProject])
```

## Todo List

- [ ] Read current App.tsx implementation
- [ ] Verify setActiveTerminal is destructured from useAppStore
- [ ] Modify handleSelectProject: add null project handling
- [ ] Modify handleSelectProject: add terminal auto-selection after setActiveProject
- [ ] Update useCallback dependency array
- [ ] Verify no TypeScript errors
- [ ] Manual test: project switch cursor behavior

## Success Criteria

1. **State Verification**:
   - After switch: `activeTerminalId` belongs to new project
   - Empty project: `activeTerminalId === null`

2. **Behavioral Verification**:
   - Cursor blinks in first terminal after switch
   - No cursor issues in other terminals
   - Rapid switching doesn't corrupt state

3. **Code Quality**:
   - No TypeScript errors
   - No ESLint warnings
   - Clean implementation (no debug logs)

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dependency array incomplete | Low | High | Review all used variables |
| Stale closure for terminals | Medium | Medium | Use `useAppStore.getState()` |
| Race condition during transition | Low | Medium | Terminal selection after dispose delay |

## Security Considerations

None - this is a state management fix with no security implications.

## Next Steps

After Phase 1 completion:
1. Proceed to Phase 2: Testing & Verification
2. Run manual tests per test scenarios
3. Verify all success criteria met
