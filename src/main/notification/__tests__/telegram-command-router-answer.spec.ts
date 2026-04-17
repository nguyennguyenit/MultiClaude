import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramCommandRouter } from '../telegram-command-router'
import { pendingQuestionStore } from '../pending-question-store'
import { callbackIdempotencyCache } from '../callback-idempotency'
import { callbackRateLimiter } from '../callback-rate-limiter'
import type { Terminal, Project, AskUserQuestionPayload } from '@shared/types'
import type { TerminalManager } from '../../terminal/terminal-manager'
import type { ProjectStore } from '../../project/project-store'

const mockTerminalManager = {
  list: vi.fn<() => Terminal[]>(),
  write: vi.fn<(id: string, data: string) => boolean>(),
  destroy: vi.fn<(id: string) => boolean>(),
  getSessions: vi.fn(),
  getExitedSession: vi.fn(),
  create: vi.fn<(opts: { cwd?: string; projectId?: string; shell?: unknown }) => Terminal>()
}

const mockProjectStore = {
  getProjects: vi.fn<() => Project[]>(),
  getProject: vi.fn<(id: string) => Project | undefined>(),
  setActiveProjectId: vi.fn<(id: string | null) => void>(),
  getActiveProjectId: vi.fn<() => string | null>()
}

const mockSendReply = vi.fn<(text: string) => Promise<boolean>>()

const term: Terminal = {
  id: 'term-1',
  title: 'pick-db',
  cwd: '/tmp',
  isClaudeMode: true,
  createdAt: new Date()
}

const singleSelectQuestion: AskUserQuestionPayload = {
  text: 'Pick DB',
  multiSelect: false,
  options: [
    { label: 'Postgres' },
    { label: 'MongoDB' },
    { label: 'SQLite' }
  ]
}

const multiSelectQuestion: AskUserQuestionPayload = {
  text: 'Pick features',
  multiSelect: true,
  options: [
    { label: 'Auth' },
    { label: 'Billing' },
    { label: 'Analytics' }
  ]
}

describe('TelegramCommandRouter — answer callbacks', () => {
  let router: TelegramCommandRouter

  beforeEach(() => {
    vi.clearAllMocks()
    callbackRateLimiter.reset()
    // Note: we deliberately don't reset idempotency cache in this file —
    // the "idempotent on duplicate callback_query.id" test depends on it persisting.
    callbackIdempotencyCache.reset()
    mockSendReply.mockResolvedValue(true)
    mockTerminalManager.list.mockReturnValue([term])
    mockTerminalManager.write.mockReturnValue(true)
    mockProjectStore.getProjects.mockReturnValue([])
    mockProjectStore.getProject.mockReturnValue(undefined)
    mockProjectStore.getActiveProjectId.mockReturnValue(null)
    pendingQuestionStore.clear()

    router = new TelegramCommandRouter(
      mockTerminalManager as unknown as TerminalManager,
      mockProjectStore as unknown as ProjectStore,
      mockSendReply
    )
  })

  describe('single-select answer:<index>:<terminalId>', () => {
    it('writes selected label plus \\r to the terminal', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-1', 'answer:1:term-1')

      expect(mockTerminalManager.write).toHaveBeenCalledWith('term-1', 'MongoDB\r')
    })

    it('clears the pending-question entry after answering', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-1', 'answer:0:term-1')
      expect(pendingQuestionStore.get('term-1')).toBeUndefined()
    })

    it('sends a confirmation reply with the chosen label', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-1', 'answer:2:term-1')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('SQLite')
    })

    it('replies with "expired" when no pending question exists', async () => {
      await router.handleCallback('cb-1', 'answer:0:term-1')
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply.toLowerCase()).toContain('expired')
    })

    it('replies with closed-terminal warning when terminal missing', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      mockTerminalManager.list.mockReturnValue([]) // terminal gone
      await router.handleCallback('cb-1', 'answer:0:term-1')
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply.toLowerCase()).toContain('closed')
    })

    it('rejects out-of-range option index', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-1', 'answer:9:term-1')
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
    })

    it('rejects malformed answer data (non-numeric index)', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-1', 'answer:xyz:term-1')
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
    })

    it('is idempotent on duplicate callback_query.id', async () => {
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-dup', 'answer:0:term-1')
      // second delivery with same cb id — side-effect should not repeat
      pendingQuestionStore.put('term-1', singleSelectQuestion)
      await router.handleCallback('cb-dup', 'answer:1:term-1')

      expect(mockTerminalManager.write).toHaveBeenCalledTimes(1)
      expect(mockTerminalManager.write).toHaveBeenCalledWith('term-1', 'Postgres\r')
    })
  })

  describe('question-overwrite race (M3 regression guard)', () => {
    it('rejects answer with stale qid after a second question overwrote the store', async () => {
      // First question lands, notifier builds callback_data with qid1.
      const qid1 = pendingQuestionStore.put('term-1', singleSelectQuestion)

      // Before user taps, Claude emits a NEW AskUserQuestion for the same terminal.
      // notifier.put() would overwrite — we simulate that here.
      pendingQuestionStore.put('term-1', {
        text: 'totally different',
        multiSelect: false,
        options: [{ label: 'WRONG_A' }, { label: 'WRONG_B' }]
      })

      // User now taps the OLD notification's "Postgres" button (index 0, qid1).
      await router.handleCallback('cb-stale', `answer:0:${qid1}:term-1`)

      // Must NOT have written the wrong question's option to the terminal.
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls.at(-1)?.[0] ?? ''
      expect(reply.toLowerCase()).toContain('expired')
    })
  })

  describe('multi-select toggle: + submit: flow', () => {
    it('toggle updates selection without writing to terminal', async () => {
      pendingQuestionStore.put('term-1', multiSelectQuestion)
      await router.handleCallback('cb-t1', 'toggle:0:term-1')
      await router.handleCallback('cb-t2', 'toggle:2:term-1')

      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const entry = pendingQuestionStore.get('term-1')
      expect(entry?.selected).toEqual(new Set([0, 2]))
    })

    it('submit writes newline-joined selected labels to terminal', async () => {
      pendingQuestionStore.put('term-1', multiSelectQuestion)
      await router.handleCallback('cb-t1', 'toggle:0:term-1')
      await router.handleCallback('cb-t2', 'toggle:2:term-1')
      await router.handleCallback('cb-s', 'submit:term-1')

      expect(mockTerminalManager.write).toHaveBeenCalledWith('term-1', 'Auth, Analytics\r')
      expect(pendingQuestionStore.get('term-1')).toBeUndefined()
    })

    it('submit without any selection sends a prompt, no terminal write', async () => {
      pendingQuestionStore.put('term-1', multiSelectQuestion)
      await router.handleCallback('cb-s', 'submit:term-1')
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls.at(-1)?.[0] ?? ''
      expect(reply.toLowerCase()).toContain('select')
    })
  })
})
