import * as pty from '@lydell/node-pty'
import os from 'os'
import { spawnSync } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, readdirSync, realpathSync } from 'fs'
import path from 'path'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO, AGENT_DETECTION_PATTERNS } from '@shared/constants'
import type { Terminal, TerminalSession, WindowsShell, AgentType, ShellInfo, WslInfo, CreateTerminalOptions } from '@shared/types'
import { detectMacosShells } from './macos-shell-detector'
import { detectWsl } from './wsl-detector'

const DESTROY_TIMEOUT_MS = 3000
// Max exited terminals to keep for notification button lookups
const MAX_GHOST_TERMINALS = 50
const GHOST_TTL_MS = 30 * 60 * 1000 // 30 minutes

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
  // Shell list caching (C3: store Promise, not raw array — prevents startup race)
  private shellsPromise: Promise<ShellInfo[]> | null = null
  // WSL info cache (set from startup on Windows)
  wslInfo: WslInfo | null = null

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

  /**
   * Store the shell detection promise at startup (C3: deferred promise prevents race).
   * Must be called after wslInfo is populated on Windows.
   */
  initializeShells(): void {
    if (process.platform === 'win32') {
      // Detect WSL now so buildWindowsShellInfoList has distros available
      if (!this.wslInfo) {
        this.wslInfo = detectWsl()
      }
      this.shellsPromise = Promise.resolve(this.buildWindowsShellInfoList())
    } else {
      this.shellsPromise = detectMacosShells()
    }
  }

  /** Returns the cached shell list. Returns [] before initializeShells() is called. */
  async getAvailableShells(): Promise<ShellInfo[]> {
    const shells = await (this.shellsPromise ?? Promise.resolve([]))
    // Populate synchronous allowlist so isAllowedShell() works immediately after this call
    this.resolvedShellPaths = new Set(shells.map(s => s.path))
    return shells
  }

  /** Build ShellInfo[] from Windows shell options (cmd, powershell, WSL distros). */
  private buildWindowsShellInfoList(): ShellInfo[] {
    const list: ShellInfo[] = [
      {
        path: process.env.COMSPEC || 'cmd.exe',
        name: 'Command Prompt',
        isDefault: !this.settings?.windowsShell || this.settings.windowsShell.type === 'cmd',
        kind: 'cmd',
      },
      {
        path: this.resolvedWindowsPowerShellCommand ?? 'powershell.exe',
        name: 'PowerShell',
        isDefault: this.settings?.windowsShell?.type === 'powershell',
        kind: 'powershell',
      },
    ]

    const distros = this.wslInfo?.distros ?? []
    for (const d of distros) {
      list.push({
        path: `wsl://${d.name}`,
        name: d.name,
        isDefault: this.settings?.windowsShell?.type === 'wsl' &&
          (this.settings.windowsShell as { type: 'wsl'; distro: string }).distro === d.name,
        kind: 'wsl',
      })
    }

    return list
  }

  // Settings reference for Windows shell info (injected from startup)
  private settings: { windowsShell?: WindowsShell } | null = null

  /** Provide settings context so buildWindowsShellInfoList can mark the default. */
  setSettings(s: { windowsShell?: WindowsShell }): void {
    this.settings = s
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
   * Get shell command and args based on WindowsShell option or custom shellPath.
   * Non-Windows: if shellPath is provided and in the allowlist, use it; else use default shell.
   * Windows: shellPath is ignored — uses WindowsShell union.
   */
  private getShellCommand(shell?: WindowsShell, shellPath?: string): { command: string; args: string[] } {
    // Non-Windows: use shellPath if provided and allowlisted, else default
    if (process.platform !== 'win32') {
      const cmd = shellPath && this.isAllowedShell(shellPath) ? shellPath : this.shell
      return { command: cmd, args: this.getShellArgs(cmd) }
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
   * Map shell binary name to login args (H2: per-shell arg mapping).
   * fish uses --login, POSIX shells use -l, unknown shells get no args.
   */
  private getShellArgs(shellPath: string): string[] {
    const name = path.basename(shellPath).split('-')[0].toLowerCase()
    if (name === 'fish') return ['--login']
    if (['bash', 'zsh', 'sh', 'ksh', 'tcsh'].includes(name)) return ['-l']
    return []
  }

  /**
   * Check if shellPath is in the cached allowlist (M3: symlink-safe via realpathSync).
   * Falls back to raw path comparison if realpathSync fails (e.g. in test environments).
   * Always returns false if shells have not been initialized yet.
   */
  private isAllowedShell(shellPath: string): boolean {
    if (!this.resolvedShellPaths) return false
    try {
      const resolved = realpathSync(shellPath)
      return this.resolvedShellPaths.has(resolved)
    } catch {
      // realpathSync fails when path doesn't exist (e.g. non-existent mock paths in tests).
      // Fall back to direct string comparison against stored allowlist.
      return this.resolvedShellPaths.has(shellPath)
    }
  }

  // Synchronous allowlist populated when shellsPromise settles (used by isAllowedShell)
  private resolvedShellPaths: Set<string> | null = null

  private extractClaudeSessionId(command: string): string | undefined {
    const match = command.match(/(?:^|\s)--resume(?:=|\s+)(\S+)/)
    return match?.[1]
  }

  private getCreatedAtMs(createdAt: Date | string): number {
    const value = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
    return Number.isFinite(value) ? value : 0
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

  /**
   * Detect CLI agent from terminal input commands.
   * Watches keystrokes for Enter, then checks command against known agent binaries.
   * Sets agentType on terminal metadata and emits 'agentDetected' event.
   * For claude: also sets isClaudeMode for backward compatibility.
   */
  private processInputForAgentDetection(term: PTYProcess, data: string): void {
    // Skip if agent already detected for this terminal
    if (term.metadata.agentType) return

    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const command = term.inputBuffer.trim()
        term.inputBuffer = ''

        if (!command) continue

        // Extract binary name (first token)
        const binary = command.split(/\s+/)[0].toLowerCase()
        const agentType = AGENT_DETECTION_PATTERNS[binary] as AgentType | undefined

        if (agentType) {
          term.metadata.agentType = agentType

          // Backward compat: claude still sets isClaudeMode
          if (agentType === 'claude') {
            this.setClaudeMode(term)
            const sessionId = this.extractClaudeSessionId(command)
            if (sessionId) {
              term.metadata.claudeSessionId = sessionId
            }
          } else {
            // Non-claude agents also get title updates
            term.metadata.allowTitleUpdate = true
          }

          this.emit('agentDetected', { terminalId: term.id, agentType })
        }
        continue
      }

      if (char === '\u007f' || char === '\b') {
        term.inputBuffer = term.inputBuffer.slice(0, -1)
        continue
      }

      // Only keep printable command input. This avoids escape-sequence noise from
      // cursor/navigation keys while still catching direct agent launches.
      if (char >= ' ' || char === '\t') {
        term.inputBuffer += char
        if (term.inputBuffer.length > 1024) {
          term.inputBuffer = term.inputBuffer.slice(-1024)
        }
      }
    }
  }

  create(options: CreateTerminalOptions = {}): Terminal {
    const id = this.generateId()
    const cwd = options.cwd || os.homedir()

    // Determine shell command and args based on shell option and optional shellPath
    const { command, args } = this.getShellCommand(options.shell, options.shellPath)

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
        lastOutputAt: termProcess.lastOutputAt,
        exitedAt: Date.now()
      })
      // Evict expired ghosts first
      const now = Date.now()
      for (const [gid, session] of this.exitedTerminals) {
        if (session.exitedAt && (now - session.exitedAt) > GHOST_TTL_MS) {
          this.exitedTerminals.delete(gid)
        }
      }
      // Count-based eviction if still over limit
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
      this.processInputForAgentDetection(term, data)
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
      term.metadata.claudeSessionId = sessionId
    }
    command += '\n'

    term.pty.write(command)
    this.setClaudeMode(term)
    term.metadata.agentType = 'claude'
    this.emit('agentDetected', { terminalId: id, agentType: 'claude' as AgentType })
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

  /**
   * Attach a Claude session ID to the most likely live Claude terminal for a cwd.
   * This is used when JSONL transcript events arrive before the terminal knows its session ID.
   */
  attachClaudeSession(sessionId: string, cwd: string): { id: string } | undefined {
    const existing = this.findByClaudeSessionId(sessionId)
    if (existing) return existing

    const claudeTerminals = Array.from(this.terminals.values())
      .filter(term => term.metadata.agentType === 'claude' || term.metadata.isClaudeMode)

    // Prefer unbound terminals, then most recently active
    const sortByAffinity = (list: PTYProcess[]) =>
      list.sort((a, b) => {
        const aUnbound = a.metadata.claudeSessionId ? 0 : 1
        const bUnbound = b.metadata.claudeSessionId ? 0 : 1
        if (aUnbound !== bUnbound) return bUnbound - aUnbound
        if (a.lastOutputAt !== b.lastOutputAt) return b.lastOutputAt - a.lastOutputAt
        return this.getCreatedAtMs(b.metadata.createdAt) - this.getCreatedAtMs(a.metadata.createdAt)
      })

    // Tier 1: Exact CWD match
    const exactMatch = sortByAffinity(
      claudeTerminals.filter(t => t.metadata.cwd === cwd)
    )[0]

    // Tier 2: Same project basename (handles symlinks, resolved paths, sub-dirs)
    const cwdBasename = path.basename(cwd)
    const basenameMatch = !exactMatch
      ? sortByAffinity(
          claudeTerminals.filter(t => path.basename(t.metadata.cwd || '') === cwdBasename)
        )[0]
      : undefined

    // Tier 3: Most recently active Claude terminal (last resort)
    const fallback = !exactMatch && !basenameMatch
      ? sortByAffinity(claudeTerminals)[0]
      : undefined

    const candidate = exactMatch ?? basenameMatch ?? fallback
    if (!candidate) return undefined

    candidate.metadata.claudeSessionId = sessionId
    return { id: candidate.id }
  }

  /**
   * Find a live or exited terminal by its Claude session ID.
   * Used to translate JSONL watcher events (which use Claude session IDs)
   * back to real MultiClaude terminal IDs.
   */
  findByClaudeSessionId(sessionId: string): { id: string } | undefined {
    for (const t of this.terminals.values()) {
      if (t.metadata.claudeSessionId === sessionId) return { id: t.id }
    }
    for (const s of this.exitedTerminals.values()) {
      if (s.claudeSessionId === sessionId) return { id: s.id }
    }
    return undefined
  }
}
