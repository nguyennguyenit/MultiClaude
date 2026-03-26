import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramCommandRouter } from '../telegram-command-router'
import type { Terminal, Project } from '@shared/types'

const mockTerminalManager = {
  list: vi.fn<() => Terminal[]>(),
  write: vi.fn<(id: string, data: string) => boolean>(),
  destroy: vi.fn<(id: string) => boolean>(),
  getSessions: vi.fn()
}

const mockProjectStore = {
  getProjects: vi.fn<() => Project[]>(),
  setActiveProjectId: vi.fn<(id: string | null) => void>(),
  getActiveProjectId: vi.fn<() => string | null>()
}

const mockSendReply = vi.fn<(text: string) => Promise<boolean>>()

describe('TelegramCommandRouter', () => {
  let router: TelegramCommandRouter

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendReply.mockResolvedValue(true)
    router = new TelegramCommandRouter(
      mockTerminalManager as any,
      mockProjectStore as any,
      mockSendReply
    )
  })

  describe('/help', () => {
    it('returns command list', async () => {
      await router.handle('/help')
      expect(mockSendReply).toHaveBeenCalledTimes(1)
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('/status')
      expect(reply).toContain('/send')
      expect(reply).toContain('/kill')
      expect(reply).toContain('/tail')
      expect(reply).toContain('/project')
    })
  })

  describe('/status', () => {
    it('lists terminals with short index', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'claude-api', cwd: '/tmp', isClaudeMode: true, createdAt: new Date() },
        { id: 'uuid-2', title: 'test-runner', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])

      await router.handle('/status')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('1')
      expect(reply).toContain('claude\\-api')
      expect(reply).toContain('2')
      expect(reply).toContain('test\\-runner')
    })

    it('reports no terminals when empty', async () => {
      mockTerminalManager.list.mockReturnValue([])
      await router.handle('/status')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('No terminals')
    })
  })

  describe('/send', () => {
    it('writes text to terminal by index', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'term1', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.write.mockReturnValue(true)
      mockTerminalManager.getSessions.mockReturnValue([
        { id: 'uuid-1', title: 'term1', cwd: '/tmp', outputBuffer: 'line1\nline2\nline3' }
      ])

      await router.handle('/send 1 hello world')
      expect(mockTerminalManager.write).toHaveBeenCalledWith('uuid-1', 'hello world\n')
    })

    it('rejects invalid terminal index', async () => {
      mockTerminalManager.list.mockReturnValue([])
      await router.handle('/send 5 hello')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('not found')
    })

    it('rejects missing text', async () => {
      await router.handle('/send 1')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('Usage')
    })
  })

  describe('/kill', () => {
    it('destroys terminal by index', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'term1', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.destroy.mockReturnValue(true)

      await router.handle('/kill 1')
      expect(mockTerminalManager.destroy).toHaveBeenCalledWith('uuid-1')
    })
  })

  describe('/tail', () => {
    it('returns last N lines from output buffer', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'term1', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.getSessions.mockReturnValue([
        { id: 'uuid-1', outputBuffer: 'line1\nline2\nline3\nline4\nline5' }
      ])

      await router.handle('/tail 1 3')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('line3')
      expect(reply).toContain('line4')
      expect(reply).toContain('line5')
    })

    it('defaults to 20 lines', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'term1', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      const lines = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join('\n')
      mockTerminalManager.getSessions.mockReturnValue([
        { id: 'uuid-1', outputBuffer: lines }
      ])

      await router.handle('/tail 1')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('line11')
      expect(reply).toContain('line30')
    })
  })

  describe('/project', () => {
    it('switches project by name (case-insensitive)', async () => {
      mockProjectStore.getProjects.mockReturnValue([
        { id: 'proj-1', name: 'MyApp', path: '/app', createdAt: new Date() },
        { id: 'proj-2', name: 'Backend', path: '/api', createdAt: new Date() }
      ] as Project[])
      mockTerminalManager.list.mockReturnValue([])

      await router.handle('/project backend')
      expect(mockProjectStore.setActiveProjectId).toHaveBeenCalledWith('proj-2')
    })

    it('lists projects when no name given', async () => {
      mockProjectStore.getProjects.mockReturnValue([
        { id: 'proj-1', name: 'MyApp', path: '/app', createdAt: new Date() }
      ] as Project[])
      mockProjectStore.getActiveProjectId.mockReturnValue('proj-1')

      await router.handle('/project')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('MyApp')
    })
  })

  describe('unknown command', () => {
    it('suggests /help', async () => {
      await router.handle('/unknown')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('/help')
    })

    it('ignores non-command messages', async () => {
      await router.handle('just some text')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('/help')
    })
  })
})
