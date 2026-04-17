import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PendingQuestionStore } from '../pending-question-store'
import type { AskUserQuestionPayload } from '@shared/types'

const mkQuestion = (text: string, multiSelect = false): AskUserQuestionPayload => ({
  text,
  multiSelect,
  options: [{ label: 'A' }, { label: 'B' }]
})

describe('PendingQuestionStore', () => {
  let store: PendingQuestionStore

  beforeEach(() => {
    vi.useFakeTimers()
    store = new PendingQuestionStore({ ttlMs: 10 * 60 * 1000, maxEntries: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves by terminalId', () => {
    const q = mkQuestion('Q1')
    store.put('term-1', q)
    const entry = store.get('term-1')
    expect(entry?.question).toEqual(q)
  })

  it('returns undefined for unknown terminalId', () => {
    expect(store.get('unknown')).toBeUndefined()
  })

  it('expires entries after TTL on lazy cleanup in get()', () => {
    store.put('term-1', mkQuestion('Q'))
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(store.get('term-1')).toBeDefined()

    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(store.get('term-1')).toBeUndefined()
  })

  it('put overwrites existing entry for same terminalId', () => {
    store.put('term-1', mkQuestion('first'))
    store.put('term-1', mkQuestion('second'))
    expect(store.get('term-1')?.question.text).toBe('second')
    expect(store.size()).toBe(1)
  })

  it('evicts oldest when exceeding maxEntries (LRU by insertion)', () => {
    store.put('a', mkQuestion('qa'))
    store.put('b', mkQuestion('qb'))
    store.put('c', mkQuestion('qc'))
    store.put('d', mkQuestion('qd')) // triggers eviction of 'a'

    expect(store.get('a')).toBeUndefined()
    expect(store.get('b')).toBeDefined()
    expect(store.get('c')).toBeDefined()
    expect(store.get('d')).toBeDefined()
    expect(store.size()).toBe(3)
  })

  it('refreshes recency on get (LRU updates on access)', () => {
    store.put('a', mkQuestion('qa'))
    store.put('b', mkQuestion('qb'))
    store.put('c', mkQuestion('qc'))
    // access 'a' so it becomes most-recent
    store.get('a')
    store.put('d', mkQuestion('qd')) // evict LRU (now 'b')

    expect(store.get('a')).toBeDefined()
    expect(store.get('b')).toBeUndefined()
  })

  it('delete removes entry', () => {
    store.put('term-1', mkQuestion('Q'))
    const removed = store.delete('term-1')
    expect(removed).toBe(true)
    expect(store.get('term-1')).toBeUndefined()
  })

  it('delete returns false when entry absent', () => {
    expect(store.delete('missing')).toBe(false)
  })

  it('clear empties the store', () => {
    store.put('a', mkQuestion('qa'))
    store.put('b', mkQuestion('qb'))
    store.clear()
    expect(store.size()).toBe(0)
    expect(store.get('a')).toBeUndefined()
  })

  it('tracks selected indices for multiSelect questions', () => {
    store.put('term-1', mkQuestion('pick many', true))
    store.toggleSelection('term-1', 0)
    store.toggleSelection('term-1', 1)
    store.toggleSelection('term-1', 0) // toggles off
    const entry = store.get('term-1')
    expect(entry?.selected).toEqual(new Set([1]))
  })

  it('toggleSelection is a no-op for non-multiSelect questions', () => {
    store.put('term-1', mkQuestion('single', false))
    store.toggleSelection('term-1', 0)
    const entry = store.get('term-1')
    expect(entry?.selected.size ?? 0).toBe(0)
  })

  it('toggleSelection tolerates missing terminalId', () => {
    expect(() => store.toggleSelection('ghost', 0)).not.toThrow()
  })

  describe('questionId', () => {
    it('each put() generates a unique questionId', () => {
      store.put('t1', mkQuestion('Q1'))
      const first = store.get('t1')?.questionId
      store.put('t1', mkQuestion('Q2'))
      const second = store.get('t1')?.questionId
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      expect(first).not.toBe(second)
    })

    it('questionId format is 4+ alphanumeric chars', () => {
      store.put('t1', mkQuestion('Q'))
      expect(store.get('t1')?.questionId).toMatch(/^[a-z0-9]{4,}$/)
    })

    it('getByQuestionId returns entry only when id matches stored entry', () => {
      store.put('t1', mkQuestion('Q1'))
      const qid = store.get('t1')!.questionId
      expect(store.getByQuestionId('t1', qid)).toBeDefined()

      // Overwrite with a new question → old qid no longer resolves
      store.put('t1', mkQuestion('Q2'))
      expect(store.getByQuestionId('t1', qid)).toBeUndefined()
    })
  })
})
