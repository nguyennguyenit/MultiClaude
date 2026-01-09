# MultiClaude Codebase Summary

## Overview
MultiClaude v1.1.6 is an Electron 33 + React 19 + TypeScript desktop application for managing multiple Claude Code instances simultaneously. It provides project management, Git integration, GitHub authentication, terminal management (with WSL support on Windows), and user settings (themes and notifications).

**Codebase Stats**: ~10K LOC, 90 TypeScript files, 80 IPC channels

## Architecture

### Core Layers
1. **Main Process** (Node.js) - Terminal spawning, Git operations, project persistence
2. **IPC Layer** - Bidirectional communication between main and renderer
3. **Renderer** (React 19 + TypeScript) - UI components, state management, settings
4. **Shared** - Types, constants, IPC channel definitions

### Key Components

#### Terminal Management
- **TerminalManager**: Spawns/destroys PTY processes via node-pty
  - **Async Destruction**: `destroyAsync(id)` with graceful exit + 2s timeout + platform-specific force kill fallback
  - **Batch Destruction**: `destroyAllAsync()` for parallel cleanup via `Promise.allSettled()`
  - **Process Kill Strategy**: Windows uses `taskkill /T /F` for tree kill, Unix uses `SIGKILL`
  - **Sync Methods**: Legacy `destroy(id)` and `destroyAll()` retained for compatibility
- **WslDetector**: Windows-only utility detecting WSL availability and installed distros via `wsl --list` commands
- **Shell Selection**: Default shell picker (cmd, PowerShell, WSL distro) + right-click context menu for per-terminal shell selection
- **TerminalView**: xterm.js renderer with WebGL addon (controlled by rendering mode setting)
- **TerminalGrid**: Auto-split layout (1x1 → 3x4 based on terminal count), add-cell placeholder when <9 terminals, fade transition during project switching
- **TerminalPane**: Resizable wrapper with header bar containing editable title, refresh button (WebGL recovery), Claude button, close button
  - **Active Terminal Styling** (`globals.css`): Visual distinction via glow + opacity
    - `--terminal-active-glow`: CSS var for active pane outer glow (`color-mix()` animated)
    - `--terminal-transition`: Unified 0.25s ease timing for opacity/glow transitions
    - Active pane: animated glow effect; Inactive: 0.85 opacity
    - `will-change: opacity, box-shadow` for GPU-optimized transitions
- **Smart Scroll**: Auto-scroll during output when at bottom; preserves scroll position when user scrolls up
  - `isAtBottomRef` (ref) for write() logic, `isAtBottom` (state) for UI reactivity
  - 5-line threshold reduces button flicker on minor scroll changes
  - `write()` conditionally calls `scrollToBottom()` only when at bottom
  - **Scroll-to-Bottom Button**: Floating button (bottom-right) with fade animation
    - Appears when user scrolls 5+ lines from bottom
    - Opacity-based show/hide (no mount/unmount) for smooth transitions
    - Accessibility: `aria-label`, `aria-hidden`, `pointer-events-none` when hidden
    - **Responsive Sizing**: CSS Container Queries with `clamp(20px, 4cqw, 32px)` for 3-4% terminal width scaling
  - Proper disposable cleanup on unmount
- **WebGL Disposal Timing**: Fixed display corruption during rapid project switching via:
  - `TERMINAL_DISPOSE_DELAY` (100ms) constant for deferred cleanup
  - WebGL addon ref tracking with proper disposal order (addon before terminal)
  - Deferred `initialOutput` write until terminal fully mounted
  - `isTransitioning` state in App.tsx with rapid-switch guard to prevent race conditions
- **Terminal Refresh**: Manual and automatic WebGL context recovery
  - Refresh button in TerminalPane header (100ms debounce)
  - Auto-recovery on WebGL context lost events with toast notification
  - `use-terminal.ts` exposes `refresh()` callback via `onRefreshReady` prop

#### Sidebar & UI Components
- **Sidebar**: Left-side navigation with collapsible layout (240px expanded / 60px collapsed)
  - **sidebar-header.tsx**: Logo display + collapse/expand toggle button
  - **navigation-item.tsx**: Reusable navigation menu item with active/hover states
  - **user-account-card.tsx**: GitHub account card showing username, connection status, and current branch
  - Features: Git status display/initialization and GitHub authentication/repo creation
  - Tools: New Terminal, Start Claude, Kill All with terminal counting
  - Settings toggle at bottom
