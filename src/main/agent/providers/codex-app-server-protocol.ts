/**
 * Reduced non-experimental surface generated and verified against Codex App
 * Server 0.146.0. Keep this boundary narrow; provider schemas remain outside
 * shared UI contracts.
 */
export const PINNED_CODEX_APP_SERVER_VERSION = '0.146.0'

export type CodexRequestId = number

export interface CodexInitializeResult {
  userAgent: string
  codexHome: string
  platformFamily: string
  platformOs: string
}

export interface CodexNotificationEnvelope {
  method: string
  params?: Record<string, unknown>
}

export interface CodexServerRequestEnvelope extends CodexNotificationEnvelope {
  id: CodexRequestId | string
}

export interface CodexResponseEnvelope {
  id: CodexRequestId | string
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

export type CodexClientRequestMethod =
  | 'initialize'
  | 'thread/start'
  | 'thread/resume'
  | 'turn/start'
  | 'turn/interrupt'

export interface CodexClientRequestEnvelope {
  id: CodexRequestId
  method: CodexClientRequestMethod
  params: Record<string, unknown>
}
