import { useRef, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../stores'
import { getShellKey } from '../../utils'
import type { WindowsShell } from '@shared/types'

interface ShellSelectorDropdownProps {
  onSelect: (shell: WindowsShell) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Build shell options
  const options = useMemo(() => {
    const opts: { shell: WindowsShell; label: string; icon: string }[] = [
      { shell: { type: 'cmd' }, label: 'Command Prompt', icon: '>' },
      { shell: { type: 'powershell' }, label: 'PowerShell', icon: 'PS' }
    ]

    if (wslInfo?.distros) {
      wslInfo.distros.forEach((distro) => {
        opts.push({
          shell: { type: 'wsl', distro: distro.name },
          label: distro.name,
          icon: 'L' // Linux icon placeholder
        })
      })
    }

    return opts
  }, [wslInfo])

  const defaultKey = getShellKey(settings.windowsShell || { type: 'cmd' })

  return (
    <div
      ref={dropdownRef}
      role="menu"
      aria-label="Shell selection menu"
      className="absolute right-0 top-full mt-1 py-1 min-w-[180px]
        bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)]
        rounded-lg shadow-lg z-50"
    >
      <div
        id="shell-selector-label"
        className="px-3 py-1.5 text-xs text-[var(--mc-text-muted)] border-b border-[var(--mc-border)]"
      >
        Select Shell
      </div>
      {options.map((option) => {
        const key = getShellKey(option.shell)
        const isDefault = key === defaultKey

        return (
          <button
            key={key}
            role="menuitem"
            aria-label={`${option.label}${isDefault ? ' (default)' : ''}`}
            onClick={() => {
              onSelect(option.shell)
              onClose()
            }}
            className="w-full px-3 py-2 text-left text-sm
              hover:bg-[var(--mc-bg-hover)] flex items-center gap-2"
          >
            <span className="w-5 text-center text-xs font-mono text-[var(--mc-text-muted)]" aria-hidden="true">
              {option.icon}
            </span>
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
