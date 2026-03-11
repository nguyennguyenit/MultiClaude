# Phase 3: Repo Info Header

## Context

- Plan: `plans/260104-0413-ui-redesign-phase3-github-view/plan.md`
- Design: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 302-305)
- Depends: Phase 1, Phase 2

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 1h

Create repository info header showing repo name, current branch, and changes count.

## Requirements

### Design Spec
```
┌──────────────────────────────────────────────────────────────┐
│ 📂 Repository: nguyennguyenit/MultiClaude                    │
│ 🌿 Branch: main                  📝 3 changes                 │
└──────────────────────────────────────────────────────────────┘
```

### Functional
- Show repository name (owner/repo)
- Show current branch with icon
- Show file changes count
- Branch selector dropdown (reuse BranchSelector)

## Architecture

```tsx
interface RepoInfoHeaderProps {
  repoName: string | undefined
  currentBranch: string | undefined
  changesCount: number
  branches: GitBranch[]
  onCheckoutBranch: (name: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  isLoading: boolean
}
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/github-view/repo-info-header.tsx` | Info header |

### Reuse
| Component | From |
|-----------|------|
| BranchSelector | git-panel/branch-selector.tsx |

## Implementation Steps

### Step 1: Create Repo Info Header

```tsx
// src/renderer/components/github-view/repo-info-header.tsx
import { BranchSelector } from '../git-panel/branch-selector'
import type { GitBranch } from '@shared/types'

interface RepoInfoHeaderProps {
  repoName: string | undefined
  currentBranch: string | undefined
  changesCount: number
  branches: GitBranch[]
  onCheckoutBranch: (name: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  isLoading: boolean
}

export function RepoInfoHeader({
  repoName,
  currentBranch,
  changesCount,
  branches,
  onCheckoutBranch,
  onCreateBranch,
  isLoading
}: RepoInfoHeaderProps) {
  return (
    <div className="px-4 py-3 bg-[var(--mc-bg-tertiary)] border-b border-[var(--mc-border)]">
      {/* Repository name */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <span>📂</span>
        <span className="text-[var(--mc-text-muted)]">Repository:</span>
        <span className="font-medium">{repoName || 'Not connected'}</span>
      </div>

      {/* Branch and changes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <span>🌿</span>
            <BranchSelector
              currentBranch={currentBranch}
              branches={branches}
              onCheckout={onCheckoutBranch}
              onCreate={onCreateBranch}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Changes count */}
        <div className="flex items-center gap-2 text-sm">
          <span>📝</span>
          <span className={changesCount > 0 ? 'text-amber-400' : 'text-[var(--mc-text-muted)]'}>
            {changesCount} changes
          </span>
        </div>
      </div>
    </div>
  )
}
```

### Step 2: Integrate in GitHub View

```tsx
// github-view.tsx
const changesCount = gitPanel.files.length

<RepoInfoHeader
  repoName={repoName}
  currentBranch={gitPanel.currentBranch}
  changesCount={changesCount}
  branches={gitPanel.branches}
  onCheckoutBranch={gitPanel.checkoutBranch}
  onCreateBranch={gitPanel.createBranch}
  isLoading={gitPanel.isLoading}
/>
```

## Todo List

- [ ] Create repo-info-header.tsx
- [ ] Import and reuse BranchSelector
- [ ] Show repository name
- [ ] Show current branch with selector
- [ ] Show changes count with color coding
- [ ] Integrate in github-view
- [ ] Test branch switching
- [ ] Test with different change counts

## Success Criteria

- [ ] Repository name displays correctly
- [ ] Branch selector works
- [ ] Changes count updates correctly
- [ ] Yellow color when changes > 0
- [ ] Muted color when no changes

## Next Steps

Proceed to Phase 4: Integration & Cleanup
