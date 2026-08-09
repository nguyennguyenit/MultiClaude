import type { AgentType, TerminalRendererPolicy } from '@shared/types'

export type DesiredTerminalRenderer = 'dom' | 'webgl'
export type RendererFallbackReason =
  | 'automatic-agent-safe'
  | 'policy-safe'
  | 'webgl-unavailable'
  | 'webgl-load-failed'
  | 'webgl-context-lost'

interface TerminalClassification {
  agentType?: AgentType
  isClaudeMode?: boolean
}

interface ResolveTerminalRendererInput extends TerminalClassification {
  policy: TerminalRendererPolicy
}

export interface ResolvedTerminalRenderer {
  desired: DesiredTerminalRenderer
  fallbackReason: RendererFallbackReason | null
}

export function isSafeAgentTerminal({
  agentType,
  isClaudeMode = false,
}: TerminalClassification): boolean {
  return isClaudeMode || agentType === 'claude' || agentType === 'codex'
}

export function resolveTerminalRenderer({
  policy,
  agentType,
  isClaudeMode,
}: ResolveTerminalRendererInput): ResolvedTerminalRenderer {
  if (policy === 'safe-dom') {
    return { desired: 'dom', fallbackReason: 'policy-safe' }
  }
  if (policy === 'automatic' && isSafeAgentTerminal({ agentType, isClaudeMode })) {
    return { desired: 'dom', fallbackReason: 'automatic-agent-safe' }
  }
  return { desired: 'webgl', fallbackReason: null }
}
