import { useRef, type ReactElement } from 'react'
import { useContextMenuStore, type ContextMenuItem } from '../../stores/context-menu-store'
import type { PaneSplitDirection } from '@shared/types'

interface SplitButtonProps {
  atLimit: boolean
  splitDisabled: boolean
  terminalLimit: number
  onAddTerminal: () => void
  onSplit: (direction: PaneSplitDirection) => void
}

export function SplitButton({
  atLimit,
  splitDisabled,
  terminalLimit,
  onAddTerminal,
  onSplit
}: SplitButtonProps): ReactElement {
  const arrowRef = useRef<HTMLButtonElement>(null)

  const openSplitDropdown = (): void => {
    const rect = arrowRef.current?.getBoundingClientRect()
    if (!rect) return
    const items: ContextMenuItem[] = [
      { id: 'split-right', label: 'Split right', shortcut: '⌘⇧→', onSelect: () => onSplit('right') },
      { id: 'split-left', label: 'Split left', shortcut: '⌘⇧←', onSelect: () => onSplit('left') },
      { id: 'split-down', label: 'Split down', shortcut: '⌘⇧↓', onSelect: () => onSplit('down') },
      { id: 'split-up', label: 'Split up', shortcut: '⌘⇧↑', onSelect: () => onSplit('up') }
    ]
    useContextMenuStore.getState().openMenu({ x: rect.left, y: rect.bottom + 4, items })
  }

  return (
    <div className="split-button" data-disabled={atLimit || undefined}>
      <button
        type="button"
        className="action-bar-btn split-button-main"
        title={atLimit ? `Terminal limit (${terminalLimit}) reached` : 'New Terminal (Ctrl+T)'}
        aria-label="New Terminal"
        onClick={onAddTerminal}
        disabled={atLimit}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </button>
      <div className="split-button-divider" aria-hidden="true" />
      <button
        ref={arrowRef}
        type="button"
        className="action-bar-btn split-button-arrow"
        title={atLimit ? `Terminal limit (${terminalLimit}) reached` : 'Split terminal…'}
        aria-label="Split terminal options"
        aria-haspopup="menu"
        onClick={openSplitDropdown}
        disabled={splitDisabled}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
