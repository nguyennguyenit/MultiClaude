/**
 * useTerminalWebGL — manages WebGL renderer lifecycle for a single xterm terminal.
 *
 * Responsibilities:
 *   - Load / unload WebglAddon based on shouldUseWebGL() result
 *   - Attach context-loss listener (calls onRefresh on GPU context loss)
 *   - Expose clearTextureAtlas() helper for other hooks
 *   - Subscribe to render-mode + Claude-mode store changes (three useEffects)
 *   - Expose reloadWebGLForTheme() — dispose + reload WebGL after theme change
 *   - Expose refreshTerminal() — full display refresh with debounce
 *
 * Sub-hooks must NOT import from each other.  All orchestration lives in use-terminal.ts.
 */
import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useSettingsStore, useAppStore, useToastStore } from '../stores'

const REFRESH_DEBOUNCE = 100  // ms debounce for refreshTerminal()

/**
 * Determine if WebGL should be used based on render mode, active state, and hidden state.
 * Hidden terminals never use WebGL to save GPU resources.
 */
export function shouldUseWebGL(terminalId: string, isActive: boolean, isHidden: boolean): boolean {
  if (isHidden) return false

  const { pendingSettings } = useSettingsStore.getState()
  const isClaudeTerminal = useAppStore.getState().terminals.some(
    terminal => terminal.id === terminalId && terminal.isClaudeMode
  )

  if (isClaudeTerminal && !pendingSettings.gpuRendererForClaudeTerminals) {
    return false
  }

  const mode = pendingSettings.terminalRenderMode ?? 'balanced'
  switch (mode) {
    case 'performance':
      return false
    case 'balanced':
      return isActive
    case 'quality':
      return true
  }
}

interface UseTerminalWebGLParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
  terminalId: string
  isActiveRef: RefObject<boolean>
  isHiddenRef: RefObject<boolean>
  /** Called when WebGL context is lost — triggers a full display refresh */
  onRefresh: (showNotification?: boolean) => void
  /** Called after WebGL addon loads to repaint visible rows */
  onRefreshVisibleRows: () => void
  /** Called to refit terminal after a refresh */
  performFit: (restoreViewport?: boolean) => boolean
}

interface UseTerminalWebGLResult {
  /** Reconcile the current WebGL state with shouldUseWebGL() result */
  reconcileWebGL: () => void
  /** Clear texture atlas — useful before renderer transitions */
  clearTextureAtlas: () => void
  /** Ref to the active WebGL addon (null when canvas renderer is active) */
  webglAddonRef: RefObject<WebglAddon | null>
  /** True while WebGL addon is loading — visibility hook polls this before restoring scroll */
  webglLoadingRef: RefObject<boolean>
  /** Dispose + reload WebGL after theme change (cursor color requires full reload) */
  reloadWebGLForTheme: () => void
  /** Full display refresh: dispose WebGL, redraw, reinit WebGL, refit, restore viewport */
  refreshTerminal: (showNotification?: boolean) => void
}

