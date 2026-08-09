import { EventEmitter } from 'node:events'

import type {
  AgentEvent,
  AgentProvider,
  AgentProviderReadiness,
  AgentSessionBinding,
  ExternalSessionRef,
} from '@shared/types'
import type {
  AgentAdapter,
  AgentApprovalDecision,
  AgentLaunchContext,
  AgentSessionDescriptor,
} from './agent-adapter'

export type { AgentSessionBinding } from '@shared/types'

export interface StartAgentRequest extends AgentLaunchContext {
  provider: AgentProvider
  webContentsId: number
}

export interface ResumeAgentRequest extends AgentLaunchContext {
  session: ExternalSessionRef
  webContentsId: number
}

function sessionKey(ref: ExternalSessionRef): string {
  return `${ref.provider}:${ref.id}`
}

function assertSessionDescriptor(provider: AgentProvider, descriptor: AgentSessionDescriptor): void {
  if (descriptor.ref.provider !== provider || !descriptor.ref.id) {
    throw new Error(`Adapter ${provider} returned an invalid session reference`)
  }
}

function malformedEventReason(event: AgentEvent): string | undefined {
  if (!event || typeof event !== 'object') return 'malformed event'
  if (typeof event.eventId !== 'string' || event.eventId.length === 0) return 'malformed event id'
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) return 'malformed event sequence'
  if (!Number.isFinite(event.timestamp) || event.timestamp < 0) return 'malformed event timestamp'
  if (!event.payload || typeof event.payload !== 'object') return 'malformed event payload'
  if (event.type === 'status') {
    const status = (event.payload as Record<string, unknown>).status
    if (![
      'starting',
      'idle',
      'running',
      'waiting-approval',
      'completed',
      'failed',
      'disposed',
    ].includes(String(status))) return 'malformed event status'
  }
  return undefined
}

/** Owns managed provider sessions and their terminal/project/window authorization. */
export class AgentRegistry extends EventEmitter {
  private readonly adapters = new Map<AgentProvider, AgentAdapter>()
  private readonly bindingsByTerminal = new Map<string, AgentSessionBinding>()
  private readonly bindingsBySession = new Map<string, AgentSessionBinding>()
  private readonly unsubscribeBySession = new Map<string, () => void>()
  private readonly lastSequenceBySession = new Map<string, number>()
  private readonly eventIdsBySession = new Map<string, Set<string>>()
  private readonly operationReservations = new Set<string>()
  private readonly inFlightOperations = new Set<Promise<unknown>>()
  private readonly cancelledTerminals = new Set<string>()
  private disposed = false

