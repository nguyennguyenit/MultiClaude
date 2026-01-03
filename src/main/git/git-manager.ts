import simpleGit, { SimpleGit, StatusResult, LogResult, DefaultLogFields } from 'simple-git'
import { spawn } from 'child_process'
import { resolve, relative } from 'path'
import type {
  GitStatus,
  GitHubAuth,
  GitFileStatus,
  GitCommitResult,
  GitDiffResult,
  GitBranch,
  GitLogEntry,
  GitStashEntry,
  GitOperationResult
} from '@shared/types'

// Valid branch name pattern (alphanumeric, -, _, /, .)
const VALID_BRANCH_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/

export class GitManager {
  private getGit(cwd: string): SimpleGit {
    return simpleGit(cwd)
  }

  // Validate file path to prevent path traversal attacks
  private isValidFilePath(cwd: string, file: string): boolean {
    const absPath = resolve(cwd, file)
    const relPath = relative(cwd, absPath)
    // Must stay within cwd, no .. escapes
    return !relPath.startsWith('..') && !relPath.startsWith('/') && relPath.length > 0
  }

  // Validate branch name to prevent injection
  private isValidBranchName(name: string): boolean {
    return VALID_BRANCH_REGEX.test(name) && name.length <= 255 && !name.startsWith('-')
  }

  // Validate stash index
  private isValidStashIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < 100
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
    if (!this.isValidFilePath(cwd, file)) return false
    const git = this.getGit(cwd)
    try {
      await git.add(file)
      return true
    } catch {
      return false
    }
  }

  async unstageFile(cwd: string, file: string): Promise<boolean> {
    if (!this.isValidFilePath(cwd, file)) return false
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
    if (!this.isValidFilePath(cwd, file)) return false
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

  // ========== Pull/Fetch Operations ==========

  async pull(cwd: string): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      const result = await git.pull()
      return {
        success: true,
        message: result.summary.changes > 0
          ? `Updated: ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`
          : 'Already up to date'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pull failed'
      }
    }
  }

  async fetch(cwd: string): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      await git.fetch()
      return { success: true, message: 'Fetch completed' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fetch failed'
      }
    }
  }

  // ========== Branch Operations ==========

  async getBranches(cwd: string): Promise<GitBranch[]> {
    const git = this.getGit(cwd)
    try {
      const summary = await git.branch(['-a', '-v'])
      const branches: GitBranch[] = []

      for (const [name, data] of Object.entries(summary.branches)) {
        // Skip HEAD entries
        if (name.includes('HEAD')) continue

        const isRemote = name.startsWith('remotes/')
        const displayName = isRemote ? name.replace('remotes/', '') : name

        branches.push({
          name: displayName,
          current: data.current,
          commit: data.commit,
          label: data.label || '',
          isRemote
        })
      }

      return branches
    } catch {
      return []
    }
  }

  async createBranch(cwd: string, name: string, checkout = true): Promise<GitOperationResult> {
    if (!this.isValidBranchName(name)) {
      return { success: false, error: 'Invalid branch name' }
    }
    const git = this.getGit(cwd)
    try {
      if (checkout) {
        await git.checkoutLocalBranch(name)
      } else {
        await git.branch([name])
      }
      return { success: true, message: `Branch '${name}' created` }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create branch'
      }
    }
  }

  async checkoutBranch(cwd: string, name: string): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      await git.checkout(name)
      return { success: true, message: `Switched to '${name}'` }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Checkout failed'
      }
    }
  }

  async deleteBranch(cwd: string, name: string, force = false): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      await git.deleteLocalBranch(name, force)
      return { success: true, message: `Branch '${name}' deleted` }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete branch'
      }
    }
  }

  async mergeBranch(cwd: string, branch: string): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      const result = await git.merge([branch])
      if (result.failed) {
        return { success: false, error: 'Merge failed with conflicts' }
      }
      return { success: true, message: `Merged '${branch}' successfully` }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Merge failed'
      }
    }
  }

  // ========== Commit History ==========

  async getLog(cwd: string, maxCount = 50): Promise<GitLogEntry[]> {
    const git = this.getGit(cwd)
    try {
      const log: LogResult<DefaultLogFields> = await git.log({ maxCount })
      return log.all.map(entry => ({
        hash: entry.hash,
        hashShort: entry.hash.substring(0, 7),
        author: entry.author_name,
        email: entry.author_email,
        date: entry.date,
        message: entry.message
      }))
    } catch {
      return []
    }
  }

  // ========== Stash Operations ==========

  async getStashList(cwd: string): Promise<GitStashEntry[]> {
    const git = this.getGit(cwd)
    try {
      const result = await git.stashList()
      return result.all.map((entry, index) => ({
        index,
        hash: entry.hash,
        message: entry.message,
        date: entry.date
      }))
    } catch {
      return []
    }
  }

  async stashSave(cwd: string, message?: string): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      const args = message ? ['push', '-m', message] : ['push']
      await git.stash(args)
      return { success: true, message: 'Changes stashed' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stash failed'
      }
    }
  }

  async stashApply(cwd: string, index = 0): Promise<GitOperationResult> {
    if (!this.isValidStashIndex(index)) {
      return { success: false, error: 'Invalid stash index' }
    }
    const git = this.getGit(cwd)
    try {
      await git.stash(['apply', `stash@{${index}}`])
      return { success: true, message: 'Stash applied' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Apply failed'
      }
    }
  }

  async stashPop(cwd: string, index = 0): Promise<GitOperationResult> {
    if (!this.isValidStashIndex(index)) {
      return { success: false, error: 'Invalid stash index' }
    }
    const git = this.getGit(cwd)
    try {
      await git.stash(['pop', `stash@{${index}}`])
      return { success: true, message: 'Stash popped' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pop failed'
      }
    }
  }

  async stashDrop(cwd: string, index = 0): Promise<GitOperationResult> {
    if (!this.isValidStashIndex(index)) {
      return { success: false, error: 'Invalid stash index' }
    }
    const git = this.getGit(cwd)
    try {
      await git.stash(['drop', `stash@{${index}}`])
      return { success: true, message: 'Stash dropped' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Drop failed'
      }
    }
  }

  // ========== GitHub Logout ==========

  async logoutGitHub(): Promise<GitOperationResult> {
    return new Promise((resolve) => {
      const proc = spawn('gh', ['auth', 'logout', '-h', 'github.com'])

      proc.stdin.write('Y\n')
      proc.stdin.end()

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'Logged out from GitHub' })
        } else {
          resolve({ success: false, error: 'Logout failed' })
        }
      })

      proc.on('error', () => {
        resolve({ success: false, error: 'GitHub CLI not found' })
      })
    })
  }
}
