import type {
  AgentCapabilities,
  AgentEvent,
  AgentProviderReadiness,
  ExternalSessionRef,
} from '@shared/types'
import type {
  AgentAdapter,
  AgentApprovalDecision,
  AgentLaunchContext,
  AgentSessionDescriptor,
} from '../agent-adapter'
import type {
  CodexInitializeResult,
  CodexNotificationEnvelope,
  CodexServerRequestEnvelope,
} from './codex-app-server-protocol'

export interface CodexAppServerPort {
  detect(): Promise<AgentProviderReadiness>
  connect(): Promise<CodexInitializeResult>
  startThread(cwd: string): Promise<string>
  resumeThread(threadId: string, cwd: string): Promise<string>
  startTurn(threadId: string, input: string): Promise<string>
  interruptTurn(threadId: string, turnId: string): Promise<void>
  respond(id: number | string, result: unknown): void
  close(reason?: Error): void
  on(event: 'notification', listener: (value: CodexNotificationEnvelope) => void): unknown
  on(event: 'serverRequest', listener: (value: CodexServerRequestEnvelope) => void): unknown
  off?(event: 'notification', listener: (value: CodexNotificationEnvelope) => void): unknown
  off?(event: 'serverRequest', listener: (value: CodexServerRequestEnvelope) => void): unknown
  on(event: 'exit', listener: (error: Error) => void): unknown
  off?(event: 'exit', listener: (error: Error) => void): unknown
}

export interface CodexAdapterOptions {
  now?: () => number
}

const CODEX_CAPABILITIES: AgentCapabilities = {
  send: true,
  interrupt: true,
  resume: true,
  approvals: true,
  contextUsage: 'exact',
  reasoningMetadata: true,
}

interface PendingApproval {
  requestId: number | string
  sessionId: string
  method: string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

type NormalizedCodexEvent = Pick<AgentEvent, 'type' | 'payload'>

function normalizeNotification(notification: CodexNotificationEnvelope): {
  sessionId?: string
  events: NormalizedCodexEvent[]
} {
  const params = asRecord(notification.params)
  const sessionId = typeof params?.threadId === 'string' ? params.threadId : undefined
  if (!params || !sessionId) return { events: [] }

  if (notification.method === 'thread/tokenUsage/updated') {
    const tokenUsage = asRecord(params.tokenUsage)
    const total = asRecord(tokenUsage?.total)
    const payload = {
      totalTokens: finiteNonNegative(total?.totalTokens),
      inputTokens: finiteNonNegative(total?.inputTokens),
      cachedInputTokens: finiteNonNegative(total?.cachedInputTokens),
      outputTokens: finiteNonNegative(total?.outputTokens),
      reasoningOutputTokens: finiteNonNegative(total?.reasoningOutputTokens),
      contextWindow: finiteNonNegative(tokenUsage?.modelContextWindow),
    }
    const available = Object.fromEntries(
      Object.entries(payload).filter((entry): entry is [string, number] => entry[1] !== undefined)
    )
    return available && Object.keys(available).length > 0
      ? { sessionId, events: [{ type: 'usage', payload: available }] }
      : { sessionId, events: [] }
  }

  if (notification.method === 'thread/compacted') {
    return {
      sessionId,
      events: [{ type: 'compaction', payload: { source: 'codex-app-server:thread/compacted' } }],
    }
  }

  if (notification.method === 'turn/started' || notification.method === 'turn/completed') {
    return {
      sessionId,
      events: [{
        type: 'status',
        payload: { status: notification.method === 'turn/started' ? 'running' : 'idle' },
      }],
    }
  }

  if (notification.method === 'item/started' || notification.method === 'item/completed') {
    const item = asRecord(params.item)
    const itemType = typeof item?.type === 'string' ? item.type : undefined
    const itemId = typeof item?.id === 'string' ? item.id : undefined
    if (itemType === 'contextCompaction' && notification.method === 'item/completed') {
      return {
        sessionId,
        events: [{ type: 'compaction', payload: { source: 'codex-app-server:item/contextCompaction' } }],
      }
    }
    if (itemType === 'reasoning' && notification.method === 'item/completed') {
      const summary = Array.isArray(item?.summary) ? item.summary : []
      const content = Array.isArray(item?.content) ? item.content : []
      return {
        sessionId,
        events: [{
          type: 'reasoning',
          payload: { summaryCount: Math.max(summary.length, content.length > 0 ? 1 : 0) },
        }],
      }
    }
    if (
      itemType === 'commandExecution'
      || itemType === 'fileChange'
      || itemType === 'mcpToolCall'
      || itemType === 'dynamicToolCall'
      || itemType === 'collabAgentToolCall'
    ) {
      const itemStatus = typeof item?.status === 'string' ? item.status : undefined
      const state = notification.method === 'item/started'
        ? 'started'
        : itemStatus === 'failed' || itemStatus === 'declined'
          ? 'failed'
          : 'completed'
      return {
        sessionId,
        events: [{
          type: 'tool-activity',
          payload: {
            toolName: itemType,
            state,
            ...(itemId ? { correlationId: itemId } : {}),
          },
        }],
      }
    }
  }

  return { sessionId, events: [] }
}

export class CodexAdapter implements AgentAdapter {
  readonly provider = 'codex' as const
  private readonly sessions = new Set<string>()
  private readonly activeTurnBySession = new Map<string, string>()
  private readonly nextSequenceBySession = new Map<string, number>()
  private readonly pendingApprovals = new Map<string, PendingApproval>()
  private readonly now: () => number

