# Current vs. Correct Implementation Comparison

## Side-by-Side Code Comparison

### CURRENT (BROKEN) - terminal-grid.tsx

```tsx
export const TerminalGrid = memo(function TerminalGrid({ terminals, activeProjectId, ... }) {
  const visibleTerminals = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId)
    : terminals

  const hiddenTerminals = activeProjectId
    ? terminals.filter(t => t.projectId !== activeProjectId)
    : []

  return (
    <div>
      {/* ❌ PARENT CONTAINER #1 - Hidden terminals */}
      {hiddenTerminals.length > 0 && (
        <div style={{ display: 'none' }} aria-hidden="true">
          {hiddenTerminals.map((terminal) => (
            <TerminalPane key={terminal.id} hidden={true} {...props} />
          ))}
        </div>
      )}

      {/* ❌ PARENT CONTAINER #2 - Visible terminals */}
      <Group orientation="vertical">
        {rows.map((rowTerminals, rowIndex) => (
          <Panel>
            {rowTerminals.map((terminal) => (
              <TerminalPane key={terminal.id} hidden={false} {...props} />
            ))}
          </Panel>
        ))}
      </Group>
    </div>
  )
})
```

**Problem**: Terminals move between `<div style="display:none">` and `<Panel>` on project switch → React unmounts/remounts

---

### CORRECT (FIXED) - terminal-grid.tsx

```tsx
export const TerminalGrid = memo(function TerminalGrid({ terminals, activeProjectId, ... }) {
  // Group terminals by project
  const projectGroups = Array.from(
    new Set(terminals.map(t => t.projectId))
  ).map(projectId => ({
    projectId,
    isActive: projectId === activeProjectId,
    terminals: terminals.filter(t => t.projectId === projectId)
  }))

  return (
    <div>
      {/* ✅ SINGLE PARENT CONTAINER - All projects */}
      <Group orientation="vertical">
        {projectGroups.map(group => {
          const { cols } = calculateGrid(group.terminals.length)
          const rows = splitIntoRows(group.terminals, cols)

          return (
            <div
              key={group.projectId}
              style={{
                display: group.isActive ? 'flex' : 'none',
                flexDirection: 'column',
                height: '100%'
              }}
            >
              {/* Each project's grid stays mounted, just hidden with CSS */}
              {rows.map((rowTerminals, rowIndex) => (
                <Fragment key={`row-${rowIndex}`}>
                  <Panel defaultSize={100 / rows.length}>
                    <Group orientation="horizontal">
                      {rowTerminals.map((terminal, colIndex) => (
                        <Fragment key={terminal.id}>
                          <Panel defaultSize={100 / rowTerminals.length}>
                            <TerminalPane
                              terminalId={terminal.id}
                              hidden={!group.isActive}
                              {...props}
                            />
                          </Panel>
                          {colIndex < rowTerminals.length - 1 && (
                            <Separator className="terminal-resize-handle-horizontal" />
                          )}
                        </Fragment>
                      ))}
                    </Group>
                  </Panel>
                  {rowIndex < rows.length - 1 && (
                    <Separator className="terminal-resize-handle-vertical" />
                  )}
                </Fragment>
              ))}
            </div>
          )
        })}
      </Group>
    </div>
  )
})
```

**Solution**: All terminals in same `<Group>` parent, project grids hidden with CSS → React preserves component instances

---

## Behavioral Comparison

| Aspect | Current (Broken) | Correct (Fixed) |
|--------|-----------------|-----------------|
| **Parent containers** | 2 separate (hidden div + Panel grid) | 1 unified (Group with hidden children) |
| **Project switch behavior** | Terminals move between parents | Terminals stay in same parent |
| **React reconciliation** | Unmount from old parent → Mount in new parent | No unmount, only CSS change |
| **XTerm lifecycle** | `dispose()` called → new `XTerm()` created | Instance preserved across switches |
| **Cursor position** | ❌ Lost on switch | ✅ Preserved |
| **Buffer state** | ❌ Lost on switch | ✅ Preserved |
| **PTY connection** | ❌ Disrupted | ✅ Maintained |
| **Switch delay** | 150ms waiting for disposal | ⚡ Instant (no disposal) |
| **WebGL state** | ❌ Re-initialized | ✅ Toggled without recreation |
| **Memory usage** | Lower (unmounted terminals freed) | Higher (all terminals kept mounted) |
| **Performance** | Slower switches (remount overhead) | Faster switches (CSS only) |