- **ProjectTabs**: Top tab bar for switching between projects with keyboard shortcuts (Alt+1-9)

#### Project Management & Persistence
- **ProjectStore**: electron-store persistence layer for projects and terminal layouts
  - Projects: CRUD operations with metadata (id, name, path, gitRemote)
  - Active project tracking (activeProjectId)
  - **Terminal Layout Persistence**: Per-project terminal layout storage
    - `saveTerminalLayout(projectId, layout)`: Store layout snapshot
    - `loadTerminalLayout(projectId)`: Retrieve saved layout
    - `deleteTerminalLayout(projectId)`: Clean up on project deletion
    - `getAllTerminalLayouts()`: Bulk layout retrieval
  - Session management: Save/load/clear AppSession
- File-based storage under electron-store (`multiclaude-data`)

#### Git Integration
- **GitManager**: Git operations via simple-git
- **GitHubAuth**: OAuth flow using GitHub CLI (gh command)
- Channels: status, init, add-remote, push

#### Settings
- **SettingsStore** (Main Process): electron-store based persistence for app-wide preferences
  - Storage path: `%APPDATA%/multiclaude/multiclaude-settings.json` (Windows), `~/.config/multiclaude/multiclaude-settings.json` (Linux), `~/Library/Application Support/multiclaude/multiclaude-settings.json` (macOS)
  - Validation: Enum validation for themeMode/colorTheme/terminalRenderMode, range checks for terminalLimit, object structure checks for windowsShell
  - IPC: SETTINGS_GET/SET/RESET with fallback to defaults on errors, Array.isArray check for input validation
  - Handlers in `src/main/ipc/handlers.ts` with error handling
- **SettingsStore** (Zustand): Renderer store with explicit Save/Cancel flow
  - Architecture: savedSettings (disk source of truth) + pendingSettings (live preview)
  - Save/Cancel: Changes preview immediately, persist only on Save button
  - localStorage migration: One-time automatic migration of old data on first load
  - Optimized equality check: Field-by-field comparison instead of JSON.stringify
- **SettingsPanel**: Tabbed settings UI (Appearance, Notifications, Updates) with Save/Cancel buttons
- **ThemeSelector**: Color theme and dark/light mode selection
- **Terminal Rendering Mode**: WebGL optimization for xterm.js (Settings > Appearance > Terminal Rendering)
  - **Performance**: No WebGL, best for many terminals (lower GPU usage)
  - **Balanced** (default): WebGL only for active terminal
  - **Quality**: WebGL always enabled, best visual quality
- Themes: 7 color themes + light/dark/system mode

#### Notifications
**Phase 1 - Completed: Types & Constants**
- **NotificationEventType**: 'taskComplete' | 'taskFailed' | 'reviewNeeded'
- **OutputMode**: 'auto' | 'stream-json' | 'plain-text' - Parser mode for terminal output
- **SoundPreset**: 'default' | 'minimal' | 'retro'
- **NotificationSettings**: Event toggles, sound config, Telegram/Discord flags, output mode, background-only, task summary
- **TaskEvent**: Unique task event with id, terminalId, type, taskName, projectName, context, timestamp
- **JsonStreamEvent**: Claude Code stream-json event structure (init, message, tool_use, tool_result, result, error)
- **ParserType**: Alias for OutputMode (parser-specific usage)
- **TelegramCredentials**, **DiscordCredentials**: Secure credential interfaces
- **DETECTION_PATTERNS**: Regex patterns for automatic event detection
- **ENHANCED_DETECTION_PATTERNS**: Named capture group patterns for task name extraction

**Phase 2 - Completed: Core Backend**
- **NotificationManager**: Central orchestrator for all notification types
- **SecureStorage**: Electron safeStorage wrapper for credential encryption (Telegram/Discord)
- **PatternDetector**: Terminal output pattern matching with 300ms debounce
- **TelegramNotifier**: Telegram Bot API integration via HTTP
- **DiscordNotifier**: Discord Webhook integration with URL validation
- 12 IPC handlers for credential management, testing, and retrieval

