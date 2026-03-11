# GitHub Setup Dialog & Project Settings Exploration Report

**Date**: 2026-02-01  
**Project**: MultiClaude  
**Focus**: GitHub setup flow, project settings storage, new project addition, UI components

---

## 1. Key Findings

### 1.1 No Dedicated GitHub Setup Dialog
- **No "Skip for now" button found** in the codebase
- GitHub authentication is **opt-in via sidebar user account card**
- No modal dialogs forcing GitHub setup on app launch or project creation
- GitHub features (Issues/PRs tabs, create repo) are available **only if gh CLI is authenticated**

### 1.2 Project Storage Mechanism
- **Location**: `src/main/project/project-store.ts`
- **Storage**: electron-store (not localStorage)
- **Type**: `Project` interface with: `id`, `name`, `path`, `gitRemote?`, `createdAt`, `updatedAt`
- **IPC Channel**: `PROJECT_CREATE`, `PROJECT_LIST`, `PROJECT_DELETE`
- **API**: `window.electron.project.create()`, `.list()`, `.delete()`

### 1.3 GitHub Authentication
- **Method**: via `gh` CLI (GitHub CLI)
- **IPC Channels**: `GITHUB_AUTH_STATUS`, `GITHUB_LOGIN`, `GITHUB_LOGOUT`, `GITHUB_CREATE_REPO`
- **Storage**: Handled by gh CLI (system-level, not in app)
- **No stored tokens in app**: User is responsible for `gh auth login`
- **Authentication check**: `window.electron.github.authStatus()` → `{isAuthenticated, username?}`

### 1.4 GitHub Features Available
- Issues tab (read-only list)
- PRs tab (read-only list, merge status)
- Create repository (via `window.electron.github.createRepo()`)
- Login/Logout UI in sidebar

---

## 2. File Structure & Components

### 2.1 Project Management Files

**Main Process** (`src/main/`):
```
project/
├── project-store.ts          # Electron-store based persistence
└── __tests__/
    └── project-store.spec.ts # Storage tests

ipc/
├── handlers.ts               # IPC for PROJECT_* channels
│   ├── PROJECT_LIST
│   ├── PROJECT_CREATE
│   ├── PROJECT_DELETE
│   ├── PROJECT_OPEN_FOLDER (dialog.showOpenDialog)
│   └── PROJECT_CHECK_FOLDER (validates folder exists & git status)
└── github-handlers.ts        # GitHub issues/PRs via `gh` CLI
```

**Renderer Process** (`src/renderer/`):
```
components/
├── project-tabs/
│   └── project-tabs.tsx      # Tab bar showing projects + add button
├── welcome-screen.tsx        # "Add Project" button when no projects
└── App.tsx                   # Main app logic
```

**Stores** (`src/renderer/stores/`):
```
app-store.ts                  # Zustand: projects[], activeProjectId
settings-store.ts            # Theme, terminal limits, NOT project config
```

### 2.2 GitHub Integration Files

**Sidebar Account Card** (`src/renderer/components/sidebar/user-account-card.tsx`):
- Shows GitHub username or "GitHub CLI"
- Connection status indicator (connected/disconnected/syncing)
- Logout button (if authenticated)
- Git branch display
- Git identity (name/email) editor
- NO dialog or setup flow

**GitHub Views** (`src/renderer/components/github-view/`):
```
github-view.tsx              # Main container for all GitHub tabs
├── github-action-bar.tsx    # Push/Pull/Sync/Fetch buttons
├── repo-info-header.tsx     # Branch selector, create branch
├── issues-tab.tsx           # List issues, filter by state
├── prs-tab.tsx              # List PRs, merge status
└── [git panels]             # Changes, history, branches, stash
```

**IPC for GitHub** (`src/main/ipc/github-handlers.ts`):
- `listIssues()`: Calls `gh issue list --json`
- `listPRs()`: Calls `gh pr list --json`
- No create repo UI (API exists but not implemented in UI)

---

## 3. Adding a New Project - Flow Analysis

### 3.1 User Interaction Path

```
Welcome Screen (no projects)
    ↓
[Add Project Button]
    ↓
handleAddProject() in App.tsx (line 53-62)
    ↓
window.electron.project.openFolder()  [IPC: PROJECT_OPEN_FOLDER]
    ↓
dialog.showOpenDialog() → select folder
    ↓
window.electron.project.create({name, path})  [IPC: PROJECT_CREATE]
    ↓
projectStore.addProject(project)  [stores to disk]
    ↓
addProject(project)  [Zustand state update]
    ↓
setActiveProject(project.id)  [Switch to project]
```

### 3.2 ProjectStore.addProject() Details

**File**: `src/main/project/project-store.ts:39-52`

```typescript
addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const newProject: Project = {
    ...project,
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const projects = this.getProjects()
  projects.push(newProject)
  this.store.set('projects', projects)  // Persists to disk
  
  return newProject
}
```

