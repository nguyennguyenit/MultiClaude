import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GitManager } from '../git-manager'

// Mock simple-git
const mockGit = {
  checkIsRepo: vi.fn().mockResolvedValue(true),
  status: vi.fn().mockResolvedValue({
    current: 'main',
    isClean: () => true,
    staged: [],
    modified: [],
    deleted: [],
    not_added: []
  }),
  getRemotes: vi.fn().mockResolvedValue([
    { name: 'origin', refs: { fetch: 'https://github.com/user/repo' } }
  ]),
  init: vi.fn().mockResolvedValue(undefined),
  addRemote: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ total: 1 })
}

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGit)
}))

// Mock child_process for gh commands
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === 'close') cb(0)
    })
  }))
}))

describe('GitManager', () => {
  let manager: GitManager

  beforeEach(() => {
    manager = new GitManager()
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    it('returns status for git repo', async () => {
      const status = await manager.getStatus('/test')
      expect(status.isRepo).toBe(true)
      expect(status.branch).toBe('main')
      expect(status.hasRemote).toBe(true)
    })

    it('returns correct remote info', async () => {
      const status = await manager.getStatus('/test')
      expect(status.remoteName).toBe('origin')
      expect(status.remoteUrl).toBe('https://github.com/user/repo')
    })

    it('returns isDirty false for clean repo', async () => {
      const status = await manager.getStatus('/test')
      expect(status.isDirty).toBe(false)
    })

    it('returns not repo for non-git folder', async () => {
      mockGit.checkIsRepo.mockResolvedValueOnce(false)
      const status = await manager.getStatus('/not-a-repo')
      expect(status.isRepo).toBe(false)
      expect(status.hasRemote).toBe(false)
    })

    it('returns not repo on error', async () => {
      mockGit.checkIsRepo.mockRejectedValueOnce(new Error('fail'))
      const status = await manager.getStatus('/error')
      expect(status.isRepo).toBe(false)
    })
  })

  describe('init', () => {
    it('initializes git repo', async () => {
      const result = await manager.init('/test')
      expect(result).toBe(true)
      expect(mockGit.init).toHaveBeenCalled()
    })

    it('returns false on error', async () => {
      mockGit.init.mockRejectedValueOnce(new Error('fail'))
      const result = await manager.init('/error')
      expect(result).toBe(false)
    })
  })

  describe('addRemote', () => {
    it('adds remote to repo', async () => {
      const result = await manager.addRemote('/test', 'https://github.com/user/repo')
      expect(result).toBe(true)
      expect(mockGit.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo')
    })

    it('uses custom remote name', async () => {
      await manager.addRemote('/test', 'https://github.com/user/repo', 'upstream')
      expect(mockGit.addRemote).toHaveBeenCalledWith('upstream', 'https://github.com/user/repo')
    })

    it('returns false on error', async () => {
      mockGit.addRemote.mockRejectedValueOnce(new Error('fail'))
      const result = await manager.addRemote('/error', 'url')
      expect(result).toBe(false)
    })
  })

  describe('push', () => {
    it('pushes to remote with upstream', async () => {
      const result = await manager.push('/test', 'main', true)
      expect(result).toBe(true)
      expect(mockGit.push).toHaveBeenCalledWith(['--set-upstream', 'origin', 'main'])
    })

    it('pushes without upstream', async () => {
      await manager.push('/test', 'main', false)
      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main')
    })

    it('returns false on error', async () => {
      mockGit.push.mockRejectedValueOnce(new Error('fail'))
      const result = await manager.push('/error')
      expect(result).toBe(false)
    })
  })
})
