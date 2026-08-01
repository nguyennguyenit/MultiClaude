import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import type { AgentEvent, AgentProviderReadiness } from '@shared/types'
import {
  CodexAdapter,
  type CodexAppServerPort,
} from '../codex-adapter'

class FakeClient extends EventEmitter implements CodexAppServerPort {
  detect = vi.fn<() => Promise<AgentProviderReadiness>>(async () => ({
    status: 'ready',
    version: '0.146.0',
  }))
  connect = vi.fn(async () => ({
    userAgent: 'codex-cli/0.146.0',
    codexHome: '/tmp/codex',
    platformFamily: 'unix',
    platformOs: 'macos',
  }))
  startThread = vi.fn(async () => 'thread-1')
  resumeThread = vi.fn(async (threadId: string) => threadId)
  startTurn = vi.fn(async () => 'turn-1')
  interruptTurn = vi.fn(async () => undefined)
  respond = vi.fn()
  close = vi.fn()
}

describe('CodexAdapter', () => {
  it('starts/resumes threads and routes send/interrupt through the negotiated client', async () => {
    const client = new FakeClient()
    const adapter = new CodexAdapter(client)

    const started = await adapter.start({ terminalId: 't1', cwd: '/repo' })
    expect(started.ref).toEqual({ provider: 'codex', id: 'thread-1' })
    expect(client.startThread).toHaveBeenCalledWith('/repo')

    const resumed = await adapter.resume(
      { provider: 'codex', id: 'thread-2' },
      { terminalId: 't2', cwd: '/repo-2' }
    )
    expect(resumed.ref.id).toBe('thread-2')
    expect(client.resumeThread).toHaveBeenCalledWith('thread-2', '/repo-2')

    await adapter.send(started.ref, 'hello')
    expect(client.startTurn).toHaveBeenCalledWith('thread-1', 'hello')
    await adapter.interrupt(started.ref)
    expect(client.interruptTurn).toHaveBeenCalledWith('thread-1', 'turn-1')

    adapter.subscribe(started.ref, () => undefined)
    client.emit('notification', {
      method: 'turn/completed',
      params: { threadId: 'thread-1', turn: { id: 'turn-1' } },
    })
    await expect(adapter.interrupt(started.ref)).rejects.toThrow(/no active turn/i)
  })

  it('projects exact usage, explicit compaction, reasoning metadata, and flat tool activity', async () => {
    const client = new FakeClient()
    const adapter = new CodexAdapter(client, { now: () => 123 })
    const ref = (await adapter.start({ terminalId: 't1', cwd: '/repo' })).ref
    const events: AgentEvent[] = []
    const unsubscribe = adapter.subscribe(ref, value => events.push(value))

    client.emit('notification', {
      method: 'thread/tokenUsage/updated',
      params: {
        threadId: 'thread-1',
        tokenUsage: {
          total: {
            totalTokens: 30,
            inputTokens: 20,
            cachedInputTokens: 5,
            outputTokens: 10,
            reasoningOutputTokens: 3,
          },
          modelContextWindow: 200_000,
        },
      },
    })
    client.emit('notification', {
      method: 'item/started',
      params: {
        threadId: 'thread-1',
        item: { type: 'commandExecution', id: 'item-1', status: 'completed', command: 'secret command' },
      },
    })
    client.emit('notification', {
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        item: { type: 'commandExecution', id: 'item-1', command: 'secret command' },
      },
    })
    client.emit('notification', {
      method: 'item/completed',
      params: { threadId: 'thread-1', item: { type: 'reasoning', id: 'reason-1', content: ['secret'] } },
    })
    client.emit('notification', {
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        item: { type: 'fileChange', id: 'item-2', status: 'failed', changes: ['secret'] },
      },
    })
    client.emit('notification', {
      method: 'thread/compacted',
      params: { threadId: 'thread-1', turnId: 'turn-1' },
    })

    expect(events.map(value => value.type)).toEqual([
      'usage',
      'tool-activity',
      'tool-activity',
      'reasoning',
      'tool-activity',
      'compaction',
    ])
    expect(events[0].payload).toMatchObject({
      totalTokens: 30,
      inputTokens: 20,
      outputTokens: 10,
      contextWindow: 200_000,
    })
    expect(events[1].payload).toEqual({
      toolName: 'commandExecution',
      state: 'started',
      correlationId: 'item-1',
    })
    expect(events[2].payload).toEqual({
      toolName: 'commandExecution',
      state: 'completed',
      correlationId: 'item-1',
    })
    expect(events[3].payload).toEqual({ summaryCount: 1 })
    expect(events[4].payload).toEqual({
      toolName: 'fileChange',
      state: 'failed',
      correlationId: 'item-2',
    })
    expect(JSON.stringify(events)).not.toContain('secret')
    expect(events.map(value => value.sequence)).toEqual([0, 1, 2, 3, 4, 5])
    expect(events.every(value => value.timestamp === 123)).toBe(true)

    unsubscribe()
  })

  it('routes only matching approval requests and maps decisions to protocol responses', async () => {
    const client = new FakeClient()
    const adapter = new CodexAdapter(client)
    const ref = (await adapter.start({ terminalId: 't1', cwd: '/repo' })).ref
    const events: AgentEvent[] = []
    adapter.subscribe(ref, value => events.push(value))

    client.emit('serverRequest', {
      id: 91,
      method: 'item/commandExecution/requestApproval',
      params: { threadId: 'other-thread', itemId: 'ignored' },
    })
    client.emit('serverRequest', {
      id: 92,
      method: 'item/commandExecution/requestApproval',
      params: { threadId: 'thread-1', itemId: 'item-1', command: 'private' },
    })

    expect(events).toHaveLength(1)
    expect(events[0].payload).toEqual({
      approvalId: '92',
      kind: 'item/commandExecution/requestApproval',
    })
    await adapter.approve(ref, '92', 'accept-for-session')
    expect(client.respond).toHaveBeenCalledWith(92, { decision: 'acceptForSession' })
    await expect(adapter.approve(ref, 'missing', 'accept')).rejects.toThrow(/unknown approval/i)
  })

  it('reports provider-native capabilities and closes only after the last session is disposed', async () => {
    const client = new FakeClient()
    const adapter = new CodexAdapter(client)
    const one = (await adapter.start({ terminalId: 't1', cwd: '/one' })).ref
    client.startThread.mockResolvedValueOnce('thread-2')
    const two = (await adapter.start({ terminalId: 't2', cwd: '/two' })).ref

    expect(await adapter.detect()).toMatchObject({ status: 'ready', version: '0.146.0' })
    expect(adapter.capabilities()).toMatchObject({
      approvals: true,
      contextUsage: 'exact',
      reasoningMetadata: true,
    })
    await adapter.dispose(one)
    expect(client.close).not.toHaveBeenCalled()
    await adapter.dispose(two)
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  it('fails attached sessions when the App Server process exits', async () => {
    const client = new FakeClient()
    const adapter = new CodexAdapter(client, { now: () => 123 })
    const ref = (await adapter.start({ terminalId: 't1', cwd: '/repo' })).ref
    const events: AgentEvent[] = []
    adapter.subscribe(ref, event => events.push(event))

    client.emit('exit', new Error('process died'))

    expect(events.at(-1)).toMatchObject({
      type: 'error',
      payload: { message: 'Codex App Server exited', recoverable: true },
    })
    await expect(adapter.send(ref, 'after death')).rejects.toThrow(/not attached/i)
  })
})
