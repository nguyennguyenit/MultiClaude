import { spawn, execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'

import type { AgentProviderReadiness } from '@shared/types'
import {
  PINNED_CODEX_APP_SERVER_VERSION,
  type CodexClientRequestEnvelope,
  type CodexClientRequestMethod,
  type CodexInitializeResult,
  type CodexNotificationEnvelope,
  type CodexResponseEnvelope,
  type CodexServerRequestEnvelope,
} from './codex-app-server-protocol'

const execFileAsync = promisify(execFile)

export interface CodexAppServerTransport {
  write(message: string): void
  onData(listener: (data: string) => void): () => void
  onExit(listener: (error?: Error) => void): () => void
  close(): void
}

class StdioCodexTransport implements CodexAppServerTransport {
  private readonly child = spawn('codex', ['app-server', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  private readonly dataListeners = new Set<(data: string) => void>()
  private readonly exitListeners = new Set<(error?: Error) => void>()
  private stderrTail = ''
  private closed = false

  constructor() {
    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', (data: string) => {
      for (const listener of this.dataListeners) listener(data)
    })
    this.child.stderr.on('data', (data: string) => {
      this.stderrTail = `${this.stderrTail}${data}`.slice(-2_000)
    })
    this.child.once('error', error => this.notifyExit(error))
    this.child.once('exit', (code, signal) => {
      const detail = this.stderrTail.trim()
      this.notifyExit(new Error(
        `Codex App Server exited (${signal ?? code ?? 'unknown'})${detail ? `: ${detail}` : ''}`
      ))
    })
  }

  write(message: string): void {
    if (this.closed || !this.child.stdin.writable) throw new Error('Codex App Server stdin is closed')
    this.child.stdin.write(message)
  }

  onData(listener: (data: string) => void): () => void {
    this.dataListeners.add(listener)
    return () => this.dataListeners.delete(listener)
  }

  onExit(listener: (error?: Error) => void): () => void {
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.child.stdin.end()
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill()
  }

  private notifyExit(error?: Error): void {
    if (this.closed) return
    this.closed = true
    for (const listener of this.exitListeners) listener(error)
  }
}

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: Error): void
  timer: NodeJS.Timeout
}

