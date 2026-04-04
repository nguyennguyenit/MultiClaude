import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as pty from '@lydell/node-pty'
import { TerminalManager } from '../terminal-manager'

const mockSpawnSync = vi.hoisted(() => vi.fn())
const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReaddirSync = vi.hoisted(() => vi.fn())

// Mock node-pty
const mockPty = {
  onData: vi.fn((cb) => { mockPty._dataCallback = cb }),
  onExit: vi.fn((cb) => { mockPty._exitCallback = cb }),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  _dataCallback: null as ((data: string) => void) | null,
  _exitCallback: null as ((info: { exitCode: number }) => void) | null
}

vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => mockPty)
}))

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    spawnSync: mockSpawnSync
  }
})

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync
  }
})

describe('TerminalManager', () => {
  let manager: TerminalManager

  beforeEach(() => {
    manager = new TerminalManager()
    vi.clearAllMocks()
    mockSpawnSync.mockReturnValue({ status: 1 })
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  afterEach(() => {
    manager.destroyAll()
  })

  describe('create', () => {
    it('creates terminal with generated id', () => {
      const term = manager.create()
      expect(term.id).toMatch(/^term-/)
      expect(term.title).toBe('Terminal 1')
    })

    it('creates terminal with incremented title', () => {
      manager.create()
      const term2 = manager.create()
      expect(term2.title).toBe('Terminal 2')
    })

    it('does not reuse a default title after a terminal is destroyed', () => {
      manager.create()
      const term2 = manager.create()
      const term3 = manager.create()

      manager.destroy(term2.id)

      const term4 = manager.create()
      expect(term3.title).toBe('Terminal 3')
      expect(term4.title).toBe('Terminal 4')
    })

    it('creates terminal with custom cwd', () => {
      const term = manager.create({ cwd: '/custom/path' })
      expect(term.cwd).toBe('/custom/path')
    })

    it('associates terminal with project', () => {
      const term = manager.create({ projectId: 'proj-1' })
      expect(term.projectId).toBe('proj-1')
    })

    it('initializes with isClaudeMode false', () => {
      const term = manager.create()
      expect(term.isClaudeMode).toBe(false)
    })

    it('initializes with allowTitleUpdate false', () => {
      const term = manager.create()
      expect(term.allowTitleUpdate).toBe(false)
    })
  })

  describe('write', () => {
    it('writes data to terminal', () => {
      const term = manager.create()
      const result = manager.write(term.id, 'test')
      expect(result).toBe(true)
      expect(mockPty.write).toHaveBeenCalledWith('test')
    })

    it('marks a terminal as Claude mode when the user launches claude manually', () => {
      const term = manager.create()

      manager.write(term.id, 'claude')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.isClaudeMode).toBe(true)
    })

    it('enables title updates and emits stateChange when claude is launched manually', () => {
      const term = manager.create()
      const stateChangeListener = vi.fn()
      manager.on('stateChange', stateChangeListener)

      manager.write(term.id, 'claude --resume session-123')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.allowTitleUpdate).toBe(true)
      expect(stateChangeListener).toHaveBeenCalledWith({ terminalId: term.id, isClaudeMode: true })
    })

    it('stores the resumed Claude session ID when launched manually', () => {
      const term = manager.create()

      manager.write(term.id, 'claude --resume session-123')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.claudeSessionId).toBe('session-123')
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.write('invalid', 'test')).toBe(false)
    })
  })

  describe('resize', () => {
    it('resizes terminal', () => {
      const term = manager.create()
      const result = manager.resize(term.id, 120, 40)
      expect(result).toBe(true)
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40)
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.resize('invalid', 80, 24)).toBe(false)
    })
  })

  describe('destroy', () => {
    it('destroys terminal', () => {
      const term = manager.create()
      const result = manager.destroy(term.id)
      expect(result).toBe(true)
      expect(mockPty.kill).toHaveBeenCalled()
    })

    it('removes terminal from list', () => {
      const term = manager.create()
      manager.destroy(term.id)
      expect(manager.get(term.id)).toBeUndefined()
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.destroy('invalid')).toBe(false)
    })
  })

  describe('destroyAll', () => {
    it('destroys all terminals', () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)

      manager.destroyAll()
      expect(manager.list()).toHaveLength(0)
    })
  })

  describe('list', () => {
    it('returns empty array initially', () => {
      expect(manager.list()).toEqual([])
    })

    it('returns all terminals', () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)
    })
  })

  describe('get', () => {
    it('returns terminal by id', () => {
      const term = manager.create()
      const found = manager.get(term.id)
      expect(found?.id).toBe(term.id)
    })

    it('returns undefined for non-existent terminal', () => {
      expect(manager.get('invalid')).toBeUndefined()
    })
  })

  describe('invokeClaudeCode', () => {
    it('writes claude command to terminal', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      expect(mockPty.write).toHaveBeenCalledWith('claude\n')
    })

    it('includes session id if provided', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id, 'session-123')
      expect(mockPty.write).toHaveBeenCalledWith('claude --resume session-123\n')
    })

    it('stores session id if provided', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id, 'session-123')
      expect(manager.get(term.id)?.claudeSessionId).toBe('session-123')
    })

    it('sets isClaudeMode to true', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      const updated = manager.get(term.id)
      expect(updated?.isClaudeMode).toBe(true)
    })

    it('sets allowTitleUpdate to true', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      const updated = manager.get(term.id)
      expect(updated?.allowTitleUpdate).toBe(true)
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.invokeClaudeCode('invalid')).toBe(false)
    })
  })

  describe('Windows PowerShell resolution', () => {
    it('prefers pwsh.exe when available on PATH', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      mockSpawnSync.mockImplementation((command: string, args?: string[]) => (
        command === 'where.exe' && args?.[0] === 'pwsh.exe'
          ? { status: 0 }
          : { status: 1 }
      ))

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'pwsh.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      platformSpy.mockRestore()
    })

    it('falls back to PowerShell 7 install path when pwsh.exe is not on PATH', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      const originalProgramFiles = process.env.ProgramFiles

      process.env.ProgramFiles = 'C:\\Program Files'
      mockSpawnSync.mockReturnValue({ status: 1 })
      mockExistsSync.mockImplementation((target: string) => (
        target === 'C:\\Program Files/PowerShell' || target === 'C:\\Program Files/PowerShell/7/pwsh.exe'
      ))
      mockReaddirSync.mockReturnValue([
        {
          name: '7',
          isDirectory: () => true
        }
      ])

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'C:\\Program Files/PowerShell/7/pwsh.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      process.env.ProgramFiles = originalProgramFiles
      platformSpy.mockRestore()
    })

    it('falls back to powershell.exe when PowerShell 7 is unavailable', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      platformSpy.mockRestore()
    })
  })

  describe('getSessions', () => {
    it('returns session info for all terminals', () => {
      const term = manager.create({ projectId: 'proj-1' })
      const sessions = manager.getSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(term.id)
      expect(sessions[0].projectId).toBe('proj-1')
    })

    it('preserves buffered output beyond 100KB for restore', () => {
      const term = manager.create()
      const largeOutput = 'x'.repeat(150000)

      mockPty._dataCallback?.(largeOutput)

      const sessions = manager.getSessions()
      expect(sessions[0].id).toBe(term.id)
      expect(sessions[0].outputBuffer).toHaveLength(150000)
    })

    it('can attach a Claude session ID to a live Claude terminal by cwd', () => {
      const term = manager.create({ cwd: '/workspace/app' })

      manager.write(term.id, 'claude')
      manager.write(term.id, '\r')

      expect(manager.attachClaudeSession('session-456', '/workspace/app')).toEqual({ id: term.id })
      expect(manager.get(term.id)?.claudeSessionId).toBe('session-456')
      expect(manager.findByClaudeSessionId('session-456')).toEqual({ id: term.id })
    })
  })

  describe('destroyAsync', () => {
    it('resolves after terminal exits', async () => {
      const term = manager.create()
      const promise = manager.destroyAsync(term.id)

      // Simulate exit
      mockPty._exitCallback?.({ exitCode: 0 })

      const result = await promise
      expect(result).toBe(true)
      expect(manager.get(term.id)).toBeUndefined()
    })

    it('force kills after timeout', async () => {
      vi.useFakeTimers()
      const term = manager.create()

      const promise = manager.destroyAsync(term.id)

      // Advance past timeout without exit (3000ms default)
      vi.advanceTimersByTime(3001)

      const result = await promise
      expect(result).toBe(true)
      vi.useRealTimers()
    })

    it('returns false for non-existent terminal', async () => {
      const result = await manager.destroyAsync('invalid')
      expect(result).toBe(false)
    })
  })

  describe('destroyAllAsync', () => {
    it('destroys all terminals', async () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)

      // Simulate exits for all terminals
      setTimeout(() => {
        mockPty._exitCallback?.({ exitCode: 0 })
        mockPty._exitCallback?.({ exitCode: 0 })
      }, 10)

      await manager.destroyAllAsync()
      expect(manager.list()).toHaveLength(0)
    })
  })

  describe('hasTerminals', () => {
    it('returns false when no terminals', () => {
      expect(manager.hasTerminals()).toBe(false)
    })

    it('returns true when terminals exist', () => {
      manager.create()
      expect(manager.hasTerminals()).toBe(true)
    })
  })
})
