---
parent: ./plan.md
status: completed
priority: P1
effort: 1.5h
completed: 2026-01-11
---

# Phase 1: Restructure Terminal Grid

## Overview

Replace the dual-container pattern (hidden div + visible Panel grid) with a single-parent pattern where all project grids are rendered within the same `<Group>` hierarchy, with inactive projects hidden via CSS.

## Context Links

- [Parent Plan](./plan.md)
- [Root Cause Analysis](../reports/brainstorm-260111-1016-terminal-cursor-root-cause.md)
- [Implementation Comparison](../reports/implementation-comparison.md)

## Key Insights

1. **React reconciliation unmounts when parent changes** - Keys only preserve identity within same parent's children list
2. **Current pattern has 2 parents**: `<div style="display:none">` for hidden, `<Panel>` grid for visible
3. **Fix**: Group by projectId, render ALL projects in single parent, hide with CSS

## Related Files

- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-grid.tsx` - Main file to modify

## Current Implementation (BROKEN)

```tsx
// Lines 113-142: TWO SEPARATE PARENT CONTAINERS

// PARENT #1: Hidden terminals
{hiddenTerminals.length > 0 && (
  <div style={{ display: 'none' }} aria-hidden="true">
    {hiddenTerminals.map((terminal) => (
      <TerminalPane key={terminal.id} hidden={true} ... />
    ))}
  </div>
)}

// PARENT #2: Visible terminals in grid
<Group orientation="vertical" className="h-full">
  {rows.map((rowTerminals, rowIndex) => (
    <Panel>
      {rowTerminals.map((terminal) => (
        <TerminalPane key={terminal.id} hidden={false} ... />
      ))}
    </Panel>
  ))}
</Group>
```

## Target Implementation (FIXED)

```tsx
// SINGLE PARENT CONTAINER - All projects rendered, inactive hidden with CSS

// Group terminals by projectId
const projectGroups = useMemo(() => {
  const groups = new Map<string, TerminalWithOutput[]>()

  for (const terminal of terminals) {
    const pid = terminal.projectId || 'default'
    if (!groups.has(pid)) groups.set(pid, [])
    groups.get(pid)!.push(terminal)
  }

  return Array.from(groups.entries()).map(([projectId, terms]) => ({
    projectId,
    isActive: projectId === activeProjectId,
    terminals: terms
  }))
}, [terminals, activeProjectId])

