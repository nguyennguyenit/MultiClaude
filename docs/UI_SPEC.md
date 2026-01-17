# UI Specification

> Auto-generated from codebase via `/ipa:init`
> Recommend manual enhancement for User Journeys (CJX)

## 1. Overview

MultiClaude is a desktop application with a single-page layout containing:
- Title bar with sidebar toggle
- Project tabs bar
- Main content area (Sidebar + Terminal Grid / GitHub View)
- Settings modal

## 2. Screen List

| ID | Screen | Route/State | Component | Description |
|----|--------|-------------|-----------|-------------|
| S-01 | Welcome | `activeProjectId = null` | `WelcomeScreen` | No project selected |
| S-02 | Terminal View | `activeView = 'terminals'` | `TerminalGrid` | Main terminal workspace |
| S-03 | GitHub View | `activeView = 'github'` | `GitHubView` | GitHub Issues/PRs |
| S-04 | Settings Modal | `settingsModalOpen = true` | `SettingsModal` | App configuration |

## 3. Component Hierarchy

```
App
├── ToastContainer
├── SettingsModal
│   ├── SettingsSidebar
│   └── [Settings Panels]
│       ├── ThemeSelector
│       ├── NotificationSettings
│       │   ├── TelegramConfigModal
│       │   └── DiscordConfigModal
│       └── UpdateSettings
├── TitleBar (drag region)
│   └── SidebarToggle
├── ProjectTabs
│   └── ProjectTab[]
└── MainContent
    ├── [No Project] → WelcomeScreen
    └── [Has Project]
        ├── Sidebar
        │   ├── NavigationItem (Terminals)
        │   ├── NavigationItem (GitHub)
        │   ├── GitPanel
        │   │   ├── BranchSelector
        │   │   ├── ChangesList
        │   │   ├── CommitForm
        │   │   ├── DiffViewer
        │   │   ├── BranchesTab
        │   │   ├── HistoryTab
        │   │   └── StashTab
        │   └── UserAccountCard
        └── ContentArea
            ├── [terminals] → TerminalView
            │   ├── TerminalActionBar
            │   └── TerminalGrid
            │       └── TerminalPane[]
            │           └── TerminalView (xterm.js)
            └── [github] → GitHubView
                ├── RepoInfoHeader
                ├── GitHubActionBar
                ├── IssuesTab
                └── PRsTab
```

## 4. Screen Details

### S-01: Welcome Screen

**State Condition**: No project selected (`activeProjectId = null`)

**Layout**:
- Centered content
- App logo/title
- "Add Project" button

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click "Add Project" | `handleAddProject` | Opens folder picker, creates project |

**Source**: `src/renderer/components/welcome-screen.tsx`

---

### S-02: Terminal View

**State Condition**: `activeView = 'terminals'`

**Layout**:
- TerminalActionBar (top)
  - Terminal count indicator
  - YOLO mode toggle
  - Add terminal button
  - Shell selector dropdown (Windows)
  - Kill all button
- TerminalGrid (main area)
  - Auto-split grid (1x1 to 3x4)
  - Resizable panels via `react-resizable-panels`

**Grid Layout Logic**:
| Terminals | Grid |
|-----------|------|
| 1 | 1x1 |
| 2 | 1x2 |
| 3-4 | 2x2 |
| 5-6 | 2x3 |
| 7-9 | 3x3 |
| 10-12 | 3x4 |

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click terminal | `setActiveTerminal` | Focus terminal |
| Click "+" | `handleAddTerminal` | Create new terminal |
| Toggle YOLO | `handleYoloToggle` | Enable/disable Claude YOLO mode |
| Click "Kill All" | `handleKillAll` | Close all terminals |
| Drag file | `onInsertFilePath` | Insert path into terminal |
| Double-click title | inline edit | Rename terminal |

**Source**:
- `src/renderer/components/terminal/terminal-grid.tsx`
- `src/renderer/components/terminal/terminal-action-bar.tsx`
- `src/renderer/components/terminal/terminal-pane.tsx`

---

### S-03: GitHub View

**State Condition**: `activeView = 'github'`

**Layout**:
- RepoInfoHeader (repo name, visibility)
- GitHubActionBar (tabs: Issues, PRs)
- Tab content (IssuesTab or PRsTab)