---

## App.tsx Changes Required

### CURRENT (BROKEN)

```tsx
const handleProjectSwitch = useCallback(async (id: string) => {
  if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
    setProjectSwitching(true)
    // Allow old terminals to start unmounting  ← ❌ THIS IS THE BUG
    setActiveProject(id)
    // Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
    await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
    setProjectSwitching(false)
  } else {
    setActiveProject(id)
  }
}, [])
```

### CORRECT (FIXED)

```tsx
const handleProjectSwitch = useCallback((id: string) => {
  // No delay needed - terminals don't unmount anymore!
  setActiveProject(id)

  // Auto-select first terminal of new project
  const { terminals } = useAppStore.getState()
  const newProjectTerminals = terminals.filter(t => t.projectId === id)
  if (newProjectTerminals.length > 0) {
    setActiveTerminal(newProjectTerminals[0].id)
  }
}, [])
```

**Changes**:
- ❌ Remove `setProjectSwitching` state (not needed)
- ❌ Remove `async` and disposal delay
- ❌ Remove "Allow old terminals to start unmounting" comment
- ✅ Instant project switch

---

## Test Results Comparison

### Current Implementation
```
User switches Project A → Project B

Console:
🔴 UNMOUNT: Terminal A1 - Destroying XTerm
🔴 UNMOUNT: Terminal A2 - Destroying XTerm
⏱️  Waiting 150ms for disposal...
🟢 MOUNT: Terminal B1 - Creating new XTerm (initialOutput restore)
🟢 MOUNT: Terminal B2 - Creating new XTerm (initialOutput restore)
⚠️  Cursor position incorrect on Terminal B1
⚠️  Buffer state lost
```

### Correct Implementation
```
User switches Project A → Project B

Console:
🟡 UPDATE: Terminal A1 - CSS hidden
🟡 UPDATE: Terminal A2 - CSS hidden
🟡 UPDATE: Terminal B1 - CSS visible
🟡 UPDATE: Terminal B2 - CSS visible
✅ Cursor position preserved
✅ Buffer state intact
```

---

## Migration Steps

1. **Backup current implementation**
   ```bash
   git checkout -b fix/terminal-reconciliation
   ```

2. **Update terminal-grid.tsx**
   - Replace dual-container pattern with single-parent pattern
   - Group terminals by projectId
   - Render all project grids, hide inactive with CSS

3. **Update App.tsx**
   - Remove `projectSwitching` state
   - Remove disposal delay
   - Simplify `handleProjectSwitch`

4. **Update use-terminal.ts**
   - Verify WebGL toggle still works with `hidden` prop
   - Ensure fit() calls work on hidden terminals

5. **Test thoroughly**
   - Create multiple projects
   - Add terminals to each
   - Switch between projects rapidly
   - Verify cursor position preserved
   - Check memory usage

6. **Remove unnecessary code**
   - Delete `isTransitioning` prop from TerminalGrid
   - Remove `projectSwitching` state from App
   - Remove TERMINAL_DISPOSE_DELAY wait logic

---

## Performance Considerations

### Memory Impact
- **Current**: Only active project terminals mounted (~2-4 terminals)
- **Correct**: All project terminals mounted (e.g., 3 projects × 3 terminals = 9)

**Mitigation**:
- Hidden terminals already have WebGL disabled (GPU optimization)
- Consider terminal limit per project (e.g., max 4)
- Monitor memory in production

### Render Performance
- **Current**: Remount cost on every switch (expensive)
- **Correct**: CSS toggle only (very cheap)

**Net result**: Better performance despite more mounted terminals

---

## Open Test Files

To verify React behavior interactively:

```bash
# Test current broken pattern
xdg-open reconciliation-test.html

# Test correct pattern
xdg-open reconciliation-correct-pattern.html
```

Compare lifecycle logs when switching between containers vs. CSS visibility changes.
