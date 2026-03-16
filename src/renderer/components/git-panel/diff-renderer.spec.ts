import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from './diff-renderer'

describe('parseUnifiedDiff', () => {
  it('tracks summary counts and line numbers for unified hunks', () => {
    const diff = [
      'diff --git a/src/example.ts b/src/example.ts',
      'index 1234567..89abcde 100644',
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -10,3 +10,4 @@ export function demo() {',
      ' const value = 1',
      '-return value',
      '+const nextValue = value + 1',
      '+return nextValue',
      ' }'
    ].join('\n')

    const parsed = parseUnifiedDiff(diff)

    expect(parsed.summary).toEqual({
      additions: 2,
      deletions: 1,
      hunks: 1,
      files: 1
    })

    const contentLines = parsed.lines.filter(line => ['context', 'addition', 'deletion'].includes(line.kind))

    expect(contentLines).toEqual([
      expect.objectContaining({ kind: 'context', oldLineNumber: 10, newLineNumber: 10, display: 'const value = 1' }),
      expect.objectContaining({ kind: 'deletion', oldLineNumber: 11, newLineNumber: null, display: 'return value' }),
      expect.objectContaining({ kind: 'addition', oldLineNumber: null, newLineNumber: 11, display: 'const nextValue = value + 1' }),
      expect.objectContaining({ kind: 'addition', oldLineNumber: null, newLineNumber: 12, display: 'return nextValue' }),
      expect.objectContaining({ kind: 'context', oldLineNumber: 12, newLineNumber: 13, display: '}' })
    ])
  })

  it('handles file additions that start from line zero', () => {
    const diff = [
      'diff --git a/new-file.ts b/new-file.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new-file.ts',
      '@@ -0,0 +1,2 @@',
      '+first line',
      '+second line'
    ].join('\n')

    const parsed = parseUnifiedDiff(diff)
    const additions = parsed.lines.filter(line => line.kind === 'addition')

    expect(additions).toEqual([
      expect.objectContaining({ oldLineNumber: null, newLineNumber: 1, display: 'first line' }),
      expect.objectContaining({ oldLineNumber: null, newLineNumber: 2, display: 'second line' })
    ])
  })
})
