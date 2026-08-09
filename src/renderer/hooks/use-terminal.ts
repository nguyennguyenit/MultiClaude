/**
 * useTerminal — thin orchestrator that wires up 9 concern-based sub-hooks.
 *
 * Sub-hooks own their concerns; this file only:
 *   - Creates shared refs
 *   - Wires sub-hooks together (passes cross-hook callbacks)
 *   - Runs the unmount cleanup effect
 *   - Exposes the public API returned to the component
 */
import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import {
  claimTerminalOutputSession,
  resumeAndFlush as resumeTerminalOutput,
} from '../utils/terminal-output-dispatcher'
import { useTerminalWebGL } from './use-terminal-webgl'
import { useTerminalFontTheme } from './use-terminal-font-theme'
import { useTerminalKeyboard } from './use-terminal-keyboard'
import { useTerminalClipboard } from './use-terminal-clipboard'
import { useTerminalVisibility } from './use-terminal-visibility'
import { useTerminalInit } from './use-terminal-init'
import { useTerminalScrollback } from './use-terminal-scrollback'
import { useTerminalScroll } from './use-terminal-scroll'
import { useTerminalFit } from './use-terminal-fit'
import { useTerminalDebug } from './use-terminal-debug'
import type { ViewportEventListener } from './terminal-hook-types'
import type { TerminalSurface } from '../terminal/terminal-surface'

export const TERMINAL_DISPOSE_DELAY = 100  // Delay to allow xterm's internal setTimeout to complete

interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string
  initialViewportY?: number | null
  isActive?: boolean
  isHidden?: boolean
  onResize?: (cols: number, rows: number) => void
}

