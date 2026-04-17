import { randomBytes, createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import Store from 'electron-store'
import { HookServer, type HandlerResult } from './hook-server'
import { HookRouter, type HookRouterEvent } from './hook-router'
import { HookInstaller, type HookInstallStatus } from './hook-installer'
import { ResponseStore } from './response-store'
import { pendingQuestionStore } from './pending-question-store'
import { pendingPermissionStore } from './pending-permission-store'
import { detectCcpoke } from './ccpoke-coexistence'

export interface MobileControlStatus {
  enabled: boolean
  running: boolean
  port: number | null
  secretFingerprint: string | null
  installStatus: HookInstallStatus
  ccpokeDetected: boolean
  ccpokeReasons: string[]
  error?: string
}

export interface MobileControlManagerOptions {
  /** Override ~/.multiclaude/responses dir. */
  responsesDir?: string
  /** Override Claude settings path. */
  claudeSettingsPath?: string
  /** Version string for User-Agent marker. */
  userAgentVersion?: string
  /** Function to resolve session_id -> terminalId (injected from terminal manager). */
  resolveTerminalBySession: (sessionId: string) => string | undefined
  /** Claude dir for ccpoke detection (default ~/.claude). */
  claudeDir?: string
}

interface SecretSchema {
  mobileControlSecret?: string
}

/**
 * Orchestrates the hook-server + hook-router + hook-installer + response-store
 * as a single enable/disable toggle. Emits HookRouterEvent to feed
 * NotificationManager.
 */
export class MobileControlManager extends EventEmitter {
  private readonly opts: MobileControlManagerOptions
  private readonly store: Store<SecretSchema>
  private readonly userAgentVersion: string
  private readonly claudeDir: string
  private readonly responsesDir: string
  private readonly settingsPath: string

  private server: HookServer | null = null
  private installer: HookInstaller | null = null
  private router: HookRouter | null = null
  private responseStore: ResponseStore | null = null
  private currentPort: number | null = null
  private currentSecret: string | null = null
  private lastError: string | undefined

  constructor(options: MobileControlManagerOptions) {
    super()
    this.opts = options
    this.userAgentVersion = options.userAgentVersion ?? 'MultiClaude/phase02'
    this.claudeDir = options.claudeDir ?? join(homedir(), '.claude')
    this.responsesDir = options.responsesDir ?? join(homedir(), '.multiclaude', 'responses')
    this.settingsPath = options.claudeSettingsPath ?? join(this.claudeDir, 'settings.json')
    this.store = new Store<SecretSchema>({ name: 'multiclaude-mobile-control' })
  }

  async enable(): Promise<MobileControlStatus> {
    if (this.server) return this.getStatus()
    try {
      this.ensureResponsesDir()
      this.responseStore = new ResponseStore({ dir: this.responsesDir })
      this.currentSecret = this.loadOrCreateSecret()
      this.server = new HookServer({
        secret: this.currentSecret,
        handler: async (event, payload, _req): Promise<HandlerResult> => {
          if (!this.router) return { status: 200 }
          return this.router.handle(event, payload)
        },
        logger: (level, msg, meta) => {
          if (level === 'warn' || level === 'error') {
            console.warn(`[MobileControl] ${level} ${msg}`, meta ?? {})
          }
        }
      })
      const port = await this.server.start()
      this.currentPort = port
      this.router = new HookRouter({
        responseStore: this.responseStore,
        questionStore: pendingQuestionStore,
        permissionStore: pendingPermissionStore,
        resolveTerminalBySession: this.opts.resolveTerminalBySession,
        emit: (event, payload) => this.emit('hook:event', { type: event, payload } satisfies { type: HookRouterEvent; payload: Record<string, unknown> }),
        logger: (level, msg, meta) => {
          if (level !== 'info') console.warn(`[MobileControl] ${level} ${msg}`, meta ?? {})
        }
      })

      // Self-loopback check before declaring enabled
      await this.selfCheck(port)

      this.installer = new HookInstaller({
        settingsPath: this.settingsPath,
        userAgent: this.userAgentVersion,
        port,
        secret: this.currentSecret
      })
      await this.installer.install()

      this.lastError = undefined
      this.emit('status-changed', await this.getStatus())
      return this.getStatus()
    } catch (err) {
      this.lastError = (err as Error).message
      await this.disable().catch(() => undefined)
      const status = await this.getStatus()
      this.emit('status-changed', status)
      return status
    }
  }

  async disable(): Promise<MobileControlStatus> {
    try {
      if (this.installer) {
        await this.installer.uninstall().catch((err) => {
          console.warn('[MobileControl] uninstall failed', err)
        })
      }
    } finally {
      this.installer = null
      this.router = null
      if (this.server) {
        await this.server.stop().catch(() => undefined)
        this.server = null
      }
      this.currentPort = null
      this.emit('status-changed', await this.getStatus())
    }
    return this.getStatus()
  }

  async regenerateSecret(): Promise<MobileControlStatus> {
    this.currentSecret = randomBytes(32).toString('hex')
    this.store.set('mobileControlSecret', this.currentSecret)
    if (this.server) {
      // Hot-rotate: disable and re-enable so installer re-writes settings.json with new secret.
      await this.disable()
      return this.enable()
    }
    return this.getStatus()
  }

  async getStatus(): Promise<MobileControlStatus> {
    const installStatus = await this.currentInstallStatus()
    let ccpoke = { detected: false, reasons: [] as string[] }
    try {
      ccpoke = await detectCcpoke({ claudeDir: this.claudeDir })
    } catch {
      // Non-fatal.
    }
    return {
      enabled: this.server !== null,
      running: this.server !== null,
      port: this.currentPort,
      secretFingerprint: this.currentSecret ? createHash('sha256').update(this.currentSecret).digest('hex').slice(0, 8) : null,
      installStatus,
      ccpokeDetected: ccpoke.detected,
      ccpokeReasons: ccpoke.reasons,
      error: this.lastError
    }
  }

  responseStoreRef(): ResponseStore | null {
    return this.responseStore
  }

  private async currentInstallStatus(): Promise<HookInstallStatus> {
    const installer =
      this.installer ??
      new HookInstaller({
        settingsPath: this.settingsPath,
        userAgent: this.userAgentVersion,
        port: this.currentPort ?? 0,
        secret: this.currentSecret ?? ''
      })
    return installer.status()
  }

  private loadOrCreateSecret(): string {
    const existing = this.store.get('mobileControlSecret')
    if (typeof existing === 'string' && existing.length >= 64) return existing
    const fresh = randomBytes(32).toString('hex')
    this.store.set('mobileControlSecret', fresh)
    return fresh
  }

  private ensureResponsesDir(): void {
    if (!existsSync(this.responsesDir)) {
      mkdirSync(this.responsesDir, { recursive: true, mode: 0o700 })
    }
    const readme = join(this.responsesDir, 'README.txt')
    if (!existsSync(readme)) {
      writeFileSync(
        readme,
        [
          'MultiClaude response store',
          '',
          'This directory holds Claude Code response snapshots for 24 hours.',
          'On Windows the 0o600 permission model is a best-effort — if you',
          'share this machine with other users, mobile control may expose',
          'last-assistant-message summaries. Prefer a private account.',
          ''
        ].join('\n')
      )
    }
  }

  private async selfCheck(port: number): Promise<void> {
    const url = `http://127.0.0.1:${port}/hook/selfcheck`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MC-Hook-Secret': this.currentSecret ?? ''
        },
        body: JSON.stringify({ probe: true })
      })
      if (!res.ok) throw new Error(`self-check status ${res.status}`)
    } catch (err) {
      throw new Error(`Hook server self-check failed on ${url}: ${(err as Error).message}`)
    }
  }
}
