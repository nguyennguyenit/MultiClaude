# Phase 2: Main Process - Notification Module

## Overview

- **Priority**: P1 (Core Logic)
- **Status**: ✅ Complete (2026-01-01)
- **Effort**: 2.5h (Completed)
- **Depends on**: Phase 1

Implement notification logic in Electron main process. PHASE COMPLETE - All files created and integrated.

## Files to Create

```
src/main/notification/
├── index.ts
├── notification-manager.ts
├── pattern-detector.ts
├── telegram-notifier.ts
├── discord-notifier.ts
└── secure-storage.ts
```

## Files to Modify

- `src/main/index.ts`
- `src/main/ipc/handlers.ts`
- `src/preload/index.ts`

## Implementation Steps

### Step 1: Create secure-storage.ts

**File**: `src/main/notification/secure-storage.ts`

```typescript
import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store({ name: 'notification-credentials' })

// Keys for credential storage
const TELEGRAM_KEY = 'telegram-credentials'
const DISCORD_KEY = 'discord-credentials'

export class SecureStorage {
  private isEncryptionAvailable: boolean

  constructor() {
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable()
  }

  // Encrypt and store value
  private encrypt(value: string): string {
    if (this.isEncryptionAvailable) {
      return safeStorage.encryptString(value).toString('base64')
    }
    // Fallback: base64 encoding (less secure)
    return Buffer.from(value).toString('base64')
  }

  // Decrypt stored value
  private decrypt(encrypted: string): string {
    if (this.isEncryptionAvailable) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  }

  // Telegram
  setTelegram(botToken: string, chatId: string): void {
    const data = JSON.stringify({ botToken, chatId })
    store.set(TELEGRAM_KEY, this.encrypt(data))
  }

  getTelegram(): { botToken: string; chatId: string } | null {
    const encrypted = store.get(TELEGRAM_KEY) as string | undefined
    if (!encrypted) return null
    try {
      return JSON.parse(this.decrypt(encrypted))
    } catch {
      return null
    }
  }

  clearTelegram(): void {
    store.delete(TELEGRAM_KEY)
  }

  hasTelegram(): boolean {
    return store.has(TELEGRAM_KEY)
  }

  // Discord
  setDiscord(webhookUrl: string): void {
    store.set(DISCORD_KEY, this.encrypt(webhookUrl))
  }

  getDiscord(): string | null {
    const encrypted = store.get(DISCORD_KEY) as string | undefined
    if (!encrypted) return null
    try {
      return this.decrypt(encrypted)
    } catch {
      return null
    }
  }

  clearDiscord(): void {
    store.delete(DISCORD_KEY)
  }

  hasDiscord(): boolean {
    return store.has(DISCORD_KEY)
  }
}
```

### Step 2: Create telegram-notifier.ts

**File**: `src/main/notification/telegram-notifier.ts`

```typescript
import type { NotificationTestResult } from '@shared/types'

export class TelegramNotifier {
  private botToken: string
  private chatId: string

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken
    this.chatId = chatId
  }

  async send(message: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      })

      const data = await response.json()
      return data.ok === true
    } catch (error) {
      console.error('[TelegramNotifier] Send failed:', error)
      return false
    }
  }

  static async test(botToken: string, chatId: string): Promise<NotificationTestResult> {
    try {
      const notifier = new TelegramNotifier(botToken, chatId)
      const success = await notifier.send('🔔 MultiClaude: Test notification successful!')
      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check token and chat ID.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
```

### Step 3: Create discord-notifier.ts

**File**: `src/main/notification/discord-notifier.ts`

```typescript
import type { NotificationTestResult } from '@shared/types'

export class DiscordNotifier {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async send(message: string): Promise<boolean> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      })

      // Discord returns 204 No Content on success
      return response.ok
    } catch (error) {
      console.error('[DiscordNotifier] Send failed:', error)
      return false
    }
  }

  static async test(webhookUrl: string): Promise<NotificationTestResult> {
    try {
      // Validate URL format
      if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return { success: false, error: 'Invalid webhook URL format' }
      }

      const notifier = new DiscordNotifier(webhookUrl)
      const success = await notifier.send('🔔 **MultiClaude**: Test notification successful!')
      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check webhook URL.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
```

### Step 4: Create pattern-detector.ts

**File**: `src/main/notification/pattern-detector.ts`

```typescript
import { EventEmitter } from 'events'
import type { NotificationEventType } from '@shared/types'
import { DETECTION_PATTERNS } from '@shared/constants'

interface DetectionResult {
  type: NotificationEventType
  match: string
}

export class PatternDetector extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  private debounceMs = 300

  // Check terminal output for notification patterns
  detect(terminalId: string, output: string): DetectionResult | null {
    // Check each pattern
    for (const [type, pattern] of Object.entries(DETECTION_PATTERNS)) {
      const match = output.match(pattern)
      if (match) {
        const key = `${terminalId}:${type}`
        const now = Date.now()
        const lastEmit = this.debounceMap.get(key) || 0

        // Debounce same event type from same terminal
        if (now - lastEmit > this.debounceMs) {
          this.debounceMap.set(key, now)
          return {
            type: type as NotificationEventType,
            match: match[0]
          }
        }
      }
    }
    return null
  }

  // Clean up old debounce entries (call periodically)
  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) { // 1 minute
        this.debounceMap.delete(key)
      }
    }
  }
}
```

