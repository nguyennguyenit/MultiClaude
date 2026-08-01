export interface TerminalStreamCase {
  name: string
  chunks: readonly string[]
  expectedText: readonly string[]
}

/**
 * Redacted, deterministic byte-stream cases shared by the terminal contract
 * tests. Chunk boundaries intentionally split UTF-8 graphemes and CSI input.
 */
export const TERMINAL_STREAM_CASES: readonly TerminalStreamCase[] = [
  {
    name: 'plain output',
    chunks: ['alpha\r\n', 'beta\r\n'],
    expectedText: ['alpha', 'beta'],
  },
  {
    name: 'split unicode grapheme',
    chunks: ['status: caf', 'e\u0301 ', '✅\r\n'],
    expectedText: ['status: cafe\u0301 ✅'],
  },
  {
    name: 'split CSI cursor movement',
    chunks: ['progress: 10%', '\x1b[', '1Gprogress: 100%\r\n'],
    expectedText: ['progress: 100%'],
  },
  {
    name: 'rebuild tail marker',
    chunks: ['before-rebuild\r\n', 'during-rebuild\r\n', 'after-rebuild\r\n'],
    expectedText: ['before-rebuild', 'during-rebuild', 'after-rebuild'],
  },
]

export const SNAPSHOT_DUPLICATION_CASE = {
  beforeSnapshot: 'before-snapshot\r\n',
  crossesSnapshotBarrier: 'barrier-tail\r\n',
} as const
