import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DiscordNotifier } from '../discord-notifier'
import type { TaskEvent } from '@shared/types/notification-events'

describe('DiscordNotifier', () => {
  let notifier: DiscordNotifier
  const webhookUrl = 'https://discord.com/api/webhooks/123/abc'

  beforeEach(() => {
    notifier = new DiscordNotifier(webhookUrl)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendEmbed', () => {
    it('sends embed payload to webhook', async () => {
      const result = await notifier.sendEmbed({
        embeds: [{
          title: 'Test',
          color: 5763719,
          fields: [{ name: 'Field', value: 'Value' }]
        }]
      })

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(webhookUrl, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }))

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      expect(body.embeds).toHaveLength(1)
      expect(body.embeds[0].title).toBe('Test')
    })

    it('returns false on fetch error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await notifier.sendEmbed({ embeds: [] })

      expect(result).toBe(false)
    })

    it('returns false on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)

      const result = await notifier.sendEmbed({ embeds: [] })

      expect(result).toBe(false)
    })
  })

  describe('sendTaskEvent', () => {
    const baseEvent: TaskEvent = {
      id: 'task-123',
      terminalId: 'term-1',
      type: 'taskComplete',
      taskName: 'Test task',
      projectName: 'TestProject',
      timestamp: 1704067200000 // 2024-01-01T00:00:00.000Z
    }

    it('sends embed with correct title and color for taskComplete (green)', async () => {
      await notifier.sendTaskEvent(baseEvent)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds).toHaveLength(1)
      expect(body.embeds[0].title).toBe('✅ Task Complete')
      expect(body.embeds[0].color).toBe(5763719) // Green
    })

    it('sends embed with correct title and color for taskFailed (red)', async () => {
      const event: TaskEvent = { ...baseEvent, type: 'taskFailed' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds[0].title).toBe('❌ Task Failed')
      expect(body.embeds[0].color).toBe(15548997) // Red
    })

    it('sends embed with correct title and color for reviewNeeded (yellow)', async () => {
      const event: TaskEvent = { ...baseEvent, type: 'reviewNeeded' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds[0].title).toBe('👀 Review Needed')
      expect(body.embeds[0].color).toBe(16776960) // Yellow
    })

    it('includes project and task fields', async () => {
      await notifier.sendTaskEvent(baseEvent)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      const fields = body.embeds[0].fields

      expect(fields).toContainEqual({ name: 'Project', value: 'TestProject', inline: true })
      expect(fields).toContainEqual({ name: 'Task', value: 'Test task', inline: false })
    })

    it('includes context field when provided', async () => {
      const event: TaskEvent = { ...baseEvent, context: 'Additional context' }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      const fields = body.embeds[0].fields

      expect(fields).toContainEqual({ name: 'Context', value: 'Additional context', inline: true })
    })

    it('includes timestamp in ISO format', async () => {
      await notifier.sendTaskEvent(baseEvent)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds[0].timestamp).toBe('2024-01-01T00:00:00.000Z')
    })

    it('includes MultiClaude footer', async () => {
      await notifier.sendTaskEvent(baseEvent)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds[0].footer).toEqual({ text: 'MultiClaude' })
    })

    it('truncates task name to 256 chars', async () => {
      const longTaskName = 'A'.repeat(300)
      const event: TaskEvent = { ...baseEvent, taskName: longTaskName }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      const taskField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Task')

      expect(taskField.value).toHaveLength(256)
    })

    it('truncates project name to 256 chars', async () => {
      const longProjectName = 'P'.repeat(300)
      const event: TaskEvent = { ...baseEvent, projectName: longProjectName }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      const projectField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Project')

      expect(projectField.value).toHaveLength(256)
    })

    it('truncates context to 256 chars', async () => {
      const longContext = 'B'.repeat(300)
      const event: TaskEvent = { ...baseEvent, context: longContext }
      await notifier.sendTaskEvent(event)

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)
      const contextField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Context')

      expect(contextField.value).toHaveLength(256)
    })
  })

  describe('test (static)', () => {
    it('rejects invalid webhook URL', async () => {
      const result = await DiscordNotifier.test('https://example.com/webhook')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid webhook URL')
    })

    it('sends test embed on valid webhook', async () => {
      const result = await DiscordNotifier.test(webhookUrl)

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalled()

      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(options?.body as string)

      expect(body.embeds[0].title).toBe('🔔 Test Notification')
      expect(body.embeds[0].color).toBe(5814783) // Blue
    })
  })
})