  constructor(
    private readonly client: CodexAppServerPort,
    options: CodexAdapterOptions = {}
  ) {
    this.now = options.now ?? Date.now
  }

  detect(): Promise<AgentProviderReadiness> {
    return this.client.detect()
  }

  capabilities(): AgentCapabilities {
    return { ...CODEX_CAPABILITIES }
  }

  async start(context: AgentLaunchContext): Promise<AgentSessionDescriptor> {
    const id = await this.client.startThread(context.cwd)
    this.sessions.add(id)
    return this.descriptor(id)
  }

  async resume(ref: ExternalSessionRef, context: AgentLaunchContext): Promise<AgentSessionDescriptor> {
    this.assertRef(ref)
    const id = await this.client.resumeThread(ref.id, context.cwd)
    this.sessions.add(id)
    return this.descriptor(id)
  }

  async send(ref: ExternalSessionRef, input: string): Promise<void> {
    this.requireSession(ref)
    const turnId = await this.client.startTurn(ref.id, input)
    this.activeTurnBySession.set(ref.id, turnId)
  }

  async interrupt(ref: ExternalSessionRef): Promise<void> {
    this.requireSession(ref)
    const turnId = this.activeTurnBySession.get(ref.id)
    if (!turnId) throw new Error(`Codex session ${ref.id} has no active turn`)
    await this.client.interruptTurn(ref.id, turnId)
  }

  subscribe(ref: ExternalSessionRef, listener: (event: AgentEvent) => void): () => void {
    this.requireSession(ref)
    const emit = (normalized: NormalizedCodexEvent) => {
      const sequence = this.nextSequenceBySession.get(ref.id) ?? 0
      this.nextSequenceBySession.set(ref.id, sequence + 1)
      listener({
        eventId: `codex:${ref.id}:${sequence}`,
        provider: 'codex',
        session: { ...ref },
        sequence,
        timestamp: this.now(),
        ...normalized,
      })
    }
    const onNotification = (notification: CodexNotificationEnvelope) => {
      const normalized = normalizeNotification(notification)
      if (normalized.sessionId !== ref.id) return
      if (notification.method === 'turn/completed') this.activeTurnBySession.delete(ref.id)
      for (const value of normalized.events) emit(value)
    }
    const onServerRequest = (request: CodexServerRequestEnvelope) => {
      const params = asRecord(request.params)
      if (params?.threadId !== ref.id) return
      if (
        request.method !== 'item/commandExecution/requestApproval'
        && request.method !== 'item/fileChange/requestApproval'
      ) return
      const approvalId = String(request.id)
      this.pendingApprovals.set(approvalId, {
        requestId: request.id,
        sessionId: ref.id,
        method: request.method,
      })
      emit({
        type: 'approval',
        payload: { approvalId, kind: request.method },
      })
    }
    const onExit = () => {
      if (!this.sessions.delete(ref.id)) return
      this.activeTurnBySession.delete(ref.id)
      for (const [approvalId, approval] of this.pendingApprovals) {
        if (approval.sessionId === ref.id) this.pendingApprovals.delete(approvalId)
      }
      emit({
        type: 'error',
        payload: { message: 'Codex App Server exited', recoverable: true },
      })
    }
    this.client.on('notification', onNotification)
    this.client.on('serverRequest', onServerRequest)
    this.client.on('exit', onExit)
    return () => {
      this.client.off?.('notification', onNotification)
      this.client.off?.('serverRequest', onServerRequest)
      this.client.off?.('exit', onExit)
    }
  }

  async approve(
    ref: ExternalSessionRef,
    approvalId: string,
    decision: AgentApprovalDecision
  ): Promise<void> {
    this.requireSession(ref)
    const approval = this.pendingApprovals.get(approvalId)
    if (!approval || approval.sessionId !== ref.id) throw new Error(`Unknown approval ${approvalId}`)
    const protocolDecision = decision === 'accept-for-session' ? 'acceptForSession' : decision
    this.client.respond(approval.requestId, { decision: protocolDecision })
    this.pendingApprovals.delete(approvalId)
  }

  async dispose(ref: ExternalSessionRef): Promise<void> {
    this.assertRef(ref)
    this.sessions.delete(ref.id)
    this.activeTurnBySession.delete(ref.id)
    this.nextSequenceBySession.delete(ref.id)
    for (const [approvalId, approval] of this.pendingApprovals) {
      if (approval.sessionId === ref.id) this.pendingApprovals.delete(approvalId)
    }
    if (this.sessions.size === 0) this.client.close()
  }

  private descriptor(id: string): AgentSessionDescriptor {
    if (!id) throw new Error('Codex App Server returned an empty thread id')
    return {
      ref: { provider: 'codex', id },
      status: 'idle',
      capabilities: this.capabilities(),
    }
  }

  private assertRef(ref: ExternalSessionRef): void {
    if (ref.provider !== 'codex' || !ref.id) throw new Error('Invalid Codex session reference')
  }

  private requireSession(ref: ExternalSessionRef): void {
    this.assertRef(ref)
    if (!this.sessions.has(ref.id)) throw new Error(`Codex session ${ref.id} is not attached`)
  }
}
