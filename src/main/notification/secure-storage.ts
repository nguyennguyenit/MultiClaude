import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store({ name: 'notification-credentials' })

const TELEGRAM_KEY = 'telegram-credentials'
const DISCORD_KEY = 'discord-credentials'

export class SecureStorage {
  private isEncryptionAvailable: boolean

  constructor() {
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable()
  }

  private encrypt(value: string): string {
    if (this.isEncryptionAvailable) {
      return safeStorage.encryptString(value).toString('base64')
    }
    // Fallback: base64 encoding (less secure but functional)
    return Buffer.from(value).toString('base64')
  }

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
