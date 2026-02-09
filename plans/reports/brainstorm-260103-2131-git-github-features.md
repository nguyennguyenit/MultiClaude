# Brainstorm Report: Git & GitHub Features Enhancement

**Date**: 2026-01-03
**Project**: MultiClaude
**Status**: Ready for implementation planning

---

## 1. Problem Statement

MultiClaude hiện có tính năng Git/GitHub cơ bản:
- Init repo, view branch/status, push
- GitHub login, create repo

Cần mở rộng để hỗ trợ workflow Git đầy đủ cho developers sử dụng Claude Code multi-agent.

---

## 2. Requirements Summary

| Category | Features |
|----------|----------|
| **Commit Workflow** | Stage/unstage files, commit with message, view inline diff |
| **Branch Operations** | Create/switch/delete branches, branch selector |
| **Sync Operations** | Pull, push with indicators, fetch status |
| **GitHub Integration** | PR create/view, Actions status, quick links |

### Constraints
- **UI**: Dedicated collapsible Git panel (right of sidebar)
- **Diff**: Inline simple view
- **Approach**: MVP first
- **GitHub API**: gh CLI only (no additional deps)

---

## 3. Evaluated Approaches

### A. UI Layout Options

| Option | Chosen | Rationale |
|--------|--------|-----------|
| Minimal sidebar | ❌ | Would clutter existing sidebar |
| **Dedicated Git panel** | ✅ | Clean separation, VS Code-like UX |
| Separate tab | ❌ | Context switching overhead |

### B. Diff Viewer Options

| Option | Chosen | Rationale |
|--------|--------|-----------|
| **Inline simple** | ✅ | Fast to implement, lightweight |
| Side-by-side | ❌ | Overkill for MVP, adds complexity |
| Modal view | ❌ | Disrupts workflow |

### C. GitHub API Options

| Option | Chosen | Rationale |
|--------|--------|-----------|
| **gh CLI only** | ✅ | Already integrated, minimal maintenance |
| @octokit/rest | ❌ | Additional dependency, more code |
| Hybrid | ❌ | Unnecessary complexity |

---

