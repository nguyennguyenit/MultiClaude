import { watch, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { FSWatcher } from 'fs'

type BranchChangeCallback = (projectPath: string, branch: string) => void

/**
 * Watches .git/HEAD file for branch changes from external terminals.
 * When git checkout/switch is run outside the app, this detects the change.
 */
export class GitHeadWatcher {
  private watchers: Map<string, FSWatcher> = new Map()
  private lastBranches: Map<string, string> = new Map()
  private callbacks: BranchChangeCallback[] = []
  // Debounce to prevent multiple triggers from single git operation
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private debounceMs = 300

  /**
   * Register a callback for branch changes
   */
  onBranchChange(callback: BranchChangeCallback): () => void {
    this.callbacks.push(callback)
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index !== -1) this.callbacks.splice(index, 1)
    }
  }

  /**
   * Start watching a project's .git/HEAD file
   */
  watch(projectPath: string): boolean {
    if (this.watchers.has(projectPath)) return true

    const gitDir = join(projectPath, '.git')
    const gitHeadPath = join(gitDir, 'HEAD')
    if (!existsSync(gitHeadPath)) return false

    // Read initial branch
    const initialBranch = this.readBranch(gitHeadPath)
    if (initialBranch) {
      this.lastBranches.set(projectPath, initialBranch)
    }

    try {
      // Watch the .git directory instead of just HEAD file
      // This is more reliable on Linux where git may use atomic file operations
      const watcher = watch(gitDir, (eventType, filename) => {
        // Only care about HEAD file changes
        if (filename === 'HEAD') {
          console.log(`[GitHeadWatcher] Detected HEAD change in ${projectPath}`)
          this.handleChange(projectPath, gitHeadPath)
        }
      })

      watcher.on('error', (error) => {
        console.error(`[GitHeadWatcher] Error watching ${projectPath}:`, error)
        this.unwatch(projectPath)
      })

      this.watchers.set(projectPath, watcher)
      console.log(`[GitHeadWatcher] Started watching ${projectPath}`)
      return true
    } catch (error) {
      console.error(`[GitHeadWatcher] Failed to watch ${projectPath}:`, error)
      return false
    }
  }

  /**
   * Stop watching a project
   */
  unwatch(projectPath: string): void {
    const watcher = this.watchers.get(projectPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(projectPath)
      this.lastBranches.delete(projectPath)
    }
    const timer = this.debounceTimers.get(projectPath)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(projectPath)
    }
  }

  /**
   * Stop all watchers
   */
  destroy(): void {
    for (const [projectPath] of this.watchers) {
      this.unwatch(projectPath)
    }
    this.callbacks = []
  }

  private handleChange(projectPath: string, gitHeadPath: string): void {
    // Debounce changes
    const existingTimer = this.debounceTimers.get(projectPath)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      this.debounceTimers.delete(projectPath)
      const newBranch = this.readBranch(gitHeadPath)
      const lastBranch = this.lastBranches.get(projectPath)

      console.log(`[GitHeadWatcher] Branch check: ${lastBranch} -> ${newBranch}`)

      if (newBranch && newBranch !== lastBranch) {
        this.lastBranches.set(projectPath, newBranch)
        console.log(`[GitHeadWatcher] Branch changed! Notifying ${this.callbacks.length} callbacks`)
        // Notify all callbacks
        for (const callback of this.callbacks) {
          try {
            callback(projectPath, newBranch)
          } catch (error) {
            console.error('[GitHeadWatcher] Callback error:', error)
          }
        }
      }
    }, this.debounceMs)

    this.debounceTimers.set(projectPath, timer)
  }

  private readBranch(gitHeadPath: string): string | null {
    try {
      const content = readFileSync(gitHeadPath, 'utf-8').trim()
      // Format: "ref: refs/heads/branch-name" or commit hash for detached HEAD
      if (content.startsWith('ref: refs/heads/')) {
        return content.replace('ref: refs/heads/', '')
      }
      // Detached HEAD - return short hash
      return content.slice(0, 7)
    } catch {
      return null
    }
  }
}
