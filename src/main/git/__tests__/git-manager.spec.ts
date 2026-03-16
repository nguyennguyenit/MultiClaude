import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitManager } from '../git-manager'

// Mock simple-git
const mockGit = {
  checkIsRepo: vi.fn().mockResolvedValue(true),
  status: vi.fn().mockResolvedValue({
    current: 'main',
    isClean: () => true,
    staged: ['file.ts'],
    modified: [],
    deleted: [],
    not_added: [],
    renamed: [],
    created: ['file.ts']
  }),
  getRemotes: vi.fn().mockResolvedValue([
    { name: 'origin', refs: { fetch: 'https://github.com/user/repo' } }
  ]),
  init: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
  addRemote: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ total: 1 }),
  diff: vi.fn().mockResolvedValue(''),
  raw: vi.fn().mockResolvedValue('')
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
  const tempDirs: string[] = []

  beforeEach(() => {
    manager = new GitManager()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
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
      // Simulate commit failure — init succeeds but commit phase fails
      mockGit.commit.mockRejectedValueOnce(new Error('fail'))
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
      expect(result.success).toBe(true)
      expect(mockGit.push).toHaveBeenCalledWith(['--set-upstream', 'origin', 'main'])
    })

    it('pushes without upstream', async () => {
      await manager.push('/test', 'main', false)
      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main')
    })

    it('returns false on error', async () => {
      mockGit.push.mockRejectedValueOnce(new Error('fail'))
      const result = await manager.push('/error')
      expect(result.success).toBe(false)
    })
  })

  describe('getFileStatus', () => {
    it('returns separate staged and unstaged entries for the same path and preserves rename source', async () => {
      mockGit.raw.mockResolvedValueOnce([
        'MM src/app.ts',
        'RM lib/new.ts',
        'lib/old.ts',
        '?? notes.md',
        ''
      ].join('\0'))
      mockGit.diff
        .mockResolvedValueOnce('2\t1\tsrc/app.ts\n1\t0\tlib/new.ts\n')
        .mockResolvedValueOnce('1\t0\tsrc/app.ts\n3\t0\tlib/old.ts => lib/new.ts\n')

      const files = await manager.getFileStatus('/test')

      expect(files).toEqual([
        { path: 'src/app.ts', status: 'modified', staged: true, additions: 1, deletions: 0 },
        { path: 'src/app.ts', status: 'modified', staged: false, additions: 2, deletions: 1 },
        { path: 'lib/new.ts', status: 'renamed', staged: true, oldPath: 'lib/old.ts', additions: 3, deletions: 0 },
        { path: 'lib/new.ts', status: 'modified', staged: false, additions: 1, deletions: 0 },
        { path: 'notes.md', status: 'untracked', staged: false }
      ])
    })
  })

  describe('diff', () => {
    it('builds a synthetic diff for untracked files', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'multiclaude-git-diff-'))
      tempDirs.push(dir)
      await writeFile(join(dir, 'notes.txt'), 'one\ntwo\n')

      mockGit.status.mockResolvedValueOnce({
        current: 'main',
        isClean: () => false,
        staged: [],
        modified: [],
        deleted: [],
        not_added: ['notes.txt'],
        renamed: [],
        created: []
      })

      const result = await manager.getDiff(dir, 'notes.txt')

      expect(result.success).toBe(true)
      expect(result.diff).toContain('diff --git a/notes.txt b/notes.txt')
      expect(result.diff).toContain('+++ b/notes.txt')
      expect(result.diff).toContain('+one')
      expect(mockGit.diff).not.toHaveBeenCalled()
    })

    it('includes the old path when requesting a staged rename diff', async () => {
      const result = await manager.getDiff('/test', 'lib/new.ts', true, 'lib/old.ts')

      expect(result.success).toBe(true)
      expect(mockGit.diff).toHaveBeenCalledWith(['--find-renames', '--cached', '--', 'lib/old.ts', 'lib/new.ts'])
    })
  })

  describe('diffBranch', () => {
    it('retains oldPath for renamed files when comparing branches', async () => {
      mockGit.status.mockResolvedValueOnce({
        current: 'feature',
        isClean: () => false,
        staged: [],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [],
        created: []
      })
      mockGit.raw.mockResolvedValueOnce('R075\told.ts\tnew.ts\nM\tother.ts\n')
      mockGit.diff.mockResolvedValueOnce('4\t1\told.ts => new.ts\n2\t0\tother.ts\n')
      mockGit.log
        .mockResolvedValueOnce({ total: 2 })
        .mockResolvedValueOnce({ total: 1 })

      const result = await manager.diffBranch('/test', 'main')

      expect(result.files).toEqual([
        { path: 'new.ts', status: 'renamed', oldPath: 'old.ts', additions: 4, deletions: 1 },
        { path: 'other.ts', status: 'modified', additions: 2, deletions: 0 }
      ])
      expect(result.aheadBy).toBe(2)
      expect(result.behindBy).toBe(1)
    })
  })

  describe('diffAgainstBranch', () => {
    it('includes old and new paths for branch rename diffs', async () => {
      const result = await manager.getDiffAgainstBranch('/test', 'lib/new.ts', 'main', 'lib/old.ts')

      expect(result.success).toBe(true)
      expect(mockGit.diff).toHaveBeenCalledWith(['--find-renames', 'main...HEAD', '--', 'lib/old.ts', 'lib/new.ts'])
    })
  })
})
