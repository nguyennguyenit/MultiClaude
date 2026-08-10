import type {
  TerminalOutputChunk,
  TerminalSnapshot,
  TerminalStreamRecoveryReason,
} from '@shared/types'

type TerminalOutputHandler = (data: string) => void
type RecoveryHandler = (reason: TerminalStreamRecoveryReason) => void | Promise<void>

const MAX_PENDING_BYTES = 1024 * 1024
const MAX_PENDING_CHUNKS = 4096
const RECOVERY_TIMEOUT_MS = 5000
const textEncoder = new TextEncoder()

interface StreamState {
  status: 'hydrating' | 'live' | 'gap' | 'overflowed' | 'disposed'
  streamEpoch: string | null
  lastAppliedSequence: number
  pending: TerminalOutputChunk[]
  pendingBytes: number
  handler?: TerminalOutputHandler
  recoveryHandler?: RecoveryHandler
  recoveryTimer?: ReturnType<typeof setTimeout>
  recoveryInFlight: boolean
  explicitlyPaused: boolean
  ownerToken?: symbol
}

function isOwnedBy(state: StreamState, token?: symbol): boolean {
  return token === undefined || state.ownerToken === token
}

export function claimTerminalOutputSession(id: string, token: symbol): void {
  const state = getState(id)
  if (state.ownerToken === token) return
  state.ownerToken = token
  state.handler = undefined
  state.recoveryHandler = undefined
  state.status = 'hydrating'
  state.explicitlyPaused = true
  clearRecovery(state)
}

const states = new Map<string, StreamState>()

function getState(id: string): StreamState {
  let state = states.get(id)
  if (!state) {
    state = {
      status: 'hydrating',
      streamEpoch: null,
      lastAppliedSequence: 0,
      pending: [],
      pendingBytes: 0,
      recoveryInFlight: false,
      explicitlyPaused: false,
    }
    states.set(id, state)
  }
  return state
}

function requestRecovery(id: string, state: StreamState, reason: TerminalStreamRecoveryReason): void {
  if (state.recoveryInFlight || !state.recoveryHandler) return
  state.recoveryInFlight = true
  void Promise.resolve(state.recoveryHandler(reason)).catch(() => undefined)
  state.recoveryTimer = setTimeout(() => {
    const current = states.get(id)
    if (!current || !current.recoveryInFlight) return
    current.status = 'overflowed'
    current.recoveryInFlight = false
  }, RECOVERY_TIMEOUT_MS)
}

function clearRecovery(state: StreamState): void {
  if (state.recoveryTimer) clearTimeout(state.recoveryTimer)
  state.recoveryTimer = undefined
  state.recoveryInFlight = false
}

function enqueue(id: string, state: StreamState, chunk: TerminalOutputChunk): void {
  const chunkBytes = textEncoder.encode(chunk.data).byteLength
  if (
    state.pending.length >= MAX_PENDING_CHUNKS ||
    state.pendingBytes + chunkBytes > MAX_PENDING_BYTES
  ) {
    state.pending = []
    state.pendingBytes = 0
    state.status = 'overflowed'
    requestRecovery(id, state, 'overflow')
    return
  }
  state.pending.push(chunk)
  state.pendingBytes += chunkBytes
}

function applyChunk(id: string, state: StreamState, chunk: TerminalOutputChunk): void {
  if (state.status !== 'live' || !state.handler) {
    enqueue(id, state, chunk)
    return
  }
  // Snapshot hydration can fail before the first live chunk arrives. In that
  // degraded path there is no authoritative epoch/watermark to adopt yet, so
  // bind to the first observed envelope instead of inventing a legacy epoch.
  if (state.streamEpoch === null) {
    state.streamEpoch = chunk.streamEpoch
    state.lastAppliedSequence = Math.max(0, chunk.sequence - 1)
  }
  if (state.streamEpoch !== chunk.streamEpoch) {
    state.status = 'gap'
    enqueue(id, state, chunk)
    requestRecovery(id, state, 'epoch')
    return
  }
  if (chunk.sequence <= state.lastAppliedSequence) return
  if (chunk.sequence !== state.lastAppliedSequence + 1) {
    state.status = 'gap'
    enqueue(id, state, chunk)
    requestRecovery(id, state, 'gap')
    return
  }
  state.handler(chunk.data)
  state.lastAppliedSequence = chunk.sequence
}

