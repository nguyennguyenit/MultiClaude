import fs from 'fs'
import path from 'path'
import os from 'os'
import { EventEmitter } from 'events'
import { JsonlEventParser } from './jsonl-event-parser'

/** Debounce delay to handle fs.watch firing multiple times per write */
const WATCH_DEBOUNCE_MS = 300

/**
 * Converts a project CWD path to the directory name used by Claude Code.
 * Example: /Users/foo/Project/Bar → -Users-foo-Project-Bar
 */
function cwdToProjectHash(cwd: string): string {
  return cwd.replace(/\//g, '-')
}

interface TrackedFile {
  bytesRead: number
  watcher: fs.FSWatcher | null
  debounceTimer: NodeJS.Timeout | null
}

/**
 * Watches Claude Code JSONL transcript files under ~/.claude/projects/.
 * Emits 'taskEvent' when Claude finishes a turn and is waiting for user input.
 *
 * Workflow:
 *  1. `register(cwd)` → watches ~/.claude/projects/<hash>/ for new .jsonl files
 *  2. On new/changed .jsonl: reads only newly appended bytes (byte-offset tracking)
 *  3. Passes new lines to JsonlEventParser
 *  4. If a TaskEvent is detected, emits it
 */
export class ClaudeLogWatcher extends EventEmitter {
  private readonly baseDir: string
  private readonly parser: JsonlEventParser
  /** Map of watched project dir path → FSWatcher */
  private dirWatchers: Map<string, fs.FSWatcher> = new Map()
  /** Map of JSONL file path → read state */
  private fileStates: Map<string, TrackedFile> = new Map()

  constructor() {
    super()
    this.baseDir = path.join(os.homedir(), '.claude', 'projects')
    this.parser = new JsonlEventParser()
  }

  /**
   * Register a project CWD to watch for Claude Code transcript events.
   * Safe to call multiple times with the same CWD.
   */
  register(cwd: string): void {
    const hash = cwdToProjectHash(cwd)
    const projectDir = path.join(this.baseDir, hash)

    if (this.dirWatchers.has(projectDir)) return

    // Directory may not exist yet if project hasn't been used with claude before
    if (!fs.existsSync(projectDir)) {
      this.watchForDirCreation(projectDir)
      return
    }

    this.watchProjectDir(projectDir)
  }

  /** Unregister a CWD and stop watching its directory */
  unregister(cwd: string): void {
    const hash = cwdToProjectHash(cwd)
    const projectDir = path.join(this.baseDir, hash)
    this.stopWatchingDir(projectDir)
  }

  destroy(): void {
    for (const [dir] of this.dirWatchers) {
      this.stopWatchingDir(dir)
    }
    for (const [, state] of this.fileStates) {
      if (state.debounceTimer) clearTimeout(state.debounceTimer)
      state.watcher?.close()
    }
    this.fileStates.clear()
  }

  private watchProjectDir(projectDir: string): void {
    try {
      const watcher = fs.watch(projectDir, (event, filename) => {
        if (!filename?.endsWith('.jsonl')) return
        const filePath = path.join(projectDir, filename)
        this.scheduleFileRead(filePath)
      })
      this.dirWatchers.set(projectDir, watcher)

      // Read any existing .jsonl files to initialize byte offsets
      // (don't fire notifications for past events)
      for (const file of fs.readdirSync(projectDir)) {
        if (!file.endsWith('.jsonl')) continue
        const filePath = path.join(projectDir, file)
        const size = fs.statSync(filePath).size
        this.fileStates.set(filePath, { bytesRead: size, watcher: null, debounceTimer: null })
      }
    } catch {
      // Directory not accessible — silently ignore
    }
  }

  /** Poll for directory creation when the project dir doesn't exist yet */
  private watchForDirCreation(projectDir: string): void {
    // Watch the base ~/.claude/projects dir and check if our dir appears
    try {
      const baseWatcher = fs.watch(this.baseDir, (event, filename) => {
        if (filename && path.join(this.baseDir, filename) === projectDir) {
          if (fs.existsSync(projectDir)) {
            baseWatcher.close()
            this.watchProjectDir(projectDir)
          }
        }
      })
      // Store under base dir key temporarily
      this.dirWatchers.set(projectDir + ':pending', baseWatcher)
    } catch {
      // ~/.claude/projects doesn't exist — nothing to watch
    }
  }

  private stopWatchingDir(projectDir: string): void {
    this.dirWatchers.get(projectDir)?.close()
    this.dirWatchers.delete(projectDir)
    this.dirWatchers.get(projectDir + ':pending')?.close()
    this.dirWatchers.delete(projectDir + ':pending')
  }

  private scheduleFileRead(filePath: string): void {
    const state = this.fileStates.get(filePath) || { bytesRead: 0, watcher: null, debounceTimer: null }

    // Debounce: cancel pending timer and restart
    if (state.debounceTimer) clearTimeout(state.debounceTimer)

    state.debounceTimer = setTimeout(() => {
      this.readNewContent(filePath, state)
    }, WATCH_DEBOUNCE_MS)

    this.fileStates.set(filePath, state)
  }

  private readNewContent(filePath: string, state: TrackedFile): void {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size <= state.bytesRead) return

      // Read only newly appended bytes
      const fd = fs.openSync(filePath, 'r')
      const bytesToRead = stat.size - state.bytesRead
      const buf = Buffer.alloc(bytesToRead)
      fs.readSync(fd, buf, 0, bytesToRead, state.bytesRead)
      fs.closeSync(fd)

      state.bytesRead = stat.size

      const newContent = buf.toString('utf8')
      const lines = newContent.split('\n')
      const event = this.parser.parseLines(lines, filePath)
      if (event) {
        this.emit('taskEvent', event)
      }
    } catch {
      // File may have been deleted or truncated — reset offset
      state.bytesRead = 0
    }
  }
}
