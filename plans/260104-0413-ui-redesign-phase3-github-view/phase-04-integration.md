# Phase 4: Integration & Cleanup

## Context

- Plan: `plans/260104-0413-ui-redesign-phase3-github-view/plan.md`
- Depends: Phases 1-3

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 1h

Final integration, remove old GitPanel usage, and polish.

## Requirements

### Integration Tasks
1. Complete GitHub View with all sub-components
2. Remove GitPanel from App.tsx (no longer needed as separate panel)
3. Update exports and imports
4. Test full workflow

### Layout Comparison

**Before (GitPanel as side panel):**
```
[ Sidebar ][ Terminal Grid ][ GitPanel 320px ]
```

**After (GitHub View as full content):**
```
[ Sidebar ][ GitHub View (full width) ]
```
OR
```
[ Sidebar ][ Terminal Grid (when terminals active) ]
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Remove GitPanel, clean up gitPanelOpen state |
| `src/renderer/stores/settings-store.ts` | Remove gitPanelOpen if unused |
| `github-view/index.ts` | Export all components |

### Potentially Delete
| File | Reason |
|------|--------|
| N/A | Keep GitPanel components for reuse |

## Implementation Steps

### Step 1: Complete GitHub View Integration

```tsx
// Final github-view.tsx structure
export function GitHubView({ projectPath }: GitHubViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')
  const [syncing, setSyncing] = useState(false)

  const gitPanel = useGitPanel({ projectPath, enabled: true })
  const repoName = parseRepoName(gitPanel.gitStatus?.remote)
  const changesCount = gitPanel.files.length
  const stagedCount = gitPanel.files.filter(f => f.staged).length

  // Handlers...

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <GitHubActionBar ... />
      <RepoInfoHeader ... />
      <TabBar ... />
      <TabContent ... />
    </div>
  )
}
```

### Step 2: Update App.tsx

```tsx
// Remove old GitPanel usage
// Before:
<GitPanel
  projectPath={activeProject?.path}
  isOpen={gitPanelOpen}
  onToggle={() => setGitPanelOpen(!gitPanelOpen)}
/>

// After: Already handled via activeView === 'github'
```

### Step 3: Clean Up Unused State

```tsx
// settings-store.ts - if gitPanelOpen no longer needed
// Remove or deprecate:
// gitPanelOpen: boolean
// setGitPanelOpen: (open: boolean) => void
```

### Step 4: Update Exports

```tsx
// github-view/index.ts
export { GitHubView } from './github-view'
export { GitHubActionBar } from './github-action-bar'
export { RepoInfoHeader } from './repo-info-header'
```

### Step 5: Test Full Workflow

Test checklist:
- [ ] Click GitHub nav → shows GitHub View
- [ ] Click Terminals nav → shows Terminal Grid
- [ ] Push/Pull/Sync/Fetch buttons work
- [ ] Branch selector works
- [ ] Changes tab shows file list + diff + commit form
- [ ] History tab shows commits
- [ ] Stash tab shows stash entries
- [ ] Branches tab shows branch list

## Todo List

- [ ] Finalize github-view.tsx with all components
- [ ] Remove GitPanel from App.tsx layout
- [ ] Clean up gitPanelOpen state if unused
- [ ] Update exports in index.ts
- [ ] Test navigation switching
- [ ] Test all Git operations
- [ ] Test all tabs
- [ ] Fix any styling issues

## Success Criteria

- [ ] GitHub View fully functional
- [ ] No GitPanel side panel in UI
- [ ] View switching works correctly
- [ ] All Git operations work
- [ ] No console errors
- [ ] Clean, full-width layout

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Git workflow | High | Test all operations thoroughly |
| Missing component exports | Low | Verify all imports work |

## Security Considerations

N/A - UI reorganization only, no security changes.

## Next Steps

After Phase 3 complete:
1. Proceed to Phase 4: Settings Modal (overall UI redesign)
2. Or iterate on GitHub View based on user feedback
