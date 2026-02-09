# Fix Terminal Display Corruption on Project Switch

```yaml
status: done
created: 2026-01-05
completed: 2026-01-06
branch: master
issue: Terminal display corruption when switching projects
type: bugfix
complexity: medium
files:
  - src/renderer/hooks/use-terminal.ts
  - src/renderer/components/terminal/terminal-grid.tsx
  - src/renderer/App.tsx
```

## Problem

Terminal shows duplicated/corrupted output when switching projects. Creating or closing any terminal fixes the display.

**Root Cause:** Race condition - new xterm instances mount before old ones finish disposing (100ms deferred setTimeout). WebGL addon not tracked in ref, preventing proper cleanup.

## Solution

Deferred mount with fade transition + proper WebGL disposal.

---

## Phase 1: Fix WebGL Addon Tracking & Disposal Order

**File:** `src/renderer/hooks/use-terminal.ts`

### Task 1.1: Add WebGL Addon Ref

Add ref to track WebGL addon instance for proper disposal:

```typescript
// Line 29, add after disposedRef
const webglAddonRef = useRef<WebglAddon | null>(null)
```

### Task 1.2: Store WebGL Addon in Ref

Modify WebGL addon creation (lines 70-75):

```typescript
// BEFORE
try {
  const webglAddon = new WebglAddon()
  terminal.loadAddon(webglAddon)
} catch (e) {
  console.warn('WebGL addon failed to load:', e)
}

// AFTER
try {
  const webglAddon = new WebglAddon()
  webglAddonRef.current = webglAddon
  terminal.loadAddon(webglAddon)
} catch (e) {
  console.warn('WebGL addon failed to load:', e)
}
```

### Task 1.3: Defer initialOutput Write

Move `initialOutput` write inside the setTimeout block (after WebGL addon loads) to prevent race condition. Currently at lines 184-186, should move inside setTimeout block after fit().

```typescript
setTimeout(() => {
  if (disposedRef.current || !terminalRef.current) return

  // Try WebGL addon
  try {
    const webglAddon = new WebglAddon()
    webglAddonRef.current = webglAddon
    terminal.loadAddon(webglAddon)
  } catch (e) {
    console.warn('WebGL addon failed to load:', e)
  }

  try {
    fitAddon.fit()
  } catch {
    // Ignore fit errors
  }

  // Restore output AFTER WebGL init
  if (initialOutput) {
    terminal.write(initialOutput)
  } else {
    window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
  }
}, 50)
```

### Task 1.4: Fix Disposal Order

Modify cleanup effect (lines 226-247) to dispose in correct order:

```typescript
return () => {
  disposedRef.current = true

  const terminal = terminalRef.current
  const fitAddon = fitAddonRef.current
  const webglAddon = webglAddonRef.current

  terminalRef.current = null
  fitAddonRef.current = null
  webglAddonRef.current = null

  setTimeout(() => {
    try {
      // Order: WebGL first, then fit, then terminal
      webglAddon?.dispose()
      fitAddon?.dispose()
      terminal?.dispose()
    } catch {
      // Already disposed
    }
  }, 100)
}
```

---

## Phase 2: Add Project Switch Transition State

**File:** `src/renderer/App.tsx`

### Task 2.1: Add Transition State

Add state to track project switch in progress:

```typescript
// After yoloEnabled state (line 35)
const [projectSwitching, setProjectSwitching] = useState(false)
const prevProjectIdRef = useRef<string | null>(null)
```

### Task 2.2: Modify handleSelectProject

Wrap project switch with transition state:

```typescript
const handleSelectProject = useCallback(async (id: string | null) => {
  if (!id) {
    setActiveProject(null)
    return
  }

  const project = projects.find(p => p.id === id)
  if (!project) return

  // Validate folder
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

  // Start transition if switching between projects (not initial load)
  if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
    setProjectSwitching(true)
    // Allow old terminals to start unmounting
    setActiveProject(id)
    // Wait for disposal (100ms) + buffer
    await new Promise(resolve => setTimeout(resolve, 150))
    setProjectSwitching(false)
  } else {
    setActiveProject(id)
  }

  prevProjectIdRef.current = id
}, [projects, setActiveProject, removeProject])
```

### Task 2.3: Pass Transition State to TerminalGrid

Add prop to TerminalGrid:

```tsx
<TerminalGrid
  terminals={projectTerminals}
  activeTerminalId={activeTerminalId}
  isTransitioning={projectSwitching}  // NEW
  onTerminalClick={setActiveTerminal}
  onAddTerminal={handleAddTerminal}
  onCloseTerminal={handleCloseTerminal}
  onStartClaude={handleStartClaude}
  onInsertFilePath={handleInsertFilePath}
/>
```

---

## Phase 3: Add Transition Animation

**File:** `src/renderer/components/terminal/terminal-grid.tsx`

### Task 3.1: Add isTransitioning Prop

Update interface and component:

```typescript
interface TerminalGridProps {
  terminals: TerminalWithOutput[]
  activeTerminalId: string | null
  isTransitioning?: boolean  // NEW
  onTerminalClick: (id: string) => void
  onAddTerminal?: () => void
  onCloseTerminal?: (id: string) => void
  onStartClaude?: (id: string) => void
  onInsertFilePath?: (terminalId: string, paths: string[]) => void
}

export const TerminalGrid = memo(function TerminalGrid({
  terminals,
  activeTerminalId,
  isTransitioning = false,  // NEW
  onTerminalClick,
  onAddTerminal,
  onCloseTerminal,
  onStartClaude,
  onInsertFilePath
}: TerminalGridProps) {
```

### Task 3.2: Add Transition Wrapper

Wrap the Group component with transition styling:

```tsx
return (
  <div
    className={`h-full transition-opacity duration-100 ${
      isTransitioning ? 'opacity-50 pointer-events-none' : 'opacity-100'
    }`}
  >
    <Group orientation="vertical" className="h-full">
      {/* ... existing content ... */}
    </Group>
  </div>
)
```

---

## Verification

After implementation, test:

1. **Basic switch:** Open 2 projects with terminals, switch between them
2. **Rapid switching:** Switch back and forth quickly multiple times
3. **Terminal count:** Test with 1, 2, 4 terminals per project
4. **Console check:** Verify no WebGL warnings in DevTools

### Expected Results

- [ ] No duplicated terminal output on project switch
- [ ] Smooth fade transition (~150ms)
- [ ] No WebGL context warnings
- [ ] No need to create/close terminals to fix display

---

## Rollback

If issues arise, revert changes in order:
1. Remove transition state from App.tsx
2. Remove isTransitioning from terminal-grid.tsx
3. Keep WebGL ref tracking (beneficial regardless)
