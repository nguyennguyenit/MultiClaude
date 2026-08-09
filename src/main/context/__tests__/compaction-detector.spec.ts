import { describe, it, expect } from 'vitest'
import { CompactionDetector } from '../compaction-detector'

describe('CompactionDetector', () => {
  it('emits a high-confidence event when an explicit summary line is observed', () => {
    const d = new CompactionDetector()
    d.recordTotalTokens(50_000, 1_000)
    const ev = d.recordLine({
      type: 'summary',
      summary: 'recap of prior turns…',
      timestamp: '2026-04-25T10:00:00Z'
    })
    expect(ev).not.toBeNull()
    expect(ev!.confidence).toBe('high')
    expect(ev!.source).toBe('summary')
    expect(ev!.observedTokens).toBe(50_000)
    expect(ev!.summary).toMatch(/recap of prior turns/)
  })

  it('does not treat user-authored marker text as an explicit signal', () => {
    const d = new CompactionDetector()
    d.recordTotalTokens(80_000, 1)
    const ev = d.recordLine({
      type: 'user',
      message: { content: '<compact>summary text</compact>' }
    })
    expect(ev).toBeNull()
    expect(d.getEvents()).toEqual([])
  })

  it('records an explicit compact boundary with its source', () => {
    const d = new CompactionDetector()
    const ev = d.recordLine({ subtype: 'compact_boundary', timestamp: 1_000 })
    expect(ev).toMatchObject({ confidence: 'high', source: 'compact-boundary' })
  })

  it('does not infer compaction from a sudden token drop', () => {
    const d = new CompactionDetector()
    d.recordTotalTokens(100_000, 1_000)
    const ev = d.recordTotalTokens(40_000, 2_000)
    expect(ev).toBeNull()
    expect(d.getEvents()).toEqual([])
  })

  it('does not treat /clear as a compaction signal', () => {
    const d = new CompactionDetector()
    d.recordTotalTokens(100_000, 1_000)
    expect(d.recordLine({ type: 'command_input', content: '/clear' })).toBeNull()
    expect(d.recordTotalTokens(0, 2_000)).toBeNull()
    expect(d.getEvents()).toEqual([])
  })

  it('does NOT flag the first sample (no before-state)', () => {
    const d = new CompactionDetector()
    const ev = d.recordTotalTokens(50_000, 1_000)
    expect(ev).toBeNull()
  })

  it('dedupes high-confidence signals within a 2s window', () => {
    const d = new CompactionDetector()
    d.recordTotalTokens(50_000, 1000)
    d.recordLine({ type: 'summary', summary: 'a', timestamp: '2026-04-25T10:00:00Z' })
    const dup = d.recordLine({ type: 'summary', summary: 'b', timestamp: '2026-04-25T10:00:01Z' })
    expect(dup).toBeNull()
    expect(d.getEvents().length).toBe(1)
  })

  it('caps history at 10 events (FIFO)', () => {
    const d = new CompactionDetector()
    for (let i = 0; i < 15; i++) {
      d.recordLine({ type: 'summary', summary: `summary ${i}`, timestamp: i * 5_000 })
    }
    expect(d.getEvents().length).toBe(10)
  })

  it('ignores unknown shapes without throwing', () => {
    const d = new CompactionDetector()
    expect(d.recordLine(null as unknown as object)).toBeNull()
    expect(d.recordLine({})).toBeNull()
    expect(d.recordLine({ type: 'random', foo: 'bar' })).toBeNull()
    expect(d.getEvents().length).toBe(0)
  })
})
