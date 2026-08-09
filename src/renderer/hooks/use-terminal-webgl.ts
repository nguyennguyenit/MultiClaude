/**
 * useTerminalWebGL — manages WebGL renderer lifecycle for a single xterm terminal.
 *
 * Responsibilities:
 *   - Load / unload WebglAddon based on shouldUseWebGL() result
 *   - Attach context-loss listener (calls onRefresh on GPU context loss)
 *   - Expose clearTextureAtlas() helper for other hooks
 *   - Subscribe to render-mode + Claude-mode store changes (three useEffects)
 *   - Expose reloadWebGLForTheme() — dispose + reload WebGL after theme change
 *   - Expose refreshTerminal() — full display refresh with snapshot replay
 *
 * Sub-hooks must NOT import from each other.  All orchestration lives in use-terminal.ts.
 */
import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { TerminalSurface } from '../terminal/terminal-surface'
import { useSettingsStore, useAppStore, useToastStore } from '../stores'
import {
  pauseAndBuffer,
  resumeAndFlush,
  resumeFromSnapshot,
} from '../utils/terminal-output-dispatcher'
import { subscribeToSystemResume, unsubscribeFromSystemResume } from '../utils/terminal-lifecycle-dispatcher'

// ── Per-terminal mutex ───────────────────────────────────────────────────────
// Prevents concurrent snapshot replays (e.g. refresh + phase-4 auto-resync).
// Map<terminalId, Promise<void>> — presence of key = lock is held.
// Designed for phase-4 reuse: import snapshotReplayMutex and call isLocked() before
// triggering auto-resync from powerMonitor/onSystemResumed.
const snapshotReplayMutex = new Map<string, Promise<void>>()

export async function acquireSnapshotReplayLock(
  terminalId: string,
  waitForExisting = false
): Promise<(() => void) | null> {
  while (snapshotReplayMutex.has(terminalId)) {
    if (!waitForExisting) return null
    await snapshotReplayMutex.get(terminalId)
  }

  let resolve!: () => void
  const lock = new Promise<void>(resolveLock => { resolve = resolveLock })
  snapshotReplayMutex.set(terminalId, lock)
  return () => {
    if (snapshotReplayMutex.get(terminalId) === lock) {
      snapshotReplayMutex.delete(terminalId)
    }
    resolve()
  }
}

const REFRESH_DEBOUNCE = 100  // ms debounce for refreshTerminal()

/**
 * Determine if WebGL is allowed for this terminal based on settings only.
 *
 * Note: isActive/isHidden are accepted for API compatibility but intentionally
 * ignored in the allow decision. Once loaded, the WebGL addon stays alive across
 * terminal switches to avoid texture-atlas corruption caused by repeated
 * load/dispose cycles (observed as stretched/garbled text when switching panes).
 * Initial-load gating on isActive/isHidden happens in reconcileWebGL instead.
 */
export function shouldUseWebGL(terminalId: string, _isActive?: boolean, _isHidden?: boolean): boolean {
  void _isActive; void _isHidden
  const { pendingSettings } = useSettingsStore.getState()
  const terminal = useAppStore.getState().terminals.find(
    candidate => candidate.id === terminalId
  )
  const requiresSafeRenderer =
    terminal?.agentType === 'claude' ||
    terminal?.agentType === 'codex' ||
    terminal?.isClaudeMode === true

  if (requiresSafeRenderer && !pendingSettings.gpuRendererForClaudeTerminals) {
    return false
  }

  const mode = pendingSettings.terminalRenderMode ?? 'balanced'
  return mode !== 'performance'
}

interface UseTerminalWebGLParams {
  terminalRef: RefObject<XTerm | null>
  surfaceRef?: RefObject<TerminalSurface | null>
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
  /** Full display refresh via snapshot replay (debounced). showNotification defaults true. */
  refreshTerminal: (showNotification?: boolean) => void
}

interface SnapshotReplayParams {
  terminalId: string
  terminalRef: RefObject<XTerm | null>
  surfaceRef?: RefObject<TerminalSurface | null>
  disposedRef: RefObject<boolean>
  isActiveRef: RefObject<boolean>
  isHiddenRef: RefObject<boolean>
  clearTextureAtlas: () => void
  webglAddonRef: RefObject<WebglAddon | null>
  reconcileWebGL: () => void
  performFit: (restoreViewport?: boolean) => boolean
  silent: boolean
}

/**
 * Core snapshot replay sequence — hardened against B1/H4/H6/M8 failure modes.
 *
 * Sequence:
 *   mutex check → pauseAndBuffer → getSnapshot → (disposed check) →
 *   WebGL teardown → terminal.reset() → resize →
 *   write snapshot data → WebGL reload → performFit → SIGWINCH →
 *   resumeFromSnapshot(watermark) → toast
 *
 * Exported so phase-4 (powerMonitor auto-resync) can call it with silent:true.
 */
