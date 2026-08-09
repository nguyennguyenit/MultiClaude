/**
 * useTerminalScroll — manages write, scroll position, and viewport state.
 *
 * Responsibilities:
 *   - write(): strip keyboard-enhancement responses, manage pending write count,
 *     restore scroll position after each write batch
 *   - followLiveOutput(): anchor scroll to live output on next write
 *   - scrollToTop() / scrollToBottom(): explicit scroll commands from UI
 *   - syncViewportState(): update isAtBottom / hasScrollback reactive state
 *   - clearUserViewportInteraction() / markUserViewportInteraction()
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useState, useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import type { UserScrollIntent } from '../utils/terminal-scroll-utils'
import type { TerminalSurface } from '../terminal/terminal-surface'
import { SynchronizedOutputFilter } from '../utils/synchronized-output-filter'
import {
  createUserScrollIntent,
  isViewportNearBottom,
  resolveViewportRestoreTarget,
  TERMINAL_SCROLL_THRESHOLD,
  withInstantTerminalScroll,
} from '../utils/terminal-scroll-utils'

const USER_SCROLL_WHEEL_GRACE = 180   // ms wheel-scroll intent grace period
const USER_SCROLL_DRAG_GRACE = 1200  // ms scrollbar-drag intent grace period

interface UseTerminalScrollParams {
  terminalRef: RefObject<XTerm | null>
  surfaceRef: RefObject<TerminalSurface | null>
  disposedRef: RefObject<boolean>
  isHiddenRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  userViewportInteractingRef: RefObject<boolean>
  processKeyboardEnhancementOutput: (data: string) => string
}

interface UseTerminalScrollResult {
  write: (data: string) => string
  scrollToTop: () => void
  scrollToBottom: () => void
  followLiveOutput: () => void
  syncViewportState: (buffer: XTerm['buffer']['active'], intent?: UserScrollIntent | null) => void
  clearUserViewportInteraction: () => void
  markUserViewportInteraction: (durationMs: number, direction?: 'up' | 'down') => void
  isAtBottom: boolean
  hasScrollback: boolean
}

export function useTerminalScroll(params: UseTerminalScrollParams): UseTerminalScrollResult {
  const {
    terminalRef,
    surfaceRef,
    disposedRef,
    isHiddenRef,
    scrollMachineRef,
    userViewportInteractingRef,
    processKeyboardEnhancementOutput,
  } = params

  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasScrollback, setHasScrollback] = useState(false)
  const userViewportInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const synchronizedOutputFilterRef = useRef(new SynchronizedOutputFilter())

  const syncViewportState = useCallback((
    buffer: XTerm['buffer']['active'],
    hiddenViewportIntent: UserScrollIntent | null = null
  ) => {
    const atBottom = hiddenViewportIntent
      ? hiddenViewportIntent.stickToBottom
      : isViewportNearBottom(buffer.baseY, buffer.viewportY, TERMINAL_SCROLL_THRESHOLD)

    scrollMachineRef.current.isAtBottom = atBottom
    setIsAtBottom(atBottom)
    setHasScrollback(buffer.baseY > 0)

    if (hiddenViewportIntent) {
      scrollMachineRef.current.savedViewportY = hiddenViewportIntent.stickToBottom
        ? buffer.baseY
        : hiddenViewportIntent.viewportY
      return
    }

    scrollMachineRef.current.savedViewportY = buffer.viewportY
  }, [scrollMachineRef])

  const clearUserViewportInteraction = useCallback(() => {
    if (userViewportInteractionTimerRef.current) {
      clearTimeout(userViewportInteractionTimerRef.current)
      userViewportInteractionTimerRef.current = null
    }
    userViewportInteractingRef.current = false
    scrollMachineRef.current.userScrollDirection = null
  }, [scrollMachineRef, userViewportInteractingRef])

  const markUserViewportInteraction = useCallback((durationMs: number, direction?: 'up' | 'down') => {
    userViewportInteractingRef.current = true
    scrollMachineRef.current.userScrollDirection = direction ?? null

    if (userViewportInteractionTimerRef.current) {
      clearTimeout(userViewportInteractionTimerRef.current)
    }

    userViewportInteractionTimerRef.current = setTimeout(() => {
      userViewportInteractionTimerRef.current = null
      userViewportInteractingRef.current = false
      scrollMachineRef.current.userScrollDirection = null
    }, durationMs)
  }, [scrollMachineRef, userViewportInteractingRef])

  const followLiveOutput = useCallback(() => {
    scrollMachineRef.current.followOutputOnNextWrite = true
    scrollMachineRef.current.pendingUserScrollIntent = null
    scrollMachineRef.current.readingViewportIntent = null
    clearUserViewportInteraction()

    const terminal = terminalRef.current
    if (!terminal || disposedRef.current) return

    withInstantTerminalScroll(terminal, () => terminal.scrollToBottom())

    const buffer = terminal.buffer.active
    scrollMachineRef.current.isAtBottom = true
    setIsAtBottom(true)
    setHasScrollback(buffer.baseY > 0)
    scrollMachineRef.current.savedViewportY = buffer.viewportY
  }, [clearUserViewportInteraction, disposedRef, scrollMachineRef, terminalRef])

  const write = useCallback((data: string) => {
    const terminal = terminalRef.current
    if (!terminal) return ''

    const filteredData = synchronizedOutputFilterRef.current.process(data)
    const visibleData = processKeyboardEnhancementOutput(filteredData)
    if (!visibleData) return ''

    const scrollMachine = scrollMachineRef.current

    // Capture pre-write scroll state on the first concurrent write
    if (scrollMachine.pendingWriteCount === 0) {
      const buffer = terminal.buffer.active
      const readingIntent = scrollMachine.readingViewportIntent
      scrollMachine.pendingWriteSnapshot = {
        wasAtBottom: readingIntent
          ? readingIntent.stickToBottom
          : isViewportNearBottom(buffer.baseY, buffer.viewportY, TERMINAL_SCROLL_THRESHOLD),
        savedViewportY: readingIntent?.stickToBottom === false && readingIntent.viewportY !== null
          ? readingIntent.viewportY
          : buffer.viewportY
      }
    }

    scrollMachine.pendingWriteCount += 1

    const afterWrite = () => {
      scrollMachine.pendingWriteCount = Math.max(0, scrollMachine.pendingWriteCount - 1)
      const term = terminalRef.current
      if (!term) return

      const hiddenViewportIntent = isHiddenRef.current ? scrollMachine.hiddenViewportIntent : null

      if (scrollMachine.pendingWriteCount > 0) {
        // More writes in flight — apply hidden intent if present, then exit
        if (hiddenViewportIntent?.stickToBottom) {
          withInstantTerminalScroll(term, () => term.scrollToBottom())
        } else if (hiddenViewportIntent?.viewportY !== null && hiddenViewportIntent?.viewportY !== undefined) {
          const targetViewportY = hiddenViewportIntent.viewportY
          withInstantTerminalScroll(term, () => term.scrollToLine(targetViewportY))
        }
        syncViewportState(term.buffer.active, hiddenViewportIntent)
        return
      }

      const pendingWriteSnapshot = scrollMachine.pendingWriteSnapshot
      scrollMachine.pendingWriteSnapshot = null

      const restoreTarget = resolveViewportRestoreTarget({
        forceStickToBottom: scrollMachine.followOutputOnNextWrite,
        wasAtBottom: pendingWriteSnapshot?.wasAtBottom ?? true,
        savedViewportY: pendingWriteSnapshot?.savedViewportY ?? term.buffer.active.viewportY,
        currentBaseY: term.buffer.active.baseY,
        pendingUserScrollIntent: isHiddenRef.current
          ? scrollMachine.hiddenViewportIntent
          : scrollMachine.pendingUserScrollIntent ?? scrollMachine.readingViewportIntent
      })
      scrollMachine.followOutputOnNextWrite = false
      scrollMachine.pendingUserScrollIntent = null

      if (restoreTarget === 'bottom') {
        withInstantTerminalScroll(term, () => term.scrollToBottom())
      } else if (typeof restoreTarget === 'number' && restoreTarget >= 0) {
        withInstantTerminalScroll(term, () => term.scrollToLine(restoreTarget))
      }

      const buffer = term.buffer.active
      syncViewportState(buffer, isHiddenRef.current ? scrollMachine.hiddenViewportIntent : null)
    }
    if (surfaceRef.current) void surfaceRef.current.write(visibleData).then(afterWrite)
    else terminal.write(visibleData, afterWrite)

    return visibleData
  // eslint-disable-next-line react-hooks/exhaustive-deps -- disposedRef is a stable ref object
  }, [disposedRef, isHiddenRef, processKeyboardEnhancementOutput, scrollMachineRef, surfaceRef, syncViewportState, terminalRef])

  const scrollToTop = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    withInstantTerminalScroll(terminal, () => terminal.scrollToLine(0))
    const scrollMachine = scrollMachineRef.current
    scrollMachine.hiddenViewportIntent = createUserScrollIntent(
      terminal.buffer.active.baseY,
      terminal.buffer.active.viewportY,
      TERMINAL_SCROLL_THRESHOLD
    )
    scrollMachine.pendingUserScrollIntent = scrollMachine.hiddenViewportIntent
    scrollMachine.readingViewportIntent = scrollMachine.hiddenViewportIntent
    syncViewportState(terminal.buffer.active, isHiddenRef.current ? scrollMachine.hiddenViewportIntent : null)
  }, [isHiddenRef, scrollMachineRef, syncViewportState, terminalRef])

  const scrollToBottom = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    withInstantTerminalScroll(terminal, () => terminal.scrollToBottom())
    const scrollMachine = scrollMachineRef.current
    scrollMachine.hiddenViewportIntent = createUserScrollIntent(
      terminal.buffer.active.baseY,
      terminal.buffer.active.viewportY,
      TERMINAL_SCROLL_THRESHOLD
    )
    scrollMachine.pendingUserScrollIntent = scrollMachine.hiddenViewportIntent
    scrollMachine.readingViewportIntent = scrollMachine.hiddenViewportIntent
    syncViewportState(terminal.buffer.active, isHiddenRef.current ? scrollMachine.hiddenViewportIntent : null)
  }, [isHiddenRef, scrollMachineRef, syncViewportState, terminalRef])

  return {
    write,
    scrollToTop,
    scrollToBottom,
    followLiveOutput,
    syncViewportState,
    clearUserViewportInteraction,
    markUserViewportInteraction,
    isAtBottom,
    hasScrollback,
  }
}

// Expose USER_SCROLL_WHEEL_GRACE and USER_SCROLL_DRAG_GRACE for initTerminal
export { USER_SCROLL_WHEEL_GRACE, USER_SCROLL_DRAG_GRACE }
