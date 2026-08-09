import { ipcMain, webContents } from 'electron'

import type { AgentApprovalDecision } from '@main/agent/agent-adapter'
import type { AgentRegistry } from '@main/agent/agent-registry'
import { IPC_CHANNELS } from '@shared/constants'
import type { AgentEvent, AgentProvider, AgentSessionBinding, ExternalSessionRef } from '@shared/types'

interface TrustedTerminalContext {
  cwd: string
  projectId?: string
}

type TerminalContextResolver = (
  terminalId: string,
  webContentsId: number
) => TrustedTerminalContext | undefined

const PROVIDERS = new Set<AgentProvider>(['claude', 'codex'])
const APPROVAL_DECISIONS = new Set<AgentApprovalDecision>([
  'accept',
  'accept-for-session',
  'decline',
  'cancel',
])

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`)
  return value
}

function provider(value: unknown): AgentProvider {
  if (!PROVIDERS.has(value as AgentProvider)) throw new Error('Unsupported agent provider')
  return value as AgentProvider
}

function externalSessionRef(value: unknown): ExternalSessionRef {
  const candidate = value as Partial<ExternalSessionRef> | undefined
  return {
    provider: provider(candidate?.provider),
    id: requiredString(candidate?.id, 'session.id'),
  }
}

function sessionKey(ref: ExternalSessionRef): string {
  return `${ref.provider}:${ref.id}`
}

function sendToOwner(binding: AgentSessionBinding, channel: string, payload: unknown): void {
  const target = webContents.fromId(binding.webContentsId)
  if (target && !target.isDestroyed()) target.send(channel, payload)
}

/** Registers the only renderer-facing entry point for managed agent sessions. */
export function registerAgentHandlers(
  registry: AgentRegistry,
  resolveTerminalContext: TerminalContextResolver
): () => void {
  const bindingsBySession = new Map<string, AgentSessionBinding>()
  const handledChannels = [
    IPC_CHANNELS.AGENT_GET_READINESS,
    IPC_CHANNELS.AGENT_GET_BINDING,
    IPC_CHANNELS.AGENT_START,
    IPC_CHANNELS.AGENT_RESUME,
    IPC_CHANNELS.AGENT_SEND,
    IPC_CHANNELS.AGENT_INTERRUPT,
    IPC_CHANNELS.AGENT_APPROVE,
  ]
  for (const channel of handledChannels) ipcMain.removeHandler(channel)

  const authorizeInitialBinding = (terminalId: string, senderId: number): TrustedTerminalContext => {
    const context = resolveTerminalContext(terminalId, senderId)
    if (!context) {
      throw new Error(`Window ${senderId} is not authorized for terminal ${terminalId}`)
    }
    return context
  }

  ipcMain.handle(IPC_CHANNELS.AGENT_GET_READINESS, async () => registry.getReadiness())
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_BINDING, async (event, payload: { terminalId?: unknown }) => {
    const terminalId = requiredString(payload?.terminalId, 'terminalId')
    authorizeInitialBinding(terminalId, event.sender.id)
    return registry.getByTerminal(terminalId)
  })
  ipcMain.handle(IPC_CHANNELS.AGENT_START, async (event, payload: Record<string, unknown>) => {
    const terminalId = requiredString(payload?.terminalId, 'terminalId')
    const context = authorizeInitialBinding(terminalId, event.sender.id)
    return registry.start({
      provider: provider(payload.provider),
      terminalId,
      cwd: context.cwd,
      projectId: context.projectId,
      webContentsId: event.sender.id,
    })
  })
  ipcMain.handle(IPC_CHANNELS.AGENT_RESUME, async (event, payload: Record<string, unknown>) => {
    const terminalId = requiredString(payload?.terminalId, 'terminalId')
    const context = authorizeInitialBinding(terminalId, event.sender.id)
    return registry.resume({
      session: externalSessionRef(payload.session),
      terminalId,
      cwd: context.cwd,
      projectId: context.projectId,
      webContentsId: event.sender.id,
    })
  })
  ipcMain.handle(IPC_CHANNELS.AGENT_SEND, async (event, payload: Record<string, unknown>) =>
    registry.send(
      requiredString(payload?.terminalId, 'terminalId'),
      event.sender.id,
      requiredString(payload?.input, 'input')
    )
  )
  ipcMain.handle(IPC_CHANNELS.AGENT_INTERRUPT, async (event, payload: Record<string, unknown>) =>
    registry.interrupt(requiredString(payload?.terminalId, 'terminalId'), event.sender.id)
  )
  ipcMain.handle(IPC_CHANNELS.AGENT_APPROVE, async (event, payload: Record<string, unknown>) => {
    const decision = payload?.decision as AgentApprovalDecision
    if (!APPROVAL_DECISIONS.has(decision)) throw new Error('Unsupported approval decision')
    return registry.approve(
      requiredString(payload?.terminalId, 'terminalId'),
      event.sender.id,
      requiredString(payload?.approvalId, 'approvalId'),
      decision
    )
  })

  const onBindingChanged = (binding: AgentSessionBinding): void => {
    bindingsBySession.set(sessionKey(binding.session), binding)
    sendToOwner(binding, IPC_CHANNELS.AGENT_BINDING_CHANGED, binding)
  }
  const onBindingRemoved = (binding: AgentSessionBinding): void => {
    bindingsBySession.delete(sessionKey(binding.session))
    sendToOwner(binding, IPC_CHANNELS.AGENT_BINDING_REMOVED, binding)
  }
  const onEvent = (agentEvent: AgentEvent): void => {
    const binding = bindingsBySession.get(sessionKey(agentEvent.session))
    if (binding) sendToOwner(binding, IPC_CHANNELS.AGENT_EVENT, agentEvent)
  }

  registry.on('bindingChanged', onBindingChanged)
  registry.on('bindingRemoved', onBindingRemoved)
  registry.on('event', onEvent)

  return () => {
    registry.off('bindingChanged', onBindingChanged)
    registry.off('bindingRemoved', onBindingRemoved)
    registry.off('event', onEvent)
    for (const channel of handledChannels) ipcMain.removeHandler(channel)
  }
}
