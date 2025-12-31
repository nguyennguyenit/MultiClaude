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
