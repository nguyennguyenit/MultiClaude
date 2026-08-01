export interface TerminalOutputChunk {
  terminalId: string
  streamEpoch: string
  sequence: number
  data: string
}

export interface LegacyTerminalOutputChunk {
  terminalId: string
  data: string
}

export interface TerminalSnapshot {
  terminalId: string
  streamEpoch: string
  watermark: number
  ansi: string
  cols: number
  rows: number
  buffer: 'normal' | 'alternate'
}

export interface LegacyTerminalSnapshot {
  data: string
  cols: number
  rows: number
}

export type TerminalOutputPayload = TerminalOutputChunk | LegacyTerminalOutputChunk
export type TerminalSnapshotPayload = TerminalSnapshot | LegacyTerminalSnapshot

export type TerminalStreamRecoveryReason = 'gap' | 'overflow' | 'epoch'

/** Privacy-safe runtime metadata used by the Diagnostics settings surface. */
export interface TerminalPlatformDiagnostic {
  terminalId: string
  provider: import('./agent-provider').AgentProvider | null
  engine: import('./index').TerminalEngine
  backend: 'xterm-headless' | 'unavailable'
  backendAvailable: boolean
  lastSequence: number
  watermark: number
  fallbackReason: string | null
}
