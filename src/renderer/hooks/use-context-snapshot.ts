import { useEffect, useRef, useState } from 'react'
import type { ContextSnapshot } from '@shared/types'

export interface UseContextSnapshotResult {
  snapshot: ContextSnapshot | null
  /** True when no new snapshot has arrived for STALE_THRESHOLD_MS. */
  isStale: boolean
}

/** Snapshot is flagged stale after 10s of silence. */
export const STALE_THRESHOLD_MS = 10_000
const STALE_CHECK_MS = 1_000

/**
 * Subscribes to main-process context-window snapshots for a given Claude
 * session id. Rebinds when sessionId changes.
 *
 * Returns both the latest snapshot (or null until the first arrives) and an
 * `isStale` flag that flips true when no update has been received for
 * {@link STALE_THRESHOLD_MS}. Useful for degraded-state UI when IPC stalls.
 */
export function useContextSnapshot(sessionId: string | null): UseContextSnapshotResult {
  const [snap, setSnap] = useState<ContextSnapshot | null>(null)
  const [isStale, setIsStale] = useState(false)
  const lastAtRef = useRef<number>(0)

  useEffect(() => {
    setSnap(null)
    setIsStale(false)
    lastAtRef.current = 0
    if (!sessionId) return

    let cancelled = false
    const api = (window as unknown as { electron?: { context?: {
      getSnapshot: (sid: string) => Promise<ContextSnapshot | null>
      onSnapshot: (cb: (s: ContextSnapshot) => void) => () => void
    } } }).electron?.context
    if (!api) return

    const markFresh = () => {
      lastAtRef.current = Date.now()
      setIsStale(false)
    }

    // Initial hydration
    void api.getSnapshot(sessionId).then((initial) => {
      if (!cancelled && initial && initial.sessionId === sessionId) {
        setSnap(initial)
        markFresh()
      }
    }).catch(() => { /* swallow */ })

    // Live updates
    const unsub = api.onSnapshot((incoming) => {
      if (incoming.sessionId === sessionId) {
        setSnap(incoming)
        markFresh()
      }
    })

    // Stale watcher — gap since last snapshot > threshold
    const interval = setInterval(() => {
      const last = lastAtRef.current
      if (last === 0) return
      const stale = Date.now() - last > STALE_THRESHOLD_MS
      setIsStale((prev) => (prev === stale ? prev : stale))
    }, STALE_CHECK_MS)

    return () => {
      cancelled = true
      unsub()
      clearInterval(interval)
    }
  }, [sessionId])

  return { snapshot: snap, isStale }
}