export function useTerminalWebGL(params: UseTerminalWebGLParams): UseTerminalWebGLResult {
  const {
    terminalRef,
    disposedRef,
    terminalId,
    isActiveRef,
    isHiddenRef,
    onRefresh,
    onRefreshVisibleRows,
    performFit,
  } = params

  const webglAddonRef = useRef<WebglAddon | null>(null)
  const webglLoadingRef = useRef(false)

  // Keep a stable ref to onRefresh so the context-loss handler always calls the latest version
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  /**
   * Attach context-loss listener via the public addon API.
   * Wraps dispose() to also cleanup the listener.
   */
  const attachContextLostListener = useCallback((addon: WebglAddon) => {
    const contextLossDisposable = addon.onContextLoss(() => {
      console.warn('WebGL context lost, auto-refreshing terminal...')
      onRefreshRef.current(true)  // Show notification on auto-refresh
    })

    const originalDispose = addon.dispose.bind(addon)
    addon.dispose = () => {
      contextLossDisposable.dispose()
      originalDispose()
    }
  }, [])

  const clearTextureAtlas = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal || disposedRef.current) return

    try {
      terminal.clearTextureAtlas()
    } catch {
      // Ignore atlas resets during initialization/teardown races
    }
  }, [terminalRef, disposedRef])

  const reconcileWebGL = useCallback(() => {
    if (disposedRef.current || !terminalRef.current || webglLoadingRef.current) return

    const needsWebGL = shouldUseWebGL(terminalId, isActiveRef.current, isHiddenRef.current)
    const hasWebGL = webglAddonRef.current !== null

    if (needsWebGL && !hasWebGL) {
      webglLoadingRef.current = true
      requestAnimationFrame(() => {
        if (disposedRef.current || !terminalRef.current) {
          webglLoadingRef.current = false
          return
        }
        try {
          const webglAddon = new WebglAddon()
          webglAddonRef.current = webglAddon
          terminalRef.current.loadAddon(webglAddon)
          attachContextLostListener(webglAddon)
          onRefreshVisibleRows()
        } catch (e) {
          console.warn('WebGL addon failed to load:', e)
        }
        webglLoadingRef.current = false
      })
    } else if (!needsWebGL && hasWebGL) {
      try {
        webglAddonRef.current?.dispose()
      } catch {
        // Ignore disposal errors
      }
      webglAddonRef.current = null
      onRefreshVisibleRows()
    }
  }, [attachContextLostListener, disposedRef, isActiveRef, isHiddenRef, onRefreshVisibleRows, terminalId, terminalRef])

  // Subscribe to render-mode + GPU-override setting changes
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      const renderModeChanged =
        state.pendingSettings.terminalRenderMode !== prevState.pendingSettings.terminalRenderMode
      const claudeGpuOverrideChanged =
        state.pendingSettings.gpuRendererForClaudeTerminals !== prevState.pendingSettings.gpuRendererForClaudeTerminals

      if (!renderModeChanged && !claudeGpuOverrideChanged) return

      reconcileWebGL()
    })
    return unsubscribe
  }, [disposedRef, reconcileWebGL, terminalRef])

  // Subscribe to Claude-mode changes (affects GPU usage per terminal)
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return

      const nextClaudeMode = state.terminals.find(t => t.id === terminalId)?.isClaudeMode ?? false
      const prevClaudeMode = prevState.terminals.find(t => t.id === terminalId)?.isClaudeMode ?? false

      if (nextClaudeMode === prevClaudeMode) return

      reconcileWebGL()
    })
    return unsubscribe
  }, [disposedRef, reconcileWebGL, terminalId, terminalRef])

  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Dispose + reload WebGL after a theme change (cursor color requires full reload).
   * When no WebGL is active, simply refreshes the canvas renderer.
   */
  const reloadWebGLForTheme = useCallback(() => {
    const t = terminalRef.current
    if (!t || disposedRef.current) return
    clearTextureAtlas()
    if (webglAddonRef.current) {
      try { webglAddonRef.current.dispose() } catch { /* ignore */ }
      webglAddonRef.current = null
      t.refresh(0, t.rows - 1)
      if (shouldUseWebGL(terminalId, isActiveRef.current, isHiddenRef.current)) {
        try {
          const addon = new WebglAddon()
          webglAddonRef.current = addon
          t.loadAddon(addon)
          reconcileWebGL()
        } catch (e) { console.warn('WebGL addon failed to load:', e) }
      }
    } else {
      t.refresh(0, t.rows - 1)
    }
  }, [clearTextureAtlas, disposedRef, isActiveRef, isHiddenRef, reconcileWebGL, terminalId, terminalRef, webglAddonRef])

  /**
   * Full display refresh: dispose WebGL, redraw canvas, reinit WebGL, refit, restore viewport.
   * Debounced to avoid spam from rapid context-loss events.
   */
  const refreshTerminal = useCallback((showNotification = false) => {
    if (disposedRef.current || !terminalRef.current) return
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return
      const savedViewportY = terminalRef.current.buffer.active.viewportY
      clearTextureAtlas()
      try { webglAddonRef.current?.dispose() } catch { /* ignore */ }
      webglAddonRef.current = null
      terminalRef.current.refresh(0, terminalRef.current.rows - 1)
      if (shouldUseWebGL(terminalId, isActiveRef.current, isHiddenRef.current)) {
        try {
          const addon = new WebglAddon()
          webglAddonRef.current = addon
          terminalRef.current.loadAddon(addon)
          reconcileWebGL()
        } catch (e) { console.warn('WebGL addon failed to load:', e) }
      }
      performFit(false)
      if (savedViewportY >= 0) terminalRef.current.scrollToLine(savedViewportY)
      if (showNotification) {
        try { useToastStore.getState().addToast('Terminal display refreshed', 'info') } catch { /* ignore */ }
      }
    }, REFRESH_DEBOUNCE)
  }, [clearTextureAtlas, disposedRef, isActiveRef, isHiddenRef, performFit, reconcileWebGL, terminalId, terminalRef, webglAddonRef])

  return { reconcileWebGL, clearTextureAtlas, webglAddonRef, webglLoadingRef, reloadWebGLForTheme, refreshTerminal }
}