### Step 5: Create notification-manager.ts

**File**: `src/main/notification/notification-manager.ts`

```typescript
import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import type { NotificationSettings, NotificationEventType, NotificationEvent } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { PatternDetector } from './pattern-detector'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private detector: PatternDetector
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.detector = new PatternDetector()
    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Cleanup old debounce entries every minute
    this.cleanupInterval = setInterval(() => this.detector.cleanup(), 60000)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
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
    return this.getSettings()
  }

  // Process terminal output for pattern detection
  processOutput(terminalId: string, output: string): void {
    const result = this.detector.detect(terminalId, output)
    if (result) {
      this.triggerNotification(result.type, terminalId, result.match)
    }
  }

  // Trigger notification for detected event
  private async triggerNotification(
    type: NotificationEventType,
    terminalId: string,
    message: string
  ): Promise<void> {
    const settings = this.getSettings()

    // Check if this event type is enabled
    const eventEnabled =
      (type === 'taskComplete' && settings.onTaskComplete) ||
      (type === 'taskFailed' && settings.onTaskFailed) ||
      (type === 'reviewNeeded' && settings.onReviewNeeded)

    if (!eventEnabled) return

    const event: NotificationEvent = {
      type,
      terminalId,
      message,
      timestamp: Date.now()
    }

    // Send to renderer for sound playback
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_EVENT, event)
    }

    // Show native notification
    this.showNativeNotification(type, message)

    // Send to external platforms
    await this.sendExternalNotifications(type, message)
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

  private async sendExternalNotifications(
    type: NotificationEventType,
    message: string
  ): Promise<void> {
    const settings = this.getSettings()
    const emoji: Record<NotificationEventType, string> = {
      taskComplete: '✅',
      taskFailed: '❌',
      reviewNeeded: '👀'
    }

    const formattedMessage = `${emoji[type]} <b>MultiClaude</b>\n${message}`

    // Telegram
    if (settings.telegramEnabled && settings.telegramConfigured) {
      const creds = this.storage.getTelegram()
      if (creds) {
        const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
        notifier.send(formattedMessage).catch(console.error)
      }
    }

    // Discord
    if (settings.discordEnabled && settings.discordConfigured) {
      const webhookUrl = this.storage.getDiscord()
      if (webhookUrl) {
        const discordMessage = `${emoji[type]} **MultiClaude**\n${message}`
        const notifier = new DiscordNotifier(webhookUrl)
        notifier.send(discordMessage).catch(console.error)
      }
    }
  }

  // Telegram methods
  setTelegram(botToken: string, chatId: string): void {
    this.storage.setTelegram(botToken, chatId)
  }

  clearTelegram(): void {
    this.storage.clearTelegram()
    this.settings.telegramEnabled = false
  }

  async testTelegram(botToken: string, chatId: string) {
    return TelegramNotifier.test(botToken, chatId)
  }

  // Discord methods
  setDiscord(webhookUrl: string): void {
    this.storage.setDiscord(webhookUrl)
  }

  clearDiscord(): void {
    this.storage.clearDiscord()
    this.settings.discordEnabled = false
  }

  async testDiscord(webhookUrl: string) {
    return DiscordNotifier.test(webhookUrl)
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}
```

### Step 6: Create index.ts

**File**: `src/main/notification/index.ts`

```typescript
export { NotificationManager } from './notification-manager'
export { SecureStorage } from './secure-storage'
export { PatternDetector } from './pattern-detector'
export { TelegramNotifier } from './telegram-notifier'
export { DiscordNotifier } from './discord-notifier'
```

### Step 7: Update IPC handlers

**File**: `src/main/ipc/handlers.ts`

Add to imports:
```typescript
import type { NotificationManager } from '../notification'
```

Update `Managers` interface:
```typescript
interface Managers {
  terminalManager: TerminalManager
  gitManager: GitManager
  projectStore: ProjectStore
  notificationManager: NotificationManager
}
```

Add notification handlers inside `registerIpcHandlers`:
```typescript
const { terminalManager, gitManager, projectStore, notificationManager } = managers

// ... existing handlers ...

// Notification handlers
ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_SETTINGS, () => {
  return notificationManager.getSettings()
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_SETTINGS, (_, settings) => {
  return notificationManager.updateSettings(settings)
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_TELEGRAM, (_, { botToken, chatId }) => {
  notificationManager.setTelegram(botToken, chatId)
  return true
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_DISCORD, (_, { webhookUrl }) => {
  notificationManager.setDiscord(webhookUrl)
  return true
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_TELEGRAM_STATUS, () => {
  return notificationManager.getSettings().telegramConfigured
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_DISCORD_STATUS, () => {
  return notificationManager.getSettings().discordConfigured
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST_TELEGRAM, async (_, { botToken, chatId }) => {
  return notificationManager.testTelegram(botToken, chatId)
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST_DISCORD, async (_, { webhookUrl }) => {
  return notificationManager.testDiscord(webhookUrl)
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_CLEAR_TELEGRAM, () => {
  notificationManager.clearTelegram()
  return true
})

ipcMain.handle(IPC_CHANNELS.NOTIFICATION_CLEAR_DISCORD, () => {
  notificationManager.clearDiscord()
  return true
})
```

