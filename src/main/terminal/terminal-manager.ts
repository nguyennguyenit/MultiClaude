import * as pty from '@lydell/node-pty'
import os from 'os'
import { EventEmitter } from 'events'
import type { Terminal, TerminalSession, WindowsShell } from '@shared/types'

interface PTYProcess {
  id: string
  pty: pty.IPty
  metadata: Terminal
  outputBuffer: string
  oscBuffer: string // Buffer for incomplete OSC sequences
}

export class TerminalManager extends EventEmitter {
  private terminals: Map<string, PTYProcess> = new Map()
  private shell: string

  constructor() {
    super()
    this.shell = this.getDefaultShell()
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  /**
   * Get shell command and args based on WindowsShell option
   * Non-Windows: uses default shell
   * Windows: supports cmd, powershell, or wsl distro
   */
  private getShellCommand(shell?: WindowsShell): { command: string; args: string[] } {
    // Non-Windows: use default shell
    if (process.platform !== 'win32') {
      return {
        command: process.env.SHELL || '/bin/bash',
        args: []
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
        command: 'powershell.exe',
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

  create(options: { cwd?: string; projectId?: string; shell?: WindowsShell } = {}): Terminal {
    const id = this.generateId()
    const cwd = options.cwd || os.homedir()

    // Determine shell command and args based on shell option
    const { command, args } = this.getShellCommand(options.shell)

    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
      cols: 80,
      rows: 24
    })

    const terminal: Terminal = {
      id,
      title: `Terminal ${this.terminals.size + 1}`,
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
      oscBuffer: ''
    }

    // Handle terminal output
    ptyProcess.onData((data) => {
      termProcess.outputBuffer += data
      // Keep buffer at max 100KB
      if (termProcess.outputBuffer.length > 100000) {
        termProcess.outputBuffer = termProcess.outputBuffer.slice(-50000)
      }
      this.emit('output', { terminalId: id, data })

      // Parse OSC sequences for title changes
      this.parseOscTitle(termProcess, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.emit('exit', { terminalId: id, exitCode })
      this.terminals.delete(id)
    })

    this.terminals.set(id, termProcess)
    return terminal
  }

  write(id: string, data: string): boolean {
    const term = this.terminals.get(id)
    if (!term) return false
    term.pty.write(data)
    return true
  }

  resize(id: string, cols: number, rows: number): boolean {
    const term = this.terminals.get(id)
    if (!term) return false
    term.pty.resize(cols, rows)
    return true
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
    term.metadata.isClaudeMode = true
    // Enable title updates once Claude is running (activity started)
    term.metadata.allowTitleUpdate = true
    return true
  }

  getSessions(): TerminalSession[] {
    return Array.from(this.terminals.values()).map(t => ({
      id: t.id,
      title: t.metadata.title,
      cwd: t.metadata.cwd,
      projectId: t.metadata.projectId,
      claudeSessionId: t.metadata.claudeSessionId,
      outputBuffer: t.outputBuffer.slice(-10000) // Last 10KB
    }))
  }
}
