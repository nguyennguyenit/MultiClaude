import path from 'path'
import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import Store from 'electron-store'
import type { NotificationSettings, NotificationEventType, NotificationEvent, AgentType } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS, TASK_TRACKER_CLEANUP_INTERVAL_MS, AGENT_DISPLAY_NAMES } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { OutputParser } from './output-parser'
import { FocusDetector } from './focus-detector'
import { TaskTracker } from './task-tracker'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'
import { TelegramPoller } from './telegram-poller'
import { TelegramCommandRouter } from './telegram-command-router'
import { TelegramAuthFlow } from './telegram-auth-flow'
import { pendingQuestionStore } from './pending-question-store'
import { pendingPermissionStore } from './pending-permission-store'
import { ClaudeLogWatcher } from './claude-log-watcher'
import { MobileControlManager, type MobileControlStatus } from './mobile-control-manager'
import { generateTaskEventId } from './parser-utils'
import type { RemoteControlStatus } from '@shared/types'
import type { TerminalManager } from '../terminal/terminal-manager'
import type { ProjectStore } from '../project/project-store'

// Keys to persist (exclude computed fields like telegramConfigured/discordConfigured)
type PersistableKey = 'onTaskComplete' | 'onTaskFailed' | 'onReviewNeeded' |
  'soundEnabled' | 'soundPreset' | 'telegramEnabled' | 'discordEnabled' |
  'outputMode' | 'notifyOnlyBackground' | 'includeTaskSummary' | 'remoteControlEnabled'

const PERSISTABLE_KEYS: PersistableKey[] = [
  'onTaskComplete', 'onTaskFailed', 'onReviewNeeded',
  'soundEnabled', 'soundPreset', 'telegramEnabled', 'discordEnabled',
  'outputMode', 'notifyOnlyBackground', 'includeTaskSummary', 'remoteControlEnabled'
]

