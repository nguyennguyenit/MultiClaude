import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramNotifier } from '../telegram-notifier'

type FetchCall = { url: string; init?: RequestInit }

describe('TelegramNotifier.sendDocument for long responses', () => {
  let notifier: TelegramNotifier
  let calls: FetchCall[]

  beforeEach(() => {
    calls = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 42 } })
      } as Response
    })
    notifier = new TelegramNotifier('tok123', 'chat1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sendLongResponse uses sendDocument when text > 4000 chars', async () => {
    const long = 'x'.repeat(4001)
    const ok = await notifier.sendLongResponse({ caption: 'Response', text: long, fileName: 'response.txt' })
    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/sendDocument')
  })

  it('sendLongResponse falls back to paginated sendMessage when text <= 4000 chars', async () => {
    const ok = await notifier.sendLongResponse({ caption: 'Short', text: 'hello', fileName: 'x.txt' })
    expect(ok).toBe(true)
    expect(calls[0].url).toContain('/sendMessage')
  })

  it('sendDocument includes correct multipart form fields', async () => {
    const long = 'y'.repeat(5000)
    await notifier.sendLongResponse({ caption: 'Cap', text: long, fileName: 'r-1.txt' })
    const body = calls[0].init?.body
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('chat_id')).toBe('chat1')
    expect(form.get('caption')).toBe('Cap')
    expect(form.has('document')).toBe(true)
  })

  it('returns false when API responds non-ok', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false })
    } as Response))
    const bad = new TelegramNotifier('t', 'c')
    const result = await bad.sendLongResponse({ caption: 'c', text: 'z'.repeat(5000), fileName: 'f.txt' })
    expect(result).toBe(false)
  })
})
