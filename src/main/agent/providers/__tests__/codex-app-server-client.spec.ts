import { describe, expect, it, vi } from 'vitest'

import {
  CodexAppServerClient,
  type CodexAppServerTransport,
} from '../codex-app-server-client'

class FakeTransport implements CodexAppServerTransport {
  readonly writes: Array<Record<string, unknown>> = []
  closed = false
  private dataListeners = new Set<(data: string) => void>()
  private exitListeners = new Set<(error?: Error) => void>()

  write(message: string): void {
    this.writes.push(JSON.parse(message.trim()) as Record<string, unknown>)
  }

  onData(listener: (data: string) => void): () => void {
    this.dataListeners.add(listener)
    return () => this.dataListeners.delete(listener)
  }

  onExit(listener: (error?: Error) => void): () => void {
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  push(value: unknown, splitAt?: number): void {
    const line = `${JSON.stringify(value)}\n`
    if (splitAt === undefined) {
      for (const listener of this.dataListeners) listener(line)
      return
    }
    for (const listener of this.dataListeners) listener(line.slice(0, splitAt))
    for (const listener of this.dataListeners) listener(line.slice(splitAt))
  }

  pushRaw(value: string): void {
    for (const listener of this.dataListeners) listener(value)
  }

  exit(error?: Error): void {
    for (const listener of this.exitListeners) listener(error)
  }

  close(): void {
    this.closed = true
  }
}

async function waitForWrites(transport: FakeTransport, count: number): Promise<void> {
  await vi.waitFor(() => expect(transport.writes).toHaveLength(count))
}

async function connectClient(transport: FakeTransport): Promise<CodexAppServerClient> {
  const client = new CodexAppServerClient({
    createTransport: () => transport,
    detectVersion: async () => '0.146.0',
    requestTimeoutMs: 100,
  })
  const connecting = client.connect()
  await waitForWrites(transport, 1)
  expect(transport.writes[0]).toMatchObject({ method: 'initialize' })
  transport.push({
    id: transport.writes[0].id,
    result: {
      userAgent: 'codex-cli/0.146.0',
      codexHome: '/tmp/codex',
      platformFamily: 'unix',
      platformOs: 'macos',
    },
  }, 5)
  await connecting
  expect(transport.writes[1]).toEqual({ method: 'initialized' })
  return client
}

describe('CodexAppServerClient', () => {
  it('fails closed to fallback before spawning when the CLI version is incompatible', async () => {
    const createTransport = vi.fn(() => new FakeTransport())
    const client = new CodexAppServerClient({
      createTransport,
      detectVersion: async () => '0.145.0',
    })

    expect(await client.detect()).toMatchObject({ status: 'fallback', version: '0.145.0' })
    await expect(client.connect()).rejects.toThrow(/requires Codex 0\.146\.0/i)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('initializes once and validates thread start/resume plus turn operations', async () => {
    const transport = new FakeTransport()
    const client = await connectClient(transport)

    const starting = client.startThread('/repo')
    await waitForWrites(transport, 3)
    expect(transport.writes[2]).toMatchObject({ method: 'thread/start', params: { cwd: '/repo' } })
    transport.push({ id: transport.writes[2].id, result: { thread: { id: 'thread-1' } } })
    await expect(starting).resolves.toBe('thread-1')

    const resuming = client.resumeThread('thread-2', '/repo-2')
    await waitForWrites(transport, 4)
    expect(transport.writes[3]).toMatchObject({
      method: 'thread/resume',
      params: { threadId: 'thread-2', cwd: '/repo-2' },
    })
    transport.push({ id: transport.writes[3].id, result: { thread: { id: 'thread-2' } } })
    await expect(resuming).resolves.toBe('thread-2')

    const turning = client.startTurn('thread-1', 'hello')
    await waitForWrites(transport, 5)
    expect(transport.writes[4]).toMatchObject({
      method: 'turn/start',
      params: { threadId: 'thread-1', input: [{ type: 'text', text: 'hello', text_elements: [] }] },
    })
    transport.push({ id: transport.writes[4].id, result: { turn: { id: 'turn-1' } } })
    await expect(turning).resolves.toBe('turn-1')

    const interrupting = client.interruptTurn('thread-1', 'turn-1')
    await waitForWrites(transport, 6)
    expect(transport.writes[5]).toMatchObject({
      method: 'turn/interrupt',
      params: { threadId: 'thread-1', turnId: 'turn-1' },
    })
    transport.push({ id: transport.writes[5].id, result: {} })
    await expect(interrupting).resolves.toBeUndefined()
  })

  it('isolates malformed lines while forwarding notifications and server requests', async () => {
    const transport = new FakeTransport()
    const client = await connectClient(transport)
    const notifications: unknown[] = []
    const requests: unknown[] = []
    const errors: Error[] = []
    client.on('notification', value => notifications.push(value))
    client.on('serverRequest', value => requests.push(value))
    client.on('protocolError', value => errors.push(value))

    transport.pushRaw('not-json\n')
    transport.push({ method: 'thread/tokenUsage/updated', params: { threadId: 't1' } })
    transport.push({ id: 91, method: 'item/commandExecution/requestApproval', params: { threadId: 't1' } })

    expect(errors).toHaveLength(1)
    expect(notifications).toEqual([
      { method: 'thread/tokenUsage/updated', params: { threadId: 't1' } },
    ])
    expect(requests).toEqual([
      { id: 91, method: 'item/commandExecution/requestApproval', params: { threadId: 't1' } },
    ])
  })

  it('rejects slow/pending requests and cleans resources on process exit', async () => {
    const timeoutTransport = new FakeTransport()
    const timeoutClient = new CodexAppServerClient({
      createTransport: () => timeoutTransport,
      detectVersion: async () => '0.146.0',
      requestTimeoutMs: 5,
    })
    const connecting = timeoutClient.connect()
    await expect(connecting).rejects.toThrow(/timed out/i)
    expect(timeoutTransport.closed).toBe(true)

    const exitTransport = new FakeTransport()
    const client = await connectClient(exitTransport)
    const exits: Error[] = []
    client.on('exit', error => exits.push(error))
    const pending = client.startThread('/repo')
    await waitForWrites(exitTransport, 3)
    exitTransport.exit(new Error('process died'))
    await expect(pending).rejects.toThrow(/process died/i)
    expect(exits).toEqual([expect.objectContaining({ message: 'process died' })])
    expect(exitTransport.closed).toBe(true)
  })
})
