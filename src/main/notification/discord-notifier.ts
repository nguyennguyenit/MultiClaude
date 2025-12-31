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
