# MultiClaude Code Standards

## Project Structure

```
multiclaude/
├── src/
│   ├── main/                 # Electron main process (Node.js)
│   │   ├── index.ts          # Entry point, window, menu
│   │   ├── terminal/         # PTY management
│   │   ├── git/              # Git operations
│   │   ├── project/          # Project persistence
│   │   ├── notification/     # Notification system
│   │   ├── clipboard/        # Clipboard handlers
│   │   ├── updater/          # Auto-update
│   │   ├── ipc/              # IPC handlers
│   │   └── __tests__/        # Test files
│   ├── renderer/             # React UI
│   │   ├── App.tsx           # Root component
│   │   ├── main.tsx          # Entry point
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── stores/           # Zustand stores
│   │   ├── utils/            # Utility functions
│   │   └── styles/           # CSS files
│   ├── preload/              # Electron preload
│   │   └── index.ts          # IPC bridge
│   └── shared/               # Shared between processes
│       ├── types/            # TypeScript interfaces
│       └── constants/        # Constants, enums, IPC channels
├── docs/                     # Documentation
├── plans/                    # Development plans, reports
└── build/                    # App icons
```

## Naming Conventions

### Files and Directories

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case | `terminal-grid.tsx` |
| Hooks | kebab-case, use- prefix | `use-keyboard-shortcuts.ts` |
| Stores | kebab-case, -store suffix | `app-store.ts` |
| Types | kebab-case | `notification.ts` |
| Tests | kebab-case, .spec suffix | `git-manager.spec.ts` |
| Constants | kebab-case | `ipc-channels.ts` |

### Code Identifiers

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TerminalGrid` |
| Hooks | camelCase, use prefix | `useKeyboardShortcuts` |
| Functions | camelCase | `handleTerminalCreate` |
| Constants | SCREAMING_SNAKE | `IPC_CHANNELS` |
| Interfaces | PascalCase | `Terminal`, `Project` |
| Types | PascalCase | `UpdateStatus` |
| Enums | PascalCase | `SoundPreset` |

## TypeScript Standards

### Type Definitions

Place shared types in `src/shared/types/`:

```typescript
// src/shared/types/index.ts
export interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  claudeSessionId?: string
  projectId?: string
  createdAt: Date
}

export interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date
  updatedAt: Date
}
```

### Avoid `any`

Use proper types or `unknown` with type guards:

```typescript
// Bad
function processData(data: any) { ... }

// Good
function processData(data: unknown) {
  if (isValidData(data)) { ... }
}
```

### Prefer Type Inference

Let TypeScript infer when obvious:

```typescript
// Unnecessary
const count: number = 0
const items: string[] = []

// Preferred
const count = 0
const items: string[] = [] // explicit when empty
```

## React Standards

### Component Structure

```typescript
// components/terminal/terminal-pane.tsx
import { useState, useCallback } from 'react'
import { Terminal } from '@shared/types'

interface TerminalPaneProps {
  terminal: Terminal
  isActive: boolean
  onClose: (id: string) => void
  onTitleChange: (id: string, title: string) => void
}

export function TerminalPane({
  terminal,
  isActive,
  onClose,
  onTitleChange
}: TerminalPaneProps) {
  const [isEditing, setIsEditing] = useState(false)

  const handleClose = useCallback(() => {
    onClose(terminal.id)
  }, [terminal.id, onClose])

  return (
    <div className={`terminal-pane ${isActive ? 'active' : ''}`}>
      {/* ... */}
    </div>
  )
}
```

### Hook Guidelines

```typescript
// hooks/use-terminal.ts
export function useTerminal(terminalId: string) {
  const terminal = useAppStore(state =>
    state.terminals.find(t => t.id === terminalId)
  )

  const sendInput = useCallback((data: string) => {
    window.electron.terminal.input(terminalId, data)
  }, [terminalId])

  return { terminal, sendInput }
}
```

### Accessibility Standards

All interactive components must follow WCAG 2.1 Level AA guidelines:

**Button Accessibility:**
```typescript
<button
  onClick={handleClick}
  aria-label="Descriptive action label"
  aria-pressed={isActive}
  className="focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
>
  Button Text
</button>
```

**Form Controls:**
```typescript
<label htmlFor="control-id" className="sr-only">
  Screen reader label
</label>
<select
  id="control-id"
  value={value}
  onChange={handleChange}
  className="focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
>
  <option value="val">Option</option>
