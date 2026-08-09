import { describe, expect, it, vi } from 'vitest'

import type {
  AgentCapabilities,
  AgentEvent,
  AgentProvider,
  ExternalSessionRef,
} from '@shared/types'
import type {
  AgentAdapter,
  AgentLaunchContext,
  AgentSessionDescriptor,
} from '../agent-adapter'
import { AgentRegistry } from '../agent-registry'

const CAPABILITIES: AgentCapabilities = {
  send: true,
  interrupt: true,
  resume: true,
  approvals: false,
  contextUsage: 'estimated',
  reasoningMetadata: false,
}

function createAdapter(provider: AgentProvider, sessionId = `${provider}-session`) {
  let listener: ((event: AgentEvent) => void) | undefined
  const descriptor = (ref: ExternalSessionRef): AgentSessionDescriptor => ({
    ref,
    status: 'idle',
    capabilities: CAPABILITIES,
  })
  const adapter: AgentAdapter = {
    provider,
    detect: vi.fn(async () => ({ status: 'ready' as const, version: '1.0.0' })),
    capabilities: vi.fn(() => CAPABILITIES),
    start: vi.fn(async (_context: AgentLaunchContext) => descriptor({ provider, id: sessionId })),
    resume: vi.fn(async (ref: ExternalSessionRef) => descriptor(ref)),
    send: vi.fn(async () => undefined),
    interrupt: vi.fn(async () => undefined),
    approve: vi.fn(async () => undefined),
    subscribe: vi.fn((_ref, next) => {
      listener = next
      return () => { listener = undefined }
    }),
    dispose: vi.fn(async () => undefined),
  }
  return { adapter, emit: (event: AgentEvent) => listener?.(event) }
}

function event(
  provider: AgentProvider,
  sessionId: string,
  sequence: number,
  eventId = `${provider}-${sequence}`
): AgentEvent {
  return {
    eventId,
    provider,
    session: { provider, id: sessionId },
    sequence,
    timestamp: 1_700_000_000_000 + sequence,
    type: 'status',
    payload: { status: 'running' },
  }
}

