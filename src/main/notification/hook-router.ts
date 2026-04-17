import type { HandlerResult } from './hook-server'
import type { ResponseStore } from './response-store'
import type { PendingQuestionStore } from './pending-question-store'
import type { PendingPermissionStore, PermissionDecision } from './pending-permission-store'
import type { AskUserQuestionPayload, AskUserQuestionOption } from '@shared/types'

export type HookRouterEvent =
  | 'taskComplete'
  | 'reviewNeeded'
  | 'permissionRequested'

export interface HookRouterOptions {
  responseStore: ResponseStore
  questionStore: PendingQuestionStore
  permissionStore: PendingPermissionStore
  resolveTerminalBySession: (sessionId: string) => string | undefined
  emit: (event: HookRouterEvent, payload: Record<string, unknown>) => void
  unknownSessionWaitMs?: number
  permissionTimeoutMs?: number
  logger?: (level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void
  /** Optional async git-diff collector (skips on non-git cwd, >1000 files, 10s cap). */
  collectGitDiff?: (cwd: string) => Promise<string | undefined>
}

const DEFAULT_UNKNOWN_WAIT = 2000
const DEFAULT_PERMISSION_TIMEOUT = 30_000

/**
 * Dispatches Claude Code hook HTTP calls to notification flow.
 *   Stop → response-store.put → emit('taskComplete')
 *   PreToolUse(AskUserQuestion) → pending-question-store → emit('reviewNeeded')
 *   PermissionRequest → holds HTTP connection until user allow/deny (or 30s timeout)
 */
export class HookRouter {
  private readonly opts: HookRouterOptions

  constructor(options: HookRouterOptions) {
    this.opts = options
  }

  async handle(event: string, payload: Record<string, unknown>): Promise<HandlerResult> {
    switch (event) {
      case 'stop':
        return this.handleStop(payload)
      case 'pre-tool-use':
        return this.handlePreToolUse(payload)
      case 'permission-request':
        return this.handlePermissionRequest(payload)
      default:
        this.log('info', 'hook-unknown-event', { event })
        return { status: 200 }
    }
  }

  private async handleStop(payload: Record<string, unknown>): Promise<HandlerResult> {
    const sessionId = stringField(payload, 'session_id')
    if (!sessionId) return { status: 200 }
    // Return 200 immediately; work happens async.
    void this.processStopAsync(sessionId, payload).catch((err) => {
      this.log('error', 'stop-async-failed', { err: (err as Error).message })
    })
    return { status: 200 }
  }

  private async processStopAsync(sessionId: string, payload: Record<string, unknown>): Promise<void> {
    const terminalId = await this.resolveTerminalWithQueue(sessionId)
    if (!terminalId) {
      this.log('info', 'stop-no-terminal', { sessionId })
      return
    }
    const summary = stringField(payload, 'last_assistant_message') ?? stringField(payload, 'summary')
    const cwd = stringField(payload, 'cwd')
    const responseId = await this.opts.responseStore.put({
      sessionId,
      terminalId,
      summary,
      lastAssistantMessage: summary,
      cwd
    })
    this.opts.emit('taskComplete', { responseId, sessionId, terminalId, cwd, summary })
    if (cwd && this.opts.collectGitDiff) {
      try {
        const diff = await this.opts.collectGitDiff(cwd)
        if (diff !== undefined) {
          await this.opts.responseStore.update(responseId, { gitDiff: diff })
        }
      } catch (err) {
        this.log('warn', 'git-diff-failed', { err: (err as Error).message })
      }
    }
  }

  private async handlePreToolUse(payload: Record<string, unknown>): Promise<HandlerResult> {
    const toolName = stringField(payload, 'tool_name')
    if (toolName !== 'AskUserQuestion') return { status: 200 }
    const sessionId = stringField(payload, 'session_id')
    if (!sessionId) return { status: 200 }
    const terminalId = await this.resolveTerminalWithQueue(sessionId)
    if (!terminalId) return { status: 200 }

    const input = (payload.tool_input as Record<string, unknown>) || {}
    const question = extractQuestion(input)
    this.opts.questionStore.put(terminalId, question)
    this.opts.emit('reviewNeeded', { sessionId, terminalId, question })
    return { status: 200 }
  }

  private async handlePermissionRequest(payload: Record<string, unknown>): Promise<HandlerResult> {
    const sessionId = stringField(payload, 'session_id') ?? ''
    const toolName = stringField(payload, 'tool_name') ?? 'unknown'
    const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}
    const terminalId = sessionId ? await this.resolveTerminalWithQueue(sessionId) : undefined

    const decision = await new Promise<PermissionDecision>((resolveP) => {
      const entry = this.opts.permissionStore.create({
        sessionId,
        terminalId,
        toolName,
        toolInput,
        resolve: resolveP
      })
      this.opts.emit('permissionRequested', { id: entry.id, sessionId, terminalId, toolName, toolInput })
      const timeoutMs = this.opts.permissionTimeoutMs ?? DEFAULT_PERMISSION_TIMEOUT
      const timer = setTimeout(() => {
        if (this.opts.permissionStore.resolve(entry.id, { behavior: 'deny', message: 'Auto-denied (timeout)' })) {
          // resolve already called by store
        }
      }, timeoutMs)
      // Cleanup: if resolved before timeout, cancel timer via micro-hook.
      const originalResolve = entry.resolve
      entry.resolve = (d) => {
        clearTimeout(timer)
        originalResolve(d)
      }
    })

    return {
      status: 200,
      body: {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision
        }
      }
    }
  }

  private async resolveTerminalWithQueue(sessionId: string): Promise<string | undefined> {
    const immediate = this.opts.resolveTerminalBySession(sessionId)
    if (immediate) return immediate
    const waitMs = this.opts.unknownSessionWaitMs ?? DEFAULT_UNKNOWN_WAIT
    const pollIntervalMs = Math.min(100, Math.max(10, Math.floor(waitMs / 20)))
    const deadline = Date.now() + waitMs
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs))
      const late = this.opts.resolveTerminalBySession(sessionId)
      if (late) return late
    }
    return undefined
  }

  private log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>): void {
    this.opts.logger?.(level, msg, meta)
  }
}

function stringField(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function extractQuestion(input: Record<string, unknown>): AskUserQuestionPayload {
  const rawOptions = Array.isArray(input.options) ? (input.options as unknown[]) : []
  const options: AskUserQuestionOption[] = []
  for (const o of rawOptions) {
    if (!o || typeof o !== 'object') continue
    const rec = o as Record<string, unknown>
    if (typeof rec.label !== 'string') continue
    const option: AskUserQuestionOption = { label: rec.label }
    if (typeof rec.description === 'string') option.description = rec.description
    options.push(option)
  }
  const textRaw = typeof input.question === 'string' ? input.question : typeof input.text === 'string' ? input.text : ''
  const header = typeof input.header === 'string' ? input.header : undefined
  const multiSelect = typeof input.multiSelect === 'boolean' ? input.multiSelect : false
  return { text: textRaw, header, multiSelect, options }
}