interface NotificationStoreSchema {
  notificationSettings: Partial<NotificationSettings>
}

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private store: Store<NotificationStoreSchema>
  private parser: OutputParser
  private focusDetector: FocusDetector
  private taskTracker: TaskTracker
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private logWatcher: ClaudeLogWatcher

  // Map terminalId -> projectName for context (used by OutputParser path)
  private terminalProjects: Map<string, string> = new Map()
  // Map terminalId -> agentType for routing and event enrichment
  private terminalAgentTypes: Map<string, AgentType> = new Map()

  private poller: TelegramPoller | null = null
  private commandRouter: TelegramCommandRouter | null = null
  private terminalManagerRef: TerminalManager | null = null
  private projectStoreRef: ProjectStore | null = null
  private suspendHandler: (() => void) | null = null
  private resumeHandler: (() => void) | null = null

  // Pairing (QR deep-link) transient state
  private pairingPoller: TelegramPoller | null = null
  private pairingAuthFlow: TelegramAuthFlow | null = null
  private pairingBotToken: string | null = null

  // Mobile control (phase-02 hook receiver)
  private mobileControl: MobileControlManager | null = null
  private mobileControlEnabled = false

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.store = new Store<NotificationStoreSchema>({
      name: 'multiclaude-notification-settings',
      defaults: { notificationSettings: {} }
    })
    this.parser = new OutputParser()
    this.focusDetector = new FocusDetector()
    this.taskTracker = new TaskTracker()
    this.logWatcher = new ClaudeLogWatcher()

    // Load persisted settings, merge with defaults and computed fields
    const persisted = this.store.get('notificationSettings', {})
    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...persisted,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Listen for task events from terminal output parser (reviewNeeded only)
    this.parser.on('taskEvent', (event: TaskEvent) => {
      // Hard gate: when mobile control is ON, hook path owns reviewNeeded
      if (this.mobileControlEnabled && event.type === 'reviewNeeded') return
      // Enrich with agent type if known
      const agentType = this.terminalAgentTypes.get(event.terminalId)
      if (agentType) {
        event.agentType = agentType
      }
      this.handleTaskEvent(event)
    })

    // Listen for task completion events from JSONL transcript watcher
    // JSONL events use Claude session ID as terminalId — translate to real terminal ID
    this.logWatcher.on('taskEvent', (event: TaskEvent) => {
      // Always bind session_id to a terminal (even when mobile control owns notification
      // emission) — otherwise the hook path cannot resolve session_id → terminalId and
      // drops Stop/PermissionRequest events with `stop-no-terminal`.
      const match = this.terminalManagerRef?.findByClaudeSessionId(event.terminalId)
        ?? (event.cwd
          ? this.terminalManagerRef?.attachClaudeSession(event.terminalId, event.cwd)
          : undefined)
      if (match) {
        event.terminalId = match.id
      }
      event.agentType = 'claude'
      // Hard gate: when mobile control is ON, hook path owns taskComplete/reviewNeeded
      // emission to avoid duplicate notifications. Attachment above must still run.
      if (this.mobileControlEnabled && (event.type === 'taskComplete' || event.type === 'reviewNeeded')) return
      this.handleTaskEvent(event)
    })

    // Cleanup stale entries periodically
    this.cleanupInterval = setInterval(() => {
      this.parser.cleanup()
      this.taskTracker.cleanup()
    }, TASK_TRACKER_CLEANUP_INTERVAL_MS)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
    this.focusDetector.setWindow(window)
  }

  /** Expose the JSONL watcher so other subsystems (context-window analyzer)
   * can subscribe to `jsonlLine` events without reopening the same files. */
  getLogWatcher(): ClaudeLogWatcher {
    return this.logWatcher
  }

  /** Store references to managers for remote control command routing */
  setManagers(terminalManager: TerminalManager, projectStore: ProjectStore): void {
    this.terminalManagerRef = terminalManager
    this.projectStoreRef = projectStore
  }

  setActiveTerminal(terminalId: string | null): void {
    this.focusDetector.setActiveTerminal(terminalId)
  }

  setTerminalProject(terminalId: string, projectName: string): void {
    this.terminalProjects.set(terminalId, projectName)
  }

  setTerminalAgentType(terminalId: string, agentType: AgentType): void {
    this.terminalAgentTypes.set(terminalId, agentType)
  }

  getTerminalAgentType(terminalId: string): AgentType | undefined {
    return this.terminalAgentTypes.get(terminalId)
  }

  /**
   * Handle exit of a non-Claude agent terminal.
   * Generates taskComplete (exit 0) or taskFailed (exit non-zero) events.
   * Claude agents use JSONL transcripts instead — this is only for codex/gemini/aider.
   */
  handleAgentExit(terminalId: string, exitCode: number): void {
    const agentType = this.terminalAgentTypes.get(terminalId)
    // Skip Claude — uses ClaudeLogWatcher for taskComplete/taskFailed
    // Skip terminals without a detected agent (plain shell)
    if (!agentType || agentType === 'claude') return

    const projectName = this.terminalProjects.get(terminalId) || 'Unknown'
    const type = exitCode === 0 ? 'taskComplete' as const : 'taskFailed' as const
    const displayName = AGENT_DISPLAY_NAMES[agentType] || agentType

    const event: TaskEvent = {
      id: generateTaskEventId(terminalId, type, `${agentType}-exit-${exitCode}-${Date.now()}`),
      terminalId,
      type,
      taskName: exitCode === 0
        ? `${displayName} session completed`
        : `${displayName} exited with code ${exitCode}`,
      projectName,
      agentType,
      timestamp: Date.now()
    }

    this.handleTaskEvent(event)
  }

  /**
   * Register the working directory for a terminal.
   * Starts watching ~/.claude/projects/<hash>/ for JSONL transcript events.
   * Call this when a terminal is created with a known CWD.
   */
  registerTerminalCwd(terminalId: string, cwd: string): void {
    // Only watch JSONL transcripts for Claude terminals (or unknown — may be Claude)
    const agentType = this.terminalAgentTypes.get(terminalId)
    if (!agentType || agentType === 'claude') {
      this.logWatcher.register(cwd)
    }
    this.setTerminalProject(terminalId, path.basename(cwd))
  }

  clearTerminal(terminalId: string): void {
    this.terminalProjects.delete(terminalId)
    this.terminalAgentTypes.delete(terminalId)
    this.taskTracker.clearTerminal(terminalId)
    this.parser.clearTerminal(terminalId)
  }

  getFocusDetector(): FocusDetector {
    return this.focusDetector
  }

  getTaskTracker(): TaskTracker {
    return this.taskTracker
  }

  getSettings(): NotificationSettings {
    return {
      ...this.settings,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }
  }

  updateSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    this.settings = { ...this.settings, ...partial }

    // Persist user-configurable fields to disk
    const toPersist: Partial<NotificationSettings> = {}
    for (const key of PERSISTABLE_KEYS) {
      if (key in this.settings) {
        (toPersist as Record<string, unknown>)[key] = this.settings[key]
      }
    }
    this.store.set('notificationSettings', toPersist)

    // Update parser mode if changed
    if (partial.outputMode) {
      this.parser.setMode(partial.outputMode)
    }

    // Sync remote control if relevant settings changed
    if (partial.remoteControlEnabled !== undefined ||
        partial.telegramEnabled !== undefined) {
      this.syncRemoteControl()
    }

    return this.getSettings()
  }

  /** Start or stop remote control based on settings */
  syncRemoteControl(): void {
    const settings = this.getSettings()

    if (settings.remoteControlEnabled && settings.telegramEnabled && settings.telegramConfigured) {
      this.startRemoteControl()
    } else {
      this.stopRemoteControl()
    }
  }

  private startRemoteControl(): void {
    if (this.poller) return // Already running

    const creds = this.storage.getTelegram()
    if (!creds || !this.terminalManagerRef || !this.projectStoreRef) return

    const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
    this.commandRouter = new TelegramCommandRouter(
      this.terminalManagerRef,
      this.projectStoreRef,
      (text) => notifier.sendMarkdown(text)
    )

    // Refresh inline keyboard on every multi-select toggle so users see ⚪ → 🔘 live.
    this.commandRouter.onToggleEdit = (terminalId) => {
      const entry = pendingQuestionStore.get(terminalId)
      if (!entry || entry.messageId === undefined || entry.chatId === undefined) return
      const rows = notifier.buildQuestionKeyboardPublic(
        terminalId,
        entry.questionId,
        entry.question,
        'reviewNeeded',
        entry.selected
      )
      notifier.editReplyMarkup(entry.chatId, entry.messageId, { inline_keyboard: rows })
        .catch(err => console.error('[NotificationManager] editReplyMarkup failed', err))
    }

    // Register bot commands for Telegram autocomplete suggestions
    TelegramNotifier.registerBotCommands(creds.botToken).catch(console.error)

    this.poller = new TelegramPoller(creds.botToken, creds.chatId)
    this.poller.onMessage((text) => {
      this.commandRouter?.handle(text).catch(console.error)
    })
    this.poller.onCallback((callbackId, data) => {
      this.commandRouter?.handleCallback(callbackId, data).catch(console.error)
    })
    this.poller.onStatusChange((status) => {
      this.emitRemoteControlStatus(status)
    })

    // Listen for system suspend/resume
    this.suspendHandler = () => this.poller?.pause()
    this.resumeHandler = () => this.poller?.resume()
    this.on('system-suspend', this.suspendHandler)
    this.on('system-resume', this.resumeHandler)

    this.poller.start()
  }

  private stopRemoteControl(): void {
    if (!this.poller) return
    if (this.suspendHandler) this.off('system-suspend', this.suspendHandler)
    if (this.resumeHandler) this.off('system-resume', this.resumeHandler)
    this.suspendHandler = null
    this.resumeHandler = null
    this.poller.stop()
    this.poller = null
    this.commandRouter = null
    this.emitRemoteControlStatus('disconnected')
  }

  private emitRemoteControlStatus(status: RemoteControlStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_REMOTE_CONTROL_STATUS, status)
    }
  }

  getRemoteControlStatus(): RemoteControlStatus {
    return this.poller ? this.poller.getStatus() : 'disconnected'
  }

  // ─── Mobile control (Phase-02 hook receiver) ───────────────────────────

  async enableMobileControl(): Promise<MobileControlStatus> {
    if (!this.terminalManagerRef) {
      throw new Error('TerminalManager not attached — call setManagers() first')
    }
    if (!this.mobileControl) {
      const terminalManager = this.terminalManagerRef
      this.mobileControl = new MobileControlManager({
        resolveTerminalBySession: (sessionId) => terminalManager.findByClaudeSessionId(sessionId)?.id
      })
    }
    // Defensive: drop any prior listeners before (re)binding to prevent pile-up on repeated toggles.
    this.mobileControl.removeAllListeners('hook:event')
    this.mobileControl.removeAllListeners('status-changed')
    this.mobileControl.on('hook:event', (ev: { type: string; payload: Record<string, unknown> }) =>
      this.handleHookEvent(ev.type, ev.payload)
    )
    this.mobileControl.on('status-changed', (status: MobileControlStatus) =>
      this.emitMobileControlStatus(status)
    )
    const status = await this.mobileControl.enable()
    this.mobileControlEnabled = status.running
    return status
  }

  async disableMobileControl(): Promise<MobileControlStatus> {
    if (!this.mobileControl) {
      return {
        enabled: false,
        running: false,
        port: null,
        secretFingerprint: null,
        installStatus: { installed: false, eventCount: 0 },
        ccpokeDetected: false,
        ccpokeReasons: []
      }
    }
    const status = await this.mobileControl.disable()
    this.mobileControlEnabled = false
    return status
  }

  async getMobileControlStatus(): Promise<MobileControlStatus> {
    if (!this.mobileControl) {
      if (!this.terminalManagerRef) {
        return {
          enabled: false,
          running: false,
          port: null,
          secretFingerprint: null,
          installStatus: { installed: false, eventCount: 0 },
          ccpokeDetected: false,
          ccpokeReasons: []
        }
      }
      const terminalManager = this.terminalManagerRef
      this.mobileControl = new MobileControlManager({
        resolveTerminalBySession: (sessionId) => terminalManager.findByClaudeSessionId(sessionId)?.id
      })
    }
    return this.mobileControl.getStatus()
  }

  async regenerateMobileControlSecret(): Promise<MobileControlStatus> {
    if (!this.mobileControl) return this.getMobileControlStatus()
    const status = await this.mobileControl.regenerateSecret()
    this.mobileControlEnabled = status.running
    return status
  }

  private emitMobileControlStatus(status: MobileControlStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.MOBILE_CONTROL_STATUS_CHANGED, status)
    }
  }

  private handleHookEvent(type: string, payload: Record<string, unknown>): void {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''
    const terminalId = typeof payload.terminalId === 'string' ? payload.terminalId : ''
    if (!terminalId) return

    if (type === 'taskComplete') {
      const responseId = typeof payload.responseId === 'string' ? payload.responseId : undefined
      const summary = typeof payload.summary === 'string' ? payload.summary : ''
      const projectName = this.terminalProjects.get(terminalId) ?? 'Unknown'
      const event: TaskEvent = {
        id: generateTaskEventId(terminalId, 'taskComplete', `hook-${sessionId}-${Date.now()}`),
        terminalId,
        type: 'taskComplete',
        taskName: summary || 'Task completed',
        projectName,
        agentType: 'claude',
        responseId,
        timestamp: Date.now()
      }
      this.handleTaskEvent(event)
      return
    }
    if (type === 'reviewNeeded') {
      const question = payload.question as TaskEvent['question']
      const projectName = this.terminalProjects.get(terminalId) ?? 'Unknown'
      const event: TaskEvent = {
        id: generateTaskEventId(terminalId, 'reviewNeeded', `hook-askq-${Date.now()}`),
        terminalId,
        type: 'reviewNeeded',
        taskName: (question?.text || '').trim() || 'Question requires attention',
        projectName,
        agentType: 'claude',
        question,
        timestamp: Date.now()
      }
      this.handleTaskEvent(event)
      return
    }
    if (type === 'permissionRequested') {
      // Permission flow: treat as reviewNeeded so notifier + inline buttons render.
      // Phase-02 command-router learns the `permit:` callback separately.
      const toolName = typeof payload.toolName === 'string' ? payload.toolName : 'unknown'
      const permissionId = typeof payload.id === 'string' ? payload.id : ''
      const projectName = this.terminalProjects.get(terminalId) ?? 'Unknown'
      const event: TaskEvent = {
        id: generateTaskEventId(terminalId, 'reviewNeeded', `hook-perm-${permissionId}`),
        terminalId,
        type: 'reviewNeeded',
        taskName: `Permission request: ${toolName}`,
        projectName,
        agentType: 'claude',
        context: `permissionId=${permissionId}`,
        timestamp: Date.now()
      }
      this.handleTaskEvent(event)
      return
    }
  }

  /** Access the pending permission store (exposed for command-router wiring). */
  getPendingPermissionStore() {
    return pendingPermissionStore
  }

  // Process terminal output through the parser
  processOutput(terminalId: string, output: string): void {
    const projectName = this.terminalProjects.get(terminalId) || 'Unknown'
    const agentType = this.terminalAgentTypes.get(terminalId)
    this.parser.parse(terminalId, output, projectName, agentType)
  }

  private handleTaskEvent(event: TaskEvent): void {
    const settings = this.getSettings()

    // Check if event type is enabled
    const eventEnabled =
      (event.type === 'taskComplete' && settings.onTaskComplete) ||
      (event.type === 'taskFailed' && settings.onTaskFailed) ||
      (event.type === 'reviewNeeded' && settings.onReviewNeeded)

    if (!eventEnabled) return

    // Check focus (if notifyOnlyBackground is enabled)
    if (settings.notifyOnlyBackground) {
      if (!this.focusDetector.shouldNotify(event.terminalId)) {
        return // User is watching this terminal
      }
    }

    // Check dedup
    if (!this.taskTracker.shouldNotify(event.terminalId, event.id)) {
      return // Already notified for this task
    }

    // Trigger notification
    this.triggerNotification(event)
  }

  private async triggerNotification(event: TaskEvent): Promise<void> {
    const settings = this.getSettings()

    // Build message
    const message = settings.includeTaskSummary
      ? `${event.projectName}: ${event.taskName}`
      : event.taskName

    // Legacy NotificationEvent for renderer (sound playback)
    const legacyEvent: NotificationEvent = {
      type: event.type,
      terminalId: event.terminalId,
      message,
      timestamp: event.timestamp
    }

    // Send to renderer for sound playback
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_EVENT, legacyEvent)
    }

    // Show native notification
    this.showNativeNotification(event.type, message)

    // Send to external platforms with rich formatting
    await this.sendExternalNotifications(event)
  }

  private showNativeNotification(type: NotificationEventType, message: string): void {
    const titles: Record<NotificationEventType, string> = {
      taskComplete: '✅ Task Complete',
      taskFailed: '❌ Task Failed',
      reviewNeeded: '👀 Review Needed'
    }

    new Notification({
      title: titles[type],
      body: message.slice(0, 200)
    }).show()
  }

  private async sendExternalNotifications(event: TaskEvent): Promise<void> {
    const settings = this.getSettings()

    // Telegram with HTML formatting
    if (settings.telegramEnabled && settings.telegramConfigured) {
      const creds = this.storage.getTelegram()
      if (creds) {
        const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
        const terminalTitle = this.terminalManagerRef?.get(event.terminalId)?.title
        notifier.sendTaskEvent(event, terminalTitle).catch(console.error)
      }
    }

    // Discord with rich embed
    if (settings.discordEnabled && settings.discordConfigured) {
      const webhookUrl = this.storage.getDiscord()
      if (webhookUrl) {
        const notifier = new DiscordNotifier(webhookUrl)
        notifier.sendTaskEvent(event).catch(console.error)
      }
    }
  }

  // Telegram pairing (QR deep-link flow)

  async startTelegramPairing(botToken: string): Promise<{
    ok: boolean
    nonce?: string
    botUsername?: string
    error?: string
  }> {
    if (this.pairingAuthFlow && this.pairingAuthFlow.getState() === 'waiting') {
      return { ok: false, error: 'Pairing already in progress' }
    }

    // Reject malformed tokens before path-embedding them into the Bot API URL.
    // Telegram bot tokens: <numeric bot_id>:<alnum-with-_-, length ≥ 35>
    if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(botToken)) {
      return { ok: false, error: 'Invalid bot token format' }
    }

    // Validate token and capture username via getMe
    let botUsername: string
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      if (!res.ok) return { ok: false, error: `Invalid bot token (HTTP ${res.status})` }
      const data = (await res.json()) as {
        ok: boolean
        result?: { username?: string }
      }
      if (!data.ok || !data.result?.username) {
        return { ok: false, error: 'Bot has no username — create a bot via @BotFather' }
      }
      botUsername = data.result.username
    } catch (err) {
      return { ok: false, error: `Network error: ${String(err)}` }
    }

    // Start a fresh auth flow + transient poller
    const authFlow = new TelegramAuthFlow()
    const poller = new TelegramPoller(botToken, '0')
    poller.attachAuthFlow(authFlow)

    const cleanup = () => {
      poller.stop()
      this.pairingAuthFlow = null
      this.pairingPoller = null
      this.pairingBotToken = null
    }

    authFlow.on('pairingTimeout', () => {
      this.sendToRenderer(IPC_CHANNELS.TELEGRAM_PAIRING_TIMEOUT, undefined)
      cleanup()
    })
    authFlow.on('pairingWarning', (p: { chatId: number }) => {
      this.sendToRenderer(IPC_CHANNELS.TELEGRAM_PAIRING_WARNING, p)
    })
    authFlow.on('paired', (p: { chatId: number; botToken: string }) => {
      // Persist credentials and spin up the real remote-control poller.
      this.storage.setTelegram(p.botToken, String(p.chatId))
      this.settings.telegramConfigured = true
      this.updateSettings({ telegramEnabled: true })
      this.sendToRenderer(IPC_CHANNELS.TELEGRAM_PAIRED, {
        chatId: p.chatId,
        botToken: p.botToken
      })
      cleanup()
    })

    this.pairingAuthFlow = authFlow
    this.pairingPoller = poller
    this.pairingBotToken = botToken

    const { nonce } = authFlow.startPairing(botToken)
    poller.start().catch(err => console.error('[NotificationManager] pairing poll failed', err))

    this.sendToRenderer(IPC_CHANNELS.TELEGRAM_PAIRING_WAITING, { nonce, botUsername })
    return { ok: true, nonce, botUsername }
  }

  cancelTelegramPairing(): void {
    if (this.pairingAuthFlow) this.pairingAuthFlow.cancelPairing()
    if (this.pairingPoller) this.pairingPoller.stop()
    this.pairingAuthFlow = null
    this.pairingPoller = null
    this.pairingBotToken = null
  }

  getTelegramPairingStatus(): { state: 'idle' | 'waiting' | 'completed' } {
    return { state: this.pairingAuthFlow?.getState() ?? 'idle' }
  }

  private sendToRenderer(channel: string, payload: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  // Telegram methods
  getTelegramCredentials(): { botToken: string; chatId: string } | null {
    return this.storage.getTelegram()
  }

  setTelegram(botToken: string, chatId: string): void {
    this.storage.setTelegram(botToken, chatId)
    // Use updateSettings to persist telegramEnabled to disk and trigger syncRemoteControl
    this.updateSettings({ telegramEnabled: true })
  }

  clearTelegram(): void {
    this.storage.clearTelegram()
    // Use updateSettings to persist and trigger syncRemoteControl (stops poller)
    this.updateSettings({ telegramEnabled: false })
  }

  async testTelegram(botToken: string, chatId: string) {
    return TelegramNotifier.test(botToken, chatId)
  }

  // Discord methods
  setDiscord(webhookUrl: string): void {
    this.storage.setDiscord(webhookUrl)
    this.updateSettings({ discordEnabled: true })
  }

  clearDiscord(): void {
    this.storage.clearDiscord()
    this.updateSettings({ discordEnabled: false })
  }

  async testDiscord(webhookUrl: string) {
    return DiscordNotifier.test(webhookUrl)
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cancelTelegramPairing()
    this.stopRemoteControl()
    this.focusDetector.destroy()
    this.taskTracker.clearAll()
    this.terminalProjects.clear()
    this.terminalAgentTypes.clear()
    this.logWatcher.destroy()
  }
}
