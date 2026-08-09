/** CLI identity inferred from terminal input/output. */
export type AgentType = 'claude' | 'codex' | 'gemini' | 'aider' | 'generic'

/** Managed provider identity. This is intentionally narrower than terminal AgentType. */
export type AgentProvider = 'claude' | 'codex'

export type AgentReadinessStatus = 'ready' | 'fallback' | 'unavailable'

export interface AgentProviderReadiness {
  status: AgentReadinessStatus
  version?: string
  reason?: string
}

export interface AgentCapabilities {
  send: boolean
  interrupt: boolean
  resume: boolean
  approvals: boolean
  contextUsage: 'exact' | 'estimated' | 'unavailable'
  reasoningMetadata: boolean
}

/** Maps terminal detection to managed providers without coercing unsupported CLIs. */
export function agentTypeToProvider(agentType: AgentType | undefined): AgentProvider | undefined {
  if (agentType === 'claude' || agentType === 'codex') return agentType
  return undefined
}