**Electron-store Config**:
- Store name: `'multiclaude-data'`
- Stored in: `~/.config/multiclaude-data.json` (Linux/Mac) or `%APPDATA%/multiclaude-data.json` (Windows)
- Schema:
  ```typescript
  {
    projects: Project[],
    activeProjectId: string | null,
    session: AppSession | null,
    terminalLayouts: Record<string, ProjectTerminalLayout>
  }
  ```

### 3.3 Project Type Definition

**File**: `src/shared/types/index.ts:24-32`

```typescript
export interface Project {
  id: string                    // auto-generated: proj-{timestamp}-{random}
  name: string                  // folder name
  path: string                  // absolute folder path
  gitRemote?: string            // optional: remote URL if git repo
  createdAt: Date | string      // serialized as ISO string over IPC
  updatedAt: Date | string      // serialized as ISO string over IPC
}
```

---

## 4. GitHub Setup & Authentication

### 4.1 GitHub Auth Architecture

**No app-level storage of credentials**:
- Uses GitHub CLI (`gh` command)
- User must run `gh auth login` in terminal
- App checks auth via: `window.electron.github.authStatus()` → `GitHubAuth`
- App never touches tokens (gh CLI handles this)

**GitHubAuth Type** (`src/shared/types/index.ts:85-88`):
```typescript
export interface GitHubAuth {
  isAuthenticated: boolean
  username?: string
}
```

**Implementation** (`src/main/git/git-manager.ts`):
- Calls: `gh auth status --show-token`
- Parses JSON response
- No UI prompts for token entry

### 4.2 GitHub Features (Optional/Deferred)

**Available only with authentication**:
1. Issues tab - read-only list
2. PRs tab - read-only list
3. Create repo via `gh repo create`
4. None of these require setup dialog

**GitHub View Tab** (`src/renderer/components/github-view/github-view.tsx`):
- Rendered even if no remote (shows "No repository selected" message)
- Can be accessed before auth (will show empty/error states)
- No setup requirements

---

## 5. Settings & Storage

### 5.1 App Settings (electron-store)

**File**: `src/main/settings/settings-store.ts`

**Persisted Settings**:
```typescript
AppSettings {
  themeMode: 'light' | 'dark' | 'system'
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
  terminalRenderMode: TerminalRenderMode
  glassmorphismEnabled: boolean
  uiStyle: 'modern' | 'terminal'
  terminalStyleOptions: TerminalStyleOptions
  windowsShell?: WindowsShell  // Windows-specific
}
```

**NOT stored**: GitHub token, project GitHub setup status, etc.

### 5.2 Project-Specific Data (electron-store)

**Stored per project**:
- Terminal layouts (`terminalLayouts[projectId]`)
- Git branch watchers

**NOT stored per project**:
- GitHub setup status
- GitHub authentication (system-level via gh CLI)

### 5.3 Session Management

**File**: `src/main/project/project-store.ts:95-105`

**Stores** (in electron-store):
```typescript
{
  terminals: TerminalSession[],
  activeTerminalId: string | null,
  windowBounds?: {x, y, width, height}
}
```

---

## 6. UI Components for Project Setup

### 6.1 Welcome Screen

**File**: `src/renderer/components/welcome-screen.tsx`

```tsx
// Shown when activeProjectId is null
export function WelcomeScreen({ onAddProject }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <button onClick={onAddProject}>
        Add Project
      </button>
      {/* Features list, keyboard shortcut hint */}
    </div>
  )
}
```

- Simple, no GitHub setup
- Just "Add Project" button
- Keyboard shortcut: Ctrl+Shift+P

### 6.2 Project Tabs

**File**: `src/renderer/components/project-tabs/project-tabs.tsx`

```tsx
{/* + Add Project Button */}
<button onClick={onAddProject}>+</button>

{/* Overflow dropdown for 10+ projects */}
{overflowProjects.length > 0 && (
  <div className="relative">
    <button onClick={() => setShowOverflow(!showOverflow)}>
      +{overflowProjects.length}
    </button>
    {/* Dropdown menu */}
  </div>
)}
```

- Max 9 visible tabs (+ button after last tab)
- 10+ projects go to overflow dropdown
- Delete button (X) on hover per tab

### 6.3 GitHub Setup in Sidebar

**File**: `src/renderer/components/sidebar/user-account-card.tsx`

- **Expanded view**: Shows GitHub username, git branch, git identity editor
- **Collapsed view**: Avatar with online/offline indicator
- **Authentication**: "Not logged in" message if `authStatus.isAuthenticated === false`
- **Login**: User must use external `gh` CLI (no in-app login form)

---

## 7. IPC Channels for GitHub & Projects

### 7.1 Project Channels

