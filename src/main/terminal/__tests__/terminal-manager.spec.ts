import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TerminalManager } from '../terminal-manager'

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

describe('TerminalManager', () => {
  let manager: TerminalManager

  beforeEach(() => {
    manager = new TerminalManager()
    vi.clearAllMocks()
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

  describe('getSessions', () => {
    it('returns session info for all terminals', () => {
      const term = manager.create({ projectId: 'proj-1' })
      const sessions = manager.getSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(term.id)
      expect(sessions[0].projectId).toBe('proj-1')
    })
  })
})
