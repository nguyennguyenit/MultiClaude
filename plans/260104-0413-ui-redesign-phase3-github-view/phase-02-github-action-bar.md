# Phase 2: GitHub Action Bar

## Context

- Plan: `plans/260104-0413-ui-redesign-phase3-github-view/plan.md`
- Design: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 327-335)
- Depends: Phase 1 (GitHub View Container)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1.5h

Create action bar with repository name and Push/Pull/Sync/Fetch buttons.

## Key Insights

From existing GitPanel:
- Push/Pull/Sync handlers already exist in useGitPanel
- Remote check via `gitStatus?.hasRemote`
- Syncing state managed with `useState`

## Requirements

### Design Spec
```
┌─────────────────────────────────┬───────────────────────────────────┐
│  🔀 owner/repo                  │   ⬆️ Push   ⬇️ Pull   🔄 Sync   📥 Fetch │
└─────────────────────────────────┴───────────────────────────────────┘
```

### Functional
- Left: Git icon + repository name (owner/repo format)
- Right: Push, Pull, Sync, Fetch buttons
- Buttons disabled when no remote or when syncing
- Loading state during operations

## Architecture

```tsx
interface GitHubActionBarProps {
  repoName: string | undefined  // "owner/repo" format
  hasRemote: boolean
  syncing: boolean
  onPush: () => Promise<void>
  onPull: () => Promise<void>
  onSync: () => Promise<void>
  onFetch: () => Promise<void>
}
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/github-view/github-action-bar.tsx` | Action bar |

### Modify
| File | Changes |
|------|---------|
| `github-view.tsx` | Integrate action bar |

## Implementation Steps

### Step 1: Create Action Bar Component

```tsx
// src/renderer/components/github-view/github-action-bar.tsx
interface GitHubActionBarProps {
  repoName: string | undefined
  hasRemote: boolean
  syncing: boolean
  onPush: () => Promise<void>
  onPull: () => Promise<void>
  onSync: () => Promise<void>
  onFetch: () => Promise<void>
}

export function GitHubActionBar({
  repoName,
  hasRemote,
  syncing,
  onPush,
  onPull,
  onSync,
  onFetch
}: GitHubActionBarProps) {
  return (
    <div className="h-10 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Left: Repository name */}
      <div className="flex items-center gap-2 text-sm">
        <span>🔀</span>
        <span className="font-medium">
          {repoName || 'No repository'}
        </span>
      </div>

      {/* Right: Action buttons */}
      {hasRemote && (
        <div className="flex items-center gap-2">
          <ActionButton
            icon="⬆️"
            label="Push"
            onClick={onPush}
            disabled={syncing}
          />
          <ActionButton
            icon="⬇️"
            label="Pull"
            onClick={onPull}
            disabled={syncing}
          />
          <ActionButton
            icon="🔄"
            label="Sync"
            onClick={onSync}
            disabled={syncing}
            loading={syncing}
          />
          <ActionButton
            icon="📥"
            label="Fetch"
            onClick={onFetch}
            disabled={syncing}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  loading
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 flex items-center gap-1"
      title={label}
    >
      <span className={loading ? 'animate-spin' : ''}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
```

### Step 2: Extract Repository Name

```tsx
// In github-view.tsx
// Parse remote URL to get owner/repo
function parseRepoName(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) return undefined

  // Handle SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:(.+)\.git/)
  if (sshMatch) return sshMatch[1]

  // Handle HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/(.+?)(?:\.git)?$/)
  if (httpsMatch) return httpsMatch[1]

  return undefined
}
```

### Step 3: Integrate in GitHub View

```tsx
// github-view.tsx
const [syncing, setSyncing] = useState(false)
const repoName = parseRepoName(gitPanel.gitStatus?.remote)

const handleSync = async () => {
  setSyncing(true)
  try {
    await gitPanel.pull()
    await gitPanel.push()
  } finally {
    setSyncing(false)
  }
}

// In JSX:
<GitHubActionBar
  repoName={repoName}
  hasRemote={gitPanel.gitStatus?.hasRemote ?? false}
  syncing={syncing}
  onPush={() => { setSyncing(true); gitPanel.push().finally(() => setSyncing(false)) }}
  onPull={() => { setSyncing(true); gitPanel.pull().finally(() => setSyncing(false)) }}
  onSync={handleSync}
  onFetch={() => { setSyncing(true); gitPanel.fetch().finally(() => setSyncing(false)) }}
/>
```

## Todo List

- [ ] Create github-action-bar.tsx
- [ ] Create ActionButton helper component
- [ ] Create parseRepoName utility
- [ ] Add syncing state to github-view
- [ ] Wire up Push/Pull/Sync/Fetch handlers
- [ ] Integrate action bar in github-view
- [ ] Test all button states
- [ ] Test with/without remote

## Success Criteria

- [ ] Action bar shows repository name
- [ ] All 4 buttons visible when has remote
- [ ] Buttons disabled during sync
- [ ] Sync shows loading animation
- [ ] No buttons when no remote

## Next Steps

Proceed to Phase 3: Repo Info Header
