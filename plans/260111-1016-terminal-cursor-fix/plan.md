---
title: "Fix Terminal Cursor Misalignment on Project Switch"
description: "Restructure terminal-grid.tsx to use single parent container pattern, preventing React reconciliation from unmounting terminals"
status: in-progress
priority: P1
effort: 3h
branch: beta
tags: [bugfix, terminal, frontend, react, xterm]
created: 2026-01-11
---

# Fix Terminal Cursor Misalignment on Project Switch

## Problem Summary

When switching between projects in MultiClaude, the terminal cursor position becomes misaligned. Despite multiple fix attempts (commits `5534037`, `6ecec92`, `4b4b895`), the issue persists because all previous fixes addressed symptoms rather than the root cause.

## Root Cause

**React Reconciliation Rule**: Keys only preserve component identity within the same parent's children list.

Current `terminal-grid.tsx` renders terminals in **TWO separate parent containers**:
1. Hidden terminals: `<div style="display:none">`
2. Visible terminals: `<Panel>` grid

When switching projects, terminals move between these parents. React:
1. Unmounts from old parent (destroys xterm.js instance)
2. Mounts fresh in new parent (creates new xterm.js instance)
3. Cursor position, buffer state, all internal state lost

## Solution

**Lazy Grid Rendering Pattern**: Keep ALL terminals in SINGLE parent hierarchy, hide inactive projects with CSS.

```tsx
<Group orientation="vertical">
  {projectGroups.map(group => (
    <div key={group.projectId} style={{ display: group.isActive ? 'flex' : 'none' }}>
      {/* Each project's grid stays mounted, just hidden with CSS */}
      <Panel>{group.terminals.map(t => <TerminalPane key={t.id} />)}</Panel>
    </div>
  ))}
</Group>
```

## Phases

| Phase | File(s) | Effort | Priority | Status |
|-------|---------|--------|----------|--------|
| [Phase 1](./phase-01-restructure-grid.md) | terminal-grid.tsx | 1.5h | P1 | ✅ Completed |
| [Phase 2](./phase-02-cleanup-app.md) | App.tsx | 30m | P1 | ✅ Completed |
| [Phase 3](./phase-03-verify-webgl.md) | use-terminal.ts | 30m | P2 | Pending |
| [Phase 4](./phase-04-testing.md) | Manual + E2E | 30m | P1 | Pending |

## Expected Outcomes

| Aspect | Before | After |
|--------|--------|-------|
| Parent containers | 2 separate | 1 unified |
| Project switch | Terminals move between parents | CSS toggle only |
| React reconciliation | Unmount -> Mount | No unmount |
| XTerm lifecycle | `dispose()` -> new `XTerm()` | Instance preserved |
| Cursor position | Lost | Preserved |
| Buffer state | Lost | Preserved |
| Switch delay | 150ms wait | Instant |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory increase (all terminals mounted) | Medium | WebGL disabled for hidden; consider terminal limit |
| Resize handling for hidden terminals | Low | fit() already handles; verify works correctly |
| react-resizable-panels compatibility | Low | CSS hiding on wrapper div, not Panel |

## Success Criteria

1. No terminal `dispose()` calls on project switch
2. Cursor position identical before/after switch
3. Buffer content preserved across switches
4. No 150ms delay on project switch
5. WebGL still disabled for hidden terminals
6. All existing E2E tests pass

## Related Documentation

- [Root Cause Analysis](../reports/brainstorm-260111-1016-terminal-cursor-root-cause.md)
- [Implementation Comparison](../reports/implementation-comparison.md)
- [Debugging Report](../reports/debugger-260111-1019-react-reconciliation-cursor-issue.md)
- [Phase 2 Code Review](../reports/code-reviewer-260111-1103-phase2-cleanup.md)
- [Codebase Summary](/home/plateau/Desktop/Claude Code/MultiClaude/docs/codebase-summary.md)

## Unresolved Questions

1. Memory impact with many projects (5+) - needs production metrics after deployment
2. Performance with high terminal counts (15+) - suggest stress testing post-implementation
