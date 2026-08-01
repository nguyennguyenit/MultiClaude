import { EventEmitter } from 'node:events'
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
import type { AgentInsightsService } from '@main/agent-insights/agent-insights-service'
import { registerAgentInsightsHandlers } from '../agent-insights-handlers'

describe('registerAgentInsightsHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    sends.length = 0
  })

  it('uses sender authorization for reads and targets updates to the binding owner', async () => {
    const service = new EventEmitter() as EventEmitter & {
      getSnapshot: ReturnType<typeof vi.fn>
    }
    service.getSnapshot = vi.fn(() => ({ provider: 'codex' }))
    const binding = {
      session: { provider: 'codex', id: 'thread-1' },
      terminalId: 'terminal-1',
      webContentsId: 42,
    }
    const registry = { getBySession: vi.fn(() => binding) }
    registerAgentInsightsHandlers(
      service as unknown as AgentInsightsService,
      registry as unknown as AgentRegistry
    )

    await handlers.get(IPC_CHANNELS.AGENT_INSIGHTS_GET)?.(
      { sender: { id: 42 } },
      { terminalId: 'terminal-1' }
    )
    expect(service.getSnapshot).toHaveBeenCalledWith('terminal-1', 42)

    service.emit('snapshot', {
      session: binding.session,
      snapshot: { provider: 'codex', session: binding.session },
    })
    expect(sends).toContainEqual({
      id: 42,
      channel: IPC_CHANNELS.AGENT_INSIGHTS_UPDATED,
      payload: expect.objectContaining({ provider: 'codex' }),
    })
  })
})