export function useTerminal({
  terminalId,
  initialOutput,
  initialViewportY = null,
  isActive = true,
  isHidden = false,
  onResize
}: UseTerminalOptions) {
  // ── Shared refs ────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const surfaceRef = useRef<TerminalSurface | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const disposedRef = useRef(false)
  const isActiveRef = useRef(isActive)
  const isHiddenRef = useRef(isHidden)
  const prevHiddenRef = useRef(isHidden)
  const scrollMachineRef = useRef(new TerminalScrollMachine())
  const userViewportInteractingRef = useRef(false)
  const scrollDisposableRef = useRef<IDisposable | null>(null)
  const viewportListenersRef = useRef<ViewportEventListener[] | null>(null)
  const webglToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshFnRef = useRef<((showNotification?: boolean) => void) | null>(null)
  const sessionTokenRef = useRef<symbol>(Symbol(`terminal-renderer:${terminalId}`))
  const sessionToken = sessionTokenRef.current

  // Claim output ownership before component-level registration and deferred
  // hydration effects. Same-ID renderer recreation receives a distinct token.
  useEffect(() => {
    claimTerminalOutputSession(terminalId, sessionToken)
  }, [sessionToken, terminalId])

  // ── Sub-hooks ──────────────────────────────────────────────────────────────
  const { registerTerminalDebugHandle, unregisterTerminalDebugHandle } =
    useTerminalDebug({ terminalRef, scrollMachineRef, isHiddenRef, terminalId })

  const { processKeyboardEnhancementOutput, shouldSendEnhancedEnter } =
    useTerminalKeyboard({ terminalRef, disposedRef, terminalId, onFollowOutput: () => followLiveOutput() })

  const {
    write, scrollToTop, scrollToBottom, followLiveOutput,
    syncViewportState, clearUserViewportInteraction, markUserViewportInteraction,
    isAtBottom, hasScrollback,
  } = useTerminalScroll({
    terminalRef, surfaceRef, disposedRef, isHiddenRef, scrollMachineRef,
    userViewportInteractingRef, processKeyboardEnhancementOutput,
  })

  const refreshVisibleRows = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current || t.rows <= 0) return
    try { t.refresh(0, t.rows - 1) } catch { /* ignore */ }
  }, [])

  // performFit is needed by WebGL hook (refresh) — forward-declare via ref
  const performFitRef = useRef<(restoreViewport?: boolean) => boolean>(() => false)
  const performFitFromRef = useCallback(
    (restoreViewport?: boolean) => performFitRef.current(restoreViewport),
    [],
  )
  const refreshFromRef = useCallback(
    (showNotification?: boolean) => refreshFnRef.current?.(showNotification),
    [],
  )

  const { reconcileWebGL, clearTextureAtlas, webglAddonRef, webglLoadingRef, reloadWebGLForTheme, refreshTerminal } =
    useTerminalWebGL({
      terminalRef, surfaceRef, disposedRef, terminalId, isActiveRef, isHiddenRef,
      sessionToken,
      onRefresh: refreshFromRef,
      onRefreshVisibleRows: refreshVisibleRows,
      performFit: performFitFromRef,
    })

  const { performFit, cancelScheduledFit, fit } = useTerminalFit({
    terminalRef, surfaceRef, fitAddonRef, containerRef, disposedRef, scrollMachineRef, refreshVisibleRows,
  })
  // Wire the ref so WebGL hook can call performFit
  performFitRef.current = performFit

  const { syncFontAfterLoad } = useTerminalFontTheme({
    terminalRef, disposedRef, terminalId,
    onApplyFontMetrics: () => {
      if (disposedRef.current || !terminalRef.current || !fitAddonRef.current) return
      clearTextureAtlas()
      performFit()
      window.electron.terminal.resize(terminalId, terminalRef.current.cols, terminalRef.current.rows)
    },
    onWebGLReload: reloadWebGLForTheme,
  })

  const { attachClipboardListeners, getCtrlVHandler, followLiveOutputRef } =
    useTerminalClipboard({ terminalId, surfaceRef })
  useEffect(() => { followLiveOutputRef.current = followLiveOutput }, [followLiveOutput, followLiveOutputRef])

  useTerminalVisibility({
    terminalRef, disposedRef, isActive, isHidden, prevHiddenRef, isActiveRef,
    webglLoadingRef, scrollMachineRef, performFit, reconcileWebGL, clearTextureAtlas,
  })

  useTerminalScrollback({ terminalRef, disposedRef })

  const { initTerminal } = useTerminalInit({
    terminalRef, surfaceRef, fitAddonRef, disposedRef, containerRef, terminalId,
    sessionToken,
    initialOutput, initialViewportY, isActiveRef, isHiddenRef, scrollMachineRef,
    userViewportInteractingRef, viewportListenersRef, scrollDisposableRef,
    syncViewportState, clearUserViewportInteraction, markUserViewportInteraction,
    shouldSendEnhancedEnter, attachClipboardListeners, getCtrlVHandler,
    followLiveOutput, reconcileWebGL, syncFontAfterLoad, registerTerminalDebugHandle,
    onResize,
  })

  // ── isActive / isHidden prop sync + debounced WebGL toggle ────────────────
  useEffect(() => {
    isActiveRef.current = isActive
    isHiddenRef.current = isHidden
    if (!terminalRef.current || disposedRef.current) return
    if (webglToggleTimerRef.current) clearTimeout(webglToggleTimerRef.current)
    webglToggleTimerRef.current = setTimeout(reconcileWebGL, 50)
    return () => { if (webglToggleTimerRef.current) clearTimeout(webglToggleTimerRef.current) }
  }, [isActive, isHidden, reconcileWebGL])

  // Keep refresh ref in sync so WebGL context-loss handler calls the latest refresh
  const refresh = refreshTerminal
  useEffect(() => { refreshFnRef.current = refresh }, [refresh])

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    disposedRef.current = false
    const scrollMachine = scrollMachineRef.current
    const paneTerminalId = terminalId
    return () => {
      disposedRef.current = true
      // Drain any pause state set by initTerminal in case unmount races ahead
      // of snapshot-apply (prevents stuck pausedBuffer entry).
      resumeTerminalOutput(paneTerminalId, sessionToken)
      scrollMachine.reset()
      clearUserViewportInteraction()
      cancelScheduledFit()

      const terminal = terminalRef.current
      const surface = surfaceRef.current
      const fitAddon = fitAddonRef.current
      const webglAddon = webglAddonRef.current
      const scrollDisposable = scrollDisposableRef.current
      const viewportListeners = viewportListenersRef.current

      terminalRef.current = null; surfaceRef.current = null; fitAddonRef.current = null; webglAddonRef.current = null
      scrollDisposableRef.current = null; viewportListenersRef.current = null
      unregisterTerminalDebugHandle()

      for (const l of viewportListeners ?? []) {
        l.target.removeEventListener(l.type, l.handler, l.capture)
      }

      setTimeout(() => {
        try {
          scrollDisposable?.dispose()
          webglAddon?.dispose(); fitAddon?.dispose()
          if (surface) surface.dispose()
          else terminal?.dispose()
        } catch { /* may already be disposed */ }
      }, TERMINAL_DISPOSE_DELAY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref objects are stable; listed for clarity
  }, [cancelScheduledFit, clearUserViewportInteraction, sessionToken, unregisterTerminalDebugHandle])

  // ── Public API ─────────────────────────────────────────────────────────────
  // Focus the hidden helper textarea directly with preventScroll so the browser
  // does not auto-scroll the viewport to the cursor when user focused the pane
  // while scrolled up (e.g. mid text-selection for copy). Fall back to
  // terminal.focus() if textarea is not yet attached (pre-mount edge case).
  const focus = useCallback(() => {
    const t = terminalRef.current
    if (!t) return
    if (t.textarea) t.textarea.focus({ preventScroll: true })
    else surfaceRef.current?.focus()
  }, [])
  const blur = useCallback(() => { terminalRef.current?.blur() }, [])
  const showCursor = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current) return
    if (t.textarea) t.textarea.focus({ preventScroll: true })
    else t.focus()
  }, [])
  const restoreActiveRender = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current) return
    clearTextureAtlas()
    if (!performFit(false)) refreshVisibleRows()
  }, [clearTextureAtlas, performFit, refreshVisibleRows])
  const clear = useCallback(() => { terminalRef.current?.clear() }, [])
  const getViewportSnapshot = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current) return { viewportY: null, isAtBottom: true }
    return { viewportY: t.buffer.active.viewportY, isAtBottom: scrollMachineRef.current.isAtBottom }
  }, [])

  return {
    containerRef, initTerminal, write, fit, focus, blur, showCursor, restoreActiveRender, clear,
    scrollToTop, scrollToBottom, isAtBottom, hasScrollback,
    refresh, getViewportSnapshot, terminalRef, sessionToken
  }
}
