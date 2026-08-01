import { describe, expect, it } from 'vitest'
import type { TerminalOutputChunk, TerminalSnapshot } from '@shared/types'
import {
  toTerminalOutputPayload,
  toTerminalSnapshotPayload,
} from '../terminal-stream-compat'

const chunk: TerminalOutputChunk = {
  terminalId: 'term-1',
  streamEpoch: 'epoch-1',
  sequence: 42,
  data: 'payload',
}

const snapshot: TerminalSnapshot = {
  terminalId: 'term-1',
  streamEpoch: 'epoch-1',
  watermark: 42,
  ansi: 'snapshot',
  cols: 80,
  rows: 24,
  buffer: 'normal',
}

describe('terminal stream startup compatibility boundary', () => {
  it('preserves the sequenced contract by default', () => {
    expect(toTerminalOutputPayload(chunk, false)).toEqual(chunk)
    expect(toTerminalSnapshotPayload(snapshot, false)).toEqual(snapshot)
  })

  it('projects explicit legacy payloads for the startup escape hatch', () => {
    expect(toTerminalOutputPayload(chunk, true)).toEqual({
      terminalId: 'term-1',
      data: 'payload',
    })
    expect(toTerminalSnapshotPayload(snapshot, true)).toEqual({
      data: 'snapshot',
      cols: 80,
      rows: 24,
    })
  })
})
