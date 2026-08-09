import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import type { AgentEvent } from '@shared/types'
import { ClaudeAdapter, type ClaudeTerminalRuntime } from '../claude-adapter'

class JsonlSource extends EventEmitter {}

function createRuntime(): ClaudeTerminalRuntime {
  return {
    write: vi.fn(() => true),
    invokeClaudeCode: vi.fn(() => true),
  }
}

describe('ClaudeAdapter', () => {
  it('starts with a caller-known UUID and resumes through the compatibility runtime', async () => {
    const runtime = createRuntime()
    const source = new JsonlSource()
    const adapter = new ClaudeAdapter({
      runtime,
      source,
      createSessionId: () => '11111111-1111-4111-8111-111111111111',
      detectVersion: async () => '2.1.220',
    })

    const started = await adapter.start({ terminalId: 't1', cwd: '/repo' })
    expect(started.ref).toEqual({
      provider: 'claude',
      id: '11111111-1111-4111-8111-111111111111',
    })
    expect(runtime.write).toHaveBeenCalledWith(
      't1',
      'claude --session-id 11111111-1111-4111-8111-111111111111\n'
    )

    const resumed = await adapter.resume(
      { provider: 'claude', id: 'existing-session' },
      { terminalId: 't2', cwd: '/repo' }
    )
    expect(resumed.ref.id).toBe('existing-session')
    expect(runtime.invokeClaudeCode).toHaveBeenCalledWith('t2', 'existing-session')
  })

  it('fails launch/resume when the terminal runtime rejects the command', async () => {
    const runtime = createRuntime()
    vi.mocked(runtime.write).mockReturnValue(false)
    vi.mocked(runtime.invokeClaudeCode).mockReturnValue(false)
    const adapter = new ClaudeAdapter({ runtime, source: new JsonlSource() })

    await expect(adapter.start({ terminalId: 't1', cwd: '/repo' })).rejects.toThrow(/launch/i)
    await expect(adapter.resume(
      { provider: 'claude', id: 'session' },
      { terminalId: 't1', cwd: '/repo' }
    )).rejects.toThrow(/resume/i)
  })

  it('normalizes only matching JSONL session metadata into ordered events', async () => {
    const runtime = createRuntime()
    const source = new JsonlSource()
    const adapter = new ClaudeAdapter({
      runtime,
      source,
      createSessionId: () => '11111111-1111-4111-8111-111111111111',
    })
    const session = (await adapter.start({ terminalId: 't1', cwd: '/repo' })).ref
    const events: AgentEvent[] = []
    const unsubscribe = adapter.subscribe(session, value => events.push(value))

    source.emit('jsonlLine', {
      sessionId: 'other-session',
      line: { type: 'assistant', message: { usage: { input_tokens: 1 } } },
      filePath: '/private/transcript.jsonl',
    })
    source.emit('jsonlLine', {
      sessionId: session.id,
      line: {
        type: 'assistant',
        message: { usage: { input_tokens: 10, output_tokens: 4 } },
      },
      filePath: '/private/transcript.jsonl',
    })
    source.emit('jsonlLine', {
      sessionId: session.id,
      line: { type: 'system', subtype: 'compact_boundary' },
      filePath: '/private/transcript.jsonl',
    })

    expect(events.map(value => value.type)).toEqual(['usage', 'compaction'])
    expect(events.map(value => value.sequence)).toEqual([0, 1])
    expect(events[0].payload).toEqual({ inputTokens: 10, outputTokens: 4 })
    expect(JSON.stringify(events)).not.toContain('/private/transcript.jsonl')

    unsubscribe()
    source.emit('jsonlLine', {
      sessionId: session.id,
      line: { type: 'system', subtype: 'compact_boundary' },
      filePath: '/private/transcript.jsonl',
    })
    expect(events).toHaveLength(2)
  })

  it('reports honest capabilities/readiness and rejects unsupported approvals', async () => {
    const adapter = new ClaudeAdapter({
      runtime: createRuntime(),
      source: new JsonlSource(),
      detectVersion: async () => '2.1.220',
    })

    expect(await adapter.detect()).toEqual({ status: 'ready', version: '2.1.220' })
    expect(adapter.capabilities()).toMatchObject({
      approvals: false,
      contextUsage: 'estimated',
      reasoningMetadata: true,
    })
    await expect(adapter.approve(
      { provider: 'claude', id: 'session' },
      'approval',
      'accept'
    )).rejects.toThrow(/not supported/i)
  })
})
