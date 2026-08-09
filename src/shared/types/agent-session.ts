import type { AgentCapabilities, AgentProvider } from './agent-provider'

export interface ExternalSessionRef {
  provider: AgentProvider
  id: string
}

export type AgentSessionStatus =
  | 'starting'
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'disposed'

export interface ManagedAgentSession {
  ref: ExternalSessionRef
  status: AgentSessionStatus
  capabilities: AgentCapabilities
}

/** Authorized attachment of one managed provider session to a terminal surface. */
export interface AgentSessionBinding {
  session: ExternalSessionRef
  terminalId: string
  projectId?: string
  webContentsId: number
  capabilities: AgentCapabilities
  status: AgentSessionStatus
}
