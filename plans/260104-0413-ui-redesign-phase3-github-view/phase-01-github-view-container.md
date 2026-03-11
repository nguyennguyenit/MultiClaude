# Phase 1: GitHub View Container

## Context

- Plan: `plans/260104-0413-ui-redesign-phase3-github-view/plan.md`
- Design: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 287-325)
- Depends: Phase 1 Layout Foundation (activeView state)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1.5h

Create main GitHub View container that appears when `activeView === 'github'`.

## Key Insights

From codebase analysis:
- `useGitPanel` hook provides all Git functionality
- Current GitPanel is 320px right-side panel
- New GitHub View should be full-width main content
- Tabs: Changes, History, Stash, Branches (same as GitPanel)

## Requirements

### Functional
- Shown when activeView === 'github' (from Phase 1 navigation)
- Full-width container (replaces terminal grid area)
- Uses useGitPanel hook for all data/actions
- Contains: Action Bar, Repo Info Header, Tabs, Tab Content

### Architecture
```tsx
interface GitHubViewProps {
  projectPath: string | undefined
}

// Structure
<GitHubView projectPath={activeProject?.path}>
  <GitHubActionBar ... />      {/* Phase 2 */}
  <RepoInfoHeader ... />       {/* Phase 3 */}
  <TabBar tabs={...} />
  <TabContent ... />           {/* Reuse existing */}
</GitHubView>
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/github-view/github-view.tsx` | Main container |
| `src/renderer/components/github-view/index.ts` | Exports |

### Modify
| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Add GitHubView to main content area |

## Implementation Steps

### Step 1: Create Directory Structure

```bash
mkdir -p src/renderer/components/github-view
```

### Step 2: Create GitHub View Component

```tsx
// src/renderer/components/github-view/github-view.tsx
import { useState } from 'react'
import { useGitPanel } from '../../hooks/use-git-panel'
import { ChangesList, DiffViewer, CommitForm } from '../git-panel/changes-list'
import { HistoryTab } from '../git-panel/history-tab'
import { StashTab } from '../git-panel/stash-tab'
import { BranchesTab } from '../git-panel/branches-tab'

type TabId = 'changes' | 'history' | 'stash' | 'branches'

interface GitHubViewProps {
  projectPath: string | undefined
}

export function GitHubView({ projectPath }: GitHubViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')

  const gitPanel = useGitPanel({ projectPath, enabled: true })

  const tabs = [
    { id: 'changes', label: 'Changes' },
    { id: 'history', label: 'History' },
    { id: 'stash', label: 'Stash' },
    { id: 'branches', label: 'Branches' }
  ]

  if (!projectPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--mc-text-muted)]">
        Select a project to view Git status
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Action Bar - Phase 2 */}
      {/* <GitHubActionBar ... /> */}

      {/* Repo Info Header - Phase 3 */}
      {/* <RepoInfoHeader ... /> */}

      {/* Tabs */}
      <div className="flex border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--mc-accent)] text-[var(--mc-accent)]'
                : 'text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'changes' && (
          <div className="flex h-full">
            <ChangesList ... />
            <DiffViewer ... />
            <CommitForm ... />
          </div>
        )}
        {activeTab === 'history' && <HistoryTab ... />}
        {activeTab === 'stash' && <StashTab ... />}
        {activeTab === 'branches' && <BranchesTab ... />}
      </div>
    </div>
  )
}
```

### Step 3: Create Index Export

```tsx
// src/renderer/components/github-view/index.ts
export { GitHubView } from './github-view'
```

### Step 4: Integrate in App.tsx

```tsx
// src/renderer/App.tsx
import { GitHubView } from './components/github-view'

// In main content area:
{activeProjectId ? (
  <>
    <Sidebar />
    <div className="flex-1 min-w-0 flex flex-col">
      {activeView === 'terminals' && (
        <>
          <TerminalActionBar ... />
          <TerminalGrid ... />
        </>
      )}
      {activeView === 'github' && (
        <GitHubView projectPath={activeProject?.path} />
      )}
    </div>
  </>
)}
```

## Todo List

- [ ] Create github-view directory
- [ ] Create github-view.tsx skeleton
- [ ] Implement tab navigation
- [ ] Reuse ChangesList/DiffViewer/CommitForm for changes tab
- [ ] Reuse HistoryTab for history
- [ ] Reuse StashTab for stash
- [ ] Reuse BranchesTab for branches
- [ ] Create index.ts export
- [ ] Integrate in App.tsx with view switching
- [ ] Test view toggle between terminals/github

## Success Criteria

- [ ] GitHub view appears when clicking GitHub nav
- [ ] Tabs switch between Changes/History/Stash/Branches
- [ ] Tab content shows correctly from reused components
- [ ] No errors when switching views
- [ ] Full-width layout (not 320px panel)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Component import issues | Medium | Ensure proper exports from git-panel |
| Layout differences | Low | Adjust flex layout for full-width |

## Next Steps

After completing:
1. Phase 2: Add GitHub Action Bar
2. Phase 3: Add Repo Info Header
