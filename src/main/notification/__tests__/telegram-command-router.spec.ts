import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramCommandRouter } from '../telegram-command-router'
import type { Terminal, Project } from '@shared/types'
import type { TerminalManager } from '../../terminal/terminal-manager'
import type { ProjectStore } from '../../project/project-store'

const mockTerminalManager = {
  list: vi.fn<() => Terminal[]>(),
  write: vi.fn<(id: string, data: string) => boolean>(),
  destroy: vi.fn<(id: string) => boolean>(),
  getSessions: vi.fn(),
  create: vi.fn<(opts: { cwd?: string; projectId?: string; shell?: unknown }) => Terminal>()
}

const mockProjectStore = {
  getProjects: vi.fn<() => Project[]>(),
  getProject: vi.fn<(id: string) => Project | undefined>(),
  setActiveProjectId: vi.fn<(id: string | null) => void>(),
  getActiveProjectId: vi.fn<() => string | null>()
}

const mockSendReply = vi.fn<(text: string) => Promise<boolean>>()

describe('TelegramCommandRouter', () => {
  let router: TelegramCommandRouter

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendReply.mockResolvedValue(true)
    mockTerminalManager.create.mockReturnValue({
      id: 'new-term-id',
      title: 'Terminal 1',
      cwd: '/projects/myapp',
      isClaudeMode: false,
      createdAt: new Date()
    } as Terminal)
    mockProjectStore.getProjects.mockReturnValue([])
    mockProjectStore.getProject.mockReturnValue(undefined)
    mockProjectStore.getActiveProjectId.mockReturnValue(null)
    mockProjectStore.setActiveProjectId.mockImplementation((id) => {
      mockProjectStore.getActiveProjectId.mockReturnValue(id)
    })
    router = new TelegramCommandRouter(
      mockTerminalManager as unknown as TerminalManager,
      mockProjectStore as unknown as ProjectStore,
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

    it('writes text to terminal by title', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'Terminal 2', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.write.mockReturnValue(true)
      mockTerminalManager.getSessions.mockReturnValue([
        { id: 'uuid-1', title: 'Terminal 2', cwd: '/tmp', outputBuffer: 'line1\nline2\nline3' }
      ])

      await router.handle('/send Terminal 2 pwd')
      expect(mockTerminalManager.write).toHaveBeenCalledWith('uuid-1', 'pwd\n')
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

    it('destroys terminal by title', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'Terminal 3', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.destroy.mockReturnValue(true)

      await router.handle('/kill Terminal 3')
      expect(mockTerminalManager.destroy).toHaveBeenCalledWith('uuid-1')
    })

    it('uses active project scope when resolving index', async () => {
      mockProjectStore.getProjects.mockReturnValue([
        { id: 'proj-1', name: 'Frontend', path: '/frontend', createdAt: new Date(), updatedAt: new Date() },
        { id: 'proj-2', name: 'Backend', path: '/backend', createdAt: new Date(), updatedAt: new Date() }
      ] as Project[])
      mockProjectStore.getProject.mockImplementation((id) => mockProjectStore.getProjects().find(project => project.id === id))
      mockProjectStore.getActiveProjectId.mockReturnValue('proj-2')
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'Terminal 1', cwd: '/frontend', projectId: 'proj-1', isClaudeMode: false, createdAt: new Date() },
        { id: 'uuid-2', title: 'Terminal 2', cwd: '/backend', projectId: 'proj-2', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.destroy.mockReturnValue(true)

      await router.handle('/kill 1')
      expect(mockTerminalManager.destroy).toHaveBeenCalledWith('uuid-2')
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

    it('resolves terminal by title when requesting tail', async () => {
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'Terminal 2', cwd: '/tmp', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])
      mockTerminalManager.getSessions.mockReturnValue([
        { id: 'uuid-1', outputBuffer: 'line1\nline2\nline3\nline4' }
      ])

      await router.handle('/tail Terminal 2 2')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('line3')
      expect(reply).toContain('line4')
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
      mockProjectStore.getProject.mockImplementation((id) => mockProjectStore.getProjects().find(project => project.id === id))
      mockProjectStore.getActiveProjectId.mockReturnValue('proj-1')

      await router.handle('/project')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('MyApp')
    })

    it('scopes status output to the active project after switching', async () => {
      mockProjectStore.getProjects.mockReturnValue([
        { id: 'proj-1', name: 'Frontend', path: '/frontend', createdAt: new Date(), updatedAt: new Date() },
        { id: 'proj-2', name: 'Backend', path: '/backend', createdAt: new Date(), updatedAt: new Date() }
      ] as Project[])
      mockProjectStore.getProject.mockImplementation((id) => mockProjectStore.getProjects().find(project => project.id === id))
      mockTerminalManager.list.mockReturnValue([
        { id: 'uuid-1', title: 'Frontend Shell', cwd: '/frontend', projectId: 'proj-1', isClaudeMode: false, createdAt: new Date() },
        { id: 'uuid-2', title: 'Backend Shell', cwd: '/backend', projectId: 'proj-2', isClaudeMode: false, createdAt: new Date() }
      ] as Terminal[])

      await router.handle('/project Backend')
      await router.handle('/status')

      const reply = mockSendReply.mock.calls[1][0]
      expect(reply).toContain('Backend')
      expect(reply).toContain('Backend Shell')
      expect(reply).not.toContain('Frontend Shell')
    })
  })

  describe('/new', () => {
    const activeProject: Project = {
      id: 'proj-1',
      name: 'MyApp',
      path: '/projects/myapp',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    beforeEach(() => {
      mockProjectStore.getProjects.mockReturnValue([activeProject])
      mockProjectStore.getProject.mockReturnValue(activeProject)
      mockProjectStore.getActiveProjectId.mockReturnValue('proj-1')
      mockTerminalManager.list.mockReturnValue([])
    })

    it('creates a shell terminal when called with no args', async () => {
      await router.handle('/new')
      expect(mockTerminalManager.create).toHaveBeenCalledWith({
        cwd: '/projects/myapp',
        projectId: 'proj-1'
      })
      expect(mockTerminalManager.write).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('Terminal 1')
      expect(reply).toContain('MyApp')
    })

    it('creates terminal and runs claude when arg is claude', async () => {
      await router.handle('/new claude')
      expect(mockTerminalManager.create).toHaveBeenCalledWith({
        cwd: '/projects/myapp',
        projectId: 'proj-1'
      })
      expect(mockTerminalManager.write).toHaveBeenCalledWith('new-term-id', 'claude\n')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('Terminal 1')
      expect(reply).toContain('claude')
    })

    it('creates terminal and runs codex when arg is codex', async () => {
      await router.handle('/new codex')
      expect(mockTerminalManager.write).toHaveBeenCalledWith('new-term-id', 'codex\n')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('Terminal 1')
      expect(reply).toContain('codex')
    })

    it('returns error when no active project', async () => {
      mockProjectStore.getActiveProjectId.mockReturnValue(null)
      await router.handle('/new')
      expect(mockTerminalManager.create).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('No active project')
    })

    it('returns usage error for unknown arg', async () => {
      await router.handle('/new bash')
      expect(mockTerminalManager.create).not.toHaveBeenCalled()
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('Usage')
    })

    it('reports launch failure if write returns false', async () => {
      mockTerminalManager.write.mockReturnValue(false)
      await router.handle('/new claude')
      const reply = mockSendReply.mock.calls[0][0]
      expect(reply).toContain('failed to launch')
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
