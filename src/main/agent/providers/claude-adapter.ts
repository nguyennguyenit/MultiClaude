import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'

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

const execFileAsync = promisify(execFile)
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/

export interface ClaudeTerminalRuntime {
  write(terminalId: string, data: string): boolean
  invokeClaudeCode(terminalId: string, sessionId?: string): boolean
}

interface ClaudeJsonlEvent {
  sessionId?: string
  line?: unknown
}

export interface ClaudeJsonlSource {
  on(event: 'jsonlLine', listener: (value: ClaudeJsonlEvent) => void): unknown
  off?(event: 'jsonlLine', listener: (value: ClaudeJsonlEvent) => void): unknown
}

export interface ClaudeAdapterOptions {
  runtime: ClaudeTerminalRuntime
  source: ClaudeJsonlSource
  createSessionId?: () => string
  detectVersion?: () => Promise<string>
  now?: () => number
}

const CLAUDE_CAPABILITIES: AgentCapabilities = {
  send: true,
  interrupt: true,
  resume: true,
  approvals: false,
  contextUsage: 'estimated',
  reasoningMetadata: true,
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

type NormalizedClaudeEvent = Pick<AgentEvent, 'type' | 'payload'>

function normalizeClaudeLine(line: unknown): NormalizedClaudeEvent[] {
  const record = asRecord(line)
  if (!record) return []
  if (record.type === 'system' && record.subtype === 'compact_boundary') {
    return [{ type: 'compaction', payload: { source: 'claude-jsonl:compact_boundary' } }]
  }

  const message = asRecord(record.message)
  const usage = asRecord(message?.usage)
  const inputTokens = nonNegativeNumber(usage?.input_tokens)
  const outputTokens = nonNegativeNumber(usage?.output_tokens)
  const events: NormalizedClaudeEvent[] = []
  if (inputTokens !== undefined || outputTokens !== undefined) {
    events.push({
      type: 'usage',
      payload: {
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
      },
    })
  }

  const content = message?.content
  if (Array.isArray(content)) {
    let reasoningCount = 0
    let hasOpaqueSignature = false
    for (const value of content) {
      const block = asRecord(value)
      if (!block) continue
      if (block.type === 'tool_use' && typeof block.name === 'string' && block.name) {
        events.push({
          type: 'tool-activity',
          payload: {
            toolName: block.name,
            state: 'started',
            ...(typeof block.id === 'string' ? { correlationId: block.id } : {}),
          },
        })
      }
      if (block.type === 'thinking' || block.type === 'redacted_thinking') {
        reasoningCount += 1
        if (typeof block.signature === 'string' && block.signature.length > 0) {
          hasOpaqueSignature = true
        }
      }
    }
    if (reasoningCount > 0) {
      events.push({
        type: 'reasoning',
        payload: { summaryCount: reasoningCount, hasOpaqueSignature },
      })
    }
  }
  return events
}

export class ClaudeAdapter implements AgentAdapter {
  readonly provider = 'claude' as const
  private readonly terminalBySession = new Map<string, string>()
  private readonly nextSequenceBySession = new Map<string, number>()
  private readonly createSessionId: () => string
  private readonly detectVersion: () => Promise<string>
  private readonly now: () => number

  constructor(private readonly options: ClaudeAdapterOptions) {
    this.createSessionId = options.createSessionId ?? randomUUID
    this.detectVersion = options.detectVersion ?? (async () => {
      const { stdout } = await execFileAsync('claude', ['--version'], { timeout: 5_000 })
      const match = stdout.match(/\d+\.\d+\.\d+/)
      if (!match) throw new Error('Claude version was not recognized')
      return match[0]
    })
    this.now = options.now ?? Date.now
  }

  async detect(): Promise<AgentProviderReadiness> {
    try {
      return { status: 'ready', version: await this.detectVersion() }
    } catch (error) {
      return {
        status: 'fallback',
        reason: `Managed Claude unavailable; terminal fallback remains available: ${(error as Error).message}`,
      }
    }
  }

  capabilities(): AgentCapabilities {
    return { ...CLAUDE_CAPABILITIES }
  }

  async start(context: AgentLaunchContext): Promise<AgentSessionDescriptor> {
    const sessionId = this.createSessionId()
    if (!SAFE_SESSION_ID.test(sessionId)) throw new Error('Generated Claude session id is invalid')
    if (!this.options.runtime.write(context.terminalId, `claude --session-id ${sessionId}\n`)) {
      throw new Error(`Failed to launch Claude in terminal ${context.terminalId}`)
    }
    this.terminalBySession.set(sessionId, context.terminalId)
    return this.descriptor(sessionId)
  }

  async resume(ref: ExternalSessionRef, context: AgentLaunchContext): Promise<AgentSessionDescriptor> {
    this.assertRef(ref)
    if (!this.options.runtime.invokeClaudeCode(context.terminalId, ref.id)) {
      throw new Error(`Failed to resume Claude session ${ref.id}`)
    }
    this.terminalBySession.set(ref.id, context.terminalId)
    return this.descriptor(ref.id)
  }

  async send(ref: ExternalSessionRef, input: string): Promise<void> {
    const terminalId = this.requireTerminal(ref)
    if (!this.options.runtime.write(terminalId, `${input}\n`)) {
      throw new Error(`Failed to send input to Claude session ${ref.id}`)
    }
  }

  async interrupt(ref: ExternalSessionRef): Promise<void> {
    const terminalId = this.requireTerminal(ref)
    if (!this.options.runtime.write(terminalId, '\u0003')) {
      throw new Error(`Failed to interrupt Claude session ${ref.id}`)
    }
  }

  subscribe(ref: ExternalSessionRef, listener: (event: AgentEvent) => void): () => void {
    this.assertRef(ref)
    const onLine = (value: ClaudeJsonlEvent) => {
      if (value.sessionId !== ref.id) return
      for (const normalized of normalizeClaudeLine(value.line)) {
        const sequence = this.nextSequenceBySession.get(ref.id) ?? 0
        this.nextSequenceBySession.set(ref.id, sequence + 1)
        listener({
          eventId: `claude:${ref.id}:${sequence}`,
          provider: 'claude',
          session: { ...ref },
          sequence,
          timestamp: this.now(),
          ...normalized,
        })
      }
    }
    this.options.source.on('jsonlLine', onLine)
    return () => this.options.source.off?.('jsonlLine', onLine)
  }

  async approve(
    _ref: ExternalSessionRef,
    _approvalId: string,
    _decision: AgentApprovalDecision
  ): Promise<void> {
    throw new Error('Managed Claude approvals are not supported by this adapter')
  }

  async dispose(ref: ExternalSessionRef): Promise<void> {
    this.assertRef(ref)
    this.terminalBySession.delete(ref.id)
    this.nextSequenceBySession.delete(ref.id)
  }

  private descriptor(id: string): AgentSessionDescriptor {
    return {
      ref: { provider: 'claude', id },
      status: 'idle',
      capabilities: this.capabilities(),
    }
  }

  private assertRef(ref: ExternalSessionRef): void {
    if (ref.provider !== 'claude' || !SAFE_SESSION_ID.test(ref.id)) {
      throw new Error('Invalid Claude session reference')
    }
  }

  private requireTerminal(ref: ExternalSessionRef): string {
    this.assertRef(ref)
    const terminalId = this.terminalBySession.get(ref.id)
    if (!terminalId) throw new Error(`Claude session ${ref.id} is not attached to a terminal`)
    return terminalId
  }
}