function flushPending(id: string, state: StreamState): void {
  const pending = state.pending
    .filter(chunk => chunk.streamEpoch === state.streamEpoch && chunk.sequence > state.lastAppliedSequence)
    .sort((left, right) => left.sequence - right.sequence)
  state.pending = []
  state.pendingBytes = 0

  for (const [index, chunk] of pending.entries()) {
    if (chunk.sequence <= state.lastAppliedSequence) continue
    if (chunk.sequence !== state.lastAppliedSequence + 1 || !state.handler) {
      state.status = 'gap'
      enqueue(id, state, chunk)
      for (const laterChunk of pending.slice(index + 1)) {
        enqueue(id, state, laterChunk)
      }
      requestRecovery(id, state, 'gap')
      return
    }
    state.handler(chunk.data)
    state.lastAppliedSequence = chunk.sequence
  }
}

/** Pause delivery while a full terminal snapshot is being applied. */
export function pauseAndBuffer(id: string, token?: symbol): void {
  const state = getState(id)
  if (!isOwnedBy(state, token)) return
  if (state.status !== 'disposed') {
    state.status = 'hydrating'
    state.explicitlyPaused = true
  }
}

/**
 * Complete hydration at an atomic snapshot watermark and apply only later
 * envelopes from the same terminal lifetime.
 */
export function resumeFromSnapshot(snapshot: TerminalSnapshot, token?: symbol): void {
  const state = states.get(snapshot.terminalId)
  if (!state || !isOwnedBy(state, token)) return
  clearRecovery(state)
  state.streamEpoch = snapshot.streamEpoch
  state.lastAppliedSequence = snapshot.watermark
  state.status = 'live'
  state.explicitlyPaused = false
  flushPending(snapshot.terminalId, state)
}

/**
 * Resume sequenced live delivery when snapshot hydration is unavailable.
 * Normal snapshot paths must call resumeFromSnapshot().
 */
export function resumeAndFlush(id: string, token?: symbol): void {
  const state = states.get(id)
  if (!state || !isOwnedBy(state, token)) return
  if (!state.streamEpoch) {
    const first = state.pending[0]
    state.streamEpoch = first?.streamEpoch ?? null
    state.lastAppliedSequence = Math.max(0, (first?.sequence ?? 1) - 1)
  }
  state.status = 'live'
  state.explicitlyPaused = false
  if (!state.handler) return
  flushPending(id, state)
}

export function registerTerminalOutputHandler(
  id: string,
  handler: TerminalOutputHandler,
  recoveryHandler?: RecoveryHandler,
  token?: symbol,
): () => void {
  const state = getState(id)
  if (!isOwnedBy(state, token)) return () => undefined
  state.handler = handler
  state.recoveryHandler = recoveryHandler
  if (state.status === 'live') flushPending(id, state)
  if (state.status === 'gap') requestRecovery(id, state, 'gap')
  if (state.status === 'overflowed') requestRecovery(id, state, 'overflow')

  return () => {
    const current = states.get(id)
    if (!current || !isOwnedBy(current, token) || current.handler !== handler) return
    current.handler = undefined
    current.recoveryHandler = undefined
    if (current.status === 'live') current.status = 'gap'
  }
}

export function attachTerminalOutputDispatcher(
  subscribe: (
    callback: (payload: TerminalOutputChunk) => void
  ) => () => void
): () => void {
  return subscribe((chunk) => {
    const state = getState(chunk.terminalId)
    applyChunk(chunk.terminalId, state, chunk)
  })
}

export function disposeTerminalOutputState(id: string): void {
  const state = states.get(id)
  if (!state) return
  clearRecovery(state)
  state.status = 'disposed'
  state.pending = []
  state.pendingBytes = 0
  state.handler = undefined
  state.recoveryHandler = undefined
  states.delete(id)
}

export function resetTerminalOutputDispatcherForTests(): void {
  for (const state of states.values()) clearRecovery(state)
  states.clear()
}
