# Phase 3: Frontend - Git Panel Components

## Overview

Create React components for the Git panel with file list, diff viewer, and commit form.

**Status:** Pending
**Effort:** 2.5h
**Priority:** P1 (Depends on Phase 2)

## Context Links

- [Main Plan](./plan.md)
- [Phase 2](./phase-02-ipc-preload.md)
- Component style reference: `src/renderer/components/sidebar/sidebar.tsx`

## Requirements

### UI Components
1. **GitPanel** - Main container with toggle visibility
2. **ChangesList** - File list grouped by staged/unstaged
3. **DiffViewer** - Inline unified diff display
4. **CommitForm** - Message input + commit button

### Interactions
- Click file → toggle stage/unstage
- Click file name → show diff
- Right-click file → context menu (stage/unstage/discard)
- Enter commit message → Commit button enabled
- Commit → clear message, refresh status

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Create | `src/renderer/components/git-panel/index.ts` | Barrel export |
| Create | `src/renderer/components/git-panel/git-panel.tsx` | Main container |
| Create | `src/renderer/components/git-panel/changes-list.tsx` | File list |
| Create | `src/renderer/components/git-panel/diff-viewer.tsx` | Diff display |
| Create | `src/renderer/components/git-panel/commit-form.tsx` | Commit UI |
| Create | `src/renderer/hooks/use-git-panel.ts` | State management hook |

## Implementation Steps

### Step 1: Create Hook (src/renderer/hooks/use-git-panel.ts)

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { GitFileStatus, GitDiffResult } from '@shared/types'

interface UseGitPanelOptions {
  projectPath: string | undefined
  enabled?: boolean
}

interface UseGitPanelReturn {
  files: GitFileStatus[]
  selectedFile: string | null
  diff: string | null
  isLoading: boolean
  // Actions
  refresh: () => Promise<void>
  selectFile: (path: string | null) => void
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  discardFile: (path: string) => Promise<void>
  commit: (message: string) => Promise<boolean>
}

export function useGitPanel({ projectPath, enabled = true }: UseGitPanelOptions): UseGitPanelReturn {
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch file status
  const refresh = useCallback(async () => {
    if (!projectPath || !enabled) return
    setIsLoading(true)
    try {
      const status = await window.electron.git.fileStatus(projectPath)
      setFiles(status)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath, enabled])

  // Load diff when file selected
  const selectFile = useCallback(async (path: string | null) => {
    setSelectedFile(path)
    if (!path || !projectPath) {
      setDiff(null)
      return
    }
    const file = files.find(f => f.path === path)
    const result = await window.electron.git.diff(projectPath, path, file?.staged)
    setDiff(result.success ? result.diff || '' : null)
  }, [projectPath, files])

  // Stage file
  const stageFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.stageFile(projectPath, path)
    await refresh()
  }, [projectPath, refresh])

  // Unstage file
  const unstageFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.unstageFile(projectPath, path)
    await refresh()
  }, [projectPath, refresh])

  // Stage all
  const stageAll = useCallback(async () => {
    if (!projectPath) return
    await window.electron.git.stageAll(projectPath)
    await refresh()
  }, [projectPath, refresh])

  // Discard file
  const discardFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.discard(projectPath, path)
    await refresh()
    if (selectedFile === path) {
      setSelectedFile(null)
      setDiff(null)
    }
  }, [projectPath, refresh, selectedFile])

  // Commit
  const commit = useCallback(async (message: string): Promise<boolean> => {
    if (!projectPath || !message.trim()) return false
    const result = await window.electron.git.commit(projectPath, message)
    if (result.success) {
      await refresh()
      setSelectedFile(null)
      setDiff(null)
    }
    return result.success
  }, [projectPath, refresh])

  // Initial load + auto-refresh
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [refresh])

  return {
    files,
    selectedFile,
    diff,
    isLoading,
    refresh,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    discardFile,
    commit
  }
}
```

### Step 2: Update hooks barrel (src/renderer/hooks/index.ts)

```typescript
export { useKeyboardShortcuts } from './use-keyboard-shortcuts'
export { useGitPanel } from './use-git-panel'
```

### Step 3: Create ChangesList (src/renderer/components/git-panel/changes-list.tsx)

```typescript
import type { GitFileStatus } from '@shared/types'

