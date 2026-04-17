import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramPoller } from '../telegram-poller'
import { TelegramAuthFlow } from '../telegram-auth-flow'

/**
 * Tests focus on the new pairing hook: during a pairing window, `/start mc-pair-<nonce>`
 * from ANY chatId must call completePairing when the nonce matches exactly, and MUST NOT
 * forward the /start text to the regular messageHandler.
 */
describe('TelegramPoller — pairing /start', () => {
  let authFlow: TelegramAuthFlow
  let poller: TelegramPoller
  let fetchMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    authFlow = new TelegramAuthFlow({ pairingWindowMs: 60_000, postSuccessWindowMs: 5_000 })
    poller = new TelegramPoller('bot-token', '111')
    poller.attachAuthFlow(authFlow)
  })

  afterEach(() => {
    fetchMock?.mockRestore()
    vi.restoreAllMocks()
  })

  function mockUpdates(updates: unknown[]) {
    fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('offset=-1')) {
        // syncToLatest — return empty
        return { ok: true, status: 200, json: async () => ({ ok: true, result: [] }) } as unknown as Response
      }
      if (u.includes('getUpdates')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: updates })
        } as unknown as Response
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as unknown as Response
    })
  }

  it('accepts /start mc-pair-<exact-nonce> from any chatId and calls completePairing', async () => {
    const { nonce } = authFlow.startPairing('bot-token')
    const completeSpy = vi.spyOn(authFlow, 'completePairing')

    const messageSpy = vi.fn()
    poller.onMessage(messageSpy)

    mockUpdates([
      {
        update_id: 1,
        message: {
          chat: { id: 99999 }, // DIFFERENT from the whitelisted chatId "111"
          text: `/start mc-pair-${nonce}`
        }
      }
    ])

    await poller.pollOnce()

    expect(completeSpy).toHaveBeenCalledWith(nonce, 99999)
    expect(messageSpy).not.toHaveBeenCalled()
  })

  it('rejects /start without any payload', async () => {
    authFlow.startPairing('bot-token')
    const completeSpy = vi.spyOn(authFlow, 'completePairing')

    mockUpdates([
      { update_id: 1, message: { chat: { id: 99999 }, text: '/start' } }
    ])
    await poller.pollOnce()

    expect(completeSpy).not.toHaveBeenCalled()
  })

  it('rejects /start with wrong nonce', async () => {
    authFlow.startPairing('bot-token')
    const completeSpy = vi.spyOn(authFlow, 'completePairing')

    mockUpdates([
      { update_id: 1, message: { chat: { id: 99999 }, text: '/start mc-pair-deadbeef12345678' } }
    ])
    await poller.pollOnce()

    // completePairing is called, but returns false internally — the poller delegates
    expect(completeSpy).toHaveBeenCalledWith('deadbeef12345678', 99999)
  })

  it('outside pairing window, strict chatId filter is unchanged', async () => {
    // authFlow stays idle
    const completeSpy = vi.spyOn(authFlow, 'completePairing')
    const messageSpy = vi.fn()
    poller.onMessage(messageSpy)

    mockUpdates([
      {
        update_id: 1,
        message: { chat: { id: 99999 }, text: '/start mc-pair-abc' } // foreign chat
      }
    ])

    await poller.pollOnce()
    expect(completeSpy).not.toHaveBeenCalled()
    // Foreign chat should NOT reach the message handler (strict filter still active)
    expect(messageSpy).not.toHaveBeenCalled()
  })

  it('non-/start messages from foreign chats during pairing are still filtered out', async () => {
    authFlow.startPairing('bot-token')
    const messageSpy = vi.fn()
    poller.onMessage(messageSpy)

    mockUpdates([
      { update_id: 1, message: { chat: { id: 99999 }, text: 'hello bot' } }
    ])
    await poller.pollOnce()
    expect(messageSpy).not.toHaveBeenCalled()
  })

  it('pairing /start does not forward to messageHandler even when chatId matches whitelist', async () => {
    const { nonce } = authFlow.startPairing('bot-token')
    const messageSpy = vi.fn()
    poller.onMessage(messageSpy)

    mockUpdates([
      {
        update_id: 1,
        message: { chat: { id: 111 }, text: `/start mc-pair-${nonce}` }
      }
    ])
    await poller.pollOnce()
    // Pairing branch fully handles the message; legacy handler not invoked.
    expect(messageSpy).not.toHaveBeenCalled()
  })
})