```
PROJECT_LIST → projectStore.getProjects()
PROJECT_CREATE → projectStore.addProject(project)
PROJECT_DELETE → projectStore.deleteProject(id)
PROJECT_SET_ACTIVE → projectStore.setActiveProjectId(id)
PROJECT_OPEN_FOLDER → dialog.showOpenDialog()
PROJECT_CHECK_FOLDER → validate folder & git status
```

### 7.2 GitHub Channels

```
GITHUB_AUTH_STATUS → gitManager.authStatus()
GITHUB_LOGIN → gitManager.loginGitHub() [opens browser]
GITHUB_LOGOUT → gitManager.logoutGitHub()
GITHUB_CREATE_REPO → gitManager.createGitHubRepo(name, isPrivate)
GITHUB_ISSUES_LIST → gh issue list --json
GITHUB_PRS_LIST → gh pr list --json
```

---

## 8. Key Observations

### 8.1 No "Skip for Now" Dialog
- ✗ NOT found in codebase
- ✗ No setup wizard
- ✗ No GitHub initialization dialog

### 8.2 GitHub is Optional
- GitHub features work independently of project creation
- No gate on project addition to set up GitHub
- User can add projects, create terminals, use git without GitHub auth

### 8.3 Settings Organization
- **App Settings** (electron-store): Theme, terminal limits, WSL shell
- **Project Settings** (electron-store): Terminal layouts per project
- **Git Identity** (git config): Name/email editable in sidebar
- **GitHub Auth** (system gh CLI): Not stored in app

### 8.4 Persistence Strategy
- **All projects**: `~/.config/multiclaude-data.json`
- **All settings**: `~/.config/multiclaude-data.json`
- **Git/GitHub**: System-level via `gh` CLI
- No per-project config files in project directory

---

## 9. Component Tree

```
App.tsx
├── ProjectTabs
│   ├── [Project Tab]
│   ├── [Add Project Button] ← handleAddProject()
│   └── [Overflow Dropdown for 10+ projects]
├── WelcomeScreen (if no activeProjectId)
│   └── [Add Project Button]
├── Sidebar
│   ├── GitPanel / NavigationItems
│   └── UserAccountCard ← GitHub Auth UI
│       ├── [GitHub Status]
│       ├── [Git Branch Display]
│       └── [Git Identity Editor]
├── TerminalGrid
│   └── [Terminals]
└── GitHubView
    ├── GitHubActionBar (Push/Pull/Sync/Fetch)
    ├── RepoInfoHeader (Branch selector)
    └── [Tabs: Changes, History, Branches, Stash, Issues, PRs]
```

---

## 10. Answer to User's Questions

### Q1: GitHub setup/configuration dialog files?
**A**: No dedicated GitHub setup dialog. GitHub auth is optional, accessed via sidebar user account card (user-account-card.tsx).

### Q2: How project settings are stored?
**A**: electron-store in `~/.config/multiclaude-data.json`:
- Project metadata (name, path, id)
- Terminal layouts per project
- Settings (theme, terminal limit)
- Session state

### Q3: Flow when user adds new project?
**A**:
1. User clicks "Add Project" button
2. Folder picker dialog opens (`dialog.showOpenDialog`)
3. `projectStore.addProject({name, path})` called
4. Project stored to disk immediately
5. UI switches to new project
6. No GitHub setup required

### Q4: "Skip for now" button locations?
**A**: ✗ **NOT FOUND** in codebase. No GitHub setup dialog exists.

---

## 11. Unresolved Questions

1. **GitHub token storage**: Does `gh` CLI store tokens in `~/.config/gh/`? (Outside this app's scope)
2. **Why no GitHub setup wizard?**: Intentional design choice to keep projects separate from GitHub
3. **Create repo UI**: API exists (`window.electron.github.createRepo()`) but never called in UI - feature incomplete?
4. **Terminal layout restoration**: How are terminal layouts per project loaded on project switch? (See use-git-panel.ts)

---

## 12. Files Analyzed (Absolute Paths)

### Core Architecture
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/project/project-store.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/app-store.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts`

### IPC & Preload
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/preload/index.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/github-handlers.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/ipc-channels.ts`

### UI Components
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/project-tabs/project-tabs.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/welcome-screen.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/user-account-card.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/github-view/github-view.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/github-view/issues-tab.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/github-view/prs-tab.tsx`

### Types
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts`

---

## Summary

MultiClaude uses a **minimal approach** to project and GitHub setup:
- **No setup dialogs** - projects created via folder picker
- **GitHub is optional** - authenticated via system `gh` CLI, not in-app
- **Persistent storage** - electron-store with clear schema
- **Sidebar-based auth UI** - GitHub login/logout + git identity in sidebar
- **Feature-complete** - Issues/PRs visible when gh CLI authenticated

The architecture prioritizes simplicity and flexibility, allowing users to work with projects independently of GitHub authentication.