export interface CodexAppServerClientOptions {
  createTransport?: () => CodexAppServerTransport
  detectVersion?: () => Promise<string>
  requestTimeoutMs?: number
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(left: string, right: string): number | undefined {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return undefined
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function responseId(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : undefined
}

/** Minimal JSON-lines client for the pinned non-experimental App Server surface. */
export class CodexAppServerClient extends EventEmitter {
  private readonly createTransport: () => CodexAppServerTransport
  private readonly detectVersion: () => Promise<string>
  private readonly requestTimeoutMs: number
  private readonly pending = new Map<string, PendingRequest>()
  private transport?: CodexAppServerTransport
  private nextRequestId = 1
  private buffer = ''
  private connected = false
  private connectPromise?: Promise<CodexInitializeResult>
  private removeDataListener?: () => void
  private removeExitListener?: () => void

  constructor(options: CodexAppServerClientOptions = {}) {
    super()
    this.createTransport = options.createTransport ?? (() => new StdioCodexTransport())
    this.detectVersion = options.detectVersion ?? (async () => {
      const { stdout } = await execFileAsync('codex', ['--version'], { timeout: 5_000 })
      const version = parseVersion(stdout)
      if (!version) throw new Error('Codex version was not recognized')
      return version.join('.')
    })
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000
  }

  async detect(): Promise<AgentProviderReadiness> {
    try {
      const version = await this.detectVersion()
      const comparison = compareVersions(version, PINNED_CODEX_APP_SERVER_VERSION)
      if (comparison === undefined || comparison < 0) {
        return {
          status: 'fallback',
          version,
          reason: `Managed Codex requires Codex ${PINNED_CODEX_APP_SERVER_VERSION} or newer`,
        }
      }
      return { status: 'ready', version }
    } catch (error) {
      return {
        status: 'fallback',
        reason: `Managed Codex unavailable; PTY fallback remains available: ${(error as Error).message}`,
      }
    }
  }

  async connect(): Promise<CodexInitializeResult> {
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = this.connectInternal()
    return this.connectPromise
  }

  async startThread(cwd: string): Promise<string> {
    await this.connect()
    const result = asRecord(await this.request('thread/start', { cwd }))
    const thread = asRecord(result?.thread)
    if (typeof thread?.id !== 'string' || !thread.id) throw new Error('Invalid thread/start response')
    return thread.id
  }

  async resumeThread(threadId: string, cwd: string): Promise<string> {
    await this.connect()
    const result = asRecord(await this.request('thread/resume', { threadId, cwd }))
    const thread = asRecord(result?.thread)
    if (typeof thread?.id !== 'string' || thread.id !== threadId) {
      throw new Error('Invalid thread/resume response')
    }
    return thread.id
  }

  async startTurn(threadId: string, input: string): Promise<string> {
    await this.connect()
    const result = asRecord(await this.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: input, text_elements: [] }],
    }))
    const turn = asRecord(result?.turn)
    if (typeof turn?.id !== 'string' || !turn.id) throw new Error('Invalid turn/start response')
    return turn.id
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.connect()
    await this.request('turn/interrupt', { threadId, turnId })
  }

  respond(id: number | string, result: unknown): void {
    this.requireTransport().write(`${JSON.stringify({ id, result })}\n`)
  }

  close(reason = new Error('Codex App Server client closed')): void {
    this.connected = false
    this.connectPromise = undefined
    this.removeDataListener?.()
    this.removeExitListener?.()
    this.removeDataListener = undefined
    this.removeExitListener = undefined
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.reject(reason)
    }
    this.pending.clear()
    this.transport?.close()
    this.transport = undefined
    this.buffer = ''
  }

  private async connectInternal(): Promise<CodexInitializeResult> {
    const readiness = await this.detect()
    if (readiness.status !== 'ready') throw new Error(readiness.reason ?? 'Managed Codex is unavailable')
    this.transport = this.createTransport()
    this.removeDataListener = this.transport.onData(data => this.acceptData(data))
    this.removeExitListener = this.transport.onExit(error => {
      const cause = error ?? new Error('Codex App Server exited')
      this.emit('exit', cause)
      this.close(cause)
    })
    try {
      const result = asRecord(await this.request('initialize', {
        clientInfo: { name: 'multiclaude', title: 'MultiClaude', version: '3.5.5' },
        capabilities: null,
      }))
      if (
        typeof result?.userAgent !== 'string'
        || typeof result.codexHome !== 'string'
        || typeof result.platformFamily !== 'string'
        || typeof result.platformOs !== 'string'
      ) {
        throw new Error('Invalid initialize response')
      }
      this.transport.write(`${JSON.stringify({ method: 'initialized' })}\n`)
      this.connected = true
      return result as unknown as CodexInitializeResult
    } catch (error) {
      this.close(error as Error)
      throw error
    }
  }

  private request(method: CodexClientRequestMethod, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextRequestId
    this.nextRequestId += 1
    const envelope: CodexClientRequestEnvelope = { id, method, params }
    const transport = this.requireTransport()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id))
        reject(new Error(`${method} request timed out`))
      }, this.requestTimeoutMs)
      timer.unref?.()
      this.pending.set(String(id), { resolve, reject, timer })
      try {
        transport.write(`${JSON.stringify(envelope)}\n`)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(String(id))
        reject(error as Error)
      }
    })
  }

  private requireTransport(): CodexAppServerTransport {
    if (!this.transport) throw new Error('Codex App Server is not connected')
    return this.transport
  }

  private acceptData(data: string): void {
    this.buffer += data
    let newline = this.buffer.indexOf('\n')
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line) this.acceptLine(line)
      newline = this.buffer.indexOf('\n')
    }
  }

  private acceptLine(line: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      this.emit('protocolError', new Error('Malformed Codex App Server JSON line'))
      return
    }
    const message = asRecord(parsed)
    if (!message) {
      this.emit('protocolError', new Error('Malformed Codex App Server message'))
      return
    }

    const id = responseId(message.id)
    if (id !== undefined && typeof message.method !== 'string') {
      const pending = this.pending.get(id)
      if (!pending) {
        this.emit('protocolError', new Error(`Unknown Codex response id ${id}`))
        return
      }
      clearTimeout(pending.timer)
      this.pending.delete(id)
      const response = message as unknown as CodexResponseEnvelope
      if (response.error) {
        pending.reject(new Error(response.error.message ?? 'Codex App Server request failed'))
      } else {
        pending.resolve(response.result)
      }
      return
    }

    if (typeof message.method === 'string' && id !== undefined) {
      this.emit('serverRequest', message as unknown as CodexServerRequestEnvelope)
      return
    }
    if (typeof message.method === 'string') {
      this.emit('notification', message as unknown as CodexNotificationEnvelope)
      return
    }
    this.emit('protocolError', new Error('Unrecognized Codex App Server message'))
  }
}