</select>
```

**Key Requirements:**
- All buttons must have `aria-label` or visible text
- Toggle buttons must have `aria-pressed` state
- Form controls must have associated labels (visible or `.sr-only`)
- Interactive elements must have visible focus states (`:focus:ring-2`)
- Color contrast must meet WCAG AA standards (4.5:1 for text)

**Example (TerminalStyleOptions):**
```typescript
<button
  onClick={() => setColorPreset(preset.id)}
  aria-label={`Select ${preset.name} color preset`}
  aria-pressed={selected}
  className="focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
/>
```

### Shared Component Patterns

Extract repeated UI patterns into shared components to maintain DRY principle:

```typescript
// components/settings/settings-typography.tsx
// Shared typography for consistent styling across Settings tabs
export function SettingsTitle({ children, description }: SettingsTitleProps) {
  return (
    <div>
      <h3 className="text-lg font-medium text-[var(--mc-text-primary)]">{children}</h3>
      {description && <p className="text-sm text-[var(--mc-text-muted)]">{description}</p>}
      <hr className="my-4 border-[var(--mc-border)]" />
    </div>
  )
}

export function SettingsSubheading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase text-[var(--mc-text-muted)] mb-2 tracking-wide">
      {children}
    </h4>
  )
}
```

Guidelines:
- Extract when 3+ components share identical styling patterns
- Keep shared components simple and focused on single responsibility
- Use CSS variables for theme-aware styling

### New Shared Components (v3.0.1-beta)

**ToggleSwitch**: Reusable boolean toggle control for settings
```typescript
// components/settings/toggle-switch.tsx
interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function ToggleSwitch({ label, checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        className={`w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--mc-accent)]' : 'bg-[var(--mc-bg-hover)]'
        }`}
      />
    </div>
  )
}
```

**UpdateBanner**: Visual state management for app updates
```typescript
// components/update-banner.tsx
export function UpdateBanner() {
  const { state: updateState } = useUpdateStore()

  if (updateState.status === 'available') {
    return <div className="p-3 bg-[var(--mc-accent)]/10">Update available</div>
  }
  return null
}
```

### State Management (Zustand)

```typescript
// stores/app-store.ts
import { create } from 'zustand'
import { Terminal, Project } from '@shared/types'

interface AppState {
  terminals: Terminal[]
  projects: Project[]
  activeProjectId: string | null
  activeTerminalId: string | null

  // Actions
  addTerminal: (terminal: Terminal) => void
  removeTerminal: (id: string) => void
  setActiveProject: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  terminals: [],
  projects: [],
  activeProjectId: null,
  activeTerminalId: null,

  addTerminal: (terminal) => set((state) => ({
    terminals: [...state.terminals, terminal]
  })),

  removeTerminal: (id) => set((state) => ({
    terminals: state.terminals.filter(t => t.id !== id)
  })),

  setActiveProject: (id) => set({ activeProjectId: id })
}))
```

### Settings Store Pattern (v3.1.0)

**Dual-Flow Architecture**: Pending (live preview) + Saved (disk source of truth)

```typescript
// stores/settings-store.ts (Zustand in renderer)
interface SettingsState {
  savedSettings: Settings          // Disk source of truth
  pendingSettings: Settings        // Live preview before Save
  hasUnsavedChanges: boolean

  // Actions
  setSetting: (key: keyof Settings, value: unknown) => void
  save: () => Promise<void>        // Persist to main process
  cancel: () => void               // Discard pendingSettings
  reset: () => Promise<void>       // Reset to defaults
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedSettings: DEFAULTS,
  pendingSettings: DEFAULTS,
  hasUnsavedChanges: false,