interface ChangesListProps {
  files: GitFileStatus[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  onStageFile: (path: string) => void
  onUnstageFile: (path: string) => void
  onDiscardFile: (path: string) => void
  onStageAll: () => void
}

export function ChangesList({
  files,
  selectedFile,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll
}: ChangesListProps) {
  const staged = files.filter(f => f.staged)
  const unstaged = files.filter(f => !f.staged)

  const getStatusIcon = (status: GitFileStatus['status']) => {
    switch (status) {
      case 'staged': return 'M'
      case 'modified': return 'M'
      case 'untracked': return 'U'
      case 'deleted': return 'D'
      case 'renamed': return 'R'
      default: return '?'
    }
  }

  const getStatusColor = (status: GitFileStatus['status']) => {
    switch (status) {
      case 'staged': return 'text-green-400'
      case 'modified': return 'text-yellow-400'
      case 'untracked': return 'text-green-400'
      case 'deleted': return 'text-red-400'
      case 'renamed': return 'text-blue-400'
      default: return 'text-[var(--mc-text-muted)]'
    }
  }

  const FileRow = ({ file }: { file: GitFileStatus }) => (
    <div
      className={`
        flex items-center gap-2 px-2 py-1 cursor-pointer rounded text-xs
        ${selectedFile === file.path ? 'bg-[var(--mc-bg-active)]' : 'hover:bg-[var(--mc-bg-hover)]'}
      `}
      onClick={() => onSelectFile(file.path)}
    >
      <span className={`font-mono ${getStatusColor(file.status)}`}>
        {getStatusIcon(file.status)}
      </span>
      <span className="flex-1 truncate">{file.path}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
        {file.staged ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path) }}
            className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Unstage"
          >
            −
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onStageFile(file.path) }}
              className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded"
              title="Stage"
            >
              +
            </button>
            {file.status !== 'untracked' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDiscardFile(file.path) }}
                className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-red-400"
                title="Discard"
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Staged Section */}
      {staged.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[var(--mc-text-muted)]">
            <span>Staged ({staged.length})</span>
          </div>
          <div className="group">
            {staged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {/* Changes Section */}
      {unstaged.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[var(--mc-text-muted)]">
            <span>Changes ({unstaged.length})</span>
            <button
              onClick={onStageAll}
              className="text-[var(--mc-accent)] hover:underline"
            >
              Stage All
            </button>
          </div>
          <div className="group">
            {unstaged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="px-2 py-4 text-xs text-[var(--mc-text-muted)] text-center">
          No changes
        </div>
      )}
    </div>
  )
}
```

### Step 4: Create DiffViewer (src/renderer/components/git-panel/diff-viewer.tsx)

```typescript
interface DiffViewerProps {
  diff: string | null
  fileName: string | null
}

