import type {
  TerminalOutputChunk,
  TerminalOutputPayload,
  TerminalSnapshot,
  TerminalSnapshotPayload,
} from '@shared/types'

export function toTerminalOutputPayload(
  chunk: TerminalOutputChunk,
  legacy: boolean
): TerminalOutputPayload {
  return legacy
    ? { terminalId: chunk.terminalId, data: chunk.data }
    : chunk
}

export function toTerminalSnapshotPayload(
  snapshot: TerminalSnapshot,
  legacy: boolean
): TerminalSnapshotPayload {
  return legacy
    ? { data: snapshot.ansi, cols: snapshot.cols, rows: snapshot.rows }
    : snapshot
}
