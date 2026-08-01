import { ipcMain, webContents } from 'electron'

import type { AgentRegistry } from '@main/agent/agent-registry'
import type { AgentInsightsService } from '@main/agent-insights/agent-insights-service'
import { IPC_CHANNELS } from '@shared/constants'
import type { AgentInsightsSnapshot, ExternalSessionRef } from '@shared/types'

interface SnapshotUpdate {
  session?: ExternalSessionRef
  snapshot: AgentInsightsSnapshot
}

export function registerAgentInsightsHandlers(
  service: AgentInsightsService,
  registry: AgentRegistry
): () => void {
  ipcMain.removeHandler(IPC_CHANNELS.AGENT_INSIGHTS_GET)
  ipcMain.handle(IPC_CHANNELS.AGENT_INSIGHTS_GET, async (event, payload: { terminalId?: unknown }) => {
    if (typeof payload?.terminalId !== 'string' || !payload.terminalId) {
      throw new Error('terminalId is required')
    }
    return service.getSnapshot(payload.terminalId, event.sender.id)
  })

  const onSnapshot = (update: SnapshotUpdate): void => {
    const session = update.session ?? update.snapshot.session
    const binding = registry.getBySession(session)
    if (!binding) return
    const target = webContents.fromId(binding.webContentsId)
    if (target && !target.isDestroyed()) {
      target.send(IPC_CHANNELS.AGENT_INSIGHTS_UPDATED, update.snapshot)
    }
  }
  service.on('snapshot', onSnapshot)

  return () => {
    service.off('snapshot', onSnapshot)
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_INSIGHTS_GET)
  }
}
