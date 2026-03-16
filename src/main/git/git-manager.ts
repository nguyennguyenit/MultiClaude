import simpleGit, { SimpleGit, StatusResult, LogResult, DefaultLogFields } from 'simple-git'
import { spawn, execSync } from 'child_process'
import { readFile, stat } from 'fs/promises'
import { resolve, relative } from 'path'
import type {
  GitStatus,
  GitHubAuth,
  GitConfig,
  GitFileStatus,
  GitCommitResult,
  GitDiffResult,
  GitBranch,
  GitLogEntry,
  GitStashEntry,
  GitOperationResult,
  GitBranchDiff,
  GitBranchDiffFile
} from '@shared/types'

// Valid branch name pattern (alphanumeric, -, _, /, .)
const VALID_BRANCH_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/

// Resolve gh CLI path — Electron doesn't inherit shell PATH on macOS
function resolveGhPath(): string {
  const candidates = [
    '/opt/homebrew/bin/gh', // Apple Silicon Homebrew
    '/usr/local/bin/gh',    // Intel Homebrew
    '/usr/bin/gh',
  ]
  for (const p of candidates) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' })
      return p
    } catch {
      // not found at this path
    }
  }
  return 'gh' // fallback, will fail with clear error
}

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

  private mapPorcelainStatus(code: string, staged: boolean): GitFileStatus['status'] {
    switch (code) {
      case 'A':
        return staged ? 'added' : 'untracked'
      case 'M':
        return 'modified'
      case 'D':
        return 'deleted'
      case 'R':
        return 'renamed'
      case 'C':
        return 'copied'
      default:
        return staged ? 'staged' : 'modified'
    }
  }

  private parseRenamedPath(pathSpec: string): { path: string; oldPath?: string } {
    const braceRename = pathSpec.match(/^(.*)\{(.*) => (.*)\}(.*)$/)
    if (braceRename) {
      return {
        oldPath: `${braceRename[1]}${braceRename[2]}${braceRename[4]}`,
        path: `${braceRename[1]}${braceRename[3]}${braceRename[4]}`
      }
    }

    const rename = pathSpec.match(/^(.*) => (.*)$/)
    if (rename) {
      return {
        oldPath: rename[1],
        path: rename[2]
      }
    }

    return { path: pathSpec }
  }

  private parseNumstat(output: string): Map<string, { additions: number; deletions: number; oldPath?: string }> {
    const map = new Map<string, { additions: number; deletions: number; oldPath?: string }>()

    for (const line of output.split('\n')) {
      if (!line.trim()) continue

      const parts = line.split('\t')
      if (parts.length < 3) continue

      const rawPath = parts.slice(2).join('\t').trim()
      if (!rawPath) continue

      const { path, oldPath } = this.parseRenamedPath(rawPath)
      map.set(path, {
        additions: parseInt(parts[0], 10) || 0,
        deletions: parseInt(parts[1], 10) || 0,
        oldPath
      })
    }

    return map
  }

  private parsePorcelainFileStatus(output: string): GitFileStatus[] {
    const records = output.split('\0')
    const files: GitFileStatus[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      if (!record) continue

      const code = record.slice(0, 2)
      const path = record.slice(3)
      if (!path) continue

      if (code === '??') {
        files.push({ path, status: 'untracked', staged: false })
        continue
      }

      const indexStatus = code[0]
      const worktreeStatus = code[1]
      const needsOldPath = indexStatus === 'R' || indexStatus === 'C'
      const oldPath = needsOldPath ? records[++i] || undefined : undefined

      if (indexStatus !== ' ' && indexStatus !== '?') {
        files.push({
          path,
          status: this.mapPorcelainStatus(indexStatus, true),
          staged: true,
          oldPath
        })
      }

      if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
        files.push({
          path,
          status: this.mapPorcelainStatus(worktreeStatus, false),
          staged: false
        })
      }
    }

    return files
  }

  private buildDiffArgs(baseArgs: string[], file?: string, oldFile?: string): string[] {
    const args = ['--find-renames', ...baseArgs]

    if (file) {
      args.push('--')
      if (oldFile && oldFile !== file) {
        args.push(oldFile)
      }
      args.push(file)
    }

    return args
  }

  private getDiffFileMode(mode: number): string {
    return (mode & 0o111) !== 0 ? '100755' : '100644'
  }

  private async buildUntrackedDiff(cwd: string, file: string): Promise<string> {
    const absPath = resolve(cwd, file)
    const fileStat = await stat(absPath)

    if (fileStat.isDirectory()) {
      return [
        `diff --git a/${file} b/${file}`,
        'new file mode 040000',
        `+++ b/${file}`,
        '@@ -0,0 +1 @@',
        '+<untracked directory>'
      ].join('\n')
    }

    const buffer = await readFile(absPath)
    const mode = this.getDiffFileMode(fileStat.mode)
    const isBinary = buffer.includes(0)

    if (isBinary) {
      return [
        `diff --git a/${file} b/${file}`,
        `new file mode ${mode}`,
        `Binary files /dev/null and b/${file} differ`
      ].join('\n')
    }

    const normalized = buffer.toString('utf8').replace(/\r\n/g, '\n')
    const lines = normalized.length === 0
      ? []
      : (normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized).split('\n')

    const header = [
      `diff --git a/${file} b/${file}`,
      `new file mode ${mode}`
    ]

    if (lines.length === 0) {
      return header.join('\n')
    }

    const diffLines = [
      ...header,
      '--- /dev/null',
      `+++ b/${file}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map(line => `+${line}`)
    ]

    if (!normalized.endsWith('\n')) {
      diffLines.push('\\ No newline at end of file')
    }

    return diffLines.join('\n')
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
    } catch {
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
      // Initialize with main branch (GitHub default)
      await git.init(['--initial-branch=main'])
    } catch {
      // Fallback for older git versions that don't support --initial-branch
      await git.init()
      try {
        // Rename master to main if needed (after first commit)
        await git.branch(['-M', 'main'])
      } catch {
        // Ignore if branch doesn't exist yet
      }
    }

    try {
      // Stage all files
      await git.add('.')

      // Check if there's anything to commit
      const status = await git.status()
      if (status.staged.length === 0 && status.created.length === 0) {
        // Empty folder - create a .gitkeep file
        const { writeFileSync } = await import('fs')
        const { join } = await import('path')
        writeFileSync(join(cwd, '.gitkeep'), '')
        await git.add('.gitkeep')
      }

      await git.commit('Initial commit')

      // Ensure branch is named 'main' (GitHub default)
      const currentStatus = await git.status()
      if (currentStatus.current && currentStatus.current !== 'main') {
        await git.branch(['-M', 'main'])
      }

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

  async push(cwd: string, branch?: string, setUpstream = true): Promise<GitOperationResult> {
    const git = this.getGit(cwd)
    try {
      const status = await git.status()
      const currentBranch = branch || status.current || 'main'

      if (setUpstream) {
        await git.push(['--set-upstream', 'origin', currentBranch])
      } else {
        await git.push('origin', currentBranch)
      }
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Push failed'
      return { success: false, error: message }
    }
  }

  // GitHub CLI integration
  async getGitHubAuthStatus(): Promise<GitHubAuth> {
    return new Promise((resolve) => {
      const proc = spawn(resolveGhPath(), ['auth', 'status'])
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
      const proc = spawn(resolveGhPath(), ['auth', 'login', '--web', '-h', 'github.com'])
      let output = ''

      const checkOutput = () => {
        // gh auth login --web outputs device code and URL to stderr (not stdout)
        const codeMatch = output.match(/code:\s+(\S+)/i)
        const urlMatch = output.match(/(https:\/\/github\.com\/login\/device)/)
        if (codeMatch && urlMatch) {
          resolve({
            success: true,
            deviceCode: codeMatch[1],
            verificationUri: urlMatch[1]
          })
        }
      }

      proc.stdout.on('data', (data) => {
        output += data.toString()
        checkOutput()
      })

      proc.stderr.on('data', (data) => {
        output += data.toString()
        checkOutput()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: output || 'gh auth login failed' } as { success: boolean; error?: string })
        }
      })

      proc.on('error', (err) => {
        const isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT'
        resolve({ success: false, error: isNotFound ? 'GitHub CLI (gh) not found. Install it with: brew install gh' : err.message } as { success: boolean; error?: string })
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

      const proc = spawn(resolveGhPath(), args, { cwd: workDir })
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
      const porcelain = await git.raw(['status', '--porcelain', '-z'])
      const files = this.parsePorcelainFileStatus(porcelain)

      // Enrich with line stats via --numstat
      try {
        const [unstagedNumstat, stagedNumstat] = await Promise.all([
          git.diff(['--numstat']),
          git.diff(['--numstat', '--cached'])
        ])
        const unstagedStats = this.parseNumstat(unstagedNumstat)
        const stagedStats = this.parseNumstat(stagedNumstat)
        for (const f of files) {
          const stats = f.staged ? stagedStats.get(f.path) : unstagedStats.get(f.path)
          if (stats) {
            f.additions = stats.additions
            f.deletions = stats.deletions
            if (!f.oldPath && stats.oldPath) {
              f.oldPath = stats.oldPath
            }
          }
        }
      } catch {
        // Line stats are optional — silently ignore failures
      }

      return files
    } catch {
      return []
    }
  }

  async diffBranch(cwd: string, baseBranch?: string): Promise<GitBranchDiff> {
    const git = this.getGit(cwd)
    try {
      // Auto-detect base branch if not specified
      if (!baseBranch) {
        const branches = await git.branchLocal()
        baseBranch = branches.all.includes('main') ? 'main'
          : branches.all.includes('master') ? 'master'
          : branches.all[0]
      }

      const status = await git.status()
      const current = status.current
      if (!current || current === baseBranch) {
        return { baseBranch: baseBranch || 'main', files: [], aheadBy: 0, behindBy: 0 }
      }

      const [nameStatusRaw, numstatRaw] = await Promise.all([
        git.raw(['diff', '--name-status', `${baseBranch}...${current}`]),
        git.diff(['--numstat', `${baseBranch}...${current}`])
      ])
      const statusMap = new Map<string, { status: GitBranchDiffFile['status']; oldPath?: string }>()
      for (const line of nameStatusRaw.split('\n')) {
        const renameMatch = line.match(/^R\d*\t(.+)\t(.+)$/)
        if (renameMatch) {
          statusMap.set(renameMatch[2], { status: 'renamed', oldPath: renameMatch[1] })
          continue
        }
        const match = line.match(/^([ADM])\t(.+)$/)
        if (!match) continue

        const fileStatus: GitBranchDiffFile['status'] =
          match[1] === 'A' ? 'added' :
          match[1] === 'D' ? 'deleted' : 'modified'
        statusMap.set(match[2], { status: fileStatus })
      }

      const numstatMap = this.parseNumstat(numstatRaw)
      const files: GitBranchDiffFile[] = Array.from(statusMap.entries()).map(([path, info]) => {
        const stats = numstatMap.get(path)
        return {
          path,
          status: info.status,
          oldPath: info.oldPath ?? stats?.oldPath,
          additions: stats?.additions ?? 0,
          deletions: stats?.deletions ?? 0
        }
      })

      // Get ahead/behind counts
      const [aheadLog, behindLog] = await Promise.all([
        git.log([`${baseBranch}..${current}`, '--oneline']),
        git.log([`${current}..${baseBranch}`, '--oneline'])
      ])

      return {
        baseBranch,
        files,
        aheadBy: aheadLog.total,
        behindBy: behindLog.total
      }
    } catch {
      return { baseBranch: baseBranch || 'main', files: [], aheadBy: 0, behindBy: 0 }
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

  async getDiff(cwd: string, file?: string, staged = false, oldFile?: string): Promise<GitDiffResult> {
    if (file && !this.isValidFilePath(cwd, file)) return { success: false, error: 'Invalid file path' }
    if (oldFile && !this.isValidFilePath(cwd, oldFile)) return { success: false, error: 'Invalid file path' }
    const git = this.getGit(cwd)
    try {
      if (file && !staged) {
        const status = await git.status()
        if (status.not_added.includes(file)) {
          const diff = await this.buildUntrackedDiff(cwd, file)
          return { success: true, diff }
        }
      }

      const diff = await git.diff(this.buildDiffArgs(staged ? ['--cached'] : [], file, oldFile))
      return { success: true, diff }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Diff failed'
      }
    }
  }

  /** Get diff of a file against a base branch (three-dot merge-base diff) */
  async getDiffAgainstBranch(cwd: string, file: string, baseBranch: string, oldFile?: string): Promise<GitDiffResult> {
    if (!this.isValidFilePath(cwd, file)) return { success: false, error: 'Invalid file path' }
    if (oldFile && !this.isValidFilePath(cwd, oldFile)) return { success: false, error: 'Invalid file path' }
    if (!this.isValidBranchName(baseBranch)) return { success: false, error: 'Invalid branch name' }
    const git = this.getGit(cwd)
    try {
      const diff = await git.diff(this.buildDiffArgs([`${baseBranch}...HEAD`], file, oldFile))
      return { success: true, diff }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Branch diff failed'
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
      const proc = spawn(resolveGhPath(), ['auth', 'logout', '-h', 'github.com'])

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

  // ========== Git Config ==========

  async getGitConfig(): Promise<GitConfig> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['config', '--global', '--get-regexp', '^user\\.'])
      let output = ''

      proc.stdout.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', () => {
        const config: GitConfig = {}
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.startsWith('user.name ')) {
            config.userName = line.replace('user.name ', '').trim()
          } else if (line.startsWith('user.email ')) {
            config.userEmail = line.replace('user.email ', '').trim()
          }
        }
        resolve(config)
      })

      proc.on('error', () => {
        resolve({})
      })
    })
  }

  async setGitConfig(config: GitConfig): Promise<GitOperationResult> {
    const runGitConfig = (key: string, value: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const args = value
          ? ['config', '--global', key, value]
          : ['config', '--global', '--unset', key]
        const proc = spawn('git', args)
        let stderr = ''
        proc.stderr.on('data', (d) => { stderr += d.toString() })
        proc.on('close', (code) => {
          // exit code 5 = key not found when unsetting (ok to ignore)
          if (code === 0 || (code === 5 && !value)) resolve()
          else reject(new Error(stderr.trim() || `git config exited with code ${code}`))
        })
        proc.on('error', (err) => reject(new Error(`git not found: ${err.message}`)))
      })

    try {
      // Run sequentially — parallel git config commands conflict on ~/.gitconfig lock
      if (config.userName !== undefined) await runGitConfig('user.name', config.userName)
      if (config.userEmail !== undefined) await runGitConfig('user.email', config.userEmail)
      return { success: true, message: 'Git config updated' }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
}
