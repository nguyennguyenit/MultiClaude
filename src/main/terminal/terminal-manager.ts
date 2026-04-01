import * as pty from '@lydell/node-pty'
import os from 'os'
import { spawnSync } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'
import type { Terminal, TerminalSession, WindowsShell } from '@shared/types'

const DESTROY_TIMEOUT_MS = 3000
// Max exited terminals to keep for notification button lookups
const MAX_GHOST_TERMINALS = 20

interface PTYProcess {
  id: string
  pty: pty.IPty
  metadata: Terminal
  outputBuffer: string
  inputBuffer: string
  lastOutputAt: number // Timestamp of last output for busy detection
  oscBuffer: string // Buffer for incomplete OSC sequences
  destroying?: boolean // Guard flag to prevent duplicate destroyAsync calls
  suspended?: boolean // True when system is suspended, prevents PTY operations
}

export class TerminalManager extends EventEmitter {
  private terminals: Map<string, PTYProcess> = new Map()
  // Ghost cache: preserves exited terminal state for Telegram notification button lookups
  private exitedTerminals: Map<string, TerminalSession> = new Map()
  private shell: string
  private resolvedWindowsPowerShellCommand: string | null = null
  private systemSuspended = false // Track system suspend state
  private nextTerminalNumber = 1

  constructor() {
    super()
    this.shell = this.getDefaultShell()

    // Listen for system power events to prevent SIGTRAP on suspend/resume
    this.on('system-suspend', () => {
      console.log('[terminal-manager] System suspending - pausing PTY operations')
      this.systemSuspended = true
      for (const term of this.terminals.values()) {
        term.suspended = true
      }
    })

    this.on('system-resume', () => {
      console.log('[terminal-manager] System resumed - resuming PTY operations')
      this.systemSuspended = false
      // Check each terminal's health and mark as resumed
      for (const term of this.terminals.values()) {
        term.suspended = false
        // Emit event so renderer can refresh if needed
        this.emit('terminal-resumed', { terminalId: term.id })
      }
    })
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    // On macOS, use dscl to get the actual default shell (handles chsh changes)
    // Fall back to process.env.SHELL which may be stale if app was launched before chsh
    if (process.platform === 'darwin') {
      try {
        const result = spawnSync('dscl', ['.', '-read', `/Users/${os.userInfo().username}`, 'UserShell'], {
          encoding: 'utf8'
        })
        const match = result.stdout?.match(/UserShell:\s+(.+)/)
        if (match?.[1]) return match[1].trim()
      } catch {
        // ignore
      }
    }
    return process.env.SHELL || '/bin/bash'
  }

  private resolveWindowsPowerShellCommand(): string {
    if (this.resolvedWindowsPowerShellCommand) {
      return this.resolvedWindowsPowerShellCommand
    }

    const wherePwsh = spawnSync('where.exe', ['pwsh.exe'], {
      stdio: 'ignore',
      windowsHide: true
    })
    if (wherePwsh.status === 0) {
      this.resolvedWindowsPowerShellCommand = 'pwsh.exe'
      return this.resolvedWindowsPowerShellCommand
    }

    const powerShellRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
      .filter((root): root is string => typeof root === 'string' && root.length > 0)
      .map(root => path.join(root, 'PowerShell'))

    for (const root of powerShellRoots) {
      if (!existsSync(root)) continue

      try {
        const candidates = readdirSync(root, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => path.join(root, entry.name, 'pwsh.exe'))
          .filter(candidate => existsSync(candidate))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

        if (candidates.length > 0) {
          this.resolvedWindowsPowerShellCommand = candidates[0]
          return this.resolvedWindowsPowerShellCommand
        }
      } catch {
        // Ignore unreadable install roots and keep falling back.
      }
    }

    this.resolvedWindowsPowerShellCommand = 'powershell.exe'
    return this.resolvedWindowsPowerShellCommand
  }

  /**
   * Get shell command and args based on WindowsShell option
   * Non-Windows: uses default shell
   * Windows: supports cmd, powershell, or wsl distro
   */
  private getShellCommand(shell?: WindowsShell): { command: string; args: string[] } {
    // Non-Windows: use detected default shell (this.shell handles macOS chsh correctly)
    if (process.platform !== 'win32') {
      return {
        command: this.shell,
        args: ['-l']
      }
    }

    // Windows: check shell option
    if (!shell || shell.type === 'cmd') {
      return {
        command: process.env.COMSPEC || 'cmd.exe',
        args: []
      }
    }

    if (shell.type === 'powershell') {
      return {
        command: this.resolveWindowsPowerShellCommand(),
        args: ['-NoLogo']
      }
    }

    if (shell.type === 'wsl') {
      return {
        command: 'wsl.exe',
        args: ['-d', shell.distro]
      }
    }

    // Fallback
    return {
      command: process.env.COMSPEC || 'cmd.exe',
      args: []
    }
  }