describe('AgentRegistry', () => {
  it('starts a managed session and owns terminal/project/window authorization', async () => {
    const claude = createAdapter('claude')
    const registry = new AgentRegistry([claude.adapter])

    const binding = await registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      projectId: 'project-1',
      webContentsId: 11,
      cwd: '/workspace',
    })

    expect(binding.session).toEqual({ provider: 'claude', id: 'claude-session' })
    expect(registry.resolveAuthorized('terminal-1', 11)).toEqual(binding)
    expect(() => registry.resolveAuthorized('terminal-1', 12)).toThrow(/not authorized/i)
    expect(claude.adapter.start).toHaveBeenCalledWith(expect.objectContaining({
      terminalId: 'terminal-1',
      projectId: 'project-1',
      cwd: '/workspace',
    }))
  })

  it('keeps identical external ids isolated by provider', () => {
    const registry = new AgentRegistry([
      createAdapter('claude').adapter,
      createAdapter('codex').adapter,
    ])

    registry.attach({
      session: { provider: 'claude', id: 'same-id' },
      terminalId: 'claude-terminal',
      webContentsId: 1,
      capabilities: CAPABILITIES,
      status: 'idle',
    })
    registry.attach({
      session: { provider: 'codex', id: 'same-id' },
      terminalId: 'codex-terminal',
      webContentsId: 1,
      capabilities: CAPABILITIES,
      status: 'idle',
    })

    expect(registry.getBySession({ provider: 'claude', id: 'same-id' })?.terminalId)
      .toBe('claude-terminal')
    expect(registry.getBySession({ provider: 'codex', id: 'same-id' })?.terminalId)
      .toBe('codex-terminal')
  })

  it('emits only ordered, session-matched events and rejects malformed stream input', async () => {
    const claude = createAdapter('claude')
    const registry = new AgentRegistry([claude.adapter])
    const accepted: AgentEvent[] = []
    const rejected: string[] = []
    registry.on('event', value => accepted.push(value))
    registry.on('eventRejected', value => rejected.push(value.reason))

    await registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      webContentsId: 1,
      cwd: '/workspace',
    })

    claude.emit(event('claude', 'claude-session', 1))
    claude.emit(event('claude', 'claude-session', 1, 'duplicate-sequence'))
    claude.emit(event('claude', 'claude-session', 3))
    claude.emit(event('claude', 'different-session', 4))
    claude.emit({ ...event('claude', 'claude-session', 4), timestamp: Number.NaN })
    claude.emit({
      ...event('claude', 'claude-session', 4),
      payload: { status: 'garbage' as never },
    })

    expect(accepted.map(value => value.sequence)).toEqual([1, 3])
    expect(rejected).toHaveLength(4)
    expect(rejected.join(' ')).toMatch(/out.of.order|session|malformed/i)
  })

  it('rebinds one session atomically and cleans up subscriptions/resources', async () => {
    const claude = createAdapter('claude')
    const registry = new AgentRegistry([claude.adapter])
    const first = await registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      webContentsId: 1,
      cwd: '/workspace',
    })

    const removed: string[] = []
    registry.on('bindingRemoved', binding => removed.push(binding.terminalId))
    registry.attach({ ...first, terminalId: 'terminal-2', webContentsId: 2 })
    expect(registry.getByTerminal('terminal-1')).toBeUndefined()
    expect(registry.getByTerminal('terminal-2')?.session).toEqual(first.session)
    expect(removed).toEqual(['terminal-1'])

    await registry.detach('terminal-2', { dispose: true })
    expect(registry.getByTerminal('terminal-2')).toBeUndefined()
    expect(claude.adapter.dispose).toHaveBeenCalledWith(first.session)
  })

  it('routes actions only through the authorized binding and exposes provider readiness', async () => {
    const claude = createAdapter('claude')
    const registry = new AgentRegistry([claude.adapter])
    await registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/workspace',
    })

    await registry.send('terminal-1', 7, 'hello')
    await registry.interrupt('terminal-1', 7)
    await expect(registry.send('terminal-1', 8, 'leak')).rejects.toThrow(/not authorized/i)
    expect(claude.adapter.send).toHaveBeenCalledWith(
      { provider: 'claude', id: 'claude-session' },
      'hello'
    )
    expect(claude.adapter.interrupt).toHaveBeenCalledWith({
      provider: 'claude',
      id: 'claude-session',
    })
    await expect(registry.getReadiness()).resolves.toEqual({
      claude: { status: 'ready', version: '1.0.0' },
    })
  })

  it('fails managed launch closed when a provider requires terminal fallback', async () => {
    const codex = createAdapter('codex')
    vi.mocked(codex.adapter.detect).mockResolvedValue({
      status: 'fallback',
      version: '0.120.0',
      reason: 'Pinned App Server protocol is unavailable'
    })
    const registry = new AgentRegistry([codex.adapter])

    await expect(registry.start({
      provider: 'codex',
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/workspace'
    })).rejects.toThrow(/terminal fallback/i)
    expect(codex.adapter.start).not.toHaveBeenCalled()
  })

  it('rejects an occupied terminal before creating another provider session', async () => {
    const claude = createAdapter('claude')
    const codex = createAdapter('codex')
    const registry = new AgentRegistry([claude.adapter, codex.adapter])
    await registry.start({ provider: 'claude', terminalId: 'terminal-1', webContentsId: 7, cwd: '/one' })

    await expect(registry.start({
      provider: 'codex',
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/two',
    })).rejects.toThrow(/already bound/i)
    expect(codex.adapter.start).not.toHaveBeenCalled()
    expect(codex.adapter.dispose).not.toHaveBeenCalled()
  })

  it('serializes terminal admission across asynchronous provider launch', async () => {
    const claude = createAdapter('claude')
    let finishLaunch: ((value: AgentSessionDescriptor) => void) | undefined
    vi.mocked(claude.adapter.start).mockImplementation(() => new Promise(resolve => {
      finishLaunch = resolve
    }))
    const registry = new AgentRegistry([claude.adapter])
    const request = {
      provider: 'claude' as const,
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/one',
    }

    const first = registry.start(request)
    await vi.waitFor(() => expect(claude.adapter.start).toHaveBeenCalledTimes(1))
    await expect(registry.start(request)).rejects.toThrow(/operation.*progress/i)
    finishLaunch?.({
      ref: { provider: 'claude', id: 'session-1' },
      status: 'idle',
      capabilities: CAPABILITIES,
    })
    await expect(first).resolves.toMatchObject({ terminalId: 'terminal-1' })
    expect(claude.adapter.start).toHaveBeenCalledTimes(1)
  })

  it('cancels and cleans a provider launch when its terminal detaches in flight', async () => {
    const claude = createAdapter('claude')
    let finishLaunch: ((value: AgentSessionDescriptor) => void) | undefined
    vi.mocked(claude.adapter.start).mockImplementation(() => new Promise(resolve => {
      finishLaunch = resolve
    }))
    const registry = new AgentRegistry([claude.adapter])
    const starting = registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/one',
    })
    await vi.waitFor(() => expect(claude.adapter.start).toHaveBeenCalledTimes(1))

    await expect(registry.detach('terminal-1')).resolves.toBe(false)
    finishLaunch?.({
      ref: { provider: 'claude', id: 'session-1' },
      status: 'idle',
      capabilities: CAPABILITIES,
    })

    await expect(starting).rejects.toThrow(/cancelled|disposed/i)
    expect(claude.adapter.dispose).toHaveBeenCalledWith({ provider: 'claude', id: 'session-1' })
    expect(registry.getByTerminal('terminal-1')).toBeUndefined()
  })

  it('removes an old binding when an in-flight rebind is cancelled', async () => {
    const claude = createAdapter('claude')
    const registry = new AgentRegistry([claude.adapter])
    const original = await registry.start({
      provider: 'claude',
      terminalId: 'terminal-1',
      webContentsId: 7,
      cwd: '/one',
    })
    let finishResume: ((value: AgentSessionDescriptor) => void) | undefined
    vi.mocked(claude.adapter.resume).mockImplementation(() => new Promise(resolve => {
      finishResume = resolve
    }))
    const resuming = registry.resume({
      session: original.session,
      terminalId: 'terminal-2',
      webContentsId: 7,
      cwd: '/two',
    })
    await vi.waitFor(() => expect(claude.adapter.resume).toHaveBeenCalledTimes(1))

    await registry.detach('terminal-2')
    finishResume?.({
      ref: original.session,
      status: 'idle',
      capabilities: CAPABILITIES,
    })

    await expect(resuming).rejects.toThrow(/cancelled/i)
    expect(registry.getByTerminal('terminal-1')).toBeUndefined()
    expect(registry.getBySession(original.session)).toBeUndefined()
    expect(claude.adapter.dispose).toHaveBeenCalledWith(original.session)
  })
})