**Phase 3 - Completed: Renderer UI**
- **NotificationStore** (Zustand): Settings state management with sound caching
- **NotificationSettings**: Main settings UI with event toggles, sound preset selector, behavior controls
- **TelegramConfigModal**: Modal for Telegram botToken/chatId configuration
- **DiscordConfigModal**: Modal for Discord webhookUrl configuration
- Sound playback with audio element caching (auto, success, error, info types)
- Settings persistence via IPC with local optimistic updates
- Integrated into SettingsPanel with tabbed navigation

**Phase 4 - Completed: Focus Detection & Deduplication**
- **FocusDetector**: Window/terminal focus tracking to suppress notifications when user is watching
  - Tracks BrowserWindow focus/blur events
  - Tracks active terminal ID via IPC (NOTIFICATION_SET_ACTIVE_TERMINAL)
  - `shouldNotify(terminalId)`: Returns true if window unfocused OR different terminal active
- **TaskTracker**: Prevents duplicate notifications for same task within TTL window
  - SHA256 hash-based task ID deduplication (per terminal)
  - Configurable TTL (TASK_TRACKER_TTL_MS = 5min default)
  - Auto-cleanup of stale entries (TASK_TRACKER_CLEANUP_INTERVAL_MS = 1min)
  - `shouldNotify(terminalId, taskId)`: Returns true if task not seen within TTL
- **NotificationManager Integration**: FocusDetector and TaskTracker integrated into notification flow
- **Preload API**: Added `setActiveTerminal()` to ElectronAPI for renderer-to-main focus tracking
- **Test Coverage**: 17 tests for FocusDetector, 14 tests for TaskTracker

## File Organization

```
src/
├── main/                     # Electron main process
│   ├── index.ts             # App window creation, menu
│   ├── __tests__/           # Test setup and specs
│   │   ├── setup.ts         # Global mocks (electron-store, node-pty)
│   │   └── *.spec.ts        # Test files
│   ├── terminal/            # PTY management
│   │   ├── terminal-manager.ts
│   │   ├── wsl-detector.ts      # WSL detection (Windows)
│   │   └── pty-handler.ts
│   ├── git/                 # Git operations
│   │   ├── git-manager.ts
│   │   └── github-auth.ts
│   ├── project/             # Project storage
│   │   └── project-store.ts
│   ├── notification/        # Notification system
│   │   ├── notification-manager.ts
│   │   ├── secure-storage.ts
│   │   ├── pattern-detector.ts
│   │   ├── focus-detector.ts        # Window/terminal focus tracking
│   │   ├── task-tracker.ts          # Task ID deduplication with TTL
│   │   ├── telegram-notifier.ts
│   │   ├── discord-notifier.ts
│   │   ├── output-parser.ts         # Router: auto-detects and locks parser mode
│   │   ├── json-stream-parser.ts    # NDJSON parser for stream-json output
│   │   ├── plain-text-parser.ts     # Regex parser with named capture groups
│   │   ├── parser-utils.ts          # Shared: generateTaskEventId, MAX_REGEX_INPUT_LENGTH
│   │   ├── __tests__/
│   │   │   ├── output-parser.spec.ts
│   │   │   ├── focus-detector.spec.ts   # 17 tests
│   │   │   └── task-tracker.spec.ts     # 14 tests
│   │   └── index.ts
│   ├── clipboard/           # Clipboard operations
│   │   └── clipboard-handler.ts
│   ├── updater/             # Auto-update
│   │   ├── auto-updater.ts
│   │   └── index.ts
│   └── ipc/                 # IPC handlers
│       └── handlers.ts
├── __tests__/               # Test infrastructure
│   └── e2e/                 # Playwright E2E tests
│       ├── playwright.config.ts
│       ├── fixtures/        # Electron app fixtures, mock data
│       └── tests/           # Test specs
├── renderer/                # React UI
│   ├── App.tsx
│   ├── components/
│   │   ├── terminal/        # Terminal UI
│   │   │   ├── terminal-grid.tsx
│   │   │   ├── terminal-pane.tsx
│   │   │   ├── terminal-view.tsx
│   │   │   ├── terminal-action-bar.tsx
│   │   │   ├── shell-selector-dropdown.tsx  # WSL/shell context menu
│   │   │   └── index.ts
│   │   ├── sidebar/         # Project/settings sidebar
│   │   │   ├── sidebar.tsx
│   │   │   ├── sidebar-header.tsx      # Logo + collapse toggle
│   │   │   ├── navigation-item.tsx     # Navigation menu item
│   │   │   └── user-account-card.tsx   # GitHub account card
│   │   ├── project-tabs/    # Project tab bar
│   │   │   ├── project-tabs.tsx
│   │   │   └── index.ts
│   │   └── settings/        # Settings panels
│   │       ├── settings-panel.tsx
│   │       ├── theme-selector.tsx
│   │       ├── notification-settings.tsx
│   │       ├── telegram-config-modal.tsx
│   │       ├── discord-config-modal.tsx
│   │       ├── update-settings.tsx      # In-app update management UI
│   │       ├── settings-typography.tsx  # Shared typography (SettingsTitle, SettingsSubheading)
│   │       └── index.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── use-file-drop.ts       # Drag-drop file paths into terminal
│   │   ├── use-clipboard-paste.ts # Ctrl+V image paste → temp file → insert path
│   │   └── index.ts
│   ├── stores/              # Zustand stores
│   │   ├── app-store.ts
│   │   ├── settings-store.ts
│   │   ├── notification-store.ts
│   │   ├── update-store.ts          # Update state management
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── shell-utils.ts        # WindowsShell key generation
│   │   └── index.ts
│   └── styles/              # CSS
├── preload/                 # IPC bridge
│   └── index.ts
└── shared/                  # Shared code
    ├── types/               # TypeScript interfaces
    │   ├── index.ts
    │   ├── notification.ts
    │   └── notification-events.ts  # TaskEvent, JsonStreamEvent, ParserType
    └── constants/           # Constants & defaults
        ├── index.ts
        ├── ipc-channels.ts
        ├── notification.ts
        ├── themes.ts
        └── terminal-themes.ts
```

