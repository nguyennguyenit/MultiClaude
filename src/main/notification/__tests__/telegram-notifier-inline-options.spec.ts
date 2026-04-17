import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramNotifier } from '../telegram-notifier'
import { pendingQuestionStore } from '../pending-question-store'
import type { TaskEvent } from '@shared/types'

describe('TelegramNotifier — inline option keyboard', () => {
  let notifier: TelegramNotifier

  beforeEach(() => {
    notifier = new TelegramNotifier('tok', 'chat-1')
    pendingQuestionStore.clear()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ ok: true })
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    pendingQuestionStore.clear()
  })

  const baseEvent: TaskEvent = {
    id: 'evt-1',
    terminalId: 'term-1',
    type: 'reviewNeeded',
    taskName: 'Pick DB',
    projectName: 'Proj',
    timestamp: Date.now(),
    question: {
      text: 'Pick DB',
      multiSelect: false,
      options: [
        { label: 'Postgres', description: 'SQL' },
        { label: 'MongoDB' },
        { label: 'SQLite' }
      ]
    }
  }

  it('renders one button per option using label text (not description)', async () => {
    await notifier.sendTaskEvent(baseEvent)
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)
    const keyboard = body.reply_markup.inline_keyboard

    // flatten rows, exclude the trailing Details/Reply row
    const optionButtons = keyboard.slice(0, -1).flat()
    expect(optionButtons.map((b: { text: string }) => b.text))
      .toEqual(['Postgres', 'MongoDB', 'SQLite'])
  })

  it('encodes callback_data as answer:<index>:<qid>:<terminalId>', async () => {
    await notifier.sendTaskEvent(baseEvent)
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)
    const buttons = body.reply_markup.inline_keyboard.slice(0, -1).flat()

    // qid is a 6-char hex — match pattern, not literal
    expect(buttons[0].callback_data).toMatch(/^answer:0:[a-f0-9]+:term-1$/)
    expect(buttons[1].callback_data).toMatch(/^answer:1:[a-f0-9]+:term-1$/)
    expect(buttons[2].callback_data).toMatch(/^answer:2:[a-f0-9]+:term-1$/)
    // all three buttons share the same qid
    const qid0 = buttons[0].callback_data.split(':')[2]
    const qid1 = buttons[1].callback_data.split(':')[2]
    expect(qid0).toBe(qid1)
  })

  it('persists the question into pendingQuestionStore keyed by terminalId', async () => {
    expect(pendingQuestionStore.get('term-1')).toBeUndefined()
    await notifier.sendTaskEvent(baseEvent)
    const entry = pendingQuestionStore.get('term-1')
    expect(entry?.question.options).toHaveLength(3)
  })

  it('chunks option buttons into rows of ≤3 per row', async () => {
    const manyOpts = Array.from({ length: 7 }, (_, i) => ({ label: `Opt ${i}` }))
    const ev: TaskEvent = {
      ...baseEvent,
      question: { text: 'many', multiSelect: false, options: manyOpts }
    }
    await notifier.sendTaskEvent(ev)
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)
    const rows = body.reply_markup.inline_keyboard

    const optionRows = rows.slice(0, -1)
    // 7 options → 3 + 3 + 1
    expect(optionRows).toHaveLength(3)
    expect(optionRows[0]).toHaveLength(3)
    expect(optionRows[1]).toHaveLength(3)
    expect(optionRows[2]).toHaveLength(1)
  })

  it('caps total rendered options at 24 (≤3 per row, ≤8 rows)', async () => {
    const manyOpts = Array.from({ length: 40 }, (_, i) => ({ label: `O${i}` }))
    const ev: TaskEvent = {
      ...baseEvent,
      question: { text: 'lots', multiSelect: false, options: manyOpts }
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const optionRows = body.reply_markup.inline_keyboard.slice(0, -1)
    const totalOptionButtons = optionRows.flat().length
    expect(totalOptionButtons).toBeLessThanOrEqual(24)
  })

  it('truncates labels over 60 chars with trailing ellipsis on button text', async () => {
    const longLabel = 'x'.repeat(100)
    const ev: TaskEvent = {
      ...baseEvent,
      question: { text: 'q', multiSelect: false, options: [{ label: longLabel }] }
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const btn = body.reply_markup.inline_keyboard[0][0]
    expect(btn.text.length).toBeLessThanOrEqual(64)
    expect(btn.text.endsWith('…')).toBe(true)
  })

  it('strips control chars from button text', async () => {
    const ev: TaskEvent = {
      ...baseEvent,
      question: { text: 'q', multiSelect: false, options: [{ label: 'A\u0000B\tC' }] }
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const btn = body.reply_markup.inline_keyboard[0][0]
    // Tabs are kept, NUL stripped
    expect(btn.text).not.toContain('\u0000')
  })

  it('callback_data stays within 64 bytes per Telegram limit', async () => {
    const longId = 't'.repeat(40) // fake long terminalId
    const ev: TaskEvent = {
      ...baseEvent,
      terminalId: longId,
      question: { text: 'q', multiSelect: false, options: [{ label: 'A' }] }
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const btn = body.reply_markup.inline_keyboard[0][0]
    expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64)
  })

  it('renders toggle state icons + Submit button for multiSelect questions', async () => {
    const ev: TaskEvent = {
      ...baseEvent,
      question: {
        text: 'Pick many',
        multiSelect: true,
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }]
      }
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const rows = body.reply_markup.inline_keyboard

    // Every option button prefixed with ⚪ (deselected) initially
    const optionRows = rows.slice(0, -2) // drop Submit row + Details row
    const optionButtons = optionRows.flat()
    for (const btn of optionButtons) {
      expect(btn.text.startsWith('⚪')).toBe(true)
    }
    // Callback uses toggle:<i>:<qid>:<terminalId>
    expect(optionButtons[0].callback_data).toMatch(/^toggle:0:[a-f0-9]+:term-1$/)

    // Submit row exists
    const submitRow = rows[rows.length - 2]
    expect(submitRow).toHaveLength(1)
    expect(submitRow[0].text).toContain('Submit')
    expect(submitRow[0].callback_data).toMatch(/^submit:[a-f0-9]+:term-1$/)
  })

  it('still appends Details row when options present', async () => {
    await notifier.sendTaskEvent(baseEvent)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const rows = body.reply_markup.inline_keyboard
    const lastRow = rows[rows.length - 1]
    expect(lastRow[0].text).toContain('Details')
    expect(lastRow[0].callback_data).toBe('tail:reviewNeeded:term-1')
  })

  describe('toggle visual feedback (M1)', () => {
    it('buildQuestionKeyboardPublic renders 🔘 for selected indices', () => {
      const rows = notifier.buildQuestionKeyboardPublic(
        'term-1',
        'qid123',
        {
          text: 'Pick',
          multiSelect: true,
          options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }]
        },
        'reviewNeeded',
        new Set([1])
      )
      const optionRows = rows.slice(0, -2)
      const btns = optionRows.flat()
      expect(btns[0].text.startsWith('⚪')).toBe(true)
      expect(btns[1].text.startsWith('🔘')).toBe(true)
      expect(btns[2].text.startsWith('⚪')).toBe(true)
    })

    it('editReplyMarkup calls Telegram editMessageReplyMarkup endpoint', async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      } as Response)
      const ok = await notifier.editReplyMarkup(42, 99, {
        inline_keyboard: [[{ text: 'X', callback_data: 'x' }]]
      })
      expect(ok).toBe(true)
      const call = fetchMock.mock.calls.at(-1)
      expect(String(call![0])).toContain('editMessageReplyMarkup')
      const body = JSON.parse((call![1] as RequestInit).body as string)
      expect(body.message_id).toBe(99)
      expect(body.chat_id).toBe(42)
    })

    it('sendTaskEvent with question attaches message_id to pendingQuestionStore', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, result: { message_id: 777 } })
      } as Response)

      await notifier.sendTaskEvent(baseEvent)
      const entry = pendingQuestionStore.get('term-1')
      expect(entry?.messageId).toBe(777)
      expect(entry?.chatId).toBe('chat-1')
    })
  })

  it('falls back to legacy Details/Reply keyboard when event has no question.options', async () => {
    const ev: TaskEvent = {
      id: 'x',
      terminalId: 'term-1',
      type: 'reviewNeeded',
      taskName: 'no opts',
      projectName: 'p',
      timestamp: Date.now()
    }
    await notifier.sendTaskEvent(ev)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    const kb = body.reply_markup.inline_keyboard
    expect(kb).toHaveLength(1)
    expect(kb[0][0].text).toContain('Details')
    expect(kb[0][1].text).toContain('Reply')
  })
})