  constructor(adapters: AgentAdapter[]) {
    super()
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.provider)) {
        throw new Error(`Duplicate adapter for provider ${adapter.provider}`)
      }
      this.adapters.set(adapter.provider, adapter)
    }
  }

  getAdapter(provider: AgentProvider): AgentAdapter | undefined {
    return this.adapters.get(provider)
  }

  getByTerminal(terminalId: string): AgentSessionBinding | undefined {
    return this.bindingsByTerminal.get(terminalId)
  }

  getBySession(ref: ExternalSessionRef): AgentSessionBinding | undefined {
    return this.bindingsBySession.get(sessionKey(ref))
  }

  resolveAuthorized(terminalId: string, webContentsId: number): AgentSessionBinding {
    const binding = this.bindingsByTerminal.get(terminalId)
    if (!binding) throw new Error(`No managed agent session for terminal ${terminalId}`)
    if (binding.webContentsId !== webContentsId) {
      throw new Error(`Window ${webContentsId} is not authorized for terminal ${terminalId}`)
    }
    return binding
  }

  async getReadiness(): Promise<Partial<Record<AgentProvider, AgentProviderReadiness>>> {
    const entries = await Promise.all(
      [...this.adapters.entries()].map(async ([provider, adapter]) => [provider, await adapter.detect()] as const)
    )
    return Object.fromEntries(entries)
  }

  async send(terminalId: string, webContentsId: number, input: string): Promise<void> {
    const binding = this.resolveAuthorized(terminalId, webContentsId)
    if (!binding.capabilities.send) throw new Error(`${binding.session.provider} does not support send`)
    await this.requireAdapter(binding.session.provider).send(binding.session, input)
  }

  async interrupt(terminalId: string, webContentsId: number): Promise<void> {
    const binding = this.resolveAuthorized(terminalId, webContentsId)
    if (!binding.capabilities.interrupt) {
      throw new Error(`${binding.session.provider} does not support interrupt`)
    }
    await this.requireAdapter(binding.session.provider).interrupt(binding.session)
  }

  async approve(
    terminalId: string,
    webContentsId: number,
    approvalId: string,
    decision: AgentApprovalDecision
  ): Promise<void> {
    const binding = this.resolveAuthorized(terminalId, webContentsId)
    if (!binding.capabilities.approvals) {
      throw new Error(`${binding.session.provider} does not support approvals`)
    }
    await this.requireAdapter(binding.session.provider).approve(binding.session, approvalId, decision)
  }

  async start(request: StartAgentRequest): Promise<AgentSessionBinding> {
    return this.withAgentReservation(request.terminalId, undefined, () => this.startReserved(request))
  }

  private async startReserved(request: StartAgentRequest): Promise<AgentSessionBinding> {
    this.assertTerminalAvailable(request.terminalId)
    const adapter = this.requireAdapter(request.provider)
    await this.requireManagedReady(adapter)
    this.assertOperationActive(request.terminalId)
    const descriptor = await adapter.start(request)
    let binding: AgentSessionBinding
    try {
      this.assertOperationActive(request.terminalId)
      assertSessionDescriptor(request.provider, descriptor)
      binding = this.attach({
        ...descriptor,
        terminalId: request.terminalId,
        projectId: request.projectId,
        webContentsId: request.webContentsId,
        session: descriptor.ref,
      })
    } catch (error) {
      await adapter.dispose(descriptor.ref).catch(() => undefined)
      throw error
    }
    this.ensureSubscription(adapter, binding.session)
    return binding
  }

  async resume(request: ResumeAgentRequest): Promise<AgentSessionBinding> {
    return this.withAgentReservation(request.terminalId, request.session, () => this.resumeReserved(request))
  }

  private async resumeReserved(request: ResumeAgentRequest): Promise<AgentSessionBinding> {
    this.assertTerminalAvailable(request.terminalId, request.session)
    const adapter = this.requireAdapter(request.session.provider)
    const wasAlreadyBound = Boolean(this.getBySession(request.session))
    await this.requireManagedReady(adapter)
    this.assertOperationActive(request.terminalId)
    const descriptor = await adapter.resume(request.session, request)
    let binding: AgentSessionBinding
    try {
      this.assertOperationActive(request.terminalId)
      assertSessionDescriptor(request.session.provider, descriptor)
      binding = this.attach({
        ...descriptor,
        terminalId: request.terminalId,
        projectId: request.projectId,
        webContentsId: request.webContentsId,
        session: descriptor.ref,
      })
    } catch (error) {
      if (wasAlreadyBound && (this.disposed || this.cancelledTerminals.has(request.terminalId))) {
        const existing = this.getBySession(request.session)
        if (existing) {
          await this.detach(existing.terminalId, { dispose: true })
        } else {
          await adapter.dispose(descriptor.ref).catch(() => undefined)
        }
      } else if (!wasAlreadyBound) {
        await adapter.dispose(descriptor.ref).catch(() => undefined)
      }
      throw error
    }
    this.ensureSubscription(adapter, binding.session)
    return binding
  }

  attach(binding: AgentSessionBinding): AgentSessionBinding {
    this.assertOperationActive(binding.terminalId)
    if (!binding.session.id) throw new Error('External session id is required')
    if (!Number.isSafeInteger(binding.webContentsId) || binding.webContentsId < 0) {
      throw new Error('webContentsId must be a non-negative integer')
    }

    const key = sessionKey(binding.session)
    const terminalOccupant = this.bindingsByTerminal.get(binding.terminalId)
    if (terminalOccupant && sessionKey(terminalOccupant.session) !== key) {
      throw new Error(`Terminal ${binding.terminalId} is already bound to another session`)
    }

    const previous = this.bindingsBySession.get(key)
    if (previous && previous.terminalId !== binding.terminalId) {
      this.bindingsByTerminal.delete(previous.terminalId)
    }

    const stored = { ...binding, session: { ...binding.session }, capabilities: { ...binding.capabilities } }
    this.bindingsByTerminal.set(stored.terminalId, stored)
    this.bindingsBySession.set(key, stored)
    if (previous && previous.terminalId !== stored.terminalId) {
      this.emit('bindingRemoved', previous)
    }
    this.emit('bindingChanged', stored)
    return stored
  }

  async detach(terminalId: string, options: { dispose?: boolean } = {}): Promise<boolean> {
    if (this.operationReservations.has(`terminal:${terminalId}`)) {
      this.cancelledTerminals.add(terminalId)
    }
    const binding = this.bindingsByTerminal.get(terminalId)
    if (!binding) return false
    const key = sessionKey(binding.session)
    this.bindingsByTerminal.delete(terminalId)
    this.bindingsBySession.delete(key)
    this.unsubscribeBySession.get(key)?.()
    this.unsubscribeBySession.delete(key)
    this.lastSequenceBySession.delete(key)
    this.eventIdsBySession.delete(key)
    if (options.dispose) await this.requireAdapter(binding.session.provider).dispose(binding.session)
    this.emit('bindingRemoved', binding)
    return true
  }

  async dispose(): Promise<void> {
    this.disposed = true
    for (const reservation of this.operationReservations) {
      if (reservation.startsWith('terminal:')) {
        this.cancelledTerminals.add(reservation.slice('terminal:'.length))
      }
    }
    await Promise.allSettled([...this.inFlightOperations])
    for (const terminalId of [...this.bindingsByTerminal.keys()]) {
      await this.detach(terminalId, { dispose: true })
    }
    this.removeAllListeners()
  }

  private requireAdapter(provider: AgentProvider): AgentAdapter {
    const adapter = this.adapters.get(provider)
    if (!adapter) throw new Error(`No adapter registered for provider ${provider}`)
    return adapter
  }

  private assertTerminalAvailable(terminalId: string, session?: ExternalSessionRef): void {
    this.assertOperationActive(terminalId)
    const occupant = this.bindingsByTerminal.get(terminalId)
    if (!occupant) return
    if (session && sessionKey(occupant.session) === sessionKey(session)) return
    throw new Error(`Terminal ${terminalId} is already bound to another session`)
  }

  private assertOperationActive(terminalId: string): void {
    if (this.disposed) throw new Error('Agent registry is disposed')
    if (this.cancelledTerminals.has(terminalId)) {
      throw new Error(`Agent operation was cancelled for terminal ${terminalId}`)
    }
  }

  private async withAgentReservation<T>(
    terminalId: string,
    session: ExternalSessionRef | undefined,
    operation: () => Promise<T>
  ): Promise<T> {
    const keys = [`terminal:${terminalId}`, ...(session ? [`session:${sessionKey(session)}`] : [])]
    this.assertOperationActive(terminalId)
    if (keys.some(key => this.operationReservations.has(key))) {
      throw new Error(`An agent operation is already in progress for terminal ${terminalId}`)
    }
    for (const key of keys) this.operationReservations.add(key)
    const running = operation()
    this.inFlightOperations.add(running)
    try {
      return await running
    } finally {
      this.inFlightOperations.delete(running)
      for (const key of keys) this.operationReservations.delete(key)
    }
  }

  private async requireManagedReady(adapter: AgentAdapter): Promise<void> {
    const readiness = await adapter.detect()
    if (readiness.status === 'ready') return
    const fallback = readiness.status === 'fallback' ? 'terminal fallback is required' : 'provider is unavailable'
    throw new Error(`${adapter.provider} managed mode is unavailable; ${fallback}${readiness.reason ? `: ${readiness.reason}` : ''}`)
  }

  private ensureSubscription(adapter: AgentAdapter, ref: ExternalSessionRef): void {
    const key = sessionKey(ref)
    if (this.unsubscribeBySession.has(key)) return
    const unsubscribe = adapter.subscribe(ref, event => this.acceptEvent(ref, event))
    this.unsubscribeBySession.set(key, unsubscribe)
  }

  private acceptEvent(expected: ExternalSessionRef, event: AgentEvent): void {
    const key = sessionKey(expected)
    const malformed = malformedEventReason(event)
    if (malformed) {
      this.emit('eventRejected', { session: expected, reason: malformed })
      return
    }
    if (
      event.provider !== expected.provider
      || event.session.provider !== expected.provider
      || event.session.id !== expected.id
    ) {
      this.emit('eventRejected', { session: expected, reason: 'event session/provider mismatch' })
      return
    }

    const seen = this.eventIdsBySession.get(key) ?? new Set<string>()
    const lastSequence = this.lastSequenceBySession.get(key) ?? -1
    if (seen.has(event.eventId) || event.sequence <= lastSequence) {
      this.emit('eventRejected', { session: expected, reason: 'duplicate or out-of-order event' })
      return
    }

    seen.add(event.eventId)
    if (seen.size > 4_096) {
      const oldest = seen.values().next().value
      if (oldest !== undefined) seen.delete(oldest)
    }
    this.eventIdsBySession.set(key, seen)
    this.lastSequenceBySession.set(key, event.sequence)
    const binding = this.bindingsBySession.get(key)
    const payload = event.payload as Record<string, unknown>
    const nextStatus = event.type === 'error'
      ? 'failed'
      : event.type === 'status' && typeof payload.status === 'string'
        ? payload.status
        : undefined
    if (binding && nextStatus) {
      const updated = { ...binding, status: nextStatus as AgentSessionBinding['status'] }
      this.bindingsBySession.set(key, updated)
      this.bindingsByTerminal.set(updated.terminalId, updated)
      this.emit('bindingChanged', updated)
    }
    this.emit('event', Object.freeze({ ...event, session: Object.freeze({ ...event.session }) }))
  }
}
