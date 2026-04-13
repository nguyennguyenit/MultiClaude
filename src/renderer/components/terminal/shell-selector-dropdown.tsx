import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ShellInfo } from '@shared/types'

interface ShellSelectorDropdownProps {
  shells: ShellInfo[]
  selectedShell: ShellInfo | null
  anchorRef: RefObject<HTMLElement | null>
  onSelect: (shell: ShellInfo | null) => void
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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (dropdownRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, onClose])

  return (
    <div ref={dropdownRef} className="shell-dropdown" role="listbox" aria-label="Available shells">
      <div className="shell-dropdown-header">Available shells</div>
      {shells.map((shell) => {
        const isSelected = selectedShell?.path === shell.path
        const badge = shell.isDefault ? 'default' : shell.kind

        return (
          <button
            key={shell.path}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`shell-dropdown-item${isSelected ? ' selected' : ''}`}
            onClick={() => onSelect(shell)}
          >
            <span className="shell-dropdown-check" aria-hidden="true">
              {isSelected ? '✓' : ''}
            </span>
            <span className="shell-dropdown-name">{shell.name}</span>
            <span className="shell-dropdown-badge">{badge}</span>
          </button>
        )
      })}
    </div>
  )
}
