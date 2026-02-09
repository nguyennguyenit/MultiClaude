# Phase 5: Rich Platform Messages

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Depends On:** Phase 4 (Integration)

## Overview

- **Priority:** P2
- **Status:** Done
- **Description:** Implement rich message formatting for Telegram (HTML) and Discord (Embeds)

## Key Insights

- Telegram supports HTML formatting via `parse_mode: 'HTML'`
- Discord webhooks support rich embeds with fields, colors, timestamps
- Include: project name, task name, terminal ID, duration (if available)

## Requirements

- Telegram: HTML formatted messages with bold labels
- Discord: Rich embeds with colored sidebar and structured fields
- Both: Emoji indicators, project/task info

## Related Code Files

**Modify:**
- `src/main/notification/telegram-notifier.ts`
- `src/main/notification/discord-notifier.ts`

## Implementation Steps

### 1. Update `src/main/notification/telegram-notifier.ts`

```typescript
import type { NotificationTestResult, TaskEvent, NotificationEventType } from '@shared/types'

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

  async sendTaskEvent(event: TaskEvent): Promise<boolean> {
    const message = this.formatTaskEvent(event)
    return this.send(message)
  }

  private formatTaskEvent(event: TaskEvent): string {
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

    const lines = [
      `${emoji[event.type]} <b>${titles[event.type]}</b>`,
      `<b>Project:</b> ${this.escapeHtml(event.projectName)}`,
      `<b>Task:</b> ${this.escapeHtml(event.taskName)}`
    ]

    if (event.context) {
      lines.push(`<b>Context:</b> ${this.escapeHtml(event.context)}`)
    }

    return lines.join('\n')
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  static async test(botToken: string, chatId: string): Promise<NotificationTestResult> {
    try {
      const notifier = new TelegramNotifier(botToken, chatId)
      const success = await notifier.send('🔔 <b>MultiClaude</b>: Test notification successful!')
      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check token and chat ID.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
```

### 2. Update `src/main/notification/discord-notifier.ts`

```typescript
import type { NotificationTestResult, TaskEvent, NotificationEventType } from '@shared/types'

interface DiscordEmbed {
  title: string
  color: number
  fields: Array<{ name: string; value: string; inline?: boolean }>
  timestamp?: string
  footer?: { text: string }
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

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
      return response.ok
    } catch (error) {
      console.error('[DiscordNotifier] Send failed:', error)
      return false
    }
  }

  async sendEmbed(payload: DiscordWebhookPayload): Promise<boolean> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      return response.ok
    } catch (error) {
      console.error('[DiscordNotifier] Send embed failed:', error)
      return false
    }
  }

  async sendTaskEvent(event: TaskEvent): Promise<boolean> {
    const embed = this.formatTaskEvent(event)
    return this.sendEmbed({ embeds: [embed] })
  }

  private formatTaskEvent(event: TaskEvent): DiscordEmbed {
    const config: Record<NotificationEventType, { title: string; color: number }> = {
      taskComplete: { title: '✅ Task Complete', color: 5763719 },    // Green
      taskFailed: { title: '❌ Task Failed', color: 15548997 },      // Red
      reviewNeeded: { title: '👀 Review Needed', color: 16776960 }   // Yellow
    }

    const { title, color } = config[event.type]

    const embed: DiscordEmbed = {
      title,
      color,
      fields: [
        { name: 'Project', value: event.projectName, inline: true },
        { name: 'Task', value: event.taskName.slice(0, 256), inline: false }
      ],
      timestamp: new Date(event.timestamp).toISOString(),
      footer: { text: 'MultiClaude' }
    }

    if (event.context) {
      embed.fields.push({ name: 'Context', value: event.context.slice(0, 256), inline: true })
    }

    return embed
  }

  static async test(webhookUrl: string): Promise<NotificationTestResult> {
    try {
      if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return { success: false, error: 'Invalid webhook URL format' }
      }

      const notifier = new DiscordNotifier(webhookUrl)
      const success = await notifier.sendEmbed({
        embeds: [{
          title: '🔔 Test Notification',
          color: 5814783,  // Blue
          fields: [
            { name: 'Status', value: 'Connection successful!', inline: true }
          ],
          footer: { text: 'MultiClaude' },
          timestamp: new Date().toISOString()
        }]
      })

      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check webhook URL.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
```

### 3. Update NotificationManager to use new methods

In `notification-manager.ts`, update `sendExternalNotifications()`:

```typescript
private async sendExternalNotifications(event: TaskEvent): Promise<void> {
  const settings = this.getSettings()

  // Telegram with HTML formatting
  if (settings.telegramEnabled && settings.telegramConfigured) {
    const creds = this.storage.getTelegram()
    if (creds) {
      const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
      notifier.sendTaskEvent(event).catch(console.error)
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
```

## Todo List

- [x] Add sendTaskEvent() method to TelegramNotifier
- [x] Add formatTaskEvent() helper with HTML escaping
- [x] Add sendEmbed() method to DiscordNotifier
- [x] Add sendTaskEvent() method to DiscordNotifier
- [x] Update test notification to use embeds for Discord
- [x] Update NotificationManager.sendExternalNotifications()

## Success Criteria

- [x] Telegram messages display with bold labels and proper formatting
- [x] Discord messages show as rich embeds with colored sidebar
- [x] Embeds include project name, task name, and timestamp
- [x] Test notifications use the new formatting
- [x] HTML special characters are escaped in Telegram

## Risk Assessment

- **Low:** Discord embed limits (6000 chars total, 256 per field)
- **Mitigation:** Truncate task name to 256 chars

## Security Considerations

- HTML escape user content in Telegram messages
- Truncate content to prevent abuse

## Next Steps

→ Phase 6: Settings UI
