import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { WebglAddon } from '@xterm/addon-webgl'
import type { IDisposable, Terminal as XTerm } from '@xterm/xterm'
import type { TerminalSurface } from '../terminal/terminal-surface'
import { useAppStore, useSettingsStore, useToastStore } from '../stores'
import {
  claimTerminalRendererSession,
  registerTerminalRendererRetry,
  releaseTerminalRendererSession,
  setTerminalRendererStatus,
} from '../stores/terminal-renderer-status-store'
import {
  pauseAndBuffer,
  resumeAndFlush,
  resumeFromSnapshot,
} from '../utils/terminal-output-dispatcher'
import {
  resolveTerminalRenderer,
  type RendererFallbackReason,
} from '../utils/terminal-renderer-policy'
import {
  subscribeToSystemResume,
  unsubscribeFromSystemResume,
} from '../utils/terminal-lifecycle-dispatcher'

interface SnapshotReplayLock {
  token: symbol
  promise: Promise<void>
}

const snapshotReplayMutex = new Map<string, SnapshotReplayLock>()
const legacyReplayTokens = new Map<string, symbol>()
const REFRESH_DEBOUNCE = 100

function getLegacyReplayToken(terminalId: string): symbol {
  let token = legacyReplayTokens.get(terminalId)
  if (!token) {
    token = Symbol(`legacy-replay:${terminalId}`)
    legacyReplayTokens.set(terminalId, token)
  }
  return token
}

export async function acquireSnapshotReplayLock(
  terminalId: string,
  tokenOrWait: symbol | boolean = false,
  waitForExisting = false,
): Promise<(() => void) | null> {
  const token = typeof tokenOrWait === 'symbol'
    ? tokenOrWait
    : getLegacyReplayToken(terminalId)
  const shouldWait = typeof tokenOrWait === 'boolean' ? tokenOrWait : waitForExisting

  while (snapshotReplayMutex.has(terminalId)) {
    const existing = snapshotReplayMutex.get(terminalId)!
    if (existing.token !== token) break
    if (!shouldWait) return null
    await existing.promise
  }

  let resolve!: () => void
  const promise = new Promise<void>(resolveLock => { resolve = resolveLock })
  const lock = { token, promise }
  snapshotReplayMutex.set(terminalId, lock)
  return () => {
    if (snapshotReplayMutex.get(terminalId) === lock) snapshotReplayMutex.delete(terminalId)
    resolve()
  }
}

export function isSnapshotReplayLocked(terminalId: string): boolean {
  return snapshotReplayMutex.has(terminalId)
}

function getRendererIntent(terminalId: string) {
  const policy = useSettingsStore.getState().pendingSettings.terminalRendererPolicy
  const terminal = useAppStore.getState().terminals.find(candidate => candidate.id === terminalId)
  return resolveTerminalRenderer({
    policy,
    agentType: terminal?.agentType,
    isClaudeMode: terminal?.isClaudeMode,
  })
}

export function shouldUseWebGL(
  terminalId: string,
  _isActive?: boolean,
  _isHidden?: boolean,
): boolean {
  void _isActive
  void _isHidden
  return getRendererIntent(terminalId).desired === 'webgl'
}

interface UseTerminalWebGLParams {
  terminalRef: RefObject<XTerm | null>
  surfaceRef?: RefObject<TerminalSurface | null>
  disposedRef: RefObject<boolean>
  terminalId: string
  sessionToken?: symbol
  isActiveRef: RefObject<boolean>
  isHiddenRef: RefObject<boolean>
  onRefresh?: (showNotification?: boolean) => void
  onRefreshVisibleRows: () => void
  performFit: (restoreViewport?: boolean) => boolean
}

interface UseTerminalWebGLResult {
  reconcileWebGL: () => void
  clearTextureAtlas: () => void
  webglAddonRef: RefObject<WebglAddon | null>
  webglLoadingRef: RefObject<boolean>
  reloadWebGLForTheme: () => void
  refreshTerminal: (showNotification?: boolean) => void
  disposeWebGL: () => void
}

