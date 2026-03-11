# Phase 2: PRs Tab Component

## Context

- Plan: `plans/260104-0413-ui-redesign-phase5-issues-prs/plan.md`
- Depends: Phase 1 Issues Tab

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 1.5h

Create Pull Requests tab showing repository PRs via gh CLI.

## Requirements

### Functional
- List open/closed/merged PRs
- Show: number, title, state, author, branch, created date
- Filter by state
- Show merge status indicators
- Refresh button

### Design
```
┌─────────────────────────────────────────────────────────────┐
│ Filter: [Open ▾]                                 🔄 Refresh │
├─────────────────────────────────────────────────────────────┤
│ #45 ✨ Add dark mode support              feature/dark-mode │
│     @author · opened 1 day ago · ✅ Ready to merge          │
├─────────────────────────────────────────────────────────────┤
│ #44 🐛 Fix memory leak                    fix/memory-leak   │
│     @author · opened 2 days ago · ⚠️ Conflicts             │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

```tsx
interface PullRequest {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  createdAt: string
  author: { login: string }
  headRefName: string  // source branch
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  reviews: { state: string }[]
}

interface PRsTabProps {
  projectPath: string
}
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/github-view/prs-tab.tsx` | PRs list |

### Modify
| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Add PullRequest type |
| `src/main/ipc/github-handlers.ts` | Add prs:list handler |

## Implementation Steps

### Step 1: Add Types

```tsx
// src/shared/types/index.ts
export interface GitHubPR {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  createdAt: string
  author: { login: string }
  headRefName: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
}
```

### Step 2: Add IPC Handler

```tsx
// src/main/ipc/github-handlers.ts
ipcMain.handle('git:prs:list', async (_, projectPath: string, state = 'open') => {
  const { stdout } = await execAsync(
    `gh pr list --state ${state} --json number,title,state,createdAt,author,headRefName,mergeable`,
    { cwd: projectPath }
  )
  return JSON.parse(stdout)
})
```

### Step 3: Create PRs Tab

```tsx
// src/renderer/components/github-view/prs-tab.tsx
import { useState, useEffect } from 'react'
import type { GitHubPR } from '@shared/types'

interface PRsTabProps {
  projectPath: string
}

export function PRsTab({ projectPath }: PRsTabProps) {
  const [prs, setPrs] = useState<GitHubPR[]>([])
  const [filter, setFilter] = useState<'open' | 'closed' | 'merged' | 'all'>('open')
  const [loading, setLoading] = useState(false)

  const fetchPRs = async () => {
    setLoading(true)
    try {
      const data = await window.api.invoke('git:prs:list', projectPath, filter)
      setPrs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPRs() }, [projectPath, filter])

  const getMergeIcon = (pr: GitHubPR) => {
    if (pr.state === 'merged') return '🟣'
    if (pr.mergeable === 'MERGEABLE') return '✅'
    if (pr.mergeable === 'CONFLICTING') return '⚠️'
    return '⏳'
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-[var(--mc-border)]">
        <select value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="merged">Merged</option>
          <option value="all">All</option>
        </select>
        <button onClick={fetchPRs} disabled={loading}>🔄</button>
      </div>

      <div className="flex-1 overflow-auto">
        {prs.map(pr => (
          <div key={pr.number} className="p-3 border-b border-[var(--mc-border)] hover:bg-[var(--mc-bg-hover)]">
            <div className="flex items-center gap-2">
              <span className="text-[var(--mc-text-muted)]">#{pr.number}</span>
              <span>{pr.title}</span>
              <span className="ml-auto text-xs bg-[var(--mc-bg-tertiary)] px-2 py-0.5 rounded">
                {pr.headRefName}
              </span>
            </div>
            <div className="text-xs text-[var(--mc-text-muted)] mt-1">
              @{pr.author.login} · {getMergeIcon(pr)} {pr.mergeable}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 4: Integrate in GitHub View

```tsx
// github-view.tsx - Add to tabs array
const tabs = [
  { id: 'changes', label: 'Changes' },
  { id: 'history', label: 'History' },
  { id: 'stash', label: 'Stash' },
  { id: 'branches', label: 'Branches' },
  { id: 'issues', label: 'Issues' },
  { id: 'prs', label: 'PRs' }
]

// In tab content
{activeTab === 'issues' && <IssuesTab projectPath={projectPath} />}
{activeTab === 'prs' && <PRsTab projectPath={projectPath} />}
```

## Todo List

- [ ] Add GitHubPR type to shared/types
- [ ] Add prs:list handler to github-handlers.ts
- [ ] Create prs-tab.tsx component
- [ ] Add filter dropdown (open/closed/merged/all)
- [ ] Show merge status icons
- [ ] Show branch name
- [ ] Add refresh button
- [ ] Integrate tabs in github-view.tsx
- [ ] Test with real repository

## Success Criteria

- [ ] PRs load from gh CLI
- [ ] Filter works correctly
- [ ] Merge status shows (✅/⚠️/🟣)
- [ ] Branch name displays
- [ ] Loading state shown
- [ ] Integration with GitHub View works

## Next Steps

Phase 5 complete. Return to main implementation.