export function DiffViewer({ diff, fileName }: DiffViewerProps) {
  if (!diff || !fileName) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
        Select a file to view diff
      </div>
    )
  }

  // Parse diff lines and colorize
  const lines = diff.split('\n')

  return (
    <div className="flex-1 overflow-auto bg-[var(--mc-bg-primary)] border-t border-[var(--mc-border)]">
      <div className="p-2 text-xs border-b border-[var(--mc-border)] text-[var(--mc-text-muted)]">
        {fileName}
      </div>
      <pre className="p-2 text-xs font-mono leading-tight overflow-x-auto">
        {lines.map((line, i) => {
          let className = ''
          if (line.startsWith('+') && !line.startsWith('+++')) {
            className = 'text-green-400 bg-green-900/20'
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            className = 'text-red-400 bg-red-900/20'
          } else if (line.startsWith('@@')) {
            className = 'text-blue-400'
          }
          return (
            <div key={i} className={className}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
    </div>
  )
}
```

### Step 5: Create CommitForm (src/renderer/components/git-panel/commit-form.tsx)

```typescript
import { useState } from 'react'

interface CommitFormProps {
  stagedCount: number
  onCommit: (message: string) => Promise<boolean>
}

export function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)

  const handleCommit = async () => {
    if (!message.trim() || stagedCount === 0) return
    setIsCommitting(true)
    const success = await onCommit(message)
    setIsCommitting(false)
    if (success) {
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommit()
    }
  }

  return (
    <div className="border-t border-[var(--mc-border)] p-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        className="w-full h-16 px-2 py-1 text-xs bg-[var(--mc-bg-hover)] rounded resize-none"
        disabled={isCommitting}
      />
      <button
        onClick={handleCommit}
        disabled={!message.trim() || stagedCount === 0 || isCommitting}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded disabled:opacity-50"
      >
        {isCommitting ? 'Committing...' : `Commit (${stagedCount})`}
      </button>
      <div className="text-[10px] text-[var(--mc-text-muted)] mt-1 text-center">
        Ctrl+Enter to commit
      </div>
    </div>
  )
}
```

### Step 6: Create GitPanel (src/renderer/components/git-panel/git-panel.tsx)

```typescript
import { useGitPanel } from '../../hooks'
import { ChangesList } from './changes-list'
import { DiffViewer } from './diff-viewer'
import { CommitForm } from './commit-form'

interface GitPanelProps {
  projectPath: string | undefined
  isOpen: boolean
  onToggle: () => void
}

export function GitPanel({ projectPath, isOpen, onToggle }: GitPanelProps) {
  const {
    files,
    selectedFile,
    diff,
    isLoading,
    refresh,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    discardFile,
    commit
  } = useGitPanel({ projectPath, enabled: isOpen })

  const stagedCount = files.filter(f => f.staged).length

  return (
    <>
      {/* Toggle Button (always visible) */}
      <button
        onClick={onToggle}
        className={`
          absolute top-2 right-2 z-10 p-1.5 rounded
          ${isOpen ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]' : 'bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)]'}
        `}
        title="Toggle Git Panel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="w-72 bg-[var(--mc-bg-secondary)] border-l border-[var(--mc-border)] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--mc-border)]">
            <span className="text-sm font-medium">Git</span>
            <button
              onClick={refresh}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
              title="Refresh"
            >
              <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Changes List */}
          <ChangesList
            files={files}
            selectedFile={selectedFile}
            onSelectFile={selectFile}
            onStageFile={stageFile}
            onUnstageFile={unstageFile}
            onDiscardFile={discardFile}
            onStageAll={stageAll}
          />

          {/* Diff Viewer */}
          <DiffViewer diff={diff} fileName={selectedFile} />

          {/* Commit Form */}
          <CommitForm stagedCount={stagedCount} onCommit={commit} />
        </div>
      )}
    </>
  )
}
```

### Step 7: Create barrel export (src/renderer/components/git-panel/index.ts)

```typescript
export { GitPanel } from './git-panel'
```

## Todo List

- [ ] Create use-git-panel.ts hook
- [ ] Update hooks/index.ts barrel
- [ ] Create changes-list.tsx component
- [ ] Create diff-viewer.tsx component
- [ ] Create commit-form.tsx component
- [ ] Create git-panel.tsx container
- [ ] Create git-panel/index.ts barrel
- [ ] Test all interactions

## Success Criteria

- Panel shows staged/unstaged files correctly
- Click toggles stage/unstage
- Diff displays for selected file
- Commit works with message
- Discard removes unstaged changes

## Next Steps

→ Phase 4: Integration & Layout