interface SnapshotReplayParams {
  terminalId: string
  sessionToken?: symbol
  terminalRef: RefObject<XTerm | null>
  surfaceRef?: RefObject<TerminalSurface | null>
  disposedRef: RefObject<boolean>
  isActiveRef?: RefObject<boolean>
  isHiddenRef?: RefObject<boolean>
  clearTextureAtlas: () => void
  webglAddonRef?: RefObject<WebglAddon | null>
  disposeWebGL?: () => void
  reconcileWebGL: () => void
  performFit: (restoreViewport?: boolean) => boolean
  silent: boolean
}

export async function performSnapshotReplay(params: SnapshotReplayParams): Promise<void> {
  const {
    terminalId,
    sessionToken,
    terminalRef,
    surfaceRef,
    disposedRef,
    clearTextureAtlas,
    webglAddonRef,
    disposeWebGL,
    reconcileWebGL,
    performFit,
    silent,
  } = params
  const replayToken = sessionToken ?? getLegacyReplayToken(terminalId)
  const releaseLock = await acquireSnapshotReplayLock(terminalId, replayToken)
  if (!releaseLock) return

  try {
    pauseAndBuffer(terminalId, sessionToken)
    const snapshot = await window.electron.terminal.getSnapshot(terminalId)
    if (disposedRef.current || !terminalRef.current) {
      resumeAndFlush(terminalId, sessionToken)
      return
    }

    const terminal = terminalRef.current
    clearTextureAtlas()
    if (disposeWebGL) {
      disposeWebGL()
    } else {
      try { webglAddonRef?.current?.dispose() } catch { /* teardown is best-effort */ }
      if (webglAddonRef) webglAddonRef.current = null
    }

    if (surfaceRef?.current) {
      await surfaceRef.current.replaceSnapshot(snapshot)
    } else {
      terminal.reset()
      if (snapshot.cols > 0 && snapshot.rows > 0) terminal.resize(snapshot.cols, snapshot.rows)
      if (snapshot.ansi) {
        await new Promise<void>(resolve => terminal.write(snapshot.ansi, resolve))
      }
    }

    if (disposedRef.current || terminalRef.current !== terminal) {
      resumeAndFlush(terminalId, sessionToken)
      return
    }
    reconcileWebGL()
    const fitOk = performFit(false)
    try {
      window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
    } catch { /* non-fatal */ }
    resumeFromSnapshot(snapshot, sessionToken)

    if (!silent) {
      useToastStore.getState().addToast(
        fitOk ? 'Terminal refreshed' : 'Terminal refreshed (pane hidden — retry when visible)',
        'info',
      )
    }
  } catch {
    resumeAndFlush(terminalId, sessionToken)
    console.error('[terminal-renderer] Snapshot replay failed.')
    useToastStore.getState().addToast(
      'Terminal refresh error — could not fetch snapshot',
      'error',
    )
  } finally {
    releaseLock()
  }
}