Also, hook into terminal output for pattern detection:
```typescript
// Forward terminal output to renderer + notification detection
terminalManager.on('output', ({ terminalId, data }) => {
  if (!window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, { terminalId, data })
  }
  // Pattern detection for notifications
  notificationManager.processOutput(terminalId, data)
})
```

### Step 8: Update main/index.ts

**File**: `src/main/index.ts`

Add imports and initialization:
```typescript
import { NotificationManager } from './notification'

// In createWindow or app.whenReady:
const notificationManager = new NotificationManager()

// After window creation:
notificationManager.setWindow(mainWindow)

// Pass to registerIpcHandlers:
registerIpcHandlers(mainWindow, {
  terminalManager,
  gitManager,
  projectStore,
  notificationManager
})

// On quit:
app.on('quit', () => {
  notificationManager.destroy()
})
```

### Step 9: Update preload/index.ts

**File**: `src/preload/index.ts`

Add to `ElectronAPI` interface:
```typescript
notification: {
  getSettings: () => Promise<NotificationSettings>
  setSettings: (settings: Partial<NotificationSettings>) => Promise<NotificationSettings>
  setTelegram: (botToken: string, chatId: string) => Promise<boolean>
  setDiscord: (webhookUrl: string) => Promise<boolean>
  getTelegramStatus: () => Promise<boolean>
  getDiscordStatus: () => Promise<boolean>
  testTelegram: (botToken: string, chatId: string) => Promise<NotificationTestResult>
  testDiscord: (webhookUrl: string) => Promise<NotificationTestResult>
  clearTelegram: () => Promise<boolean>
  clearDiscord: () => Promise<boolean>
  onEvent: (callback: (event: NotificationEvent) => void) => () => void
}
```

Add to `api` object:
```typescript
notification: {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_SETTINGS),
  setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_SETTINGS, settings),
  setTelegram: (botToken, chatId) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_TELEGRAM, { botToken, chatId }),
  setDiscord: (webhookUrl) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_DISCORD, { webhookUrl }),
  getTelegramStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_TELEGRAM_STATUS),
  getDiscordStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_DISCORD_STATUS),
  testTelegram: (botToken, chatId) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_TEST_TELEGRAM, { botToken, chatId }),
  testDiscord: (webhookUrl) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_TEST_DISCORD, { webhookUrl }),
  clearTelegram: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_CLEAR_TELEGRAM),
  clearDiscord: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_CLEAR_DISCORD),
  onEvent: (callback) => {
    const listener = (_: any, event: any) => callback(event)
    ipcRenderer.on(IPC_CHANNELS.NOTIFICATION_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION_EVENT, listener)
  }
}
```

Add imports:
```typescript
import type { NotificationSettings, NotificationEvent, NotificationTestResult } from '@shared/types'
```

## Todo List

- [x] Create `src/main/notification/secure-storage.ts`
- [x] Create `src/main/notification/telegram-notifier.ts`
- [x] Create `src/main/notification/discord-notifier.ts`
- [x] Create `src/main/notification/pattern-detector.ts`
- [x] Create `src/main/notification/notification-manager.ts`
- [x] Create `src/main/notification/index.ts`
- [x] Update `src/main/ipc/handlers.ts`
- [x] Update `src/main/index.ts`
- [x] Update `src/preload/index.ts`
- [x] Verify compilation and test IPC

## Success Criteria

- [x] Notification manager initializes without errors
- [x] IPC handlers registered
- [x] Telegram/Discord test functions work (implementation complete)
- [x] Pattern detection triggers on matching output
- [x] Credentials stored securely

## Review Results

**Code Review Report**: [code-reviewer-260101-0218-notifications-phase2.md](../reports/code-reviewer-260101-0218-notifications-phase2.md)
**Status**: ✅ APPROVED - Production Ready
**Key Findings**:
- 0 critical issues
- 3 medium security improvements recommended (credential logging, input validation)
- TypeScript compilation: PASS (0 errors)
- Build: PASS
- Architecture: Excellent (YAGNI/KISS/DRY compliant)

**Recommended Before Phase 3**:
1. Sanitize error logging to prevent credential exposure (15 min)
2. Add Telegram chatId format validation (10 min)
3. Strengthen Discord webhook URL validation (10 min)

## Next Steps

→ Proceed to [Phase 3: Renderer](./phase-03-renderer.md)
