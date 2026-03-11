# Phase 1: Backend - GitManager Extension

## Overview

Extend `GitManager` class with methods for commit workflow operations.

**Status:** Pending
**Effort:** 1.5h
**Priority:** P1 (Blocker for all other phases)

## Context Links

- [Main Plan](./plan.md)
- Existing code: `src/main/git/git-manager.ts`
- Uses: `simple-git` library

## Key Insights

- `simple-git` already supports all required operations
- Existing pattern: methods return `Promise<boolean>` for success/fail
- Status result structure from `simple-git` provides file-level detail

## Requirements

### Functional
1. Get detailed file status (staged, modified, untracked, deleted)
2. Stage individual file or all files
3. Unstage individual file
4. Create commit with message
5. Get diff for file (staged or unstaged)
6. Discard unstaged changes for file

### Non-functional
- Error handling: return structured result, don't throw
- Performance: no blocking operations

## Types (add to src/shared/types/index.ts)

```typescript
// File status for Git panel
export interface GitFileStatus {
  path: string
  status: 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed' | 'copied'
  staged: boolean
  oldPath?: string  // For renames
}

// Commit result
export interface GitCommitResult {
  success: boolean
  hash?: string
  error?: string
}

// Diff result
export interface GitDiffResult {
  success: boolean
  diff?: string
  error?: string
}
```

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/shared/types/index.ts` | Add new types |
| Modify | `src/main/git/git-manager.ts` | Add 7 new methods |

## Implementation Steps

### Step 1: Add Types (src/shared/types/index.ts)

Add after line 88 (after GitHubAuth):

```typescript
// Git file status for panel
export interface GitFileStatus {
  path: string
  status: 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed' | 'copied'
  staged: boolean
  oldPath?: string
}

export interface GitCommitResult {
  success: boolean
  hash?: string
  error?: string
}

export interface GitDiffResult {
  success: boolean
  diff?: string
  error?: string
}
```

### Step 2: Extend GitManager (src/main/git/git-manager.ts)

Add these methods to the class:

```typescript
// After existing methods (~line 88)

async getFileStatus(cwd: string): Promise<GitFileStatus[]> {
  const git = this.getGit(cwd)
  try {
    const status = await git.status()
    const files: GitFileStatus[] = []

    // Staged files
    for (const file of status.staged) {
      files.push({ path: file, status: 'staged', staged: true })
    }

    // Renamed (staged)
    for (const { from, to } of status.renamed) {
      files.push({ path: to, status: 'renamed', staged: true, oldPath: from })
    }

    // Modified (unstaged)
    for (const file of status.modified) {
      // Skip if already in staged
      if (!status.staged.includes(file)) {
        files.push({ path: file, status: 'modified', staged: false })
      }
    }

    // Deleted (unstaged)
    for (const file of status.deleted) {
      if (!status.staged.includes(file)) {
        files.push({ path: file, status: 'deleted', staged: false })
      }
    }

    // Untracked
    for (const file of status.not_added) {
      files.push({ path: file, status: 'untracked', staged: false })
    }

    return files
  } catch {
    return []
  }
}

async stageFile(cwd: string, file: string): Promise<boolean> {
  const git = this.getGit(cwd)
  try {
    await git.add(file)
    return true
  } catch {
    return false
  }
}

async unstageFile(cwd: string, file: string): Promise<boolean> {
  const git = this.getGit(cwd)
  try {
    await git.reset(['HEAD', '--', file])
    return true
  } catch {
    return false
  }
}

async stageAll(cwd: string): Promise<boolean> {
  const git = this.getGit(cwd)
  try {
    await git.add('-A')
    return true
  } catch {
    return false
  }
}

async commit(cwd: string, message: string): Promise<GitCommitResult> {
  const git = this.getGit(cwd)
  try {
    const result = await git.commit(message)
    return {
      success: true,
      hash: result.commit
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Commit failed'
    }
  }
}

async getDiff(cwd: string, file?: string, staged = false): Promise<GitDiffResult> {
  const git = this.getGit(cwd)
  try {
    const args: string[] = staged ? ['--cached'] : []
    if (file) args.push('--', file)

    const diff = await git.diff(args)
    return { success: true, diff }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Diff failed'
    }
  }
}

async discardChanges(cwd: string, file: string): Promise<boolean> {
  const git = this.getGit(cwd)
  try {
    // Check if file is untracked
    const status = await git.status()
    if (status.not_added.includes(file)) {
      // For untracked files, use clean
      await git.clean('f', ['--', file])
    } else {
      // For tracked files, use checkout
      await git.checkout(['--', file])
    }
    return true
  } catch {
    return false
  }
}
```

### Step 3: Update Import (src/main/git/git-manager.ts)

Add types to import:

```typescript
import type { GitStatus, GitHubAuth, GitFileStatus, GitCommitResult, GitDiffResult } from '@shared/types'
```

## Todo List

- [ ] Add GitFileStatus, GitCommitResult, GitDiffResult types to shared/types
- [ ] Add getFileStatus() method
- [ ] Add stageFile() method
- [ ] Add unstageFile() method
- [ ] Add stageAll() method
- [ ] Add commit() method
- [ ] Add getDiff() method
- [ ] Add discardChanges() method
- [ ] Test all methods manually

## Success Criteria

- All 7 methods work with real git repos
- Proper error handling (no throws)
- Types exported correctly

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| simple-git API changes | Low | Medium | Pin version, test thoroughly |
| Edge case: binary files | Medium | Low | Diff returns empty for binaries |
| Edge case: submodules | Low | Low | Treat as regular files |

## Security Considerations

- File paths sanitized by simple-git
- No shell injection risk (using library API, not shell commands)

## Next Steps

→ Phase 2: IPC & Preload Layer
