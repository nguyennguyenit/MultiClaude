import { useEffect, useState } from 'react'
import type { ContextSnapshot } from '@shared/types'

/**
 * Subscribes to main-process context-window snapshots for a given Claude
 * session id. Rebinds when sessionId changes. Returns null until the first
 * snapshot arrives (or immediately when `getSnapshot` resolves for the
 * active session).
 */
export function useContextSnapshot(sessionId: string | null): ContextSnapshot | null {
  const [snap, setSnap] = useState<ContextSnapshot | null>(null)

  useEffect(() => {
    setSnap(null)
    if (!sessionId) return

    let cancelled = false
    const api = (window as unknown as { electron?: { context?: {
      getSnapshot: (sid: string) => Promise<ContextSnapshot | null>
      onSnapshot: (cb: (s: ContextSnapshot) => void) => () => void
    } } }).electron?.context
    if (!api) return

    // Initial hydration
    void api.getSnapshot(sessionId).then((initial) => {
      if (!cancelled && initial && initial.sessionId === sessionId) {
        setSnap(initial)
      }
    }).catch(() => { /* swallow */ })

    // Live updates
    const unsub = api.onSnapshot((incoming) => {
      if (incoming.sessionId === sessionId) setSnap(incoming)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [sessionId])

  return snap
}