## IPC Channels (84 total)

### Terminal (9 channels)
- `terminal:create`, `terminal:destroy`, `terminal:input`, `terminal:output`
- `terminal:resize`, `terminal:list`, `terminal:invoke-claude`, `terminal:title-change`
- `terminal:detect-wsl`

### Project (6 channels)
- `project:list`, `project:create`, `project:delete`, `project:set-active`
- `project:open-folder`, `project:check-folder`

### Git (35 channels)
**Basic**: `git:status`, `git:init`, `git:add-remote`, `git:push`
**File Operations**: `git:file-status`, `git:stage-file`, `git:unstage-file`, `git:stage-all`, `git:discard`, `git:diff`
**Commit**: `git:commit`
**Branch**: `git:branches`, `git:create-branch`, `git:checkout-branch`, `git:delete-branch`, `git:merge`
**Remote**: `git:pull`, `git:fetch`
**History**: `git:log`
**Stash**: `git:stash-list`, `git:stash-save`, `git:stash-apply`, `git:stash-pop`, `git:stash-drop`
**Config**: `git:config-get`, `git:config-set`
**Watcher**: `git:branch-changed`, `git:watch-project`, `git:unwatch-project`

### GitHub (5 channels)
- `github:auth-status`, `github:login`, `github:logout`, `github:create-repo`
- `github:issues-list`, `github:prs-list`

### Notifications (13 channels)
- **Settings**: `notification:get-settings`, `notification:set-settings`
- **Telegram**: `notification:set-telegram`, `notification:get-telegram-status`, `notification:test-telegram`, `notification:clear-telegram`
- **Discord**: `notification:set-discord`, `notification:get-discord-status`, `notification:test-discord`, `notification:clear-discord`
- **Events**: `notification:event`
- **Focus**: `notification:set-active-terminal`

### Session & App (4 channels)
- `session:save`, `session:restore`, `app:get-path`, `app:check-for-updates`

### Updates (5 channels)
- `update:get-state`, `update:check`, `update:download`, `update:install`, `update:status-changed`

### Clipboard (1 channel)
- `clipboard:save-image`

