import type { NotificationTestResult, NotificationEventType } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'

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
  private static readonly MAX_FIELD_LENGTH = 256
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
      taskComplete: { title: '✅ Task Complete', color: 5763719 },  // Green
      taskFailed: { title: '❌ Task Failed', color: 15548997 },    // Red
      reviewNeeded: { title: '👀 Review Needed', color: 16776960 } // Yellow
    }

    const { title, color } = config[event.type]

    const embed: DiscordEmbed = {
      title,
      color,
      fields: [
        { name: 'Project', value: event.projectName.slice(0, DiscordNotifier.MAX_FIELD_LENGTH), inline: true },
        { name: 'Task', value: event.taskName.slice(0, DiscordNotifier.MAX_FIELD_LENGTH), inline: false }
      ],
      timestamp: new Date(event.timestamp).toISOString(),
      footer: { text: 'MultiClaude' }
    }

    if (event.context) {
      embed.fields.push({ name: 'Context', value: event.context.slice(0, DiscordNotifier.MAX_FIELD_LENGTH), inline: true })
    }

    return embed
  }

  static async test(webhookUrl: string): Promise<NotificationTestResult> {
    try {
      // Validate URL format
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
