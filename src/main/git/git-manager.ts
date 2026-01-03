import simpleGit, { SimpleGit, StatusResult } from 'simple-git'
import { spawn } from 'child_process'
import type { GitStatus, GitHubAuth, GitFileStatus, GitCommitResult, GitDiffResult } from '@shared/types'

export class GitManager {
  private getGit(cwd: string): SimpleGit {
    return simpleGit(cwd)
  }

  async getStatus(cwd: string): Promise<GitStatus> {
    const git = this.getGit(cwd)

    try {
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return {
          isRepo: false,
          hasRemote: false,
          isDirty: false,
          staged: 0,
          unstaged: 0,
          untracked: 0
        }
      }

      const status: StatusResult = await git.status()
      const remotes = await git.getRemotes(true)
      const originRemote = remotes.find(r => r.name === 'origin')

      return {
        isRepo: true,
        branch: status.current || undefined,
        hasRemote: !!originRemote,
        remoteName: originRemote?.name,
        remoteUrl: originRemote?.refs?.fetch,
        isDirty: !status.isClean(),
        staged: status.staged.length,
        unstaged: status.modified.length + status.deleted.length,
        untracked: status.not_added.length
      }
    } catch (error) {
      return {
        isRepo: false,
        hasRemote: false,
        isDirty: false,
        staged: 0,
        unstaged: 0,
        untracked: 0
      }
    }
  }

  async init(cwd: string): Promise<boolean> {
    const git = this.getGit(cwd)
    try {
      await git.init()
      return true
    } catch {
      return false
    }
  }

  async addRemote(cwd: string, url: string, name = 'origin'): Promise<boolean> {
    const git = this.getGit(cwd)
    try {
      await git.addRemote(name, url)
      return true
    } catch {
      return false
    }
  }

  async push(cwd: string, branch?: string, setUpstream = true): Promise<boolean> {
    const git = this.getGit(cwd)
    try {
      const status = await git.status()
      const currentBranch = branch || status.current || 'main'

      if (setUpstream) {
        await git.push(['--set-upstream', 'origin', currentBranch])
      } else {
        await git.push('origin', currentBranch)
      }
      return true
    } catch {
      return false
    }
  }

  // GitHub CLI integration
  async getGitHubAuthStatus(): Promise<GitHubAuth> {
    return new Promise((resolve) => {
      const proc = spawn('gh', ['auth', 'status'])
      let output = ''

      proc.stdout.on('data', (data) => {
        output += data.toString()
      })

      proc.stderr.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          // Parse username from output
          const match = output.match(/Logged in to github\.com account (\S+)/)
          resolve({
            isAuthenticated: true,
            username: match?.[1]
          })
        } else {
          resolve({ isAuthenticated: false })
        }
      })

      proc.on('error', () => {
        resolve({ isAuthenticated: false })
      })
    })
  }

  async loginGitHub(): Promise<{ success: boolean; deviceCode?: string; verificationUri?: string }> {
    return new Promise((resolve) => {
      const proc = spawn('gh', ['auth', 'login', '--web', '-h', 'github.com'])
      let output = ''

      proc.stdout.on('data', (data) => {
        output += data.toString()
        // Parse device code and URL
        const codeMatch = output.match(/code:\s+(\S+)/)
        const urlMatch = output.match(/(https:\/\/github\.com\/login\/device)/)

        if (codeMatch && urlMatch) {
          resolve({
            success: true,
            deviceCode: codeMatch[1],
            verificationUri: urlMatch[1]
          })
        }
      })

      proc.stderr.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false })
        }
      })

      proc.on('error', () => {
        resolve({ success: false })
      })
    })
  }

  async createGitHubRepo(name: string, isPrivate = false, cwd?: string): Promise<{ success: boolean; url?: string; error?: string }> {
    const workDir = cwd || process.cwd()
    const git = this.getGit(workDir)

    // Ensure git is initialized
    try {
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        await git.init()
      }
    } catch {
      await git.init()
    }

    // Check if there are commits
    let hasCommits = false
    try {
      const log = await git.log({ maxCount: 1 })
      hasCommits = log.total > 0
    } catch {
      hasCommits = false
    }

    return new Promise((resolve) => {
      // If no commits, create repo without --push, then just add remote
      const args = ['repo', 'create', name, '--source', workDir]
      if (isPrivate) args.push('--private')
      else args.push('--public')

      // Only push if there are commits
      if (hasCommits) {
        args.push('--push')
      }

      console.log('Running gh command:', 'gh', args.join(' '))

      const proc = spawn('gh', args, { cwd: workDir })
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        console.log('gh exit code:', code, 'stdout:', stdout, 'stderr:', stderr)
        if (code === 0) {
          const urlMatch = stdout.match(/(https:\/\/github\.com\/\S+)/)
          resolve({
            success: true,
            url: urlMatch?.[1]
          })
        } else {
          resolve({ success: false, error: stderr || stdout })
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  }

  // ========== Git Panel / Commit Workflow Methods ==========

  // Validate file path to prevent path traversal attacks
  private isValidFilePath(file: string): boolean {
    const normalized = file.replace(/\\/g, '/')
    return !normalized.startsWith('/') &&
           !normalized.startsWith('..') &&
           !normalized.includes('/../') &&
           !normalized.includes('/..')
  }

  async getFileStatus(cwd: string): Promise<GitFileStatus[]> {
    const git = this.getGit(cwd)
    try {
      const status = await git.status()
      const files: GitFileStatus[] = []

      // Staged files
      for (const file of status.staged) {
        files.push({ path: file, status: 'staged', staged: true })
      }

      // Renamed (staged)
      for (const { from, to } of status.renamed) {
        files.push({ path: to, status: 'renamed', staged: true, oldPath: from })
      }

      // Modified (unstaged)
      for (const file of status.modified) {
        if (!status.staged.includes(file)) {
          files.push({ path: file, status: 'modified', staged: false })
        }
      }

      // Deleted (unstaged)
      for (const file of status.deleted) {
        if (!status.staged.includes(file)) {
          files.push({ path: file, status: 'deleted', staged: false })
        }
      }

      // Untracked
      for (const file of status.not_added) {
        files.push({ path: file, status: 'untracked', staged: false })
      }

      return files
    } catch {
      return []
    }
  }

  async stageFile(cwd: string, file: string): Promise<boolean> {
    if (!this.isValidFilePath(file)) return false
    const git = this.getGit(cwd)
    try {
      await git.add(file)
      return true
    } catch {
      return false
    }
  }

  async unstageFile(cwd: string, file: string): Promise<boolean> {
    if (!this.isValidFilePath(file)) return false
    const git = this.getGit(cwd)
    try {
      await git.reset(['HEAD', '--', file])
      return true
    } catch {
      return false
    }
  }

  async stageAll(cwd: string): Promise<boolean> {
    const git = this.getGit(cwd)
    try {
      await git.add('-A')
      return true
    } catch {
      return false
    }
  }

  async commit(cwd: string, message: string): Promise<GitCommitResult> {
    const git = this.getGit(cwd)
    try {
      const result = await git.commit(message)
      return { success: true, hash: result.commit }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Commit failed'
      }
    }
  }

  async getDiff(cwd: string, file?: string, staged = false): Promise<GitDiffResult> {
    const git = this.getGit(cwd)
    try {
      const args: string[] = staged ? ['--cached'] : []
      if (file) args.push('--', file)

      const diff = await git.diff(args)
      return { success: true, diff }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Diff failed'
      }
    }
  }

  async discardChanges(cwd: string, file: string): Promise<boolean> {
    if (!this.isValidFilePath(file)) return false
    const git = this.getGit(cwd)
    try {
      const status = await git.status()
      if (status.not_added.includes(file)) {
        // Untracked files: use clean
        await git.clean('f', ['--', file])
      } else {
        // Tracked files: use checkout
        await git.checkout(['--', file])
      }
      return true
    } catch {
      return false
    }
  }
}