  setSetting: (key, value) => set((state) => {
    const pending = { ...state.pendingSettings, [key]: value }
    return {
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, state.savedSettings)
    }
  }),

  save: async () => {
    const { pendingSettings } = get()
    await window.electron.settings.set(pendingSettings)
    set({ savedSettings: pendingSettings, hasUnsavedChanges: false })
  },

  cancel: () => set((state) => ({
    pendingSettings: state.savedSettings,
    hasUnsavedChanges: false
  }))
}))
```

**Key Patterns:**
- `hasUnsavedChanges`: Deep field-by-field equality (not JSON.stringify)
- `setSetting()`: Updates pendingSettings, recalculates hasUnsavedChanges
- `save()`: IPC to main process, updates savedSettings only on success
- `cancel()`: Reverts pendingSettings to savedSettings
- Main process validates all settings before persistence (validation firewall)

### Attachment Strip Pattern (v3.1.1+)

**Image/Video Thumbnail Strip**: Dropped images/videos display as 80×60px tiles above each terminal pane with ✕ remove buttons.

**Store Integration:**
- `image-store.ts`: Per-terminal image/video registry with `removeImage(terminalId, filePath)` method
- `pending-media-store.ts`: Token queue for non-Claude mode; `removeTokenByPath()` for synchronization

**Removal Handler:**
- Non-Claude mode: Removes from image store, pending-media queue, and xterm display (if still trailing input)
- Claude mode: Removes only from strip (cannot rewrite Claude Code's internal buffer)
- Pattern: Mode-aware dispatch via `handleAttachmentRemove()` utility in `src/renderer/utils/attachment-remove-handler.ts`

### Pane Tree Store Pattern (v3.4.4)

**Binary Split Tree**: Recursive tree where nodes are terminals (leaves) or splits (containers with 2 children).

```typescript
// Pure model: src/shared/types/pane-tree.ts
type PaneTree = { kind: 'leaf', terminalId: string } | 
               { kind: 'split', orientation: 'row'|'column', ratio: [0.1,0.9], children: [PaneTree, PaneTree] }

// Renderer store: src/renderer/stores/pane-tree-store.ts
// Debounces writes 200ms via terminal:load/save-pane-tree IPC
// Split actions via useExecuteSplit (10s timeout, in-flight guard)
// Resize via usePaneResize (rAF-coalesce, prevents trackpad bursts)
```

**Key Points:**
- Tree persisted per-project (schemaVersion 2, legacy flat → tree migration on-read)
- Split/close via context menu or hotkeys (Ctrl+Shift+→/←/↓/↑)
- Resize handles capture pointer, clean up on unmount; arrow-key a11y
- rAF-coalesced divider drag eliminates 100Hz trackpad → ResizeObserver→fit→SIGWINCH cascade

### Context Window Analyzer Pattern (v3.4.4)

```typescript
// Main: src/main/context/context-window-analyzer.ts (EventEmitter)
// Parses JSONL from ClaudeLogWatcher, sorts into 6 buckets, 300ms debounce snapshot
// IPC: context:get(sessionId) invoke + context:snapshot broadcast (1h per-session TTL)

// Renderer: src/renderer/hooks/use-context-snapshot.ts + ContextWindowDrawer
// Binds to active pane's claudeSessionId; exposes isStale flag (>10s no update)
// Feature flag: AppSettings.enableContextWindow (startup-only, default true)
```

## IPC Standards

### Channel Definition

```typescript
// shared/constants/ipc-channels.ts
export const IPC_CHANNELS = {
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_INPUT: 'terminal:input',
  // ... more channels
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
```

### Handler Pattern

```typescript
// main/ipc/handlers.ts
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'

export function registerHandlers(terminalManager: TerminalManager) {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, options) => {
    return terminalManager.create(options)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, id: string) => {
    return terminalManager.destroy(id)
  })
}
```

### Preload Bridge

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'

contextBridge.exposeInMainWorld('electron', {
  terminal: {
    create: (options) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),
    destroy: (id) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),
    input: (id, data) => ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, id, data),
    onOutput: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_OUTPUT, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OUTPUT, callback)
    }
  }
})
```

## Error Handling

### Main Process

```typescript
// Wrap async handlers with error handling
ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_, path, message) => {
  try {
    return await gitManager.commit(path, message)
  } catch (error) {
    console.error('[GitManager] Commit failed:', error)
    throw error // Re-throw for renderer to handle
  }
})
```

### Renderer

```typescript
// Use try/catch with toast notifications
async function handleCommit(message: string) {
  try {
    await window.electron.git.commit(projectPath, message)
    showToast({ type: 'success', message: 'Committed successfully' })
  } catch (error) {
    showToast({ type: 'error', message: error.message })
  }
}
```

## Testing Standards

### Test File Location

Place tests in `__tests__/` directories:

```
src/main/git/
├── git-manager.ts
├── git-head-watcher.ts
└── __tests__/
    └── git-manager.spec.ts
```

### Test Structure

```typescript
// __tests__/git-manager.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GitManager } from '../git-manager'

describe('GitManager', () => {
  let gitManager: GitManager

  beforeEach(() => {
    gitManager = new GitManager()
  })

  describe('status', () => {
    it('returns git status for valid repo', async () => {
      const status = await gitManager.status('/valid/repo')
      expect(status.isRepo).toBe(true)
    })

    it('throws error for invalid path', async () => {
      await expect(gitManager.status('/invalid'))
        .rejects.toThrow()
    })
  })
})
```

### Coverage Requirements

