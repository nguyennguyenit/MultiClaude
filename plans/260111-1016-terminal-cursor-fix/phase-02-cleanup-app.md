---
parent: ./plan.md
status: completed
priority: P1
effort: 30m
completed: 2026-01-11
---

# Phase 2: Cleanup App.tsx

## Overview

Remove the disposal delay and transition state from App.tsx. With the Phase 1 fix, terminals no longer unmount on project switch, so the 150ms delay workaround is unnecessary.

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Restructure Grid](./phase-01-restructure-grid.md)
- [Root Cause Analysis](../reports/brainstorm-260111-1016-terminal-cursor-root-cause.md)

## Key Insights

1. **Current delay is a symptom-masking workaround** - Waits for terminal disposal before completing switch
2. **Comment "Allow old terminals to start unmounting" confirms the bug** - Developers knew terminals were unmounting
3. **After Phase 1 fix**: No unmounting occurs, delay unnecessary

## Related Files

- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx` - Lines 42-43, 105-124

## Current Implementation (Lines 105-124)

```tsx
// Handler: Switch to project with folder validation
const handleSelectProject = useCallback(async (id: string | null) => {
  if (!id) {
    setActiveProject(null)
    setActiveTerminal(null)
    return
  }

  // Guard against rapid switching - ignore if already transitioning
  if (projectSwitching) return

  const project = projects.find(p => p.id === id)
  if (!project) return

  // Validate folder exists...

  // Start transition if switching between projects (not initial load)
  if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
    setProjectSwitching(true)
    // Allow old terminals to start unmounting  <- THE BUG INDICATOR
    setActiveProject(id)
    // Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
    await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
    setProjectSwitching(false)
  } else {
    setActiveProject(id)
  }

  // Auto-select first terminal...
  prevProjectIdRef.current = id
}, [projects, projectSwitching, setActiveProject, setActiveTerminal, removeProject])
```

## Target Implementation

```tsx
// Handler: Switch to project with folder validation
const handleSelectProject = useCallback(async (id: string | null) => {
  if (!id) {
    setActiveProject(null)
    setActiveTerminal(null)
    return
  }

  const project = projects.find(p => p.id === id)
  if (!project) return

  // Validate folder exists before switching
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

  // Instant switch - terminals stay mounted (CSS hiding only)
  setActiveProject(id)

  // Auto-select first terminal of new project
  const { terminals } = useAppStore.getState()
  const newProjectTerminals = terminals.filter(t => t.projectId === id)
  setActiveTerminal(newProjectTerminals[0]?.id || null)

  prevProjectIdRef.current = id
}, [projects, setActiveProject, setActiveTerminal, removeProject])
```

## Implementation Steps

### 1. Remove projectSwitching state
```diff
-const [projectSwitching, setProjectSwitching] = useState(false)
```

### 2. Remove rapid-switch guard
```diff
-// Guard against rapid switching - ignore if already transitioning
-if (projectSwitching) return
```

### 3. Simplify handleSelectProject
- Remove async delay logic
- Remove `TERMINAL_DISPOSE_DELAY + 50` wait
- Keep folder validation (still needed)
- Keep auto-select first terminal

### 4. Update TerminalGrid prop
```diff
 <TerminalGrid
   terminals={terminals}
   activeProjectId={activeProjectId}
   activeTerminalId={activeTerminalId}
-  isTransitioning={projectSwitching}
   onTerminalClick={setActiveTerminal}
   ...
 />
```

### 5. Optional: Remove isTransitioning from TerminalGrid interface
- If no other usage, clean up the prop entirely

## Todo List

- [x] Remove `projectSwitching` state (line 42)
- [x] Remove rapid-switch guard from handleSelectProject
- [x] Remove async delay logic from handleSelectProject
- [x] Remove `isTransitioning` prop from TerminalGrid
- [x] Update handleSelectProject dependencies array
- [x] Verify no other usages of projectSwitching
- [x] Test project switching is instant

## Code Diff

```diff
 function App() {
   const { ... } = useAppStore()
   const { ... } = useSettingsStore()

   // YOLO mode state
   const [yoloEnabled, setYoloEnabled] = useState(false)

-  // Project switch transition state
-  const [projectSwitching, setProjectSwitching] = useState(false)
   const prevProjectIdRef = useRef<string | null>(null)

   // ...

   // Handler: Switch to project with folder validation
-  const handleSelectProject = useCallback(async (id: string | null) => {
+  const handleSelectProject = useCallback(async (id: string | null) => {
     if (!id) {
       setActiveProject(null)
       setActiveTerminal(null)
       return
     }

-    // Guard against rapid switching - ignore if already transitioning
-    if (projectSwitching) return
-
     const project = projects.find(p => p.id === id)
     if (!project) return

     // Validate folder exists before switching
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

-    // Start transition if switching between projects (not initial load)
-    if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
-      setProjectSwitching(true)
-      // Allow old terminals to start unmounting
-      setActiveProject(id)
-      // Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
-      await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
-      setProjectSwitching(false)
-    } else {
-      setActiveProject(id)
-    }
+    // Instant switch - terminals stay mounted (CSS hiding only)
+    setActiveProject(id)

     // Auto-select first terminal of new project
     const { terminals } = useAppStore.getState()
     const newProjectTerminals = terminals.filter(t => t.projectId === id)
     setActiveTerminal(newProjectTerminals[0]?.id || null)

     prevProjectIdRef.current = id
-  }, [projects, projectSwitching, setActiveProject, setActiveTerminal, removeProject])
+  }, [projects, setActiveProject, setActiveTerminal, removeProject])

   // ...

   return (
     // ...
     <TerminalGrid
       terminals={terminals}
       activeProjectId={activeProjectId}
       activeTerminalId={activeTerminalId}
-      isTransitioning={projectSwitching}
       onTerminalClick={setActiveTerminal}
       ...
     />
   )
 }
```

## Success Criteria

1. Project switching is instant (no 150ms delay)
2. No projectSwitching state exists
3. No isTransitioning prop passed to TerminalGrid
4. Folder validation still works
5. Auto-select first terminal still works
6. Rapid project switching works correctly

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rapid switch race condition | Low | Medium | React state batching handles this |
| Folder validation async issue | Low | Low | Validation runs before switch |
