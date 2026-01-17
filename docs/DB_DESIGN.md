# Database Design (electron-store)

> Auto-generated from codebase via `/ipa:init`
> MultiClaude uses electron-store (JSON file-based) instead of SQL database

## 1. Overview

MultiClaude persists data using `electron-store`, which stores JSON files on disk:
- **Windows**: `%APPDATA%/multiclaude/`
- **macOS**: `~/Library/Application Support/multiclaude/`
- **Linux**: `~/.config/multiclaude/`

## 2. Store Files

| Store File | Class | Purpose |
|------------|-------|---------|
| `multiclaude-data.json` | `ProjectStore` | Projects, sessions, terminal layouts |
| `multiclaude-settings.json` | `SettingsStore` | App preferences |
| `multiclaude-notifications.json` | (inline) | Notification config |

## 3. Entity-Relationship Diagram

```mermaid
erDiagram
    PROJECT ||--o{ TERMINAL_LAYOUT : "has"
    PROJECT {
        string id PK
        string name
        string path
        string gitRemote
        datetime createdAt
        datetime updatedAt
    }

    TERMINAL_LAYOUT {
        string projectId FK
        array terminals
    }

    TERMINAL_SESSION {
        string id PK
        string title
        string cwd
        string projectId FK
        string claudeSessionId
        string outputBuffer
    }

    APP_SESSION {
        array terminals
        string activeTerminalId
        object windowBounds
    }

    APP_SETTINGS {
        string themeMode
        string colorTheme
        object terminalLimit
        string terminalRenderMode
        boolean glassmorphismEnabled
        object windowsShell
    }
```

## 4. Schema Definitions

### ProjectStore Schema (`multiclaude-data.json`)

```typescript
interface ProjectStoreSchema {
  projects: Project[]
  activeProjectId: string | null
  session: AppSession | null
  terminalLayouts: Record<string, ProjectTerminalLayout>
}
```

#### E-01: Project

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique ID (format: `proj-{timestamp}-{random}`) |
| `name` | string | ✅ | Display name (folder name) |
| `path` | string | ✅ | Absolute filesystem path |
| `gitRemote` | string | ❌ | Git remote URL |
| `createdAt` | Date | ✅ | Creation timestamp |
| `updatedAt` | Date | ✅ | Last update timestamp |

#### E-02: ProjectTerminalLayout

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | ✅ | Reference to Project.id |
| `terminals` | ProjectTerminal[] | ✅ | Terminal configurations |

#### E-03: ProjectTerminal

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Terminal instance ID |
| `title` | string | ✅ | Tab title |
| `position` | number | ✅ | Grid position (0-11) |

#### E-04: AppSession

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `terminals` | TerminalSession[] | ✅ | Active terminal sessions |
| `activeTerminalId` | string | ❌ | Currently focused terminal |
| `windowBounds` | object | ❌ | Window position/size |

#### E-05: TerminalSession

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Terminal instance ID |
| `title` | string | ✅ | Tab title |
| `cwd` | string | ✅ | Working directory |
| `projectId` | string | ❌ | Associated project |
| `claudeSessionId` | string | ❌ | Claude session ID |
| `outputBuffer` | string | ✅ | Scrollback buffer |

### SettingsStore Schema (`multiclaude-settings.json`)

```typescript
interface SettingsStoreSchema {
  settings: AppSettings
}
```

#### E-06: AppSettings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `themeMode` | `'light' \| 'dark' \| 'system'` | `'system'` | Color mode preference |
| `colorTheme` | ColorTheme | `'default'` | Color theme selection |
| `terminalLimit` | TerminalLimit | `{ preset: 9 }` | Max terminals per project |
| `terminalRenderMode` | `'performance' \| 'balanced' \| 'quality'` | `'balanced'` | WebGL rendering mode |
| `glassmorphismEnabled` | boolean | `true` | Glass effect toggle |
| `windowsShell` | WindowsShell | undefined | Default shell (Windows) |

#### E-07: TerminalLimit

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `2 \| 4 \| 9 \| 'custom'` | Preset value or custom |
| `customValue` | number | Custom limit (1-99) |

#### E-08: WindowsShell

| Type | Fields | Description |
|------|--------|-------------|
| `{ type: 'cmd' }` | - | Windows Command Prompt |
| `{ type: 'powershell' }` | - | PowerShell |
| `{ type: 'wsl', distro: string }` | distro name | WSL distribution |

### ColorTheme Values

| ID | Name |
|----|------|
| `default` | Default Blue |
| `dusk` | Dusk Purple |
| `lime` | Lime Green |
| `ocean` | Ocean Teal |
| `retro` | Retro Orange |
| `neo` | Neo Pink |
| `forest` | Forest Green |
| `neon-cyber` | Neon Cyber |
| `pro-dark` | Pro Dark |
| `vibrant` | Vibrant |

## 5. Data Operations

### ProjectStore Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getProjects()` | - | `Project[]` | List all projects |
| `getProject(id)` | `id: string` | `Project \| undefined` | Get single project |
| `addProject(project)` | `Omit<Project, 'id' \| 'createdAt' \| 'updatedAt'>` | `Project` | Create project |
| `updateProject(id, updates)` | `id, Partial<Project>` | `Project \| null` | Update project |
| `deleteProject(id)` | `id: string` | `boolean` | Delete project |
| `getActiveProjectId()` | - | `string \| null` | Get active project |
| `setActiveProjectId(id)` | `id: string \| null` | void | Set active project |
| `saveSession(session)` | `AppSession` | void | Save session state |
| `getSession()` | - | `AppSession \| null` | Restore session |
| `clearSession()` | - | void | Clear session |
| `saveTerminalLayout(...)` | `projectId, layout` | void | Save terminal layout |
| `loadTerminalLayout(...)` | `projectId` | `ProjectTerminalLayout \| null` | Load terminal layout |
| `deleteTerminalLayout(...)` | `projectId` | void | Delete terminal layout |

### SettingsStore Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getSettings()` | - | `AppSettings` | Get all settings |
| `setSettings(settings)` | `Partial<AppSettings>` | `AppSettings` | Update settings |
| `resetSettings()` | - | `AppSettings` | Reset to defaults |

## 6. Data Validation

Settings validation is performed before saving:

```typescript
// Enum validation
const VALID_THEME_MODES = ['light', 'dark', 'system']
const VALID_COLOR_THEMES = ['default', 'dusk', 'lime', ...]
const VALID_RENDER_MODES = ['performance', 'balanced', 'quality']
const VALID_TERMINAL_PRESETS = [2, 4, 9, 'custom']

// Custom terminal limit: 1-99 range
if (limit.preset === 'custom') {
  customValue >= 1 && customValue <= 99
}
```

## 7. Security

| Concern | Implementation |
|---------|----------------|
| Credential Storage | Telegram/Discord tokens use `electron.safeStorage` |
| File Location | OS-standard app data directory |
| Sensitive Data | API tokens NOT stored in JSON stores |

## 8. Source Files

| File | Purpose |
|------|---------|
| `src/main/project/project-store.ts` | ProjectStore class |
| `src/main/settings/settings-store.ts` | SettingsStore class |
| `src/shared/types/index.ts` | Type definitions |
| `src/shared/constants/index.ts` | Default values |
