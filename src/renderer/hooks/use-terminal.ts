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
import { unregisterDisplayWriter } from '../stores/display-writer-registry'
import type { ViewportEventListener } from './terminal-hook-types'

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

  // ── Sub-hooks ──────────────────────────────────────────────────────────────
  const { registerTerminalDebugHandle, unregisterTerminalDebugHandle } =
    useTerminalDebug({ terminalRef, scrollMachineRef, isHiddenRef, terminalId })

  const { processKeyboardEnhancementOutput, shouldSendEnhancedEnter } =
    useTerminalKeyboard({ terminalRef, disposedRef, terminalId, onFollowOutput: () => followLiveOutput() })

  const {
    write, scrollToTop, scrollToBottom, followLiveOutput,
    syncViewportState, clearUserViewportInteraction, markUserViewportInteraction,
    onWriteParsed, isAtBottom, hasScrollback,
  } = useTerminalScroll({
    terminalRef, disposedRef, isHiddenRef, scrollMachineRef,
    userViewportInteractingRef, processKeyboardEnhancementOutput,
  })

  const refreshVisibleRows = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current || t.rows <= 0) return
    try { t.refresh(0, t.rows - 1) } catch { /* ignore */ }
  }, [])

  // performFit is needed by WebGL hook (refresh) — forward-declare via ref
  const performFitRef = useRef<(restoreViewport?: boolean) => boolean>(() => false)

  const { reconcileWebGL, clearTextureAtlas, webglAddonRef, webglLoadingRef, reloadWebGLForTheme, refreshTerminal } =
    useTerminalWebGL({
      terminalRef, disposedRef, terminalId, isActiveRef, isHiddenRef,
      onRefresh: (n) => refreshFnRef.current?.(n),
      onRefreshVisibleRows: refreshVisibleRows,
      performFit: (r) => performFitRef.current(r),
    })

  const { performFit, cancelScheduledFit, fit } = useTerminalFit({
    terminalRef, fitAddonRef, containerRef, disposedRef, scrollMachineRef, refreshVisibleRows,
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
    useTerminalClipboard({ terminalId })
  useEffect(() => { followLiveOutputRef.current = followLiveOutput }, [followLiveOutput, followLiveOutputRef])

  useTerminalVisibility({
    terminalRef, disposedRef, isActive, isHidden, prevHiddenRef, isActiveRef,
    webglLoadingRef, scrollMachineRef, performFit, reconcileWebGL, clearTextureAtlas,
  })

  useTerminalScrollback({ terminalRef, disposedRef })

  const { initTerminal } = useTerminalInit({
    terminalRef, fitAddonRef, disposedRef, containerRef, terminalId,
    initialOutput, initialViewportY, isActiveRef, isHiddenRef, scrollMachineRef,
    userViewportInteractingRef, viewportListenersRef, scrollDisposableRef,
    syncViewportState, clearUserViewportInteraction, markUserViewportInteraction,
    shouldSendEnhancedEnter, attachClipboardListeners, getCtrlVHandler,
    followLiveOutput, reconcileWebGL, syncFontAfterLoad, registerTerminalDebugHandle,
    onWriteParsed, onResize,
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
    return () => {
      disposedRef.current = true
      scrollMachine.reset()
      clearUserViewportInteraction()
      cancelScheduledFit()

      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      const webglAddon = webglAddonRef.current
      const scrollDisposable = scrollDisposableRef.current
      const viewportListeners = viewportListenersRef.current

      terminalRef.current = null; fitAddonRef.current = null; webglAddonRef.current = null
      scrollDisposableRef.current = null; viewportListenersRef.current = null
      unregisterTerminalDebugHandle()
      unregisterDisplayWriter(terminalId)

      for (const l of viewportListeners ?? []) l.target.removeEventListener(l.type, l.handler)

      setTimeout(() => {
        try {
          scrollDisposable?.dispose()
          webglAddon?.dispose(); fitAddon?.dispose(); terminal?.dispose()
        } catch { /* may already be disposed */ }
      }, TERMINAL_DISPOSE_DELAY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref objects are stable; listed for clarity
  }, [cancelScheduledFit, clearUserViewportInteraction, unregisterTerminalDebugHandle])

  // ── Public API ─────────────────────────────────────────────────────────────
  const focus = useCallback(() => { terminalRef.current?.focus() }, [])
  const blur = useCallback(() => { terminalRef.current?.blur() }, [])
  const showCursor = useCallback(() => {
    if (!terminalRef.current || disposedRef.current) return
    terminalRef.current.focus()
  }, [])
  const clear = useCallback(() => { terminalRef.current?.clear() }, [])
  const getViewportSnapshot = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current) return { viewportY: null, isAtBottom: true }
    return { viewportY: t.buffer.active.viewportY, isAtBottom: scrollMachineRef.current.isAtBottom }
  }, [])

  return {
    containerRef, initTerminal, write, fit, focus, blur, showCursor, clear,
    scrollToTop, scrollToBottom, isAtBottom, hasScrollback,
    refresh, getViewportSnapshot, terminalRef
  }
}