### File Picker (1 channel)
- `file-picker:open`

### YOLO Mode (2 channels)
- `yolo:get`, `yolo:set`

### Settings (3 channels)
- `settings:get`, `settings:set`, `settings:reset`

## Key Data Structures

### Terminal
```typescript
interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  claudeSessionId?: string
  projectId?: string
  createdAt: Date
}

interface WslDistro { name: string; isDefault: boolean }
interface WslInfo { available: boolean; distros: WslDistro[] }
type WindowsShell = { type: 'cmd' } | { type: 'powershell' } | { type: 'wsl'; distro: string }
```

### Project
```typescript
interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date
  updatedAt: Date
}
```

### Notification Settings
```typescript
interface NotificationSettings {
  onTaskComplete: boolean
  onTaskFailed: boolean
  onReviewNeeded: boolean
  soundEnabled: boolean
  soundPreset: SoundPreset
  telegramEnabled: boolean
  telegramConfigured: boolean
  discordEnabled: boolean
  discordConfigured: boolean
  // Enhanced notification tracking
  outputMode: OutputMode        // 'auto' | 'stream-json' | 'plain-text'
  notifyOnlyBackground: boolean // Only notify when app unfocused
  includeTaskSummary: boolean   // Include task name in notification
}
```

### Update State
```typescript
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion?: string
  changelog?: string
  progress?: number  // 0-100 for download progress
  error?: string
}
```

### Project Terminal Layout (Project Tabs Redesign)
```typescript
interface ProjectTerminalLayout {
  projectId: string
  terminals: ProjectTerminal[]
}

interface ProjectTerminal {
  id: string
  title: string
  position: number  // 0-8 for grid position
}
```

## State Management

- **Zustand Stores**: SettingsStore (themes, notification settings), AppStore (terminals, projects, projectTerminals)
- **AppStore.projectTerminals**: Per-project terminal layouts via `setProjectTerminals()` / `getProjectTerminals()`
- **electron-store**: ProjectStore (persistent project list)
- **IPC Channels**: Terminal I/O streaming, real-time events
- **localStorage**: Theme preferences (auto-synced with Zustand)

## Build & Deploy

- **Bundler**: Vite with TypeScript
- **Electron Forge**: Native packaging for Win/Mac/Linux
- **Dev Mode**: `npm run electron:dev` (hot reload via Vite)
- **Build**: `npm run build` (creates distributable)
- **Release**: `npm run release` (build + publish to GitHub)
  - Platform-specific: `release:linux`, `release:win`, `release:mac`
  - Auto-update via electron-updater from GitHub releases
- **Versioning**: `npm run version:patch|minor|major` (creates git tag)
- **Testing**: Vitest with V8 coverage (60% thresholds)
  - Run tests: `npm test`
  - Watch mode: `npm run test:watch`
  - Coverage: `npm run test:coverage`
- **E2E Testing**: Playwright with Electron fixtures
  - Run UI tests: `npm run test:ui`
  - Update snapshots: `npm run test:ui:update`
  - Headed mode: `npm run test:ui:headed`
  - Visual regression: `npm run test:visual` / `test:visual:update`
  - Theme tests: `npm run test:themes`
  - Config: `src/__tests__/e2e/playwright.config.ts`
  - Features: Trace on retry, screenshot on failure, video capture
  - **Test Data** (`fixtures/test-data.ts`): Unified mock data for projects, terminals, themes, viewports
    - `themeTestCases`: 3 themes (default, ocean, vibrant) × 2 modes = 6 combinations
    - `viewportSizes`: Named viewport configs (fhd, laptop, hd, tablet, small)
    - `SIDEBAR_DIMENSIONS`: Min/max width boundaries for responsive tests
  - **Terminal Screenshot Helpers** (`fixtures/electron-app.ts`): Utilities for consistent visual regression
    - `TERMINAL_TEST_PROMPT`: Fixed prompt text for deterministic screenshots
    - `clearTerminalForScreenshot(window, index)`: Clears terminal and injects fixed prompt
    - `clearAllTerminalsForScreenshot(window)`: Clears all visible terminals for screenshots
  - **Phases Completed**:
    - Phase 1-3: Terminal pane, grid, rendering tests
    - Phase 4: Responsive layout tests - parameterized viewport testing, sidebar toggle, layout consistency
    - Phase 5: Visual regression tests - theme/mode screenshot comparisons for sidebar, settings modal, terminal, full page, empty state, theme transitions
    - Phase 6: Interactive & keyboard tests - keyboard shortcuts (Alt+1-9 project switch, Ctrl+N/W terminal mgmt), form inputs (terminal title editing), state transitions (empty states, toasts, error handling)
  - **Test Counts**: 21 passing, 5 flaky tests skipped (terminal creation timing issues in E2E)

