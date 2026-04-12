import { useRef, useEffect } from 'react'
import type { ShellInfo } from '@shared/types'

interface ShellSelectorDropdownProps {
  shells: ShellInfo[]
  selectedShell: ShellInfo | null
  anchorRef: React.RefObject<HTMLElement | null>
  onSelect: (shell: ShellInfo) => void
  onClose: () => void
}

export function ShellSelectorDropdown({
  shells,
  selectedShell,
  anchorRef,
  onSelect,
  onClose
}: ShellSelectorDropdownProps) {
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

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="Select shell"
      className="shell-dropdown"
    >
      <div className="shell-dropdown-header">
        Select Shell
      </div>
      {shells.map((shell) => {
        const isSelected = selectedShell?.path === shell.path

        return (
          <button
            key={shell.path}
            role="option"
            aria-selected={isSelected}
            aria-label={`${shell.name}${shell.isDefault ? ' (default)' : ''}`}
            onClick={() => onSelect(shell)}
            className={`shell-dropdown-item${isSelected ? ' selected' : ''}`}
          >
            <span className="shell-dropdown-check" aria-hidden="true">
              {isSelected ? '●' : ' '}
            </span>
            <span className="shell-dropdown-name">{shell.name}</span>
            {shell.isDefault && (
              <span className="shell-dropdown-badge">default</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
