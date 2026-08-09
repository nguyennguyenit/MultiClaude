import { describe, it, expect } from 'vitest'
import { TurnDeltaTracker } from '../turn-delta-tracker'

describe('TurnDeltaTracker', () => {
  it('produces a single-turn summary covering all categories with non-zero items', () => {
    const t = new TurnDeltaTracker()
    t.recordItem(1, 'claude-md', { label: 'CLAUDE.md', tokens: 50, content: 'rules' })
    t.recordItem(1, 'user-messages', { label: 'user', tokens: 10, content: 'hi' })
    t.recordItem(1, 'tool-output', { label: 'Bash:ls', tokens: 30, content: 'a\nb\nc' })
    t.closeTurn(1, 1000)

    const summary = t.getSummaries()
    expect(summary.length).toBe(1)
    expect(summary[0].turnId).toBe(1)
    expect(summary[0].totalDelta).toBe(90)
    expect(summary[0].perCategoryTokens['claude-md']).toBe(50)
    expect(summary[0].perCategoryTokens['user-messages']).toBe(10)
    expect(summary[0].perCategoryTokens['tool-output']).toBe(30)
  })

  it("does not double-count repeated content across turns (content-hash dedup)", () => {
    const t = new TurnDeltaTracker()
    // turn 1: CLAUDE.md ingested
    t.recordItem(1, 'claude-md', { label: 'CLAUDE.md', tokens: 100, content: 'project rules' })
    t.closeTurn(1, 1000)
    // turn 2: user message new
    t.recordItem(2, 'user-messages', { label: 'user', tokens: 5, content: 'hello' })
    t.closeTurn(2, 2000)
    // turn 3: same CLAUDE.md re-injected — must dedup to 0
    t.recordItem(3, 'claude-md', { label: 'CLAUDE.md', tokens: 100, content: 'project rules' })
    t.closeTurn(3, 3000)

    const sums = t.getSummaries()
    expect(sums[0].totalDelta).toBe(100)
    expect(sums[1].totalDelta).toBe(5)
    expect(sums[2].totalDelta).toBe(0)
    expect(sums[2].perCategoryTokens['claude-md']).toBe(0)
  })

  it('evicts oldest summary at FIFO cap (50)', () => {
    const t = new TurnDeltaTracker()
    for (let i = 1; i <= 60; i++) {
      // Use unique content to avoid dedup
      t.recordItem(i, 'user-messages', { label: `u${i}`, tokens: 1, content: `msg-${i}` })
      t.closeTurn(i, 1000 + i)
    }
    const sums = t.getSummaries()
    expect(sums.length).toBe(50)
    expect(sums[0].turnId).toBe(11)
    expect(sums[49].turnId).toBe(60)
  })

  it('looks up detail by turnId', () => {
    const t = new TurnDeltaTracker()
    t.recordItem(7, 'tool-output', { label: 'Bash:ls', tokens: 20, content: 'output-a' })
    t.recordItem(7, 'tool-output', { label: 'Bash:cat', tokens: 30, content: 'output-b' })
    t.closeTurn(7, 5000)

    const detail = t.getDetail(7)
    expect(detail).not.toBeNull()
    expect(detail!.turnId).toBe(7)
    const items = detail!.byCategory['tool-output'].items
    expect(items.length).toBe(2)
    expect(items[0].contentHash).toMatch(/^[0-9a-f]{16}$/)
    expect(items[0].contentHash).not.toBe(items[1].contentHash)
  })

  it('returns null detail for evicted turnId', () => {
    const t = new TurnDeltaTracker()
    for (let i = 1; i <= 60; i++) {
      t.recordItem(i, 'user-messages', { label: `u${i}`, tokens: 1, content: `m-${i}` })
      t.closeTurn(i, i)
    }
    expect(t.getDetail(1)).toBeNull()
    expect(t.getDetail(60)).not.toBeNull()
  })

  it('skips empty turns (closeTurn with no recorded items emits zero summary)', () => {
    const t = new TurnDeltaTracker()
    t.closeTurn(1, 100)
    const sums = t.getSummaries()
    expect(sums.length).toBe(1)
    expect(sums[0].totalDelta).toBe(0)
  })

  it('coalesces repeated identical items within the same turn (dedup)', () => {
    const t = new TurnDeltaTracker()
    t.recordItem(1, 'tool-output', { label: 'Bash:ls', tokens: 20, content: 'same-output' })
    t.recordItem(1, 'tool-output', { label: 'Bash:ls', tokens: 20, content: 'same-output' })
    t.closeTurn(1, 100)
    expect(t.getSummaries()[0].totalDelta).toBe(20)
    expect(t.getDetail(1)!.byCategory['tool-output'].items.length).toBe(1)
  })
})
