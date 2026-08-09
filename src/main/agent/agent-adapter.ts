import type {
  AgentCapabilities,
  AgentEvent,
  AgentProvider,
  AgentProviderReadiness,
  AgentSessionStatus,
  ExternalSessionRef,
} from '@shared/types'

export interface AgentLaunchContext {
  terminalId: string
  projectId?: string
  cwd: string
}

export interface AgentSessionDescriptor {
  ref: ExternalSessionRef
  status: AgentSessionStatus
  capabilities: AgentCapabilities
}

export type AgentApprovalDecision = 'accept' | 'accept-for-session' | 'decline' | 'cancel'

export interface AgentAdapter {
  readonly provider: AgentProvider
  detect(): Promise<AgentProviderReadiness>
  capabilities(): AgentCapabilities
  start(context: AgentLaunchContext): Promise<AgentSessionDescriptor>
  resume(ref: ExternalSessionRef, context: AgentLaunchContext): Promise<AgentSessionDescriptor>
  send(ref: ExternalSessionRef, input: string): Promise<void>
  interrupt(ref: ExternalSessionRef): Promise<void>
  subscribe(ref: ExternalSessionRef, listener: (event: AgentEvent) => void): () => void
  approve(ref: ExternalSessionRef, approvalId: string, decision: AgentApprovalDecision): Promise<void>
  dispose(ref: ExternalSessionRef): Promise<void>
}
