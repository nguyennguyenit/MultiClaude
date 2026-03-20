export interface ShortcutEventLike {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  key: string
  code?: string
}

export type GlobalShortcut =
  | { type: 'switch-project'; index: number }
  | { type: 'new-terminal' }
  | { type: 'close-terminal' }
  | { type: 'toggle-github-panel' }

function getDigitFromEvent(event: ShortcutEventLike): number | null {
  if (event.code && /^Digit[1-9]$/.test(event.code)) {
    return Number(event.code.slice(-1))
  }

  if (event.key >= '1' && event.key <= '9') {
    return Number(event.key)
  }

  return null
}

export function getGlobalShortcut(event: ShortcutEventLike): GlobalShortcut | null {
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const digit = getDigitFromEvent(event)
    if (digit !== null) {
      return { type: 'switch-project', index: digit - 1 }
    }
  }

  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const normalizedKey = event.key.toLowerCase()
    switch (event.code) {
      case 'KeyN':
        return { type: 'new-terminal' }
      case 'KeyT':
        return { type: 'new-terminal' }
      case 'KeyW':
        return { type: 'close-terminal' }
      case 'KeyG':
        return { type: 'toggle-github-panel' }
    }

    switch (normalizedKey) {
      case 'n':
      case 't':
        return { type: 'new-terminal' }
      case 'w':
        return { type: 'close-terminal' }
      case 'g':
        return { type: 'toggle-github-panel' }
    }
  }

  return null
}

export function shouldBypassXtermShortcut(event: ShortcutEventLike): boolean {
  return getGlobalShortcut(event) !== null
}