export function useTerminalWebGL(params: UseTerminalWebGLParams): UseTerminalWebGLResult {
  const {
    terminalRef,
    surfaceRef,
    disposedRef,
    terminalId,
    isActiveRef,
    isHiddenRef,
    onRefreshVisibleRows,
    performFit,
  } = params
  const localSessionTokenRef = useRef(Symbol(`renderer:${terminalId}`))
  const sessionToken = params.sessionToken ?? localSessionTokenRef.current
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const contextLossDisposableRef = useRef<IDisposable | null>(null)
  const webglLoadingRef = useRef(false)
  const queuedFrameRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const suppressedReasonRef = useRef<RendererFallbackReason | null>(null)
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const publishStatus = useCallback((
    effective: 'dom' | 'webgl',
    fallbackReason: RendererFallbackReason | null,
  ) => {
    setTerminalRendererStatus(terminalId, sessionToken, { effective, fallbackReason })
  }, [sessionToken, terminalId])

  const invalidateQueuedLoad = useCallback(() => {
    generationRef.current += 1
    webglLoadingRef.current = false
    if (queuedFrameRef.current !== null) {
      cancelAnimationFrame(queuedFrameRef.current)
      queuedFrameRef.current = null
    }
  }, [])

  const disposeWebGL = useCallback(() => {
    const addon = webglAddonRef.current
    const lossDisposable = contextLossDisposableRef.current
    webglAddonRef.current = null
    contextLossDisposableRef.current = null
    try { lossDisposable?.dispose() } catch { /* teardown is best-effort */ }
    try { addon?.dispose() } catch { /* teardown is best-effort */ }
  }, [])

  const clearTextureAtlas = useCallback(() => {
    if (disposedRef.current || !terminalRef.current) return
    try { terminalRef.current.clearTextureAtlas() } catch { /* initialization race */ }
  }, [disposedRef, terminalRef])

  const reconcileWebGL = useCallback(() => {
    const terminal = terminalRef.current
    if (disposedRef.current || !terminal) return
    const intent = getRendererIntent(terminalId)

    if (intent.desired === 'dom') {
      const hadWebGL = webglAddonRef.current !== null
      invalidateQueuedLoad()
      disposeWebGL()
      publishStatus('dom', intent.fallbackReason)
      if (hadWebGL) onRefreshVisibleRows()
      return
    }
    if (suppressedReasonRef.current) {
      publishStatus('dom', suppressedReasonRef.current)
      return
    }
    if (webglAddonRef.current) {
      publishStatus('webgl', null)
      return
    }

    publishStatus('dom', null)
    if (webglLoadingRef.current || !isActiveRef.current || isHiddenRef.current) return
    webglLoadingRef.current = true
    const generation = ++generationRef.current
    const scheduledTerminal = terminal

    queuedFrameRef.current = requestAnimationFrame(() => {
      queuedFrameRef.current = null
      const latestIntent = getRendererIntent(terminalId)
      if (
        generationRef.current !== generation
        || disposedRef.current
        || terminalRef.current !== scheduledTerminal
        || latestIntent.desired !== 'webgl'
        || suppressedReasonRef.current !== null
        || !isActiveRef.current
        || isHiddenRef.current
      ) {
        webglLoadingRef.current = false
        return
      }

      let candidate: WebglAddon | null = null
      let candidateLossDisposable: IDisposable | null = null
      try {
        if (typeof WebglAddon !== 'function') {
          suppressedReasonRef.current = 'webgl-unavailable'
          publishStatus('dom', 'webgl-unavailable')
          return
        }
        candidate = new WebglAddon()
        scheduledTerminal.loadAddon(candidate)
        candidateLossDisposable = candidate.onContextLoss(() => {
          if (webglAddonRef.current !== candidate || suppressedReasonRef.current) return
          suppressedReasonRef.current = 'webgl-context-lost'
          invalidateQueuedLoad()
          disposeWebGL()
          publishStatus('dom', 'webgl-context-lost')
          onRefreshVisibleRows()
          performFit(false)
        })
        if (
          generationRef.current !== generation
          || disposedRef.current
          || terminalRef.current !== scheduledTerminal
          || getRendererIntent(terminalId).desired !== 'webgl'
        ) {
          candidateLossDisposable.dispose()
          candidate.dispose()
          return
        }
        webglAddonRef.current = candidate
        contextLossDisposableRef.current = candidateLossDisposable
        publishStatus('webgl', null)
        onRefreshVisibleRows()
      } catch {
        try { candidateLossDisposable?.dispose() } catch { /* best-effort */ }
        try { candidate?.dispose() } catch { /* best-effort */ }
        suppressedReasonRef.current = 'webgl-load-failed'
        publishStatus('dom', 'webgl-load-failed')
      } finally {
        webglLoadingRef.current = false
      }
    })
  }, [
    disposedRef,
    disposeWebGL,
    invalidateQueuedLoad,
    isActiveRef,
    isHiddenRef,
    onRefreshVisibleRows,
    performFit,
    publishStatus,
    terminalId,
    terminalRef,
  ])

  const retryGPU = useCallback((): boolean => {
    const reason = suppressedReasonRef.current
    if (reason !== 'webgl-load-failed' && reason !== 'webgl-context-lost') return false
    if (disposedRef.current || getRendererIntent(terminalId).desired !== 'webgl') return false
    suppressedReasonRef.current = null
    invalidateQueuedLoad()
    reconcileWebGL()
    return true
  }, [disposedRef, invalidateQueuedLoad, reconcileWebGL, terminalId])

  useEffect(() => {
    claimTerminalRendererSession(terminalId, sessionToken)
    const unregisterRetry = registerTerminalRendererRetry(
      terminalId,
      sessionToken,
      retryGPU,
    )
    reconcileWebGL()
    return () => {
      invalidateQueuedLoad()
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
      unregisterRetry()
      disposeWebGL()
      releaseTerminalRendererSession(terminalId, sessionToken)
    }
  }, [
    disposeWebGL,
    invalidateQueuedLoad,
    reconcileWebGL,
    retryGPU,
    sessionToken,
    terminalId,
  ])

  useEffect(() => useSettingsStore.subscribe((state, previous) => {
    if (
      state.pendingSettings.terminalRendererPolicy
      !== previous.pendingSettings.terminalRendererPolicy
    ) {
      reconcileWebGL()
    }
  }), [reconcileWebGL])

  useEffect(() => useAppStore.subscribe((state, previous) => {
    const current = state.terminals.find(terminal => terminal.id === terminalId)
    const prior = previous.terminals.find(terminal => terminal.id === terminalId)
    if (
      current?.agentType !== prior?.agentType
      || current?.isClaudeMode !== prior?.isClaudeMode
    ) {
      reconcileWebGL()
    }
  }), [reconcileWebGL, terminalId])

  const reloadWebGLForTheme = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal || disposedRef.current) return
    clearTextureAtlas()
    const hadWebGL = webglAddonRef.current !== null
    if (hadWebGL) disposeWebGL()
    terminal.refresh(0, terminal.rows - 1)
    reconcileWebGL()
  }, [clearTextureAtlas, disposedRef, disposeWebGL, reconcileWebGL, terminalRef])

  const refreshTerminal = useCallback((showNotification = true) => {
    if (disposedRef.current || !terminalRef.current) return
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return
      void performSnapshotReplay({
        terminalId,
        sessionToken,
        terminalRef,
        surfaceRef,
        disposedRef,
        clearTextureAtlas,
        disposeWebGL,
        reconcileWebGL,
        performFit,
        silent: !showNotification,
      })
    }, REFRESH_DEBOUNCE)
  }, [
    clearTextureAtlas,
    disposedRef,
    disposeWebGL,
    performFit,
    reconcileWebGL,
    sessionToken,
    surfaceRef,
    terminalId,
    terminalRef,
  ])

  useEffect(() => {
    subscribeToSystemResume(terminalId, sessionToken, () => {
      if (disposedRef.current || !terminalRef.current) return
      void performSnapshotReplay({
        terminalId,
        sessionToken,
        terminalRef,
        surfaceRef,
        disposedRef,
        clearTextureAtlas,
        disposeWebGL,
        reconcileWebGL,
        performFit,
        silent: true,
      })
    })
    return () => unsubscribeFromSystemResume(terminalId, sessionToken)
  }, [
    clearTextureAtlas,
    disposedRef,
    disposeWebGL,
    performFit,
    reconcileWebGL,
    sessionToken,
    surfaceRef,
    terminalId,
    terminalRef,
  ])

  return {
    reconcileWebGL,
    clearTextureAtlas,
    webglAddonRef,
    webglLoadingRef,
    reloadWebGLForTheme,
    refreshTerminal,
    disposeWebGL,
  }
}