### GitHub Actions Workflows

- **build.yml**: CI builds on push/PR to master/main, manual release via workflow_dispatch
  - Matrix build: ubuntu, windows, macos
  - Artifacts uploaded per platform
- **release.yml**: Tag-triggered release workflow (on `v*` tags)
  - Triggers on version tags (e.g., `v1.0.0`)
  - Builds and publishes to GitHub Releases on all platforms
  - Uploads: AppImage, deb, dmg, zip, exe
- **ui-tests.yml**: E2E/visual regression tests on push/PR to main/beta
  - Runs on ubuntu-latest with Xvfb (virtual framebuffer for headless Electron)
  - Playwright browser caching for faster runs
  - Uploads playwright-report and screenshot-diffs artifacts on failure

## Dependencies Overview

### Main Process
- `@lydell/node-pty`: PTY process spawning
- `electron-store`: Simple persistence
- `electron-updater`: Auto-update via GitHub releases
- `simple-git`: Git wrapper
- `github-script`: GH CLI integration

### Renderer
- `react@19`: UI framework
- `@xterm/xterm`: Terminal rendering
- `react-resizable-panels`: Grid layout
- `zustand`: State management
- `tailwindcss@4`: Styling

### Testing
- `vitest`: Unit testing framework
- `@playwright/test`: E2E testing with Electron support

## Development Workflow

1. **Feature Development**: Create plan in `plans/` with phases
2. **Type Safety**: Define types in `src/shared/types/`
3. **IPC Layer**: Add channels in `src/shared/constants/ipc-channels.ts`
4. **Main Process**: Implement handlers in `src/main/ipc/handlers.ts`
5. **Renderer**: Build UI in `src/renderer/components/`
6. **Documentation**: Update this file and relevant guides

## Notifications Implementation Phases

**Phase 1 - Completed: Types & Constants**
- Notification event types (NotificationEventType), OutputMode, SoundPreset
- NotificationSettings interface with enhanced tracking fields (outputMode, notifyOnlyBackground, includeTaskSummary)
- TaskEvent and JsonStreamEvent interfaces for output parsing
- TelegramCredentials, DiscordCredentials for secure storage
- DETECTION_PATTERNS and ENHANCED_DETECTION_PATTERNS (named capture groups)
- Default settings, sound presets, IPC channel definitions

**Phase 2 - Completed: Core Backend**
- **NotificationManager**: Central orchestrator, pattern detection, external platform dispatch
- **SecureStorage**: Encrypted credential storage (Telegram botToken/chatId, Discord webhookUrl)
- **PatternDetector**: Terminal output analysis with debounce to prevent event spam
- **TelegramNotifier**: Telegram Bot API integration with test/validation
- **DiscordNotifier**: Discord Webhook integration with URL format validation
- **Output Parser Infrastructure**:
  - **OutputParser**: Router with auto-detection locking (first valid format wins)
  - **JsonStreamParser**: NDJSON parser for Claude Code `--output-format stream-json`
  - **PlainTextParser**: Enhanced regex with named capture groups for task extraction
  - **parser-utils.ts**: Shared utilities (generateTaskEventId, MAX_REGEX_INPUT_LENGTH=10000)
  - 25 unit tests covering all parser scenarios
- **IPC Handlers**: 12 handlers covering settings, Telegram/Discord management, testing
- **Main Process Integration**: NotificationManager lifecycle, terminal output forwarding, app cleanup

