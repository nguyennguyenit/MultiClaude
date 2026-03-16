# UI Specification

> Auto-generated from codebase via `/ipa:init`
> Recommend manual enhancement for User Journeys (CJX)

## 1. Overview

MultiClaude is a desktop application with a minimal terminal aesthetic (VibeTerminal):
- 32px compact toolbar at top (project selector, terminal button, panel toggles)
- Terminal grid main content area (auto-flex layout, no resizable panels)
- Slide panels for Git/GitHub/Settings (right edge on landscape, bottom on portrait)
- CSS custom properties theme system (5 curated dark themes)

## 2. Screen List

| ID | Screen | Route/State | Component | Description |
|----|--------|-------------|-----------|-------------|
| S-01 | Welcome | `activeProjectId = null` | `WelcomeScreen` | No project selected |
| S-02 | Terminal View | `activeProjectId != null` | `TerminalGrid` | Main terminal workspace |
| S-03 | Git Slide Panel | `activePanel = 'git'` | `GitPanel` | Git operations (slide from right/bottom) |
| S-04 | GitHub Slide Panel | `activePanel = 'github'` | `GitHubPanel` | GitHub Issues/PRs (slide from right/bottom) |
| S-05 | Settings Slide Panel | `activePanel = 'settings'` | `SettingsPanel` | App configuration (slide from right/bottom) |

## 3. Component Hierarchy

```
App
├── Toolbar (32px compact header)
│   ├── ToolbarButton (add terminal, ...)
│   └── ProjectDropdown
├── MainContent (flex 1, overflow hidden)
│   ├── [No Project] → WelcomeScreen
│   └── [Has Project] → TerminalGrid
│       ├── TerminalPane[]
│       │   ├── TerminalView (xterm.js)
│       │   └── Bottom Tab Bar (terminal title)
│       └── Add Cell Placeholder
├── SlidePanel (Git)
│   ├── GitPanelContent
│   │   ├── Tab Bar (Changes, History, Stash, Branches)
│   │   ├── BranchSelector
│   │   ├── ChangesList
│   │   ├── CommitForm
│   │   ├── DiffViewer
│   │   ├── BranchesTab
│   │   ├── HistoryTab
│   │   └── StashTab
│   └── Close Button
├── SlidePanel (GitHub)
│   ├── RepoInfoHeader
│   ├── GitHubActionBar
│   ├── IssuesTab / PRsTab
│   └── Close Button
├── SlidePanel (Settings)
│   ├── Tab Navigation
│   ├── ThemeSelector
│   ├── NotificationSettings
│   │   ├── TelegramConfigModal
│   │   └── DiscordConfigModal
│   ├── UpdateSettings
│   └── Save/Cancel Buttons
└── ToastContainer
```

## 4. Screen Details

### Toolbar (32px Compact Header)

**Layout**:
- Left group: Add Terminal button (Ctrl+T) + Project dropdown
- Right group: Git (Ctrl+B), GitHub, Settings, Update indicator (if available)
- macOS-aware: 72px left padding for traffic lights
- Drag region behind buttons for window moving

**Components**:
- ToolbarButton: Icon button with optional badge/highlight
- ProjectDropdown: Select active project or add new project
- Update indicator: Highlights when new version available

**Source**: `src/renderer/components/toolbar/`

---

### S-01: Welcome Screen

**State Condition**: No project selected (`activeProjectId = null`)

**Layout**:
- Centered content with app logo
- "Add Project" button

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click "Add Project" | `handleAddProject` | Opens folder picker, creates project |

**Source**: `src/renderer/components/welcome-screen.tsx`

---

### S-02: Terminal View

**State Condition**: Active project selected

**Layout**:
- Auto-flex terminal grid (equal splits, no resizable panel handles)
- Per-pane bottom tab bar showing terminal title
- Add cell placeholder when terminals < 9

**Grid Layouts**:
| Terminals | Columns | Rows | Layout |
|-----------|---------|------|--------|
| 1 | 1 | 1 | Full pane |
| 2-3 | 2 | varies | Flex columns |
| 4+ | 3 | varies | Flex 3-column grid |

**Pane Features**:
- Editable title (double-click to edit, Enter/Escape to confirm/cancel)
- Bottom action bar: Claude badge, Start Claude button, Close button
- Active pane highlight via CSS glow
- Smart scroll: Auto-scroll at bottom, preserves position when reading scrollback

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click pane | `setActiveTerminal` | Focus terminal, enable keyboard input |
| Double-click title | inline edit | Rename terminal |
| Click "+" cell | `handleAddTerminal` | Create new terminal |
| Click close | `handleCloseTerminal` | Destroy terminal |
| Drag file | `onInsertFilePath` | Insert file path into terminal |
| Ctrl+V image | auto-save & insert | Save temp image, insert path |

**Source**:
- `src/renderer/components/terminal/terminal-grid.tsx`
- `src/renderer/components/terminal/terminal-pane.tsx`
- `src/renderer/components/terminal/terminal-view.tsx`

---

### S-03: Git Slide Panel

**State Condition**: `activePanel = 'git'` (toggled via Ctrl+B)

**Position**: Right edge on landscape (340px wide), bottom edge on portrait (full width)

**Layout**:
- Close button (top-right)
- Tab bar: Changes, History, Stash, Branches
- Branch selector dropdown
- Tab content with diff viewer modal
- Sync/Pull/Push/Refresh buttons