**Requirements**:
- GitHub CLI (`gh`) authenticated
- Project has git remote

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click tab | tab switch | Show Issues or PRs |
| Click issue/PR | `openExternal` | Open in browser |

**Source**: `src/renderer/components/github-view/`

---

### S-04: Settings Modal

**State Condition**: `settingsModalOpen = true`

**Layout**:
- Sidebar navigation (tabs)
- Content panels per tab

**Tabs**:
| Tab | Component | Settings |
|-----|-----------|----------|
| Appearance | `ThemeSelector` | Theme mode, color theme, glassmorphism |
| Terminals | inline | Render mode, terminal limit, default shell |
| Notifications | `NotificationSettings` | Telegram, Discord config |
| Updates | `UpdateSettings` | Check, download, install updates |

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Select theme mode | `setSettings` | Apply light/dark/system |
| Select color theme | `setSettings` | Apply color scheme |
| Configure Telegram | modal | Save bot token + chat ID |
| Configure Discord | modal | Save webhook URL |
| Check for updates | `update.check()` | Query GitHub Releases |

**Source**: `src/renderer/components/settings/`

## 5. Sidebar Components

### Git Panel

**Tabs**:
| Tab | Component | Purpose |
|-----|-----------|---------|
| Changes | `ChangesList` | Stage/unstage files |
| Commit | `CommitForm` | Write commit message |
| Branches | `BranchesTab` | Create/switch/delete branches |
| History | `HistoryTab` | View commit log |
| Stash | `StashTab` | Save/apply/pop stashes |

**Features**:
- Diff viewer modal
- Branch selector dropdown
- Auto-refresh on external changes (via HEAD watcher)

**Source**: `src/renderer/components/git-panel/`

---

### User Account Card

**Layout**:
- GitHub avatar + username
- Login/logout button
- Settings gear icon

**Source**: `src/renderer/components/sidebar/user-account-card.tsx`

## 6. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1-9` | Switch to project 1-9 |
| `Ctrl+N` / `Ctrl+T` | New terminal |
| `Ctrl+W` | Close active terminal |
| `Ctrl+V` | Paste (or paste image as file path) |
| `Ctrl+Click` | Open URL (Cmd+Click on macOS) |

## 7. Themes

| ID | Name | Description |
|----|------|-------------|
| `default` | Default Blue | Standard blue accent |
| `dusk` | Dusk Purple | Purple accent |
| `lime` | Lime Green | Green accent |
| `ocean` | Ocean Teal | Teal accent |
| `retro` | Retro Orange | Orange accent |
| `neo` | Neo Pink | Pink accent |
| `forest` | Forest Green | Dark green accent |
| `neon-cyber` | Neon Cyber | Cyberpunk style |
| `pro-dark` | Pro Dark | Minimal dark |
| `vibrant` | Vibrant | Bold colors |

## 8. Responsive Behavior

- **Sidebar**: Collapsible via toggle button
- **Terminal Grid**: Auto-adjusts grid based on terminal count
- **Settings Modal**: Scrollable content
- **Title Bar**: Accounts for macOS traffic lights

## 9. Source Files

| Component | File |
|-----------|------|
| App | `src/renderer/App.tsx` |
| WelcomeScreen | `src/renderer/components/welcome-screen.tsx` |
| TerminalGrid | `src/renderer/components/terminal/terminal-grid.tsx` |
| GitHubView | `src/renderer/components/github-view/github-view.tsx` |
| SettingsModal | `src/renderer/components/settings/settings-modal.tsx` |
| Sidebar | `src/renderer/components/sidebar/sidebar.tsx` |
| GitPanel | `src/renderer/components/git-panel/git-panel.tsx` |

## 10. User Journey (CJX) - To Be Enhanced

> ⚠️ Placeholder - Recommend adding detailed user flows

### CJX-01: First Time User
1. Launch app → Welcome screen
2. Click "Add Project" → Folder picker
3. Select folder → Project created, terminal grid shown
4. Click terminal → Start typing commands

### CJX-02: Start Claude Session
1. Select project
2. Click "Start Claude" on terminal
3. Claude mode activated (badge shown)
4. Interact with Claude

### CJX-03: Commit Changes
1. Open Git panel in sidebar
2. View changed files
3. Stage files
4. Write commit message
5. Click "Commit"
