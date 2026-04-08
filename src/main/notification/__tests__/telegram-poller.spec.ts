import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramPoller } from '../telegram-poller'

describe('TelegramPoller', () => {
  let poller: TelegramPoller
  const botToken = 'test-bot-token'
  const chatId = '12345'

  beforeEach(() => {
    vi.useFakeTimers()
    poller = new TelegramPoller(botToken, chatId)
  })

  afterEach(() => {
    poller.stop()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('auth', () => {
    it('calls onMessage for whitelisted chat ID', async () => {
      const onMessage = vi.fn()
      poller.onMessage(onMessage)

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: [{
            update_id: 1,
            message: { chat: { id: 12345 }, text: '/status' }
          }]
        })
      } as Response)

      await poller.pollOnce()
      expect(onMessage).toHaveBeenCalledWith('/status')
    })

    it('ignores messages from non-whitelisted chat ID', async () => {
      const onMessage = vi.fn()
      poller.onMessage(onMessage)

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: [{
            update_id: 1,
            message: { chat: { id: 99999 }, text: '/status' }
          }]
        })
      } as Response)

      await poller.pollOnce()
      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('offset tracking', () => {
    it('increments offset after processing update', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [{
              update_id: 42,
              message: { chat: { id: 12345 }, text: '/help' }
            }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: [] })
        } as Response)

      poller.onMessage(vi.fn())
      await poller.pollOnce()
      await poller.pollOnce()

      const secondCall = vi.mocked(fetch).mock.calls[1]
      const url = secondCall[0] as string
      expect(url).toContain('offset=43')
    })
  })

  describe('error handling', () => {
    it('reports error status on fetch failure', async () => {
      const onStatus = vi.fn()
      poller.onStatusChange(onStatus)

      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      await poller.pollOnce()
      expect(onStatus).toHaveBeenCalledWith('reconnecting')
    })

    it('skips stale queued commands after reconnecting', async () => {
      const onMessage = vi.fn()
      poller.onMessage(onMessage)

      vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [{
              update_id: 7,
              message: { chat: { id: 12345 }, text: '/status' }
            }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: [] })
        } as Response)

      await poller.pollOnce()
      await poller.pollOnce()

      expect(onMessage).not.toHaveBeenCalled()
      expect(vi.mocked(fetch).mock.calls[1][0]).toContain('offset=-1&timeout=0')
      expect(vi.mocked(fetch).mock.calls[2][0]).toContain('offset=8')
    })

    it('reports error status on 401 (invalid token)', async () => {
      const onStatus = vi.fn()
      poller.onStatusChange(onStatus)

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ ok: false, description: 'Unauthorized' })
      } as Response)

      await poller.pollOnce()
      expect(onStatus).toHaveBeenCalledWith('error')
    })
  })

  describe('lifecycle', () => {
    it('sets status to disconnected after stop', () => {
      const onStatus = vi.fn()
      poller.onStatusChange(onStatus)

      poller.stop()
      expect(onStatus).toHaveBeenCalledWith('disconnected')
    })
  })

  describe('callback_query', () => {
    it('calls onCallback for whitelisted chat callback', async () => {
      const onCallback = vi.fn()
      poller.onCallback(onCallback)

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [{
              update_id: 10,
              callback_query: {
                id: 'cq-123',
                from: { id: 12345 },
                data: 'tail:term-abc',
                message: { message_id: 99, chat: { id: 12345 } }
              }
            }]
          })
        } as Response)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)

      await poller.pollOnce()
      expect(onCallback).toHaveBeenCalledWith('cq-123', 'tail:term-abc')
    })

    it('ignores callback_query from non-whitelisted chat', async () => {
      const onCallback = vi.fn()
      poller.onCallback(onCallback)

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [{
              update_id: 11,
              callback_query: {
                id: 'cq-456',
                from: { id: 99999 },
                data: 'tail:term-abc',
                message: { message_id: 99, chat: { id: 99999 } }
              }
            }]
          })
        } as Response)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)

      await poller.pollOnce()
      expect(onCallback).not.toHaveBeenCalled()
    })

    it('does not answer callback query when chat is not whitelisted', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [{
              update_id: 12,
              callback_query: {
                id: 'cq-789',
                from: { id: 99999 },
                data: 'tail:term-abc',
                message: { message_id: 99, chat: { id: 99999 } }
              }
            }]
          })
        } as Response)

      await poller.pollOnce()

      // Only the getUpdates call should have been made — no answerCallbackQuery for unauthorized chat
      expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
      expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('answerCallbackQuery')
    })
  })
})
