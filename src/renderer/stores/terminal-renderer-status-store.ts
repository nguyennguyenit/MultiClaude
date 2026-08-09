import { create } from 'zustand'
import type {
  DesiredTerminalRenderer,
  RendererFallbackReason,
} from '../utils/terminal-renderer-policy'

export interface TerminalRendererStatus {
  terminalId: string
  effective: DesiredTerminalRenderer
  fallbackReason: RendererFallbackReason | null
}

interface TerminalRendererStatusState {
  statuses: Record<string, TerminalRendererStatus>
}

interface RetryControl {
  token: symbol
  retry: () => boolean
}

const EFFECTIVE_RENDERERS: ReadonlySet<DesiredTerminalRenderer> = new Set(['dom', 'webgl'])
const FALLBACK_REASONS: ReadonlySet<RendererFallbackReason> = new Set([
  'automatic-agent-safe',
  'policy-safe',
  'webgl-unavailable',
  'webgl-load-failed',
  'webgl-context-lost',
])
const sessionOwners = new Map<string, symbol>()
const retryControls = new Map<string, RetryControl>()

export const useTerminalRendererStatusStore = create<TerminalRendererStatusState>(() => ({
  statuses: {},
}))

function removeStatus(terminalId: string): void {
  useTerminalRendererStatusStore.setState((state) => {
    if (!(terminalId in state.statuses)) return state
    const statuses = { ...state.statuses }
    delete statuses[terminalId]
    return { statuses }
  })
}

export function claimTerminalRendererSession(terminalId: string, token: symbol): void {
  sessionOwners.set(terminalId, token)
  retryControls.delete(terminalId)
  removeStatus(terminalId)
}

export function setTerminalRendererStatus(
  terminalId: string,
  token: symbol,
  status: Omit<TerminalRendererStatus, 'terminalId'>,
): boolean {
  if (sessionOwners.get(terminalId) !== token) return false
  if (!EFFECTIVE_RENDERERS.has(status.effective)) return false
  if (status.fallbackReason !== null && !FALLBACK_REASONS.has(status.fallbackReason)) {
    return false
  }
  useTerminalRendererStatusStore.setState((state) => ({
    statuses: {
      ...state.statuses,
      [terminalId]: { terminalId, ...status },
    },
  }))
  return true
}

export function getTerminalRendererStatus(
  terminalId: string,
): TerminalRendererStatus | undefined {
  return useTerminalRendererStatusStore.getState().statuses[terminalId]
}

export function registerTerminalRendererRetry(
  terminalId: string,
  token: symbol,
  retry: () => boolean,
): () => void {
  if (sessionOwners.get(terminalId) !== token) return () => undefined
  const control = { token, retry }
  retryControls.set(terminalId, control)
  return () => {
    if (retryControls.get(terminalId) === control) retryControls.delete(terminalId)
  }
}

export function retryTerminalRenderer(terminalId: string): boolean {
  const control = retryControls.get(terminalId)
  if (!control || sessionOwners.get(terminalId) !== control.token) return false
  return control.retry()
}

export function releaseTerminalRendererSession(terminalId: string, token: symbol): void {
  if (sessionOwners.get(terminalId) !== token) return
  sessionOwners.delete(terminalId)
  retryControls.delete(terminalId)
  removeStatus(terminalId)
}

export function resetTerminalRendererStatusStoreForTests(): void {
  sessionOwners.clear()
  retryControls.clear()
  useTerminalRendererStatusStore.setState({ statuses: {} })
}
