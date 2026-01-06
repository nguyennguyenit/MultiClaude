import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramNotifier } from '../telegram-notifier'
import type { TaskEvent } from '@shared/types/notification-events'

describe('TelegramNotifier', () => {
  let notifier: TelegramNotifier

  beforeEach(() => {
    notifier = new TelegramNotifier('test-bot-token', 'test-chat-id')
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ ok: true })
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendTaskEvent', () => {
    const baseEvent: TaskEvent = {
      id: 'task-123',
      terminalId: 'term-1',
      type: 'taskComplete',
      taskName: 'Test task',
      projectName: 'TestProject',
      timestamp: Date.now()
    }

    it('sends formatted HTML message for taskComplete', async () => {
      const result = await notifier.sendTaskEvent(baseEvent)

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.parse_mode).toBe('HTML')
      expect(body.text).toContain('✅')
      expect(body.text).toContain('<b>Task Complete</b>')
      expect(body.text).toContain('<b>Project:</b> TestProject')
      expect(body.text).toContain('<b>Task:</b> Test task')
    })

    it('sends formatted HTML message for taskFailed', async () => {
      const event: TaskEvent = { ...baseEvent, type: 'taskFailed' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('❌')
      expect(body.text).toContain('<b>Task Failed</b>')
    })

    it('sends formatted HTML message for reviewNeeded', async () => {
      const event: TaskEvent = { ...baseEvent, type: 'reviewNeeded' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('👀')
      expect(body.text).toContain('<b>Review Needed</b>')
    })

    it('includes context when provided', async () => {
      const event: TaskEvent = { ...baseEvent, context: 'Additional info' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('<b>Context:</b> Additional info')
    })

    it('escapes HTML special characters', async () => {
      const event: TaskEvent = {
        ...baseEvent,
        taskName: 'Test <script>alert("xss")</script>',
        projectName: 'Project & "Test"'
      }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('&lt;script&gt;')
      expect(body.text).toContain('&amp;')
      expect(body.text).not.toContain('<script>')
    })
  })

  describe('escapeHtml (via formatTaskEvent)', () => {
    it('escapes ampersand', async () => {
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: 'A & B',
        projectName: 'Test',
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('A &amp; B')
    })

    it('escapes less-than', async () => {
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: 'A < B',
        projectName: 'Test',
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('A &lt; B')
    })

    it('escapes greater-than', async () => {
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: 'A > B',
        projectName: 'Test',
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.text).toContain('A &gt; B')
    })
  })

  describe('truncation', () => {
    it('truncates task name to 256 chars', async () => {
      const longTaskName = 'A'.repeat(300)
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: longTaskName,
        projectName: 'Test',
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      // The A's should be truncated to 256 chars
      const taskMatch = body.text.match(/<b>Task:<\/b> (A+)/)
      expect(taskMatch).not.toBeNull()
      expect(taskMatch![1]).toHaveLength(256)
    })

    it('truncates project name to 256 chars', async () => {
      const longProjectName = 'P'.repeat(300)
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: 'Test',
        projectName: longProjectName,
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      // The P's should be truncated to 256 chars
      const projectMatch = body.text.match(/<b>Project:<\/b> (P+)/)
      expect(projectMatch).not.toBeNull()
      expect(projectMatch![1]).toHaveLength(256)
    })

    it('truncates context to 256 chars', async () => {
      const longContext = 'C'.repeat(300)
      const event: TaskEvent = {
        id: 'task-1',
        terminalId: 'term-1',
        type: 'taskComplete',
        taskName: 'Test',
        projectName: 'Project',
        context: longContext,
        timestamp: Date.now()
      }

      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      // The C's should be truncated to 256 chars
      const contextMatch = body.text.match(/<b>Context:<\/b> (C+)/)
      expect(contextMatch).not.toBeNull()
      expect(contextMatch![1]).toHaveLength(256)
    })
  })
})
