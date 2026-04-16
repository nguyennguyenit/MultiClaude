import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useContextMenuStore, type ContextMenuItem } from '../../stores/context-menu-store'
import './themed-context-menu.css'

const MENU_DEFAULT_WIDTH = 180

function clampPosition(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const viewportW = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportH = typeof window === 'undefined' ? 0 : window.innerHeight
  const clampedX = Math.max(0, Math.min(x, Math.max(0, viewportW - width)))
  const clampedY = Math.max(0, Math.min(y, Math.max(0, viewportH - height)))
  return { x: clampedX, y: clampedY }
}

function firstSelectableIndex(items: ContextMenuItem[]): number {
  return items.findIndex((it) => !it.separator && !it.disabled)
}

function nextSelectableIndex(items: ContextMenuItem[], from: number, step: 1 | -1): number {
  const n = items.length
  if (n === 0) return -1
  let i = from
  for (let guard = 0; guard < n; guard++) {
    i = (i + step + n) % n
    if (!items[i].separator && !items[i].disabled) return i
  }
  return from
}

export function ThemedContextMenu(): ReactElement | null {
  const open = useContextMenuStore((s) => s.open)
  const x = useContextMenuStore((s) => s.x)
  const y = useContextMenuStore((s) => s.y)
  const items = useContextMenuStore((s) => s.items)
  const closeMenu = useContextMenuStore((s) => s.closeMenu)

  const [focusIndex, setFocusIndex] = useState<number>(-1)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement | null>(null)
  const focusIndexRef = useRef<number>(-1)

  useEffect(() => {
    focusIndexRef.current = focusIndex
  }, [focusIndex])

  useEffect(() => {
    if (open) {
      const idx = firstSelectableIndex(items)
      setFocusIndex(idx)
      focusIndexRef.current = idx
    }
  }, [open, items])

  useLayoutEffect(() => {
    if (!open) return
    const rect = menuRef.current?.getBoundingClientRect()
    const w = rect?.width || MENU_DEFAULT_WIDTH
    const h = rect?.height || items.length * 30
    setPosition(clampPosition(x, y, w, h))
  }, [open, x, y, items])

  useEffect(() => {
    if (!open) return

    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      closeMenu()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = nextSelectableIndex(items, focusIndexRef.current, 1)
        focusIndexRef.current = next
        setFocusIndex(next)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = nextSelectableIndex(items, focusIndexRef.current === -1 ? 0 : focusIndexRef.current, -1)
        focusIndexRef.current = prev
        setFocusIndex(prev)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const target = items[focusIndexRef.current]
        if (target && !target.disabled && !target.separator) {
          target.onSelect?.()
          closeMenu()
        }
      }
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, items, closeMenu])

  const rendered = useMemo(() => {
    return items.map((item, index) => {
      if (item.separator) {
        return <hr key={item.id} className="themed-context-menu-separator" role="separator" />
      }
      const focused = index === focusIndex
      return (
        <button
          type="button"
          key={item.id}
          className="themed-context-menu-item"
          role="menuitem"
          data-focused={focused || undefined}
          data-disabled={item.disabled || undefined}
          aria-disabled={item.disabled || undefined}
          aria-keyshortcuts={item.shortcut}
          title={item.title}
          disabled={item.disabled}
          onMouseEnter={() => setFocusIndex(index)}
          onClick={() => {
            if (item.disabled) return
            item.onSelect?.()
            closeMenu()
          }}
        >
          <span>{item.label}</span>
          {item.shortcut ? <span className="themed-context-menu-shortcut">{item.shortcut}</span> : null}
        </button>
      )
    })
  }, [items, focusIndex, closeMenu])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={menuRef}
      className="themed-context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {rendered}
    </div>,
    document.body
  )
}
