import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendTaskEventMock, showMock, watcherInstances } = vi.hoisted(() => ({
  sendTaskEventMock: vi.fn<(event: { terminalId: string }, title?: string) => Promise<boolean>>(),
  showMock: vi.fn(),
  watcherInstances: [] as EventEmitter[]
}))

vi.mock('electron', () => ({
  BrowserWindow: class {},
  Notification: class {
    show = showMock
  }
}))

vi.mock('../secure-storage', () => ({
  SecureStorage: class {
    hasTelegram() { return true }
    hasDiscord() { return false }
    getTelegram() { return { botToken: 'token', chatId: 'chat-id' } }
    getDiscord() { return null }
    setTelegram() {}
    clearTelegram() {}
    setDiscord() {}
    clearDiscord() {}
  }
}))

vi.mock('../telegram-notifier', () => ({
  TelegramNotifier: class {
    sendTaskEvent = sendTaskEventMock
    sendMarkdown = vi.fn()
    static registerBotCommands = vi.fn()
    static test = vi.fn()
  }
}))

vi.mock('../discord-notifier', () => ({
  DiscordNotifier: class {
    sendTaskEvent = vi.fn()
    static test = vi.fn()
  }
}))

vi.mock('../claude-log-watcher', async () => {
  const { EventEmitter } = await import('events')
  return {
    ClaudeLogWatcher: class extends EventEmitter {
      register = vi.fn()
      destroy = vi.fn()

      constructor() {
        super()
        watcherInstances.push(this)
      }
    }
  }
})

import { NotificationManager } from '../notification-manager'

describe('NotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    watcherInstances.length = 0
    sendTaskEventMock.mockResolvedValue(true)
  })

  it('attaches Claude session IDs from JSONL events before sending Telegram callbacks', async () => {
    const terminalManager = {
      findByClaudeSessionId: vi.fn().mockReturnValue(undefined),
      attachClaudeSession: vi.fn().mockReturnValue({ id: 'term-1' }),
      get: vi.fn().mockReturnValue({ title: 'Terminal 1' })
    }

    const manager = new NotificationManager()
    manager.setManagers(terminalManager as never, {} as never)
    manager.updateSettings({ telegramEnabled: true, notifyOnlyBackground: false })

    watcherInstances[0].emit('taskEvent', {
      id: 'evt-1',
      terminalId: 'claude-session-1',
      type: 'taskComplete',
      taskName: 'Build completed',
      projectName: 'MultiClaude',
      cwd: '/Users/plateau/Project/MultiClaude',
      timestamp: Date.now()
    })

    await vi.waitFor(() => {
      expect(terminalManager.attachClaudeSession).toHaveBeenCalledWith(
        'claude-session-1',
        '/Users/plateau/Project/MultiClaude'
      )
      expect(sendTaskEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalId: 'term-1',
          agentType: 'claude'
        }),
        'Terminal 1'
      )
    })

    manager.destroy()
  })
})
