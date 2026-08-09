import { EventEmitter } from 'node:events'

import type { AgentEvent, AgentInsightsSnapshot, AgentSessionBinding, ExternalSessionRef } from '@shared/types'
import type { AgentInsightsProjection } from './agent-insights-projection'
import { ClaudeInsightsProjection } from './projections/claude-insights-projection'
import { CodexInsightsProjection } from './projections/codex-insights-projection'

export interface AgentInsightsRegistryPort {
  on(event: 'bindingChanged', listener: (binding: AgentSessionBinding) => void): unknown
  on(event: 'bindingRemoved', listener: (binding: AgentSessionBinding) => void): unknown
  on(event: 'event', listener: (event: AgentEvent) => void): unknown
  off(event: 'bindingChanged', listener: (binding: AgentSessionBinding) => void): unknown
  off(event: 'bindingRemoved', listener: (binding: AgentSessionBinding) => void): unknown
  off(event: 'event', listener: (event: AgentEvent) => void): unknown
  resolveAuthorized(terminalId: string, webContentsId: number): AgentSessionBinding
  getBySession(session: ExternalSessionRef): AgentSessionBinding | undefined
}

function sessionKey(ref: ExternalSessionRef): string {
  return `${ref.provider}:${ref.id}`
}

export class AgentInsightsService extends EventEmitter {
  private readonly projections = new Map<string, AgentInsightsProjection>()
  private readonly advancedEnabled: boolean

  constructor(
    private readonly registry: AgentInsightsRegistryPort,
    options: { advancedEnabled?: boolean } = {}
  ) {
    super()
    this.advancedEnabled = options.advancedEnabled ?? true
    registry.on('bindingChanged', this.onBindingChanged)
    registry.on('bindingRemoved', this.onBindingRemoved)
    registry.on('event', this.onEvent)
  }

  getSnapshot(terminalId: string, webContentsId: number): AgentInsightsSnapshot | undefined {
    const binding = this.registry.resolveAuthorized(terminalId, webContentsId)
    return this.projections.get(sessionKey(binding.session))?.snapshot()
  }

  destroy(): void {
    this.registry.off('bindingChanged', this.onBindingChanged)
    this.registry.off('bindingRemoved', this.onBindingRemoved)
    this.registry.off('event', this.onEvent)
    for (const projection of this.projections.values()) projection.dispose()
    this.projections.clear()
    this.removeAllListeners()
  }

  private readonly onBindingChanged = (binding: AgentSessionBinding): void => {
    const key = sessionKey(binding.session)
    if (this.projections.has(key)) return
    const projection = binding.session.provider === 'claude'
      ? new ClaudeInsightsProjection(binding.session, this.advancedEnabled)
      : new CodexInsightsProjection(binding.session, this.advancedEnabled)
    this.projections.set(key, projection)
    this.emit('snapshot', { binding, snapshot: projection.snapshot() })
  }

  private readonly onBindingRemoved = (binding: AgentSessionBinding): void => {
    if (this.registry.getBySession(binding.session)) return
    const projection = this.projections.get(sessionKey(binding.session))
    projection?.dispose()
    this.projections.delete(sessionKey(binding.session))
  }

  private readonly onEvent = (event: AgentEvent): void => {
    const projection = this.projections.get(sessionKey(event.session))
    if (!projection) return
    try {
      projection.apply(event)
      this.emit('snapshot', { session: event.session, snapshot: projection.snapshot() })
    } catch (error) {
      this.emit('projectionError', { session: event.session, error })
    }
  }
}
