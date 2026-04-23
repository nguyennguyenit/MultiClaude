import { describe, it, expect } from 'vitest'
import { ContextMentionDetector } from '../context-mention-detector'

describe('ContextMentionDetector', () => {
  it('maps @path → subsequent Read result as mentioned', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('Please check @src/foo.ts for bugs')
    d.recordToolUse('id-1', 'Read', { file_path: '/abs/src/foo.ts' })
    expect(d.resolveToolResult('id-1')).toBe('mentioned')
  })

  it('leaves unrelated Reads as normal', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('check @README.md')
    d.recordToolUse('id-2', 'Read', { file_path: '/abs/src/unrelated.ts' })
    expect(d.resolveToolResult('id-2')).toBe('normal')
  })

  it('ignores non-Read tool uses', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('check @a.ts')
    d.recordToolUse('id-3', 'Bash', { command: 'ls' })
    expect(d.resolveToolResult('id-3')).toBe('normal')
  })

  it('consumes a mention after first match so re-Reads are normal', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('look at @a.ts')
    d.recordToolUse('id-a', 'Read', { file_path: '/proj/a.ts' })
    d.recordToolUse('id-b', 'Read', { file_path: '/proj/a.ts' })
    expect(d.resolveToolResult('id-a')).toBe('mentioned')
    expect(d.resolveToolResult('id-b')).toBe('normal')
  })

  it('evicts pending entries after 10min TTL', () => {
    const d = new ContextMentionDetector()
    const t0 = 1_000_000
    d.recordUserText('ping @x.ts', t0)
    expect(d._pendingSize(t0)).toBe(1)
    expect(d._pendingSize(t0 + 11 * 60_000)).toBe(0)
  })

  it('handles empty / missing text safely', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('')
    d.recordUserText('no mentions here')
    expect(d._pendingSize()).toBe(0)
  })

  it('strips trailing punctuation from mentions', () => {
    const d = new ContextMentionDetector()
    d.recordUserText('see @foo.ts, thanks')
    d.recordToolUse('id', 'Read', { file_path: '/p/foo.ts' })
    expect(d.resolveToolResult('id')).toBe('mentioned')
  })
})
