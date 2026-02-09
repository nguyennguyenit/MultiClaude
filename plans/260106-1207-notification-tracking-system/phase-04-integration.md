# Phase 4: NotificationManager Integration

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Depends On:** Phase 2 (Output Parser), Phase 3 (Focus & Dedup)

## Overview

- **Priority:** P2
- **Status:** Done
- **Description:** Integrate OutputParser, FocusDetector, and TaskTracker into NotificationManager

## Key Insights

- Replace PatternDetector with OutputParser
- Add FocusDetector and TaskTracker as dependencies
- Modify triggerNotification() to use enhanced TaskEvent data
- Keep backward compatibility with existing settings

## Requirements

- Integrate all new components into NotificationManager
- Update processOutput() to use OutputParser
- Add focus and dedup checks before notification
- Support new settings (notifyOnlyBackground, includeTaskSummary)

## Related Code Files

**Modify:**
- `src/main/notification/notification-manager.ts`
- `src/main/notification/index.ts`

**Reference (will be deprecated):**
- `src/main/notification/pattern-detector.ts`

## Implementation Steps

### 1. Update `src/main/notification/notification-manager.ts`

```typescript
import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import type { NotificationSettings, NotificationEventType, NotificationEvent, TaskEvent } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { OutputParser } from './output-parser'
import { FocusDetector } from './focus-detector'
import { TaskTracker } from './task-tracker'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private parser: OutputParser
  private focusDetector: FocusDetector
  private taskTracker: TaskTracker
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  // Map terminalId -> projectName for context
  private terminalProjects: Map<string, string> = new Map()

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.parser = new OutputParser()
    this.focusDetector = new FocusDetector()
    this.taskTracker = new TaskTracker()

    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Listen for task events from parser
    this.parser.on('taskEvent', (event: TaskEvent) => {
      this.handleTaskEvent(event)
    })

    // Cleanup stale entries every minute
    this.cleanupInterval = setInterval(() => {
      this.taskTracker.cleanup()
    }, 60000)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
    this.focusDetector.setWindow(window)
  }

  setActiveTerminal(terminalId: string | null): void {
    this.focusDetector.setActiveTerminal(terminalId)
  }

  setTerminalProject(terminalId: string, projectName: string): void {
    this.terminalProjects.set(terminalId, projectName)
  }

  clearTerminal(terminalId: string): void {
    this.terminalProjects.delete(terminalId)
    this.taskTracker.clearTerminal(terminalId)
    this.parser.clearTerminal(terminalId)
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

    // Update parser mode if changed
    if (partial.outputMode) {
      this.parser.setMode(partial.outputMode)
    }

    return this.getSettings()
  }

  // Process terminal output
  processOutput(terminalId: string, output: string): void {
    const projectName = this.terminalProjects.get(terminalId) || 'Unknown'
    this.parser.parse(terminalId, output, projectName)
  }

  private handleTaskEvent(event: TaskEvent): void {
    // Check if event type is enabled
    const settings = this.getSettings()
    const eventEnabled =
      (event.type === 'taskComplete' && settings.onTaskComplete) ||
      (event.type === 'taskFailed' && settings.onTaskFailed) ||
      (event.type === 'reviewNeeded' && settings.onReviewNeeded)

    if (!eventEnabled) return

    // Check focus (if notifyOnlyBackground is enabled)
    if (settings.notifyOnlyBackground) {
      if (!this.focusDetector.shouldNotify(event.terminalId)) {
        return  // User is watching this terminal
      }
    }

    // Check dedup
    if (!this.taskTracker.shouldNotify(event.terminalId, event.id)) {
      return  // Already notified for this task
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

    // Legacy NotificationEvent for renderer
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
    this.showNativeNotification(event, message)

    // Send to external platforms with rich formatting
    await this.sendExternalNotifications(event)
  }

  private showNativeNotification(event: TaskEvent, message: string): void {
    const titles: Record<NotificationEventType, string> = {
      taskComplete: '✅ Task Complete',
      taskFailed: '❌ Task Failed',
      reviewNeeded: '👀 Review Needed'
    }

    new Notification({
      title: titles[event.type],
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
        const message = this.formatTelegramMessage(event)
        notifier.send(message).catch(console.error)
      }
    }

    // Discord with embed (handled in discord-notifier in Phase 5)
    if (settings.discordEnabled && settings.discordConfigured) {
      const webhookUrl = this.storage.getDiscord()
      if (webhookUrl) {
        const notifier = new DiscordNotifier(webhookUrl)
        const message = this.formatDiscordMessage(event)
        notifier.send(message).catch(console.error)
      }
    }
  }

  private formatTelegramMessage(event: TaskEvent): string {
    const emoji: Record<NotificationEventType, string> = {
      taskComplete: '✅',
      taskFailed: '❌',
      reviewNeeded: '👀'
    }
    const titles: Record<NotificationEventType, string> = {
      taskComplete: 'Task Complete',
      taskFailed: 'Task Failed',
      reviewNeeded: 'Review Needed'
    }

    return [
      `${emoji[event.type]} <b>${titles[event.type]}</b>`,
      `<b>Project:</b> ${event.projectName}`,
      `<b>Task:</b> ${event.taskName}`
    ].join('\n')
  }

  private formatDiscordMessage(event: TaskEvent): string {
    // Simple markdown for now, Phase 5 adds embeds
    const emoji: Record<NotificationEventType, string> = {
      taskComplete: '✅',
      taskFailed: '❌',
      reviewNeeded: '👀'
    }

    return `${emoji[event.type]} **${event.projectName}**: ${event.taskName}`
  }

  // ... keep existing Telegram/Discord methods (setTelegram, clearTelegram, etc.)

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.focusDetector.destroy()
  }
}
```

### 2. Update `src/main/notification/index.ts`

```typescript
export { NotificationManager } from './notification-manager'
export { SecureStorage } from './secure-storage'
export { OutputParser } from './output-parser'
export { JsonStreamParser } from './json-stream-parser'
export { PlainTextParser } from './plain-text-parser'
export { FocusDetector } from './focus-detector'
export { TaskTracker } from './task-tracker'
export { TelegramNotifier } from './telegram-notifier'
export { DiscordNotifier } from './discord-notifier'
// Deprecated, kept for reference
export { PatternDetector } from './pattern-detector'
```

## Todo List

- [x] Update NotificationManager to use OutputParser
- [x] Integrate FocusDetector for background-only notifications
- [x] Integrate TaskTracker for deduplication
- [x] Add setActiveTerminal() method
- [x] Add setTerminalProject() method
- [x] Add clearTerminal() method
- [x] Update formatTelegramMessage() for rich formatting
- [x] Update exports in index.ts
- [x] Integration test: end-to-end notification flow

## Success Criteria

- [x] Notifications include project name and task name
- [x] Background-only setting prevents notifications when watching terminal
- [x] Same task doesn't trigger duplicate notifications
- [x] Telegram messages use HTML formatting
- [x] Existing test/configure functionality still works

## Risk Assessment

- **Medium:** Breaking change if PatternDetector is used elsewhere
- **Mitigation:** Keep PatternDetector exported, deprecate later

## Security Considerations

- Continue using SecureStorage for credentials
- No new external data exposure

## Next Steps

→ Phase 5: Rich Platform Messages