**Actions**:
| Action | Handler | Result |
|--------|---------|--------|
| Click tab | `setActiveTab` | Switch git view |
| Click file | `selectFile` | Show diff |
| Click "Stage" | `stageFile` | Stage file |
| Click "Commit" | `commit` | Create commit |
| Click "Sync" | pull then push | Fetch & push |

**Source**: `src/renderer/components/git-panel/`

---

### S-04: GitHub Slide Panel

**State Condition**: `activePanel = 'github'` (toggled via toolbar button)

**Position**: Right edge on landscape (340px wide), bottom edge on portrait (full width)

**Layout**:
- Close button (top-right)
- Repo info header
- Tab bar: Issues, PRs
- Issue/PR list with click-to-browser action

**Source**: `src/renderer/components/github-view/`

---

### S-05: Settings Slide Panel

**State Condition**: `activePanel = 'settings'` (toggled via toolbar Settings button)

**Position**: Right edge on landscape (340px wide), bottom edge on portrait (full width)

**Layout**:
- Tab navigation: Appearance, Terminals, Notifications, Updates
- Theme selector (color theme dropdown for all 5 VibeTerminal themes)
- Notification settings (Telegram/Discord config)
- Terminal render mode (Performance/Balanced/Quality)
- Terminal limit, default shell (Windows)
- Update checker with progress bar
- Save/Cancel buttons

**Appearance Tab Settings**:
| Setting | Values | Default |
|---------|--------|---------|
| Color Theme | 5 VibeTerminal themes | Tokyo Night |
| Theme Mode | Light/Dark/System | System |

**Source**: `src/renderer/components/settings/`

## 5. Themes

VibeTerminal provides 5 curated dark themes, all defined in `src/shared/constants/themes.ts`:

| Theme | Background | Accent | ANSI Palette |
|-------|-----------|--------|--------------|
| Tokyo Night | #1a1b26 | #7aa2f7 (blue) | Soft pastels |
| Catppuccin Mocha | #1e1e2e | #89b4fa (blue) | Warm palette |
| Dracula | #282a36 | #bd93f9 (purple) | Vivid purples |
| Rosé Pine | #191724 | #c4a7e7 (mauve) | Muted tones |
| Pro Dark | [custom] | [custom] | [custom] |

Each theme includes:
- UI colors: background, foreground, accent, border, hover, cursor, selection
- Terminal colors: 16-color ANSI palette (black, red, green, yellow, blue, magenta, cyan, white + bright variants)
- xterm.js integration: Colors applied via `TerminalView` props

## 6. Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Alt+1-9` | Switch to project 1-9 | Global |
| `Ctrl+N` / `Ctrl+T` | New terminal | Global |
| `Ctrl+W` | Close active terminal | Global |
| `Ctrl+B` | Toggle Git panel | Global |
| `Ctrl+V` | Paste or paste image as file path | Terminal focused |
| `Enter` | Save terminal title | During title edit |
| `Escape` | Cancel terminal title edit | During title edit |

**Note**: Escape key handling uses `shortcut-utils.ts` to prevent leakage to other components during project switching and other critical operations.

## 7. Responsive Behavior

- **Toolbar**: 32px fixed height, compact layout with macOS traffic light padding
- **Terminal Grid**: Auto-flex layout, adapts to window resize
- **Slide Panels**: Right edge on landscape (340px), bottom edge on portrait (full width)
- **Add Cell**: Positioned in next grid row when terminal count < 9

## 8. Source Files

| Component | File |
|-----------|------|
| App | `src/renderer/App.tsx` |
| Toolbar | `src/renderer/components/toolbar/toolbar.tsx` |
| ToolbarButton | `src/renderer/components/toolbar/toolbar-button.tsx` |
| ProjectDropdown | `src/renderer/components/toolbar/project-dropdown.tsx` |
| WelcomeScreen | `src/renderer/components/welcome-screen.tsx` |
| TerminalGrid | `src/renderer/components/terminal/terminal-grid.tsx` |
| TerminalPane | `src/renderer/components/terminal/terminal-pane.tsx` |
| TerminalView | `src/renderer/components/terminal/terminal-view.tsx` |
| GitPanel | `src/renderer/components/git-panel/git-panel.tsx` |
| GitHubView | `src/renderer/components/github-view/github-view.tsx` |
| SettingsPanel | `src/renderer/components/settings/settings-panel.tsx` |

## 9. User Journeys

### CJX-01: First Time User
1. Launch app → Welcome screen
2. Click "Add Project" → Folder picker → Select folder
3. Toolbar auto-focuses new project in dropdown
4. Terminal grid shows with empty state (+ button)
5. Click "+" or press Ctrl+T → New terminal created
6. Type commands in focused pane

### CJX-02: Start Claude Session
1. In active terminal pane, click "Start Claude" button
2. Type `@claude ...` command
3. Claude mode badge appears in pane title bar
4. Interact with Claude (streaming output)
5. Click close or Ctrl+W to exit

### CJX-03: Commit Changes (Git Workflow)
1. Press Ctrl+B to open Git slide panel
2. Git panel slides in from right (or bottom on mobile)
3. Review changed files in "Changes" tab
4. Click file to view diff in modal
5. Click "Stage" to stage file
6. Switch to "Commit" section, write message
7. Click "Commit" button
8. Close panel with close button or Ctrl+B again

### CJX-04: Check for Updates
1. Click toolbar Settings button
2. Settings slide panel opens
3. Go to "Updates" tab
4. Click "Check for Updates"
5. If available, click "Download"
6. Once ready, click "Install and Restart"
7. App restarts with new version