export async function performSnapshotReplay(params: SnapshotReplayParams): Promise<void> {
  const {
    terminalId,
    terminalRef,
    surfaceRef,
    disposedRef,
    isActiveRef,
    isHiddenRef,
    clearTextureAtlas,
    webglAddonRef,
    reconcileWebGL,
    performFit,
    silent,
  } = params

  const releaseLock = await acquireSnapshotReplayLock(terminalId)
  if (!releaseLock) return

  try {
    // H4: buffer live output chunks while we reset+replay
    pauseAndBuffer(terminalId)

    // Canonical state is already maintained in the ordered main-process mirror.
    // Refresh never replays the persisted raw tail.
    const snap = await window.electron.terminal.getSnapshot(terminalId)

    // M8: terminal destroyed while IPC was in flight
    if (disposedRef.current || !terminalRef.current) {
      resumeAndFlush(terminalId)
      return
    }

    const t = terminalRef.current

    // Dispose WebGL before reset to avoid texture cache corruption
    clearTextureAtlas()
    try { webglAddonRef.current?.dispose() } catch { /* ignore */ }
    webglAddonRef.current = null

    if (surfaceRef?.current) {
      await surfaceRef.current.replaceSnapshot(snap)
    } else {
      t.reset()
      if (snap.cols > 0 && snap.rows > 0) t.resize(snap.cols, snap.rows)
      if (snap.ansi) await new Promise<void>(resolve => t.write(snap.ansi, resolve))
    }

    // Reload WebGL after reset/write cycle
    if (shouldUseWebGL(terminalId, isActiveRef.current, isHiddenRef.current)) {
      try {
        const addon = new WebglAddon()
        webglAddonRef.current = addon
        t.loadAddon(addon)
        reconcileWebGL()
      } catch (e) { console.warn('WebGL addon failed to load after snapshot replay:', e) }
    }

    const fitOk = performFit(false)

    // SIGWINCH — makes CLI (vim, tmux, etc.) repaint at current dimensions
    try {
      window.electron.terminal.resize(terminalId, t.cols, t.rows)
    } catch { /* ignore — non-fatal */ }

    resumeFromSnapshot(snap)

    if (!silent) {
      try {
        useToastStore.getState().addToast(
          fitOk ? 'Terminal refreshed' : 'Terminal refreshed (pane hidden — retry when visible)',
          'info'
        )
      } catch { /* ignore */ }
    }
  } catch (err) {
    // Ensure buffer is always flushed even on error, then surface the error as a toast
    resumeAndFlush(terminalId)
    console.error('Terminal snapshot replay failed:', err)
    try {
      useToastStore.getState().addToast('Terminal refresh error — could not fetch snapshot', 'error')
    } catch { /* ignore */ }
  } finally {
    releaseLock()
  }
}

/** Test helper: check if a replay is currently in progress for a terminal. */
export function isSnapshotReplayLocked(terminalId: string): boolean {
  return snapshotReplayMutex.has(terminalId)
}

export function useTerminalWebGL(params: UseTerminalWebGLParams): UseTerminalWebGLResult {
  const {
    terminalRef,
    surfaceRef,
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

    const allowed = shouldUseWebGL(terminalId)
    const hasWebGL = webglAddonRef.current !== null

    // Initial load is gated on active+visible to avoid eagerly allocating WebGL
    // contexts for inactive terminals (browsers cap concurrent WebGL contexts).
    // Once loaded, the addon stays alive across terminal switches — see
    // shouldUseWebGL() docstring for rationale.
    const shouldLoad = allowed && isActiveRef.current && !isHiddenRef.current

    if (shouldLoad && !hasWebGL) {
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
    } else if (!allowed && hasWebGL) {
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
   * Full display refresh via snapshot replay.
   * Fetches a headless PTY snapshot from the backend, resets xterm, and replays
   * the snapshot data — restoring the visible terminal state after a GPU context
   * loss, lid-wake, or explicit user refresh.
   *
   * Debounced to absorb rapid context-loss bursts.
   * Delegates to performSnapshotReplay() which holds the per-terminal mutex,
   * buffers live output during replay (H4), and handles disposal guard (M8).
   */
  const refreshTerminal = useCallback((showNotification = true) => {
    if (disposedRef.current || !terminalRef.current) return
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return
      void performSnapshotReplay({
        terminalId,
        terminalRef,
        surfaceRef,
        disposedRef,
        isActiveRef,
        isHiddenRef,
        clearTextureAtlas,
        webglAddonRef,
        reconcileWebGL,
        performFit,
        silent: !showNotification,
      })
    }, REFRESH_DEBOUNCE)
  }, [clearTextureAtlas, disposedRef, isActiveRef, isHiddenRef, performFit, reconcileWebGL, surfaceRef, terminalId, terminalRef, webglAddonRef])

  // Phase 4: subscribe to system-resume lifecycle events.
  // Triggers silent snapshot replay (no toast) on lid-wake, mirroring the same
  // path as the explicit refresh button but with silent=true.
  // snapshotReplayMutex inside performSnapshotReplay() coalesces concurrent fires.
  useEffect(() => {
    subscribeToSystemResume(terminalId, () => {
      if (disposedRef.current || !terminalRef.current) return
      void performSnapshotReplay({
        terminalId,
        terminalRef,
        surfaceRef,
        disposedRef,
        isActiveRef,
        isHiddenRef,
        clearTextureAtlas,
        webglAddonRef,
        reconcileWebGL,
        performFit,
        silent: true,
      })
    })
    return () => unsubscribeFromSystemResume(terminalId)
  }, [
    terminalId,
    terminalRef,
    surfaceRef,
    disposedRef,
    isActiveRef,
    isHiddenRef,
    clearTextureAtlas,
    webglAddonRef,
    reconcileWebGL,
    performFit,
  ])

  return { reconcileWebGL, clearTextureAtlas, webglAddonRef, webglLoadingRef, reloadWebGLForTheme, refreshTerminal }
}