- Minimum 60% coverage for statements, branches, functions, lines
- Run with: `npm run test:coverage`

## CSS Standards (Tailwind)

### Class Organization

```tsx
// Order: layout -> spacing -> sizing -> colors -> effects -> states
<div className="
  flex items-center justify-between
  p-2 gap-2
  w-full h-12
  bg-gray-800 text-white
  rounded-lg shadow-md
  hover:bg-gray-700
">
```

### Theme Variables

Use CSS variables for theme colors (defined in globals.css):

```css
.terminal-pane {
  background: var(--mc-bg-primary);
  color: var(--mc-text-primary);
  border-color: var(--mc-border);
}
```

### Terminal UI Style System

Apply `.ui-terminal` class for terminal-themed UI with monospace fonts and ASCII aesthetics.

**CSS Variables:**
- `--mc-terminal-font`: Monospace font family (customizable via settings)
- Color presets applied via data attributes or classes

**Terminal Color Presets:**
Configured in `src/shared/constants/terminal-constants.ts`:
- `green`: Classic green terminal (CRT green)
- `blue`: Blue terminal theme
- `white`: Light terminal theme
- `amber`: Amber CRT terminal
- `purple`: Purple hacker theme

**Terminal Font Options:**
- `jetbrains-mono`: JetBrains Mono (default)
- `fira-code`: Fira Code with ligatures
- `source-code-pro`: Source Code Pro
- `cascadia-code`: Cascadia Code
- `consolas`: Consolas (Windows classic)

**Border Styles:**
- `useBorderChars: false`: 1px solid borders (clean minimal)
- `useBorderChars: true`: ASCII box drawing characters (┌─┐)

**ASCII Border Utilities (requires `.ui-terminal.use-border-chars`):**
- `.ascii-border`: Adds ┌─┐ borders with ::before/::after
- `.ascii-line-h`: Horizontal line (─)
- `.ascii-line-v`: Vertical line (│)

Example usage:
```tsx
<div className="ui-terminal use-border-chars">
  <div className="ascii-border p-4">Terminal UI</div>
</div>
```

**Settings Integration:**
Terminal style managed via `useSettingsStore`:
- `uiStyle`: 'modern' | 'terminal'
- `terminalStyleOptions`: { colorPreset, fontFamily, useBorderChars }

Component: `src/renderer/components/settings/terminal-style-options.tsx`

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | feature/description | `feature/terminal-grid` |
| Fix | fix/description | `fix/webgl-disposal` |
| Refactor | refactor/description | `refactor/settings-modal` |

### Commit Messages

```
<type>(<scope>): <description>

type: feat, fix, refactor, docs, test, chore
scope: terminal, git, notification, settings, etc.
```

Examples:
- `feat(terminal): add automatic renderer policy`
- `fix(notification): prevent pattern spam with debounce`
- `refactor(sidebar): extract navigation-item component`

## Documentation Standards

### Code Comments

```typescript
// Single line for brief explanations
const DISPOSE_DELAY = 150 // Prevents WebGL corruption

/**
 * Multi-line for complex logic.
 * Explains why, not what.
 */
function handleProjectSwitch(projectId: string) {
  // ...
}
```

### JSDoc for Public APIs

```typescript
/**
 * Creates a new terminal in the specified project.
 * @param options - Terminal creation options
 * @param options.cwd - Working directory
 * @param options.projectId - Associated project ID
 * @returns Created terminal instance
 */
export async function createTerminal(options: CreateTerminalOptions): Promise<Terminal>
```

## Path Aliases

Configure in tsconfig.json:

```json
{
  "compilerOptions": {
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

Usage:
```typescript
import { IPC_CHANNELS } from '@shared/constants'
import { Terminal } from '@shared/types'
```

## Performance Best Practices

### Conditional Mounting (Git Panel Pattern)
```typescript
// Only mount git-panel when visible to prevent polling
if (gitPanelOpen) {
  return <GitPanel />
}
return null

// Use shared concurrency guards to prevent duplicate git status calls
const statusGuard = useRef(false)
const getGitStatus = useCallback(async () => {
  if (statusGuard.current) return
  statusGuard.current = true
  try {
    return await git.status(cwd)
  } finally {
    statusGuard.current = false
  }
}, [cwd])
```

### Escape Key Leakage Prevention (shortcut-utils Pattern)
Use `shortcut-utils.ts` for keyboard event handling to block escape propagation during critical operations like project switching.

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run electron:dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm test` | Run tests once |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | Type checking |
| `npm run lint` | ESLint |
