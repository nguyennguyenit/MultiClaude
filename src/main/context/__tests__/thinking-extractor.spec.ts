import { describe, it, expect } from 'vitest'
import { ThinkingExtractor } from '../thinking-extractor'

describe('ThinkingExtractor', () => {
  it('extracts a thinking block from an assistant message', () => {
    const x = new ThinkingExtractor()
    x.recordAssistantBlocks(1, [
      { type: 'thinking', thinking: '', signature: 'EpECClkIDBgCKkBJbq9' }
    ], 1_000)
    x.flushTurn()
    const blocks = x.getBlocks()
    expect(blocks.length).toBe(1)
    expect(blocks[0].turnId).toBe(1)
    expect(blocks[0].count).toBe(1)
    expect(blocks[0].signatures[0]).toBe('EpECClkIDBgCKkBJ')
    expect(blocks[0]).not.toHaveProperty('approxTokens')
  })

  it('merges multiple thinking blocks within a turn', () => {
    const x = new ThinkingExtractor()
    x.recordAssistantBlocks(1, [
      { type: 'thinking', thinking: '', signature: 'aaaaaaaaaaaaaaaaXX' },
      { type: 'thinking', thinking: '', signature: 'bbbbbbbbbbbbbbbbYY' }
    ], 100)
    x.flushTurn()
    const blocks = x.getBlocks()
    expect(blocks.length).toBe(1)
    expect(blocks[0].count).toBe(2)
    expect(blocks[0].signatures).toEqual(['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'])
  })

  it('skips turns without thinking blocks', () => {
    const x = new ThinkingExtractor()
    x.recordAssistantBlocks(1, [{ type: 'text', text: 'hello' }], 100)
    x.flushTurn()
    expect(x.getBlocks()).toEqual([])
  })

  it('caps history at 30 entries (FIFO)', () => {
    const x = new ThinkingExtractor()
    for (let i = 1; i <= 40; i++) {
      x.recordAssistantBlocks(i, [{ type: 'thinking', thinking: '', signature: `s${i}________________` }], i * 1000)
      x.flushTurn()
    }
    const blocks = x.getBlocks()
    expect(blocks.length).toBe(30)
    expect(blocks[0].turnId).toBe(11)
    expect(blocks[29].turnId).toBe(40)
  })

  it('ignores malformed entries without throwing', () => {
    const x = new ThinkingExtractor()
    x.recordAssistantBlocks(1, [
      { type: 'thinking' }, // missing signature
      null,
      { type: 'thinking', signature: '' }
    ] as unknown[], 100)
    x.flushTurn()
    // No valid blocks → no entry recorded
    expect(x.getBlocks()).toEqual([])
  })
})
