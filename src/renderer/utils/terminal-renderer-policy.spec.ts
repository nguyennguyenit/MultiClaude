import { describe, expect, it } from 'vitest'
import type { AgentType } from '@shared/types'
import {
  isSafeAgentTerminal,
  resolveTerminalRenderer,
} from './terminal-renderer-policy'

describe('terminal renderer policy', () => {
  it.each([
    [undefined, false, false],
    ['generic', false, false],
    ['gemini', false, false],
    ['aider', false, false],
    ['claude', false, true],
    ['codex', false, true],
    ['generic', true, true],
  ] as const)(
    'classifies agent=%s legacyClaude=%s as safe=%s',
    (agentType, isClaudeMode, expected) => {
      expect(isSafeAgentTerminal({ agentType, isClaudeMode })).toBe(expected)
    },
  )

  it.each([
    ['automatic', 'generic', false, 'webgl', null],
    ['automatic', 'gemini', false, 'webgl', null],
    ['automatic', 'aider', false, 'webgl', null],
    ['automatic', undefined, false, 'webgl', null],
    ['automatic', 'claude', false, 'dom', 'automatic-agent-safe'],
    ['automatic', 'codex', false, 'dom', 'automatic-agent-safe'],
    ['automatic', 'generic', true, 'dom', 'automatic-agent-safe'],
    ['prefer-gpu', 'claude', false, 'webgl', null],
    ['prefer-gpu', 'codex', false, 'webgl', null],
    ['prefer-gpu', 'generic', true, 'webgl', null],
    ['safe-dom', 'generic', false, 'dom', 'policy-safe'],
    ['safe-dom', 'claude', false, 'dom', 'policy-safe'],
    ['safe-dom', 'codex', false, 'dom', 'policy-safe'],
  ] as const)(
    'resolves %s agent=%s legacyClaude=%s to %s/%s',
    (policy, agentType, isClaudeMode, desired, fallbackReason) => {
      expect(resolveTerminalRenderer({ policy, agentType, isClaudeMode })).toEqual({
        desired,
        fallbackReason,
      })
    },
  )

  it('covers every declared agent type under every policy', () => {
    const agentTypes: AgentType[] = ['claude', 'codex', 'gemini', 'aider', 'generic']
    const policies = ['automatic', 'prefer-gpu', 'safe-dom'] as const

    for (const policy of policies) {
      for (const agentType of agentTypes) {
        expect(resolveTerminalRenderer({ policy, agentType, isClaudeMode: false }).desired)
          .toMatch(/^(dom|webgl)$/)
      }
    }
  })
})