  private generateId(): string {
    return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Parse OSC escape sequences for terminal title changes
   * OSC 0/1/2 set window/icon title: \x1b]0;title\x07 or \x1b]0;title\x1b\\
   * Only updates title if allowTitleUpdate flag is true
   */
  private parseOscTitle(term: PTYProcess, data: string): void {
    // Skip if title updates not allowed yet (default until activity starts)
    if (!term.metadata.allowTitleUpdate) return

    // Append to OSC buffer
    term.oscBuffer += data

    // Keep buffer small - only need enough for title sequences
    if (term.oscBuffer.length > 2000) {
      term.oscBuffer = term.oscBuffer.slice(-1000)
    }

    // Match OSC 0, 1, or 2 (window title, icon name, or both)
    // Terminators: BEL (\x07) or ST (\x1b\\)
    const oscPattern = /\x1b\]([012]);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
    let match: RegExpExecArray | null

    while ((match = oscPattern.exec(term.oscBuffer)) !== null) {
      const newTitle = match[2].trim()
      if (newTitle && newTitle !== term.metadata.title) {
        term.metadata.title = newTitle
        this.emit('titleChange', { terminalId: term.id, title: newTitle })
      }
    }

    // Clear processed part of buffer (keep potential incomplete sequence)
    const lastEsc = term.oscBuffer.lastIndexOf('\x1b]')
    if (lastEsc !== -1) {
      const afterEsc = term.oscBuffer.slice(lastEsc)
      // Check if it's a complete sequence (has terminator)
      if (afterEsc.includes('\x07') || afterEsc.includes('\x1b\\')) {
        term.oscBuffer = ''
      } else {
        term.oscBuffer = afterEsc
      }
    } else {
      term.oscBuffer = ''
    }
  }

  private setClaudeMode(term: PTYProcess): void {
    if (term.metadata.isClaudeMode && term.metadata.allowTitleUpdate) return

    term.metadata.isClaudeMode = true
    // Enable title updates once Claude is running (activity started)
    term.metadata.allowTitleUpdate = true
    this.emit('stateChange', { terminalId: term.id, isClaudeMode: true })
  }

  private processInputForClaudeMode(term: PTYProcess, data: string): void {
    if (term.metadata.isClaudeMode) return

    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const command = term.inputBuffer.trim()
        term.inputBuffer = ''

        if (/^claude(?:\s|$)/.test(command)) {
          this.setClaudeMode(term)
        }
        continue
      }

      if (char === '\u007f' || char === '\b') {
        term.inputBuffer = term.inputBuffer.slice(0, -1)
        continue
      }

      // Only keep printable command input. This avoids escape-sequence noise from
      // cursor/navigation keys while still catching direct `claude` launches.
      if (char >= ' ' || char === '\t') {
        term.inputBuffer += char
        if (term.inputBuffer.length > 1024) {
          term.inputBuffer = term.inputBuffer.slice(-1024)
        }
      }
    }
  }

  create(options: { cwd?: string; projectId?: string; shell?: WindowsShell } = {}): Terminal {
    const id = this.generateId()
    const cwd = options.cwd || os.homedir()

    // Determine shell command and args based on shell option
    const { command, args } = this.getShellCommand(options.shell)

    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      },
      cols: 80,
      rows: 24
    })

    const terminal: Terminal = {
      id,
      title: `Terminal ${this.nextTerminalNumber++}`,
      cwd,
      isClaudeMode: false,
      projectId: options.projectId,
      createdAt: new Date(),
      allowTitleUpdate: false // Title stays as "Terminal N" until activity starts
    }

    const termProcess: PTYProcess = {
      id,
      pty: ptyProcess,
      metadata: terminal,
      outputBuffer: '',
      inputBuffer: '',
      lastOutputAt: 0,
      oscBuffer: ''
    }

    // Handle terminal output
    ptyProcess.onData((data) => {
      // Skip processing during system suspend to prevent issues with invalid FDs
      if (termProcess.suspended || this.systemSuspended) return

      termProcess.outputBuffer += data
      termProcess.lastOutputAt = Date.now()
      if (termProcess.outputBuffer.length > TERMINAL_OUTPUT_BUFFER_MAX) {
        termProcess.outputBuffer = termProcess.outputBuffer.slice(-TERMINAL_OUTPUT_BUFFER_TRIM_TO)
      }
      this.emit('output', { terminalId: id, data })

      // Parse OSC sequences for title changes
      this.parseOscTitle(termProcess, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.emit('exit', { terminalId: id, exitCode })
      // Save to ghost cache before removing — allows Telegram buttons to still work
      this.exitedTerminals.set(id, {
        id,
        title: termProcess.metadata.title,
        cwd: termProcess.metadata.cwd,
        projectId: termProcess.metadata.projectId,
        claudeSessionId: termProcess.metadata.claudeSessionId,
        outputBuffer: termProcess.outputBuffer,
        lastOutputAt: termProcess.lastOutputAt
      })
      if (this.exitedTerminals.size > MAX_GHOST_TERMINALS) {
        this.exitedTerminals.delete(this.exitedTerminals.keys().next().value!)
      }
      this.terminals.delete(id)
    })

    this.terminals.set(id, termProcess)
    this.emit('created', { terminal })
    return terminal
  }

  write(id: string, data: string): boolean {
    const term = this.terminals.get(id)
    if (!term) return false
    // Skip PTY operations during system suspend to prevent SIGTRAP
    if (term.suspended || this.systemSuspended) {
      console.debug(`[terminal-manager] Skipping write during suspend: ${id}`)
      return false
    }
    try {
      this.processInputForClaudeMode(term, data)
      term.pty.write(data)
      return true
    } catch (error) {
      // PTY may be invalid after system resume - log but don't crash
      console.error(`[terminal-manager] Write failed for ${id}:`, (error as Error).message)
      return false
    }
  }

  resize(id: string, cols: number, rows: number): boolean {
    const term = this.terminals.get(id)
    if (!term) return false
    // Skip PTY operations during system suspend to prevent SIGTRAP
    if (term.suspended || this.systemSuspended) {
      console.debug(`[terminal-manager] Skipping resize during suspend: ${id}`)
      return false
    }
    try {
      term.pty.resize(cols, rows)
      return true
    } catch (error) {
      // PTY may be invalid after system resume - log but don't crash
      console.error(`[terminal-manager] Resize failed for ${id}:`, (error as Error).message)
      return false
    }
  }

  destroy(id: string): boolean {
    const term = this.terminals.get(id)
    if (!term) return false
    term.pty.kill()
    this.terminals.delete(id)
    return true
  }

  destroyAll(): void {
    for (const [id] of this.terminals) {
      this.destroy(id)
    }
  }

  /**
   * Force kill process - platform specific
   * Windows: taskkill for process tree (using array args to prevent injection)
   * Unix: SIGKILL
   */
  private forceKill(term: PTYProcess): void {
    try {
      if (process.platform === 'win32') {
        // Use spawnSync with array args to prevent command injection
        console.debug(`[terminal-manager] Force killing Windows process tree: PID ${term.pty.pid}`)
        spawnSync('taskkill', ['/PID', String(term.pty.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        console.debug(`[terminal-manager] Force killing Unix process: PID ${term.pty.pid}`)
        process.kill(term.pty.pid, 'SIGKILL')
      }
    } catch (error) {
      // Process already dead or permission denied - safe to ignore
      console.debug(`[terminal-manager] Force kill failed (likely already dead): ${(error as Error).message}`)
    }
  }

  /**
   * Async destroy with graceful exit + force kill fallback
   * Tries graceful exit first, force kills after timeout
   */
  async destroyAsync(id: string): Promise<boolean> {
    const term = this.terminals.get(id)
    if (!term) return false

    // Guard against duplicate calls
    if (term.destroying) return true
    term.destroying = true

    return new Promise((resolve) => {
      let resolved = false

      const cleanup = () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        this.terminals.delete(id)
      }

      // Attach exit listener BEFORE initiating kill to avoid race condition
      term.pty.onExit(() => {
        cleanup()
        resolve(true)
      })

      // Timeout handler - force kill if graceful fails
      const timeout = setTimeout(() => {
        if (resolved) return
        this.forceKill(term)
        cleanup()
        resolve(true)
      }, DESTROY_TIMEOUT_MS)

      // Initiate graceful kill after listener attached
      term.pty.kill()
    })
  }

  /**
   * Async destroy all terminals in parallel
   * Uses allSettled to ensure all destroy attempts complete even if some fail
   */
  async destroyAllAsync(): Promise<void> {
    const ids = Array.from(this.terminals.keys())
    await Promise.allSettled(ids.map(id => this.destroyAsync(id)))
  }

  /**
   * Check if any terminals exist
   */
  hasTerminals(): boolean {
    return this.terminals.size > 0
  }

  list(): Terminal[] {
    return Array.from(this.terminals.values()).map(t => t.metadata)
  }

  get(id: string): Terminal | undefined {
    return this.terminals.get(id)?.metadata
  }

  invokeClaudeCode(id: string, sessionId?: string): boolean {
    const term = this.terminals.get(id)
    if (!term) return false

    let command = 'claude'
    if (sessionId) {
      command += ` --resume ${sessionId}`
    }
    command += '\n'

    term.pty.write(command)
    this.setClaudeMode(term)
    return true
  }

  getSessions(): TerminalSession[] {
    return Array.from(this.terminals.values()).map(t => ({
      id: t.id,
      title: t.metadata.title,
      cwd: t.metadata.cwd,
      projectId: t.metadata.projectId,
      claudeSessionId: t.metadata.claudeSessionId,
      outputBuffer: t.outputBuffer,
      lastOutputAt: t.lastOutputAt
    }))
  }

  /** Returns cached session data for an exited terminal (for notification button fallback) */
  getExitedSession(id: string): TerminalSession | undefined {
    return this.exitedTerminals.get(id)
  }
}