**Phase 3 - Completed: Renderer UI**
- **NotificationStore**: Zustand store with async settings loading/saving, sound caching
- **NotificationSettings**: Event toggles (taskComplete, taskFailed, reviewNeeded), sound preset selector
- **TelegramConfigModal**: Secure credential input and management (configure/clear buttons)
- **DiscordConfigModal**: Webhook URL input and management
- **Sound Playback**: Audio element caching for efficient sound playback
- **Settings Panel Integration**: Notification tab in tabbed settings UI (Appearance/Notifications)
- **App Integration**: setupNotificationListener() called in App component on mount

**Phase 4 - Completed: Focus Detection & Deduplication**
- **FocusDetector**: Tracks window focus/blur and active terminal to suppress notifications when user is watching
- **TaskTracker**: Prevents duplicate notifications using SHA256-based task IDs with 5min TTL
- **IPC Handler**: NOTIFICATION_SET_ACTIVE_TERMINAL for renderer-to-main focus tracking
- **Preload API**: `electron.notification.setActiveTerminal(terminalId)` exposed to renderer
- **NotificationManager**: Integrated both detectors into notification flow
- **Test Coverage**: 31 new tests (17 FocusDetector + 14 TaskTracker)

**Phase 5 - Completed: Rich Platform Messages**
- **TelegramNotifier**: Rich HTML formatted messages via `sendTaskEvent(event: TaskEvent)`
  - `formatTaskEvent()`: Emoji + bold labels + HTML escaping
  - `escapeHtml()`: Escape &, <, > characters
  - `MAX_FIELD_LENGTH = 256`: Truncation limit
- **DiscordNotifier**: Colored embeds via `sendTaskEvent(event: TaskEvent)`
  - `DiscordEmbed` interface: Rich embed structure with fields, timestamp, footer
  - `sendEmbed()`: Generic embed payload sender
  - `formatTaskEvent()`: Build embed with color-coded type (green/red/yellow)
  - Test notification now uses embeds
- **NotificationManager**: Delegates to `notifier.sendTaskEvent()` instead of inline formatting
  - Removed duplicate `formatTelegramMessage()`/`formatDiscordMessage()` methods

**Phase 6 - Completed: Settings UI**
- **NotificationSettings Behavior Section**: New UI section for output parsing and notification behavior
  - Detection Mode dropdown: auto (recommended), stream-json, plain-text
  - "Only When Background" toggle: Skip notifications when watching terminal
  - "Include Task Summary" toggle: Add task name to notifications
  - Uses OutputMode type from shared/types
- **App.tsx Active Terminal Sync**: useEffect syncs activeTerminalId with notification.setActiveTerminal IPC
  - Enables FocusDetector to track which terminal user is watching
  - Runs on every activeTerminalId change

**Feature Status**: Feature complete and fully integrated

## Project Tabs Redesign Implementation Phases

**Phase 1 - Completed: Data Models**
- **ProjectTerminalLayout**: Per-project terminal layout storage (projectId + terminals array)
- **ProjectTerminal**: Terminal entry with id, title, and grid position (0-8)
- **AppStore.projectTerminals**: `Record<string, ProjectTerminalLayout>` state in Zustand
- **Store Methods**: `setProjectTerminals(projectId, layout)`, `getProjectTerminals(projectId)`

**Phase 2 - Completed: UI Components**
- **ProjectTabs**: Tab bar component for per-project terminal switching
  - Props: `projects`, `activeProjectId`, `onSelectProject`, `onAddProject`
  - Displays up to 9 visible tabs with keyboard shortcut badges (Alt+1-9)
  - Overflow dropdown for 10+ projects with click-outside/Escape dismissal
  - Add project (+) button for creating new projects
  - Empty state message when no projects exist
  - Active tab highlight with visual distinction
  - Located at `src/renderer/components/project-tabs/`

**Phase 3 - Completed: Terminal Header Bar & Add Cell**
- **TerminalPane Header Bar**: 24px header with editable title (double-click), Claude badge, Start Claude button, Close button
  - Title editing: Enter to save, Escape to cancel, blur to commit
  - Props added: `onClose`, `onStartClaude`, `onTitleChange`
  - Claude mode indicator badge when `isClaudeMode` is true
