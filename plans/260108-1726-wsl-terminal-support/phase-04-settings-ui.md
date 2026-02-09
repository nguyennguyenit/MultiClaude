# Phase 4: Settings UI

**Effort**: 1h

## Objective

Add "Default Shell" dropdown to Terminal Settings (Windows only, hidden if no WSL).

## Tasks

### 4.1 Update TerminalSettings Component

**File**: `src/renderer/components/settings/terminal-settings.tsx` (MODIFY)

Add shell selector section:

```typescript
import type { WindowsShell, WslInfo } from '@shared/types'

// Add to component
export function TerminalSettings() {
  const {
    settings,
    wslInfo,
    setWindowsDefaultShell,
    // ... existing destructures
  } = useSettingsStore()

  // Only show shell settings on Windows with WSL
  const showShellSettings = wslInfo?.available === true

  // Build shell options
  const shellOptions = useMemo(() => {
    const options: { value: WindowsShell; label: string }[] = [
      { value: { type: 'cmd' }, label: 'Command Prompt' },
      { value: { type: 'powershell' }, label: 'PowerShell' }
    ]

    if (wslInfo?.distros) {
      wslInfo.distros.forEach((distro) => {
        options.push({
          value: { type: 'wsl', distro: distro.name },
          label: `WSL: ${distro.name}${distro.isDefault ? ' (default)' : ''}`
        })
      })
    }

    return options
  }, [wslInfo])

  // Get current shell key for comparison
  const getShellKey = (shell: WindowsShell): string => {
    if (shell.type === 'wsl') return `wsl:${shell.distro}`
    return shell.type
  }

  const currentShellKey = getShellKey(settings.windowsDefaultShell || { type: 'cmd' })

  return (
    <div className="space-y-6">
      {/* Existing sections... */}

      {/* Default Shell Section - Windows only, WSL available */}
      {showShellSettings && (
        <div>
          <SettingsSubheading>Default Shell</SettingsSubheading>
          <div className="space-y-3">
            <div>
              <span className="text-sm">Shell for New Terminals</span>
              <p className="text-xs text-[var(--mc-text-muted)]">
                Select the default shell when creating new terminals
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shellOptions.map((option) => {
                const optionKey = getShellKey(option.value)
                const isSelected = optionKey === currentShellKey

                return (
                  <button
                    key={optionKey}
                    onClick={() => setWindowsDefaultShell(option.value)}
                    className={`
                      px-4 py-2 rounded-lg border-2 text-sm
                      transition-all duration-150
                      ${isSelected
                        ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                        : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
                    `}
                  >
                    <span className="flex items-center gap-2">
                      {option.label}
                      {isSelected && <span className="text-[var(--mc-accent)]">✓</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Existing rendering mode section... */}
    </div>
  )
}
```

### 4.2 Platform Detection Helper (Optional)

If needed elsewhere, create utility:

**File**: `src/shared/utils/platform.ts` (CREATE)

```typescript
export const isWindows = typeof process !== 'undefined'
  ? process.platform === 'win32'
  : navigator.platform.toLowerCase().includes('win')

export const isMac = typeof process !== 'undefined'
  ? process.platform === 'darwin'
  : navigator.platform.toLowerCase().includes('mac')

export const isLinux = typeof process !== 'undefined'
  ? process.platform === 'linux'
  : navigator.platform.toLowerCase().includes('linux')
```

## UI Mockup

When WSL is available:

```
┌────────────────────────────────────────────────────────────────┐
│ Terminals                                                       │
│ Configure terminal behavior and limits                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ General                                                         │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Max Terminals per Project                                │   │
│ │ [2] [4] [9] [Custom]                                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Default Shell                           ← NEW SECTION           │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Shell for New Terminals                                  │   │
│ │ [Command Prompt] [PowerShell] [WSL: Ubuntu ✓]            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Rendering                                                       │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ [Performance] [Balanced ✓] [Quality]                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Shell section appears only on Windows with WSL
- [ ] All detected WSL distros listed
- [ ] Selection persists after app restart
- [ ] Visual feedback for selected option
- [ ] Section hidden on macOS/Linux
- [ ] Section hidden on Windows without WSL
