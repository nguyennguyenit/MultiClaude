# Phase 3: User Account Card

## Context

- Plan: `plans/260104-0335-ui-redesign-phase1/plan.md`
- Design Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 145-178)
- Depends on: Phase 1 (Collapsible Sidebar)

## Overview

- **Priority**: P1
- **Status**: Completed
- **Effort**: 1.5h

Create dedicated User Account Card component displaying GitHub user info, connection status, and current branch.

## Requirements

### Functional
- Display GitHub username when connected
- Show connection status with colored indicator
- Show current Git branch
- Collapsed mode: icon only with tooltip
- Click opens quick actions dropdown (future)

### Connection States

| State | Icon | Color | Condition |
|-------|------|-------|-----------|
| Connected | ● | Green | GitHub authenticated |
| Disconnected | ○ | Gray | Not logged in |
| Syncing | ◐ | Amber | Operation in progress |
| Error | ● | Red | Connection failed |

### Design Spec

```
Expanded:
┌──────────────────────────┐
│  👤 nguyennguyenit       │
│  ● Connected             │
│  🌿 main                 │
└──────────────────────────┘

Collapsed (with tooltip):
┌──────┐   ┌─────────────────────┐
│  👤  │ → │ nguyennguyenit      │
│  ●   │   │ Connected           │
└──────┘   │ Branch: main        │
           └─────────────────────┘
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/sidebar/sidebar.tsx` | Integrate UserAccountCard |

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/sidebar/user-account-card.tsx` | User card component |

## Implementation Steps

### Step 1: Create User Account Card Component

```tsx
// src/renderer/components/sidebar/user-account-card.tsx
import { useState, useEffect } from 'react'
import type { GitHubAuth, GitStatus } from '@shared/types'

interface UserAccountCardProps {
  collapsed: boolean
  projectPath?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'syncing' | 'error'

const STATUS_STYLES: Record<ConnectionState, { icon: string; color: string; text: string }> = {
  connected: { icon: '●', color: 'text-green-400', text: 'Connected' },
  disconnected: { icon: '○', color: 'text-gray-400', text: 'Disconnected' },
  syncing: { icon: '◐', color: 'text-amber-400', text: 'Syncing...' },
  error: { icon: '●', color: 'text-red-400', text: 'Error' }
}

export function UserAccountCard({ collapsed, projectPath }: UserAccountCardProps) {
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // Load GitHub auth status
  useEffect(() => {
    window.electron.github.authStatus().then((auth) => {
      setGithubAuth(auth)
      setConnectionState(auth.isAuthenticated ? 'connected' : 'disconnected')
    })
  }, [])

  // Load Git status for branch
  useEffect(() => {
    if (projectPath) {
      window.electron.git.status(projectPath).then(setGitStatus)
    }
  }, [projectPath])

  const status = STATUS_STYLES[connectionState]
  const username = githubAuth?.username || 'Not logged in'
  const branch = gitStatus?.branch || 'No branch'

  // Collapsed view
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-1 py-3 cursor-pointer hover:bg-[var(--mc-bg-hover)]"
        title={`${username}\n${status.text}\nBranch: ${branch}`}
      >
        <span className="text-xl">👤</span>
        <span className={`text-xs ${status.color}`}>{status.icon}</span>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">👤</span>
        <span className="font-medium text-sm truncate">{username}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${status.color}`}>
        <span>{status.icon}</span>
        <span>{status.text}</span>
      </div>
      {gitStatus?.branch && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--mc-text-muted)] mt-1">
          <span>🌿</span>
          <span>{branch}</span>
        </div>
      )}
    </div>
  )
}
```

### Step 2: Integrate into Sidebar

```tsx
// src/renderer/components/sidebar/sidebar.tsx
import { UserAccountCard } from './user-account-card'

// Inside Sidebar component, after navigation and before settings:
<div className="flex-1" /> {/* Spacer */}

<UserAccountCard
  collapsed={sidebarCollapsed}
  projectPath={activeProject?.path}
/>

<div className="border-t border-[var(--mc-border)]">
  {/* Settings button */}
</div>
```

### Step 3: Add Tooltip Component (Optional Enhancement)

For better collapsed-mode tooltips, consider using a tooltip library or creating a simple tooltip wrapper:

```tsx
// Simple tooltip wrapper (can use native title for MVP)
<div title={tooltipContent}>
  {children}
</div>
```

## Todo List

- [x] Create user-account-card.tsx component
- [x] Define ConnectionState type and STATUS_STYLES
- [x] Implement expanded view with username, status, branch
- [x] Implement collapsed view with icon + tooltip
- [x] Load GitHub auth status on mount
- [x] Load Git status when project changes
- [x] Integrate into sidebar layout
- [x] Style card with proper colors/spacing
- [x] Test with connected/disconnected states

## Success Criteria

- [x] Card shows GitHub username when authenticated
- [x] Connection status indicator shows correct color
- [x] Current branch displays when in git repo
- [x] Collapsed mode shows icon with tooltip on hover
- [x] Card updates when project changes
- [x] Card updates when auth status changes

## Security Considerations

- No credentials stored in component
- All auth info fetched via IPC from secure main process

## Next Steps

After completing this phase:
1. Proceed to Phase 4: Integration & Polish
2. Final testing and visual polish
