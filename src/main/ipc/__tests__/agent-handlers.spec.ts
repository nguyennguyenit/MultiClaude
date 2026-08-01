import { beforeEach, describe, expect, it, vi } from 'vitest'

type TestIpcHandler = (
  event: { sender: { id: number } },
  payload?: Record<string, unknown>
) => unknown

const handlers = new Map<string, TestIpcHandler>()
const sends: Array<{ id: number; channel: string; payload: unknown }> = []

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: TestIpcHandler) => handlers.set(channel, handler)),
  },
  webContents: {
    fromId: vi.fn((id: number) => ({
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => sends.push({ id, channel, payload }),
    })),
  },
}))

import { IPC_CHANNELS } from '@shared/constants'
import type { AgentRegistry } from '@main/agent/agent-registry'
import { registerAgentHandlers } from '../agent-handlers'

describe('registerAgentHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    sends.length = 0
    vi.clearAllMocks()
  })

  it('authorizes terminal ownership on start and sender ownership on every action', async () => {
    const registry = {
      start: vi.fn(async request => ({
        session: { provider: request.provider, id: 'session-1' },
        terminalId: request.terminalId,
        webContentsId: request.webContentsId,
      })),
      send: vi.fn(async () => undefined),
      interrupt: vi.fn(async () => undefined),
      approve: vi.fn(async () => undefined),
      getReadiness: vi.fn(async () => ({})),
      getByTerminal: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as AgentRegistry
    const resolveTerminalContext = vi.fn((terminalId: string, senderId: number) =>
      terminalId === 'terminal-1' && senderId === 10
        ? { cwd: '/trusted/repo', projectId: 'project-1' }
        : undefined
    )
    registerAgentHandlers(registry, resolveTerminalContext)
    const event = { sender: { id: 10 } }

    const started = await handlers.get(IPC_CHANNELS.AGENT_START)?.(event, {
      provider: 'claude',
      terminalId: 'terminal-1',
      cwd: '/repo',
    })
    expect(started).toMatchObject({ terminalId: 'terminal-1', webContentsId: 10 })
    expect(registry.start).toHaveBeenCalledWith(expect.objectContaining({
      webContentsId: 10,
      cwd: '/trusted/repo',
      projectId: 'project-1',
    }))

    await handlers.get(IPC_CHANNELS.AGENT_SEND)?.(event, { terminalId: 'terminal-1', input: 'hello' })
    expect(registry.send).toHaveBeenCalledWith('terminal-1', 10, 'hello')

    await expect(handlers.get(IPC_CHANNELS.AGENT_START)?.(
      { sender: { id: 99 } },
      { provider: 'claude', terminalId: 'terminal-1', cwd: '/repo' }
    )).rejects.toThrow(/not authorized/i)
  })

  it('targets registry events only to the owning webContents', () => {
    const listeners = new Map<string, (value: unknown) => void>()
    const registry = {
      on: vi.fn((name: string, listener: (value: unknown) => void) => listeners.set(name, listener)),
      off: vi.fn(),
    } as unknown as AgentRegistry
    registerAgentHandlers(registry, () => ({ cwd: '/repo' }))

    listeners.get('event')?.({
      provider: 'codex',
      session: { provider: 'codex', id: 'thread-1' },
      eventId: 'e1',
      sequence: 1,
      timestamp: 1,
      type: 'status',
      payload: { status: 'running' },
    })
    expect(sends).toEqual([])

    listeners.get('bindingChanged')?.({
      session: { provider: 'codex', id: 'thread-1' },
      terminalId: 'terminal-1',
      webContentsId: 42,
      capabilities: {},
      status: 'idle',
    })
    listeners.get('event')?.({
      provider: 'codex',
      session: { provider: 'codex', id: 'thread-1' },
      eventId: 'e2',
      sequence: 2,
      timestamp: 2,
      type: 'status',
      payload: { status: 'running' },
    })

    expect(sends).toContainEqual({
      id: 42,
      channel: IPC_CHANNELS.AGENT_EVENT,
      payload: expect.objectContaining({ eventId: 'e2' }),
    })
  })
})
