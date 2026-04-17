import { create } from 'zustand'

export interface PendingToken {
  path: string
  displayLength: number
}

interface TerminalQueue {
  tokens: PendingToken[]
  charsAfterLastToken: number
}

interface PendingMediaState {
  queues: Record<string, TerminalQueue>
  push: (terminalId: string, token: PendingToken) => void
  flush: (terminalId: string) => string[]
  clear: (terminalId: string) => void
  incrementCharsAfter: (terminalId: string) => void
  decrementCharsAfter: (terminalId: string) => boolean
  popToken: (terminalId: string) => PendingToken | null
  // Removes the first token whose `path` matches. Does NOT touch
  // charsAfterLastToken — caller (attachment-remove-handler) decides whether
  // the xterm display can be safely erased.
  removeTokenByPath: (terminalId: string, path: string) => PendingToken | null
  getQueue: (terminalId: string) => TerminalQueue
}

const emptyQueue = (): TerminalQueue => ({ tokens: [], charsAfterLastToken: 0 })

export const usePendingMediaStore = create<PendingMediaState>((set, get) => ({
  queues: {},

  push: (terminalId, token) =>
    set((state) => ({
      queues: {
        ...state.queues,
        [terminalId]: {
          tokens: [...(state.queues[terminalId]?.tokens ?? []), token],
          charsAfterLastToken: 0
        }
      }
    })),

  flush: (terminalId) => {
    const q = get().queues[terminalId]
    if (!q?.tokens.length) return []
    const paths = q.tokens.map((t) => t.path)
    set((state) => ({ queues: { ...state.queues, [terminalId]: emptyQueue() } }))
    return paths
  },

  clear: (terminalId) =>
    set((state) => ({ queues: { ...state.queues, [terminalId]: emptyQueue() } })),

  incrementCharsAfter: (terminalId) =>
    set((state) => {
      const q = state.queues[terminalId] ?? emptyQueue()
      return {
        queues: {
          ...state.queues,
          [terminalId]: { ...q, charsAfterLastToken: q.charsAfterLastToken + 1 }
        }
      }
    }),

  decrementCharsAfter: (terminalId) => {
    const q = get().queues[terminalId]
    if (!q || q.charsAfterLastToken <= 0) return false
    set((state) => ({
      queues: {
        ...state.queues,
        [terminalId]: { ...q, charsAfterLastToken: q.charsAfterLastToken - 1 }
      }
    }))
    return true
  },

  popToken: (terminalId) => {
    const q = get().queues[terminalId]
    if (!q?.tokens.length) return null
    const tokens = [...q.tokens]
    const token = tokens.pop()!
    set((state) => ({ queues: { ...state.queues, [terminalId]: { ...q, tokens } } }))
    return token
  },

  removeTokenByPath: (terminalId, path) => {
    const q = get().queues[terminalId]
    if (!q?.tokens.length) return null
    const idx = q.tokens.findIndex((t) => t.path === path)
    if (idx === -1) return null
    const removed = q.tokens[idx]
    const tokens = [...q.tokens.slice(0, idx), ...q.tokens.slice(idx + 1)]
    set((state) => ({ queues: { ...state.queues, [terminalId]: { ...q, tokens } } }))
    return removed
  },

  getQueue: (terminalId) => get().queues[terminalId] ?? emptyQueue()
}))
