import { describe, expect, it } from 'vitest'

import { agentTypeToProvider } from '../agent-provider'

describe('agentTypeToProvider', () => {
  it.each([
    ['claude', 'claude'],
    ['codex', 'codex'],
    ['gemini', undefined],
    ['aider', undefined],
    ['generic', undefined],
    [undefined, undefined],
  ] as const)('maps terminal detector %s without inventing managed parity', (agentType, provider) => {
    expect(agentTypeToProvider(agentType)).toBe(provider)
  })
})
