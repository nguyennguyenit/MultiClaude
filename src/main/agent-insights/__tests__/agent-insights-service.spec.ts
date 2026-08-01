import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'

import type { AgentEvent, AgentSessionBinding } from '@shared/types'
import { AgentInsightsService } from '../agent-insights-service'

class RegistryDouble extends EventEmitter {
  binding?: AgentSessionBinding

  resolveAuthorized(terminalId: string, webContentsId: number): AgentSessionBinding {
    if (!this.binding || this.binding.terminalId !== terminalId || this.binding.webContentsId !== webContentsId) {
      throw new Error('not authorized')
    }
    return this.binding
  }

  getBySession(): AgentSessionBinding | undefined {
    return this.binding
  }
}

function binding(provider: 'claude' | 'codex', id: string): AgentSessionBinding {
  return {
    session: { provider, id },
    terminalId: `${provider}-terminal`,
    webContentsId: 7,
    capabilities: {
      send: true,
      interrupt: true,
      resume: true,
      approvals: provider === 'codex',
      contextUsage: provider === 'codex' ? 'exact' : 'estimated',
      reasoningMetadata: true,
    },
    status: 'idle',
  }
}

describe('AgentInsightsService', () => {
  it('isolates same-looking ids by provider and authorizes terminal/window lookup', () => {
    const registry = new RegistryDouble()
    const service = new AgentInsightsService(registry)
    const claude = binding('claude', 'same-id')
    const codex = binding('codex', 'same-id')
    registry.emit('bindingChanged', claude)
    registry.emit('bindingChanged', codex)
    registry.emit('event', {
      eventId: 'codex:1',
      provider: 'codex',
      session: codex.session,
      sequence: 1,
      timestamp: 1,
      type: 'usage',
      payload: { totalTokens: 9 },
    } satisfies AgentEvent)

    registry.binding = codex
    expect(service.getSnapshot(codex.terminalId, 7)?.usage.value).toEqual({ totalTokens: 9 })
    expect(() => service.getSnapshot(codex.terminalId, 8)).toThrow(/not authorized/i)
    registry.binding = claude
    expect(service.getSnapshot(claude.terminalId, 7)?.usage.value).toBeUndefined()
  })

  it('drops cached data when the registry removes a binding', () => {
    const registry = new RegistryDouble()
    const service = new AgentInsightsService(registry)
    const codex = binding('codex', 'thread-1')
    registry.binding = codex
    registry.emit('bindingChanged', codex)
    expect(service.getSnapshot(codex.terminalId, 7)).toBeDefined()
    registry.emit('event', {
      eventId: 'codex:1',
      provider: 'codex',
      session: codex.session,
      sequence: 1,
      timestamp: 1,
      type: 'usage',
      payload: { totalTokens: 9 },
    } satisfies AgentEvent)

    registry.binding = undefined
    registry.emit('bindingRemoved', codex)
    registry.binding = codex
    registry.emit('bindingChanged', codex)
    expect(service.getSnapshot(codex.terminalId, 7)?.usage.value).toBeUndefined()
  })

  it('preserves accumulated projection data when the registry rebinds a live session', () => {
    const registry = new RegistryDouble()
    const service = new AgentInsightsService(registry)
    const first = binding('codex', 'thread-1')
    registry.binding = first
    registry.emit('bindingChanged', first)
    registry.emit('event', {
      eventId: 'codex:1',
      provider: 'codex',
      session: first.session,
      sequence: 1,
      timestamp: 1,
      type: 'usage',
      payload: { totalTokens: 9 },
    } satisfies AgentEvent)

    const rebound = { ...first, terminalId: 'terminal-2' }
    registry.binding = rebound
    registry.emit('bindingRemoved', first)
    registry.emit('bindingChanged', rebound)

    expect(service.getSnapshot('terminal-2', 7)?.usage.value).toEqual({ totalTokens: 9 })
  })
})