- **TerminalGrid Add Cell**: Placeholder cell for adding new terminals
  - Shown when terminal count < 9
  - Positioned in last row (or new row if last row full)
  - Props added: `onAddTerminal`, `onCloseTerminal`, `onStartClaude`
  - Empty state with "New Terminal" button when no terminals

**Phase 4 - Completed: Sidebar Refactor**
- Removed Projects section from sidebar (now in ProjectTabs component)
- Added Tools section with: New Terminal, Start Claude, Kill All
- Sidebar layout reorganized: Features (Git/GitHub) → Tools → Settings
- New Terminal: Creates terminal in active project with correct cwd/projectId
- Start Claude: Invokes Claude Code in active terminal (disabled if no terminal selected)
- Kill All: Terminates all terminals in active project with count display

**Phase 5 - Completed: Layout Refactor & Keyboard Shortcuts**
- **App Layout**: Removed TerminalTabs, ProjectTabs moved to top below header bar
  - Layout hierarchy: Header → ProjectTabs → [Sidebar | TerminalGrid]
  - TerminalGrid filters terminals by `activeProjectId` for per-project isolation
- **useKeyboardShortcuts Hook**: Global keyboard shortcuts via `useKeyboardShortcuts()` in App.tsx
  - Alt+1~9: Switch to project by index (1st-9th project in projects list)
  - Ctrl+N / Ctrl+T: Create new terminal in active project
  - Ctrl+W: Close active terminal
  - Mac support: Cmd key works as alternative to Ctrl
  - Terminal intercept: xterm key handler prevents shortcuts from being captured by terminal
- **Session Management**: Simplified startup - always creates single initial terminal (removed session restoration)
- **Handlers**: App.tsx now contains handlers for project/terminal operations
  - `handleAddProject`: Opens folder picker, creates project, sets as active
  - `handleAddTerminal`: Creates terminal with active project's cwd/projectId
  - `handleCloseTerminal`: Destroys terminal and removes from state
  - `handleStartClaude`: Invokes Claude Code in specified terminal

**Phase 6 - Completed: Terminal Layout Persistence**
- **ProjectStore Terminal Layout Methods**: Full CRUD API for persisting terminal layouts
  - `saveTerminalLayout(projectId, layout)`: Persist layout snapshot on state changes
  - `loadTerminalLayout(projectId)`: Restore layout on project switch
  - `deleteTerminalLayout(projectId)`: Auto-cleanup when project deleted
  - `getAllTerminalLayouts()`: Bulk retrieval for app initialization
- **Deleted Components**: Removed terminal-tabs.tsx (consolidated into ProjectTabs)
- **Feature Complete**: Project tabs redesign fully integrated with persistence layer

## In-App Update Settings Implementation

**Feature Status**: Completed (2026-01-05)

**Phase 1 - Completed: Types + IPC Channels**
- **UpdateState**: State interface with status, versions, changelog, progress, error
- **UpdateStatus**: Type union ('idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error')
- **IPC Channels**: UPDATE_GET_STATE, UPDATE_CHECK, UPDATE_DOWNLOAD, UPDATE_INSTALL, UPDATE_STATE_CHANGED
- **Preload**: Added `update` namespace to ElectronAPI

**Phase 2 - Completed: Main Process Enhancements**
- **auto-updater.ts**: Enhanced with state management and IPC broadcasting
  - State tracking with status, versions, changelog, progress
  - GitHub Releases API fetch for changelog (24hr cache TTL)
  - IPC event broadcasting on state changes
  - Auto-check on startup with 3s delay
- **handlers.ts**: UPDATE_* IPC handlers for get-state, check, download, install

**Phase 3 - Completed: Renderer Store + UI**
- **update-store.ts**: Zustand store for update state management
  - State mirroring from main process via IPC
  - Actions: checkForUpdates, downloadUpdate, installUpdate
- **update-settings.tsx**: Settings panel UI component
  - Current version display
  - "Check for Updates" button with loading state
  - Changelog display (plain text)
  - Download progress bar (0-100%)
  - "Install and Restart" button when update ready
- **settings-panel.tsx**: Added Updates tab to tabbed settings UI
- **sidebar.tsx**: Badge notification dot on Settings button when update available/ready
- **App.tsx**: setupUpdateListener() called on mount for state sync