## 4. Recommended Solution

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Project Tabs                                                 │
├─────────┬───────────────────────┬───────────────────────────┤
│ Sidebar │   Terminal Grid       │  Git Panel (collapsible)  │
│         │                       │  ┌─────────────────────┐  │
│         │                       │  │ Branch: main ▼      │  │
│         │                       │  ├─────────────────────┤  │
│         │                       │  │ Staged (1)          │  │
│         │                       │  │ Changes (2)         │  │
│         │                       │  │ [Inline diff]       │  │
│         │                       │  ├─────────────────────┤  │
│         │                       │  │ Commit message...   │  │
│         │                       │  │ [Commit] [Push]     │  │
│         │                       │  └─────────────────────┘  │
└─────────┴───────────────────────┴───────────────────────────┘
```

### Module Structure

```
src/
├── main/git/
│   ├── git-manager.ts        # Extended: stage, commit, diff, log
│   ├── github-manager.ts     # NEW: PR, Issues, Actions via gh CLI
│   └── index.ts
├── renderer/components/
│   └── git-panel/
│       ├── git-panel.tsx           # Main container + toggle
│       ├── branch-selector.tsx     # Dropdown with create/switch
│       ├── changes-list.tsx        # Staged/unstaged file list
│       ├── diff-viewer.tsx         # Inline unified diff
│       ├── commit-form.tsx         # Message input + buttons
│       ├── sync-controls.tsx       # Pull/Push/Fetch
│       └── github-section.tsx      # PR list, Actions, links
├── renderer/hooks/
│   └── use-git.ts                  # Git state management hook
└── shared/types.ts                 # Extended GitStatus, PRInfo types
```

---

## 5. Implementation Phases

### Phase 1: Core Commit Workflow (MVP Priority)

| Feature | Description |
|---------|-------------|
| Enhanced status | List files by category (staged/modified/untracked) |
| Stage/unstage | Click to toggle, "Stage All" button |
| Inline diff | Show unified diff for selected file |
| Commit dialog | Message input + Commit button |
| Discard changes | Discard unstaged changes for file |

**New GitManager methods:**
```typescript
getFileStatus(cwd: string): Promise<DetailedFileStatus[]>
stageFile(cwd: string, file: string): Promise<boolean>
unstageFile(cwd: string, file: string): Promise<boolean>
stageAll(cwd: string): Promise<boolean>
commit(cwd: string, message: string): Promise<{ success: boolean; hash?: string }>
getDiff(cwd: string, file?: string, staged?: boolean): Promise<string>
discardChanges(cwd: string, file: string): Promise<boolean>
```

### Phase 2: Branch Operations

| Feature | Description |
|---------|-------------|
| Branch selector | Dropdown showing current + local branches |
| Create branch | Input + create from current HEAD |
| Switch branch | With dirty-state warning |
| Delete branch | With confirmation for unmerged |

**New methods:**
```typescript
getBranches(cwd: string): Promise<BranchInfo[]>
createBranch(cwd: string, name: string): Promise<boolean>
switchBranch(cwd: string, name: string): Promise<{ success: boolean; error?: string }>
deleteBranch(cwd: string, name: string, force?: boolean): Promise<boolean>
```

### Phase 3: Sync Operations

| Feature | Description |
|---------|-------------|
| Pull button | Pull with merge/rebase option |
| Push button | With commit count badge |
| Fetch | Update remote tracking |
| Status indicators | Ahead/behind counts |

**New methods:**
```typescript
pull(cwd: string, rebase?: boolean): Promise<{ success: boolean; conflicts?: string[] }>
getRemoteStatus(cwd: string): Promise<{ ahead: number; behind: number }>
fetch(cwd: string): Promise<boolean>
```

### Phase 4: GitHub Features

| Feature | Description |
|---------|-------------|
| Create PR | From current branch to default |
| PR list | View open PRs for repo |
| Actions status | Show latest workflow status |
| Quick links | Open repo/PRs/Issues in browser |

**New gh CLI commands:**
```bash
gh pr create --title "..." --body "..."
gh pr list --json number,title,state,url
gh run list --limit 5 --json status,conclusion,name,url
gh repo view --web  # Open in browser
```

---

## 6. Technical Considerations

### Dependencies
- `simple-git` (existing) - extend usage
- `diff` or `diff2html` - for diff display (evaluate at implementation)
- `gh` CLI (existing) - extend for PR/Actions

### State Management
```typescript
// New Zustand slice or dedicated hook
interface GitPanelState {
  isOpen: boolean
  selectedFile: string | null
  fileStatuses: DetailedFileStatus[]
  branches: BranchInfo[]
  currentBranch: string
  diffContent: string | null
  commitMessage: string
  syncStatus: { ahead: number; behind: number }
}
```

### IPC Channels (new)
```typescript
// src/shared/constants.ts additions
GIT_STAGE_FILE: 'git:stage-file'
GIT_UNSTAGE_FILE: 'git:unstage-file'
GIT_STAGE_ALL: 'git:stage-all'
GIT_COMMIT: 'git:commit'
GIT_DIFF: 'git:diff'
GIT_DISCARD: 'git:discard'
GIT_BRANCHES: 'git:branches'
GIT_CREATE_BRANCH: 'git:create-branch'
GIT_SWITCH_BRANCH: 'git:switch-branch'
GIT_DELETE_BRANCH: 'git:delete-branch'
GIT_PULL: 'git:pull'
GIT_FETCH: 'git:fetch'
GIT_REMOTE_STATUS: 'git:remote-status'
GITHUB_PR_CREATE: 'github:pr-create'
GITHUB_PR_LIST: 'github:pr-list'
GITHUB_ACTIONS_STATUS: 'github:actions-status'
```

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Merge conflicts handling | Phase 1: just report, không auto-resolve |
| Large repo performance | Lazy load file list, paginate history |
| gh CLI not installed | Clear error message + install link |
| Panel takes too much space | Collapsible, remember state |

---

## 8. Success Metrics

- [ ] User có thể stage/commit/push mà không cần rời app
- [ ] Branch operations work smoothly with dirty-state checks
- [ ] GitHub PR creation from app
- [ ] Panel không ảnh hưởng terminal workflow

---

## 9. Next Steps

1. **Approve this brainstorm** → proceed to implementation plan
2. **Phase 1 first**: ~10-15 files, core commit workflow
3. **Iterate**: Ship Phase 1 → gather feedback → Phase 2+

---

## Unresolved Questions

1. Diff library: `diff` (lighter) vs `diff2html` (prettier) - evaluate at impl
2. Commit history viewer: include in MVP or defer?
3. Stash support: include or defer?
