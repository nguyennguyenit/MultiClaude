# Phase 3: Types & Settings Store

**Effort**: 1h

## Objective

Add TypeScript types and update settings store for shell preference.

## Tasks

### 3.1 Add WindowsShell Type

**File**: `src/shared/types/index.ts` (MODIFY)

Add after `TerminalRenderMode`:

```typescript
// Windows shell types for WSL support
export type WindowsShellType = 'cmd' | 'powershell' | 'wsl'

export interface WindowsShellCmd {
  type: 'cmd'
}

export interface WindowsShellPowerShell {
  type: 'powershell'
}

export interface WindowsShellWsl {
  type: 'wsl'
  distro: string
}

export type WindowsShell = WindowsShellCmd | WindowsShellPowerShell | WindowsShellWsl

// WSL detection result
export interface WslDistro {
  name: string
  isDefault: boolean
}

export interface WslInfo {
  available: boolean
  distros: WslDistro[]
}
```

### 3.2 Update AppSettings

**File**: `src/shared/types/index.ts` (MODIFY)

Update `AppSettings` interface:

```typescript
export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
  terminalRenderMode: TerminalRenderMode
  glassmorphismEnabled: boolean
  windowsDefaultShell?: WindowsShell  // Optional - only used on Windows
}
```

### 3.3 Update Default Settings

**File**: `src/shared/constants/themes.ts` (MODIFY)

Update `DEFAULT_SETTINGS` if exists:

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  // ... existing fields
  windowsDefaultShell: { type: 'cmd' }  // Default to cmd.exe
}
```

### 3.4 Update Settings Store

**File**: `src/renderer/stores/settings-store.ts` (MODIFY)

Add WSL info state and shell setter:

```typescript
import type { WindowsShell, WslInfo } from '@shared/types'

interface SettingsState {
  settings: AppSettings
  wslInfo: WslInfo | null  // Cached WSL detection result
  // ... existing methods
  setWindowsDefaultShell: (shell: WindowsShell) => void
  setWslInfo: (info: WslInfo) => void
  detectWsl: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      wslInfo: null,

      setWindowsDefaultShell: (shell) =>
        set((state) => ({
          settings: { ...state.settings, windowsDefaultShell: shell }
        })),

      setWslInfo: (info) => set({ wslInfo: info }),

      detectWsl: async () => {
        // Only on Windows
        if (typeof window !== 'undefined' && window.electronAPI?.detectWsl) {
          const info = await window.electronAPI.detectWsl()
          set({ wslInfo: info })

          // Validate saved shell preference
          const currentShell = get().settings.windowsDefaultShell
          if (currentShell?.type === 'wsl') {
            const distroExists = info.distros.some(d => d.name === currentShell.distro)
            if (!distroExists) {
              // Saved distro no longer exists, reset to cmd
              set((state) => ({
                settings: { ...state.settings, windowsDefaultShell: { type: 'cmd' } }
              }))
            }
          }
        }
      },

      // ... existing methods
    }),
    {
      name: 'multiclaude-settings',
      partialize: (state) => ({ settings: state.settings })
      // wslInfo not persisted - detected fresh each launch
    }
  )
)
```

### 3.5 Call detectWsl on App Init

**File**: `src/renderer/App.tsx` or appropriate init location (MODIFY)

Add useEffect to detect WSL on mount (Windows only):

```typescript
import { useSettingsStore } from './stores'

function App() {
  const detectWsl = useSettingsStore((s) => s.detectWsl)

  useEffect(() => {
    // Detect WSL on Windows
    detectWsl()
  }, [detectWsl])

  // ... rest
}
```

## Acceptance Criteria

- [ ] `WindowsShell` type compiles correctly
- [ ] `AppSettings.windowsDefaultShell` persists in localStorage
- [ ] WSL detection runs on app init (Windows)
- [ ] Invalid saved distro resets to cmd.exe
- [ ] No errors on macOS/Linux (wslInfo stays null)
