# MultiClaude Codebase Summary

## Overview
MultiClaude is an Electron-based desktop application for managing multiple Claude Code instances simultaneously. It provides project management, Git integration, GitHub authentication, terminal management, and user settings (themes and notifications).

## Architecture

### Core Layers
1. **Main Process** (Node.js) - Terminal spawning, Git operations, project persistence
2. **IPC Layer** - Bidirectional communication between main and renderer
3. **Renderer** (React 19 + TypeScript) - UI components, state management, settings
4. **Shared** - Types, constants, IPC channel definitions

### Key Components

#### Terminal Management
- **TerminalManager**: Spawns/destroys PTY processes via node-pty
- **TerminalView**: xterm.js renderer with WebGL addon
- **TerminalGrid**: Auto-split layout (1x1 → 3x4 based on terminal count), add-cell placeholder when <9 terminals
- **TerminalPane**: Resizable wrapper with header bar containing editable title, Claude button, close button

#### Project Management
- **ProjectStore**: electron-store persistence for projects
- File-based storage with project metadata (id, name, path, gitRemote)

#### Git Integration
- **GitManager**: Git operations via simple-git
- **GitHubAuth**: OAuth flow using GitHub CLI (gh command)
- Channels: status, init, add-remote, push

#### Settings
- **SettingsStore** (Zustand): Theme preferences in-memory + localStorage
- **SettingsPanel**: Tabbed settings UI (Appearance, Notifications)
- **ThemeSelector**: Color theme and dark/light mode selection
- Themes: 7 color themes + light/dark/system mode

#### Notifications
**Phase 1 - Completed: Types & Constants**
- **NotificationEventType**: 'taskComplete' | 'taskFailed' | 'reviewNeeded'
- **SoundPreset**: 'default' | 'minimal' | 'retro'
- **NotificationSettings**: Event toggles, sound config, Telegram/Discord flags
- **TelegramCredentials**, **DiscordCredentials**: Secure credential interfaces
- **DETECTION_PATTERNS**: Regex patterns for automatic event detection

**Phase 2 - Completed: Core Backend**
- **NotificationManager**: Central orchestrator for all notification types
- **SecureStorage**: Electron safeStorage wrapper for credential encryption (Telegram/Discord)
- **PatternDetector**: Terminal output pattern matching with 300ms debounce
- **TelegramNotifier**: Telegram Bot API integration via HTTP
- **DiscordNotifier**: Discord Webhook integration with URL validation
- 12 IPC handlers for credential management, testing, and retrieval

**Phase 3 - Completed: Renderer UI**
- **NotificationStore** (Zustand): Settings state management with sound caching
- **NotificationSettings**: Main settings UI with event toggles, sound preset selector
- **TelegramConfigModal**: Modal for Telegram botToken/chatId configuration
- **DiscordConfigModal**: Modal for Discord webhookUrl configuration
- Sound playback with audio element caching (auto, success, error, info types)
- Settings persistence via IPC with local optimistic updates
- Integrated into SettingsPanel with tabbed navigation

## File Organization

```
src/
├── main/                     # Electron main process
│   ├── index.ts             # App window creation, menu
│   ├── terminal/            # PTY management
│   │   ├── terminal-manager.ts
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
│   │   ├── telegram-notifier.ts
│   │   ├── discord-notifier.ts
│   │   └── index.ts
│   └── ipc/                 # IPC handlers
│       └── handlers.ts
├── renderer/                # React UI
│   ├── App.tsx
│   ├── components/
│   │   ├── terminal/        # Terminal UI
│   │   ├── sidebar/         # Project/settings sidebar
│   │   ├── project-tabs/    # Project tab bar
│   │   │   ├── project-tabs.tsx
│   │   │   └── index.ts
│   │   └── settings/        # Settings panels
│   │       ├── settings-panel.tsx
│   │       ├── theme-selector.tsx
│   │       ├── notification-settings.tsx
│   │       ├── telegram-config-modal.tsx
│   │       ├── discord-config-modal.tsx
│   │       └── index.ts
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   │   ├── app-store.ts
│   │   ├── settings-store.ts
│   │   ├── notification-store.ts
│   │   └── index.ts
│   └── styles/              # CSS
├── preload/                 # IPC bridge
│   └── index.ts
└── shared/                  # Shared code
    ├── types/               # TypeScript interfaces
    │   ├── index.ts
    │   └── notification.ts
    └── constants/           # Constants & defaults
        ├── index.ts
        ├── ipc-channels.ts
        ├── notification.ts
        ├── themes.ts
        └── terminal-themes.ts
```

## IPC Channels

### Terminal
- `terminal:create`, `terminal:destroy`, `terminal:input`, `terminal:output`, `terminal:resize`, `terminal:list`, `terminal:invoke-claude`

### Project
- `project:list`, `project:create`, `project:delete`, `project:set-active`, `project:open-folder`, `project:check-folder`

### Git
- `git:status`, `git:init`, `git:add-remote`, `git:push`

### GitHub
- `github:auth-status`, `github:login`, `github:logout`, `github:create-repo`

### Notifications
- **Settings**: `notification:get-settings`, `notification:set-settings`
- **Telegram**: `notification:set-telegram`, `notification:get-telegram-status`, `notification:test-telegram`, `notification:clear-telegram`
- **Discord**: `notification:set-discord`, `notification:get-discord-status`, `notification:test-discord`, `notification:clear-discord`
- **Events**: `notification:event` (broadcast for pattern-detected events)

### Session & App
- `session:save`, `session:restore`, `app:get-path`

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

## Dependencies Overview

### Main Process
- `@lydell/node-pty`: PTY process spawning
- `electron-store`: Simple persistence
- `simple-git`: Git wrapper
- `github-script`: GH CLI integration

### Renderer
- `react@19`: UI framework
- `@xterm/xterm`: Terminal rendering
- `react-resizable-panels`: Grid layout
- `zustand`: State management
- `tailwindcss@4`: Styling

## Development Workflow

1. **Feature Development**: Create plan in `plans/` with phases
2. **Type Safety**: Define types in `src/shared/types/`
3. **IPC Layer**: Add channels in `src/shared/constants/ipc-channels.ts`
4. **Main Process**: Implement handlers in `src/main/ipc/handlers.ts`
5. **Renderer**: Build UI in `src/renderer/components/`
6. **Documentation**: Update this file and relevant guides

## Notifications Implementation Phases

**Phase 1 - Completed: Types & Constants**
- Notification event types, settings interfaces, credentials structures
- Default settings, sound presets, regex detection patterns
- IPC channel definitions and exports

**Phase 2 - Completed: Core Backend**
- **NotificationManager**: Central orchestrator, pattern detection, external platform dispatch
- **SecureStorage**: Encrypted credential storage (Telegram botToken/chatId, Discord webhookUrl)
- **PatternDetector**: Terminal output analysis with debounce to prevent event spam
- **TelegramNotifier**: Telegram Bot API integration with test/validation
- **DiscordNotifier**: Discord Webhook integration with URL format validation
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

**Phase 4 - Pending: Integration**
- Project switching with terminal layout restore
- Session persistence for terminal layouts
