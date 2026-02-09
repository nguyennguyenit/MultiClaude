# Phase 5: Terminal Creation UI

**Effort**: 1.5h

## Objective

Add right-click context menu to "+ New" button for shell selection.

## Tasks

### 5.1 Create Shell Selector Dropdown Component

**File**: `src/renderer/components/terminal/shell-selector-dropdown.tsx` (CREATE)

```typescript
import { useRef, useEffect } from 'react'
import { useSettingsStore } from '../../stores'
import type { WindowsShell } from '@shared/types'

interface ShellSelectorDropdownProps {
  onSelect: (shell: WindowsShell) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

export function ShellSelectorDropdown({
  onSelect,
  onClose,
  anchorRef
}: ShellSelectorDropdownProps) {
  const { wslInfo, settings } = useSettingsStore()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, anchorRef])

  // Build options
  const options: { shell: WindowsShell; label: string; icon: string }[] = [
    { shell: { type: 'cmd' }, label: 'Command Prompt', icon: '>' },
    { shell: { type: 'powershell' }, label: 'PowerShell', icon: 'PS' }
  ]

  if (wslInfo?.distros) {
    wslInfo.distros.forEach((distro) => {
      options.push({
        shell: { type: 'wsl', distro: distro.name },
        label: distro.name,
        icon: '🐧'
      })
    })
  }

  // Mark default
  const getShellKey = (shell: WindowsShell): string =>
    shell.type === 'wsl' ? `wsl:${shell.distro}` : shell.type

  const defaultKey = getShellKey(settings.windowsDefaultShell || { type: 'cmd' })

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 py-1 min-w-[180px]
        bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)]
        rounded-lg shadow-lg z-50"
    >
      <div className="px-3 py-1.5 text-xs text-[var(--mc-text-muted)] border-b border-[var(--mc-border)]">
        Select Shell
      </div>
      {options.map((option) => {
        const key = getShellKey(option.shell)
        const isDefault = key === defaultKey

        return (
          <button
            key={key}
            onClick={() => {
              onSelect(option.shell)
              onClose()
            }}
            className="w-full px-3 py-2 text-left text-sm
              hover:bg-[var(--mc-bg-hover)] flex items-center gap-2"
          >
            <span className="w-5 text-center text-xs">{option.icon}</span>
            <span className="flex-1">{option.label}</span>
            {isDefault && (
              <span className="text-xs text-[var(--mc-text-muted)]">default</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

### 5.2 Update Terminal Action Bar

**File**: `src/renderer/components/terminal/terminal-action-bar.tsx` (MODIFY)

Add right-click dropdown to "+ New" button:

```typescript
import { useState, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../stores'
import { ShellSelectorDropdown } from './shell-selector-dropdown'
import type { WindowsShell } from '@shared/types'

interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  onAddTerminal: (shell?: WindowsShell) => void  // Updated signature
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  disabled?: boolean
}

export function TerminalActionBar({
  terminalCount,
  terminalLimit,
  yoloEnabled,
  onAddTerminal,
  onToggleYolo,
  onKillAll,
  disabled
}: TerminalActionBarProps) {
  const [showShellSelector, setShowShellSelector] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const { wslInfo, settings } = useSettingsStore()

  // Show shell selector only on Windows with WSL
  const canSelectShell = wslInfo?.available === true

  // Handle click - use default shell
  const handleAddClick = useCallback(() => {
    onAddTerminal(settings.windowsDefaultShell)
  }, [onAddTerminal, settings.windowsDefaultShell])

  // Handle right-click - show dropdown
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!canSelectShell) return
    e.preventDefault()
    setShowShellSelector(true)
  }, [canSelectShell])

  // Handle shell selection from dropdown
  const handleShellSelect = useCallback((shell: WindowsShell) => {
    onAddTerminal(shell)
    setShowShellSelector(false)
  }, [onAddTerminal])

  // ... existing hooks (showKillConfirm, etc.)

  return (
    <div className="h-10 px-4 flex items-center justify-between ...">
      {/* Left side unchanged */}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* New Terminal - with right-click support */}
        <div className="relative">
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAddClick}
            onContextMenu={handleContextMenu}
            disabled={disabled || terminalCount >= terminalLimit}
            className="px-3 py-1 text-xs rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50"
            title={canSelectShell ? 'Click: default shell, Right-click: select shell' : 'Add new terminal'}
          >
            + New
          </button>

          {showShellSelector && (
            <ShellSelectorDropdown
              onSelect={handleShellSelect}
              onClose={() => setShowShellSelector(false)}
              anchorRef={addButtonRef}
            />
          )}
        </div>

        {/* YOLO Toggle - unchanged */}
        {/* Kill All - unchanged */}
      </div>
    </div>
  )
}
```

### 5.3 Update Parent Component

**File**: `src/renderer/components/terminal/terminal-grid.tsx` or parent (MODIFY)

Update `onAddTerminal` prop to accept shell:

```typescript
const handleAddTerminal = useCallback(async (shell?: WindowsShell) => {
  const terminal = await window.electronAPI.createTerminal({
    cwd: projectPath,
    projectId,
    shell  // Pass shell to IPC
  })
  // ... handle result
}, [projectPath, projectId])
```

### 5.4 Export New Component

**File**: `src/renderer/components/terminal/index.ts` (MODIFY)

```typescript
export * from './shell-selector-dropdown'
```

## UI Behavior

| Action | Result |
|--------|--------|
| Click "+ New" | Creates terminal with default shell from Settings |
| Right-click "+ New" | Shows dropdown to select shell |
| Select from dropdown | Creates terminal with selected shell |
| Windows without WSL | No dropdown, uses cmd.exe |
| macOS/Linux | No dropdown, uses $SHELL |

## Acceptance Criteria

- [ ] Single-click uses Settings default
- [ ] Right-click shows dropdown (Windows + WSL only)
- [ ] Dropdown lists all shells and WSL distros
- [ ] Selection creates terminal with chosen shell
- [ ] Default shell marked in dropdown
- [ ] No dropdown on macOS/Linux
- [ ] No dropdown on Windows without WSL
