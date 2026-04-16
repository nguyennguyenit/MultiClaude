/**
 * useTerminalDebug — registers / unregisters window.__TERMINAL_DEBUG__ snapshot handle.
 *
 * Provides read-only scroll state snapshots for debugging via browser console:
 *   window.__TERMINAL_DEBUG__['term-id'].getSnapshot()
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import type { UserScrollIntent } from '../utils/terminal-scroll-utils'

interface TerminalDebugSnapshot {
  baseY: number
  viewportY: number
  savedViewportY: number | null
  isHidden: boolean
  pendingWriteCount: number
  isAtBottom: boolean
  hiddenViewportIntent: UserScrollIntent | null
  pendingUserScrollIntent: UserScrollIntent | null
  domScrollTop: number | null
  domScrollHeight: number | null
  domClientHeight: number | null
}

interface UseTerminalDebugParams {
  terminalRef: RefObject<XTerm | null>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  isHiddenRef: RefObject<boolean>
  terminalId: string
}

interface UseTerminalDebugResult {
  registerTerminalDebugHandle: () => void
  unregisterTerminalDebugHandle: () => void
}

type DebugWindow = typeof window & {
  __TERMINAL_DEBUG__?: Record<string, { getSnapshot: () => TerminalDebugSnapshot | null }>
}

export function useTerminalDebug(params: UseTerminalDebugParams): UseTerminalDebugResult {
  const { terminalRef, scrollMachineRef, isHiddenRef, terminalId } = params

  const registerTerminalDebugHandle = useCallback(() => {
    if (typeof window === 'undefined') return
    const w = window as DebugWindow
    w.__TERMINAL_DEBUG__ ??= {}
    w.__TERMINAL_DEBUG__[terminalId] = {
      getSnapshot: () => {
        const terminal = terminalRef.current
        if (!terminal) return null
        const buffer = terminal.buffer.active
        const viewport = terminal.element?.querySelector('.xterm-viewport') as HTMLElement | null
        return {
          baseY: buffer.baseY,
          viewportY: buffer.viewportY,
          savedViewportY: scrollMachineRef.current.savedViewportY,
          isHidden: isHiddenRef.current,
          pendingWriteCount: scrollMachineRef.current.pendingWriteCount,
          isAtBottom: scrollMachineRef.current.isAtBottom,
          hiddenViewportIntent: scrollMachineRef.current.hiddenViewportIntent,
          pendingUserScrollIntent: scrollMachineRef.current.pendingUserScrollIntent,
          domScrollTop: viewport?.scrollTop ?? null,
          domScrollHeight: viewport?.scrollHeight ?? null,
          domClientHeight: viewport?.clientHeight ?? null
        }
      }
    }
  }, [isHiddenRef, scrollMachineRef, terminalId, terminalRef])

  const unregisterTerminalDebugHandle = useCallback(() => {
    if (typeof window === 'undefined') return
    const w = window as DebugWindow
    if (!w.__TERMINAL_DEBUG__) return
    delete w.__TERMINAL_DEBUG__[terminalId]
    if (Object.keys(w.__TERMINAL_DEBUG__).length === 0) delete w.__TERMINAL_DEBUG__
  }, [terminalId])

  return { registerTerminalDebugHandle, unregisterTerminalDebugHandle }
}