return (
  <div className={`h-full transition-opacity duration-100 ...`}>
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
          aria-hidden={!group.isActive}
        >
          <Group orientation="vertical" className="h-full">
            {rows.map((rowTerminals, rowIndex) => (
              <Fragment key={`row-${rowIndex}`}>
                <Panel defaultSize={100 / rows.length}>
                  <Group orientation="horizontal" className="h-full">
                    {rowTerminals.map((terminal, colIndex) => (
                      <Fragment key={terminal.id}>
                        <Panel defaultSize={100 / rowTerminals.length}>
                          <TerminalPane
                            terminalId={terminal.id}
                            title={terminal.title}
                            isActive={terminal.id === activeTerminalId}
                            hidden={!group.isActive}
                            isClaudeMode={terminal.isClaudeMode}
                            initialOutput={terminal.output}
                            onActivate={() => onTerminalClick(terminal.id)}
                            onClose={() => onCloseTerminal?.(terminal.id)}
                            onInsertFilePath={(paths) => onInsertFilePath?.(terminal.id, paths)}
                            onTitleChange={(title) => onTitleChange?.(terminal.id, title)}
                          />
                        </Panel>
                        {colIndex < rowTerminals.length - 1 && (
                          <Separator className="terminal-resize-handle terminal-resize-handle-horizontal" />
                        )}
                      </Fragment>
                    ))}
                  </Group>
                </Panel>
                {rowIndex < rows.length - 1 && (
                  <Separator className="terminal-resize-handle terminal-resize-handle-vertical" />
                )}
              </Fragment>
            ))}
          </Group>
        </div>
      )
    })}
  </div>
)
```

## Implementation Steps

### 1. Add useMemo import
```tsx
import { Fragment, memo, useMemo } from 'react'
```

### 2. Replace terminal grouping logic
- Remove `visibleTerminals` and `hiddenTerminals` filtering (lines 52-56, 113-116)
- Add `projectGroups` memo that groups by projectId

### 3. Update empty state check
- Check if active project has terminals: `projectGroups.find(g => g.isActive)?.terminals.length === 0`

### 4. Replace render logic
- Remove hidden terminals container (lines 123-142)
- Replace visible grid section with project groups iteration
- Wrap each project's grid in CSS-hiding div

### 5. Handle edge cases
- Default project for terminals without projectId
- Empty projectGroups array (no terminals at all)
- First project load (single project case)

## Todo List

- [ ] Backup current terminal-grid.tsx
- [ ] Add useMemo import
- [ ] Create projectGroups memo
- [ ] Update empty state logic
- [ ] Remove dual-container pattern
- [ ] Implement single-parent pattern with CSS hiding
- [ ] Verify TerminalPane receives correct `hidden` prop
- [ ] Test single project (no switch)
- [ ] Test multi-project switch
- [ ] Verify no console errors

## Success Criteria

1. All terminals render within single parent hierarchy
2. Project switch toggles CSS `display` only - no unmount
3. Cursor position preserved after switch
4. Grid layout identical to current for visible terminals
5. No React key warnings

## Code Diff Preview

```diff
-import { Fragment, memo } from 'react'
+import { Fragment, memo, useMemo } from 'react'

 export const TerminalGrid = memo(function TerminalGrid({...}) {
-  // Calculate visible terminals for the active project
-  const visibleTerminals = activeProjectId
-    ? terminals.filter(t => t.projectId === activeProjectId)
-    : terminals
-
-  // Get hidden terminals (other projects)
-  const hiddenTerminals = activeProjectId
-    ? terminals.filter(t => t.projectId !== activeProjectId)
-    : []
+  // Group terminals by project for stable rendering
+  const projectGroups = useMemo(() => {
+    const groups = new Map<string, TerminalWithOutput[]>()
+    for (const t of terminals) {
+      const pid = t.projectId || 'default'
+      if (!groups.has(pid)) groups.set(pid, [])
+      groups.get(pid)!.push(t)
+    }
+    return Array.from(groups.entries()).map(([projectId, terms]) => ({
+      projectId,
+      isActive: projectId === activeProjectId,
+      terminals: terms
+    }))
+  }, [terminals, activeProjectId])

+  // Get active project's terminals for empty state check
+  const activeGroup = projectGroups.find(g => g.isActive)
+  const visibleTerminalCount = activeGroup?.terminals.length ?? 0

   // Empty state check
-  if (visibleTerminals.length === 0) {
+  if (visibleTerminalCount === 0) {
     return (/* empty state JSX */)
   }

-  // Calculate grid based on visible terminals
-  const { cols } = calculateGrid(visibleTerminals.length)
-  const rows = splitIntoRows(visibleTerminals, cols)

   return (
     <div className={...}>
-      {/* Hidden terminals container */}
-      {hiddenTerminals.length > 0 && (
-        <div style={{ display: 'none' }} ...>
-          {hiddenTerminals.map(...)}
-        </div>
-      )}
-
-      {/* Visible terminals in grid */}
-      <Group orientation="vertical">
-        {rows.map(...)}
-      </Group>
+      {/* All project grids - inactive hidden with CSS */}
+      {projectGroups.map(group => {
+        const { cols } = calculateGrid(group.terminals.length)
+        const rows = splitIntoRows(group.terminals, cols)
+        return (
+          <div key={group.projectId}
+            style={{ display: group.isActive ? 'flex' : 'none', ... }}
+          >
+            <Group orientation="vertical">
+              {/* Same grid rendering as before */}
+            </Group>
+          </div>
+        )
+      })}
     </div>
   )
 })
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| react-resizable-panels nesting issue | Low | High | CSS hiding on wrapper div, not Panel itself |
| Performance with many hidden grids | Medium | Medium | Only calculate grid for visible project |
| Stale projectGroups memo | Low | Low | Include both terminals and activeProjectId in deps |
