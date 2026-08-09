import { describe, it, expect, beforeEach } from 'vitest'
import { useContextWindowStore } from './context-window-store'

describe('context-window-store', () => {
  beforeEach(() => {
    useContextWindowStore.setState({ isOpen: false })
  })

  it('starts closed', () => {
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('toggle flips isOpen', () => {
    useContextWindowStore.getState().toggle()
    expect(useContextWindowStore.getState().isOpen).toBe(true)
    useContextWindowStore.getState().toggle()
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('setOpen forces a specific value', () => {
    useContextWindowStore.getState().setOpen(true)
    expect(useContextWindowStore.getState().isOpen).toBe(true)
    useContextWindowStore.getState().setOpen(false)
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('keys insight snapshots by provider and session identity', () => {
    const state = useContextWindowStore.getState()
    const base = {
      updatedAt: 1,
      capabilities: {
        contextUsage: true,
        turnDeltas: false,
        toolActivity: false,
        compaction: false,
        reasoningMetadata: false,
      },
      usage: { availability: 'unknown', precision: 'not-applicable', confidence: 'low', source: 'test' },
      turnDeltas: { availability: 'unavailable', precision: 'not-applicable', confidence: 'high', source: 'test' },
      toolActivity: { availability: 'unavailable', precision: 'not-applicable', confidence: 'high', source: 'test' },
      reasoning: { availability: 'unavailable', precision: 'not-applicable', confidence: 'high', source: 'test' },
      compactions: { availability: 'unavailable', precision: 'not-applicable', confidence: 'high', source: 'test' },
    } as const
    state.setInsightSnapshot({ ...base, provider: 'claude', session: { provider: 'claude', id: 'same' } })
    state.setInsightSnapshot({ ...base, provider: 'codex', session: { provider: 'codex', id: 'same' } })

    expect(Object.keys(useContextWindowStore.getState().insightSnapshots).sort()).toEqual([
      'claude:same',
      'codex:same',
    ])
  })
})
