# Phase 1: Issues Tab Component

## Context

- Plan: `plans/260104-0413-ui-redesign-phase5-issues-prs/plan.md`
- Depends: Phase 3 GitHub View

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 1.5h

Create Issues tab showing repository issues via gh CLI.

## Requirements

### Functional
- List open/closed issues
- Show: number, title, state, author, created date, labels
- Filter by state (open/closed/all)
- Click to view issue details
- Refresh button

### Design
```
┌─────────────────────────────────────────────────────────────┐
│ Filter: [Open ▾]                                 🔄 Refresh │
├─────────────────────────────────────────────────────────────┤
│ #123 🐛 Bug: Login fails on mobile                          │
│     @author · opened 2 hours ago · bug, high-priority       │
├─────────────────────────────────────────────────────────────┤
│ #122 ✨ Feature: Add dark mode                               │
│     @author · opened 1 day ago · enhancement                │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

```tsx
interface Issue {
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  author: { login: string }
  labels: { name: string; color: string }[]
}

interface IssuesTabProps {
  projectPath: string
}
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/github-view/issues-tab.tsx` | Issues list |
| `src/main/ipc/github-handlers.ts` | gh CLI handlers |

### Modify
| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Add Issue type |
| `src/main/ipc/index.ts` | Register github handlers |

## Implementation Steps

### Step 1: Add Types

```tsx
// src/shared/types/index.ts
export interface GitHubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  author: { login: string }
  labels: { name: string; color: string }[]
  body?: string
}
```

### Step 2: Create IPC Handler

```tsx
// src/main/ipc/github-handlers.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerGitHubHandlers(ipcMain: IpcMain) {
  ipcMain.handle('git:issues:list', async (_, projectPath: string, state = 'open') => {
    const { stdout } = await execAsync(
      `gh issue list --state ${state} --json number,title,state,createdAt,author,labels`,
      { cwd: projectPath }
    )
    return JSON.parse(stdout)
  })
}
```

### Step 3: Create Issues Tab

```tsx
// src/renderer/components/github-view/issues-tab.tsx
import { useState, useEffect } from 'react'
import type { GitHubIssue } from '@shared/types'

interface IssuesTabProps {
  projectPath: string
}

export function IssuesTab({ projectPath }: IssuesTabProps) {
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [loading, setLoading] = useState(false)

  const fetchIssues = async () => {
    setLoading(true)
    try {
      const data = await window.api.invoke('git:issues:list', projectPath, filter)
      setIssues(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchIssues() }, [projectPath, filter])

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--mc-border)]">
        <select value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
        <button onClick={fetchIssues} disabled={loading}>🔄</button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {issues.map(issue => (
          <IssueItem key={issue.number} issue={issue} />
        ))}
      </div>
    </div>
  )
}
```

## Todo List

- [ ] Add GitHubIssue type to shared/types
- [ ] Create github-handlers.ts with issues:list
- [ ] Register handlers in main/ipc/index.ts
- [ ] Create issues-tab.tsx component
- [ ] Add filter dropdown
- [ ] Add refresh button
- [ ] Style issue items with labels
- [ ] Test with real repository

## Success Criteria

- [ ] Issues load from gh CLI
- [ ] Filter works (open/closed/all)
- [ ] Refresh fetches new data
- [ ] Labels display with colors
- [ ] Loading state shown

## Next Steps

Proceed to Phase 2: PRs Tab Component
