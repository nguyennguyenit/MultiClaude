import type { TerminalManager } from '../terminal/terminal-manager'
import type { ProjectStore } from '../project/project-store'
import type { Project, Terminal } from '@shared/types'

const DEFAULT_TAIL_LINES = 20
const ALLOWED_NEW_COMMANDS = ['claude', 'codex'] as const
const MAX_REMOTE_TERMINALS = 9
type AllowedNewCommand = typeof ALLOWED_NEW_COMMANDS[number]
const SEND_OUTPUT_DELAY_MS = 2000
const SEND_OUTPUT_LINES = 5
const BUSY_THRESHOLD_MS = 3000
const TELEGRAM_MSG_LIMIT = 4096

type SendReply = (text: string) => Promise<boolean>
type TerminalQueryResult = { terminal: Terminal | null; error?: string }

/**
 * Parses Telegram commands and dispatches to TerminalManager/ProjectStore.
 * Responds via sendReply callback (TelegramNotifier.send).
 */
export class TelegramCommandRouter {
  private terminalManager: TerminalManager
  private projectStore: ProjectStore
  private sendReply: SendReply

  constructor(
    terminalManager: TerminalManager,
    projectStore: ProjectStore,
    sendReply: SendReply
  ) {
    this.terminalManager = terminalManager
    this.projectStore = projectStore
    this.sendReply = sendReply
  }

  async handle(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed.startsWith('/')) {
      await this.sendReply(this.esc('Unknown command. Use /help for available commands'))
      return
    }

    const [command, ...args] = trimmed.split(/\s+/)

    switch (command) {
      case '/help':
        return this.handleHelp()
      case '/status':
        return this.handleStatus()
      case '/send':
        return this.handleSend(args)
      case '/kill':
        return this.handleKill(args)
      case '/tail':
        return this.handleTail(args)
      case '/project':
        return this.handleProject(args)
      case '/new':
        return this.handleNew(args)
      default:
        await this.sendReply(`Unknown command: ${this.esc(command)}\\. Use /help`)
    }
  }

  private async handleHelp(): Promise<void> {
    const lines = [
      '🤖 *MultiClaude Remote Control*',
      '',
      '`/status` — List terminals',
      '`/send <index|title> <text>` — Send input to terminal',
      '`/kill <index|title>` — Kill terminal',
      '`/tail <index|title> [n]` — View last N lines \\(default 20\\)',
      '`/project [name]` — Switch or list projects',
      '`/new [claude|codex]` — Open a new terminal',
      '`/help` — Show this message'
    ]
    await this.sendReply(lines.join('\n'))
  }

  private async handleStatus(): Promise<void> {
    const { terminals, activeProject } = this.getScopedTerminals()
    if (terminals.length === 0) {
      if (activeProject) {
        await this.sendReply(`📋 No terminals running in project ${this.esc(activeProject.name)}`)
        return
      }

      await this.sendReply('📋 No terminals running')
      return
    }

    const lines = [`📋 *Terminals* \\(${terminals.length}\\)`]
    if (activeProject) {
      lines.push(`📁 *Project:* ${this.esc(activeProject.name)}`)
    }
    lines.push('')

    terminals.forEach((term, i) => {
      const index = i + 1
      const mode = term.isClaudeMode ? '🟢' : '⚪'
      const projectName = !activeProject && term.projectId
        ? this.projectStore.getProject(term.projectId)?.name
        : null
      const projectSuffix = projectName ? ` \\(${this.esc(projectName)}\\)` : ''
      lines.push(`${index}️⃣ ${mode} ${this.esc(term.title)}${projectSuffix}`)
    })

    await this.sendReply(lines.join('\n'))
  }

  private async handleSend(args: string[]): Promise<void> {
    if (args.length < 2) {
      await this.sendReply('Usage: `/send <index|title> <text>`')
      return
    }

    const { terminals } = this.getScopedTerminals()
    const parsed = this.parseSendTarget(args, terminals)

    if (parsed.error) {
      await this.sendReply(parsed.error)
      return
    }

    if (!parsed.terminal) {
      await this.sendReply(`Terminal ${this.esc(parsed.query)} not found\\. Use /status`)
      return
    }

    const index = terminals.findIndex(term => term.id === parsed.terminal?.id) + 1

    // Check if terminal is busy (received output within last 3 seconds)
    if (this.isTerminalBusy(parsed.terminal.id)) {
      await this.sendReply(`⏳ Terminal ${index} is busy, try again later`)
      return
    }

    const ok = this.terminalManager.write(parsed.terminal.id, parsed.text + '\n')
    if (!ok) {
      await this.sendReply(`Failed to write to terminal ${index}`)
      return
    }

    // Wait briefly then show recent output
    await this.sleep(SEND_OUTPUT_DELAY_MS)
    const output = this.getTerminalOutput(parsed.terminal.id, SEND_OUTPUT_LINES)
    const reply = [`✅ Sent to terminal ${index} \\(${this.esc(parsed.terminal.title)}\\)`]
    if (output) {
      reply.push('', '```', output, '```')
    }

    await this.sendReply(reply.join('\n'))
  }

  private async handleKill(args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.sendReply('Usage: `/kill <index|title>`')
      return
    }

    const { terminals } = this.getScopedTerminals()
    const query = args.join(' ')
    const resolved = this.resolveTerminal(query, terminals)

    if (resolved.error) {
      await this.sendReply(resolved.error)
      return
    }

    if (!resolved.terminal) {
      await this.sendReply(`Terminal ${this.esc(query)} not found\\. Use /status`)
      return
    }

    const index = terminals.findIndex(term => term.id === resolved.terminal?.id) + 1
    const ok = this.terminalManager.destroy(resolved.terminal.id)
    if (!ok) {
      await this.sendReply(`Failed to kill terminal ${index}`)
      return
    }

    await this.sendReply(`🗑️ Terminal ${index} \\(${this.esc(resolved.terminal.title)}\\) killed`)
  }

  private async handleTail(args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.sendReply('Usage: `/tail <index|title> [lines]`')
      return
    }

    const { terminals } = this.getScopedTerminals()
    const parsed = this.parseTailTarget(args, terminals)

    if (parsed.error) {
      await this.sendReply(parsed.error)
      return
    }

    if (!parsed.terminal) {
      await this.sendReply(`Terminal ${this.esc(parsed.query)} not found\\. Use /status`)
      return
    }

    const index = terminals.findIndex(term => term.id === parsed.terminal?.id) + 1
    const output = this.getTerminalOutput(parsed.terminal.id, parsed.lineCount)
    if (!output) {
      await this.sendReply(`📄 Terminal ${index} — no output`)
      return
    }

    const msg = `📄 Terminal ${index} — last ${parsed.lineCount} lines:\n\n\`\`\`\n${output}\n\`\`\``
    if (msg.length > TELEGRAM_MSG_LIMIT) {
      // Truncate output to fit Telegram limit, keeping header
      const header = `📄 Terminal ${index} — last ${parsed.lineCount} lines:\n\n\`\`\`\n`
      const footer = '\n```'
      const maxOutput = TELEGRAM_MSG_LIMIT - header.length - footer.length - 20
      await this.sendReply(header + output.slice(-maxOutput) + '\n\\.\\.\\.' + footer)
    } else {
      await this.sendReply(msg)
    }
  }

  private async handleProject(args: string[]): Promise<void> {
    const projects = this.projectStore.getProjects()
    const activeId = this.projectStore.getActiveProjectId()

    if (args.length === 0) {
      if (projects.length === 0) {
        await this.sendReply('📁 No projects configured')
        return
      }

      const lines = ['📁 *Projects*', '']
      projects.forEach(p => {
        const marker = p.id === activeId ? '▶️' : '⚪'
        lines.push(`${marker} ${this.esc(p.name)}`)
      })
      await this.sendReply(lines.join('\n'))
      return
    }

    const name = args.join(' ').toLowerCase()
    const project = projects.find(p => p.name.toLowerCase() === name)

    if (!project) {
      await this.sendReply(`Project "${this.esc(args.join(' '))}" not found\\. Use /project to list`)
      return
    }

    this.projectStore.setActiveProjectId(project.id)
    await this.sendReply(`✅ Switched to project: ${this.esc(project.name)}`)
  }

  private async handleNew(args: string[]): Promise<void> {
    const arg = args[0]?.toLowerCase()

    // Validate arg — only whitelist or empty allowed
    if (arg !== undefined && !ALLOWED_NEW_COMMANDS.includes(arg as AllowedNewCommand)) {
      await this.sendReply('Usage: `/new [claude|codex]`')
      return
    }

    // Require active project for cwd scoping
    const activeProjectId = this.projectStore.getActiveProjectId()
    if (!activeProjectId) {
      await this.sendReply('No active project\\. Use /project \\<name\\> first')
      return
    }

    const project = this.projectStore.getProject(activeProjectId)
    if (!project) {
      await this.sendReply('Active project not found\\. Use /project \\<name\\> first')
      return
    }

    const { terminals } = this.getScopedTerminals()
    if (terminals.length >= MAX_REMOTE_TERMINALS) {
      await this.sendReply(`Terminal limit \\(${MAX_REMOTE_TERMINALS}\\) reached\\. Use /kill to free one first`)
      return
    }

    // Create the terminal in the project directory
    const terminal = this.terminalManager.create({ cwd: project.path, projectId: activeProjectId })

    // Optionally launch a whitelisted command
    if (arg) {
      const ok = this.terminalManager.write(terminal.id, `${arg}\n`)
      if (!ok) {
        await this.sendReply(`Terminal created but failed to launch ${this.esc(arg)}`)
        return
      }
    }

    // Build confirmation reply
    const lines = [
      `✅ ${this.esc(terminal.title)} created in \`${this.esc(project.name)}\``
    ]
    if (arg) {
      lines.push(`🟢 Running: ${this.esc(arg)}`)
    }

    await this.sendReply(lines.join('\n'))
  }

  /** Check if terminal received output within last BUSY_THRESHOLD_MS */
  private isTerminalBusy(terminalId: string): boolean {
    const sessions = this.terminalManager.getSessions()
    const session = sessions.find((s: { id: string; lastOutputAt?: number }) => s.id === terminalId)
    if (!session?.lastOutputAt) return false
    return (Date.now() - session.lastOutputAt) < BUSY_THRESHOLD_MS
  }

  private getScopedTerminals(): { terminals: Terminal[]; activeProject: Project | null } {
    const terminals = this.terminalManager.list()
    const activeProjectId = this.projectStore.getActiveProjectId()

    if (!activeProjectId) {
      return { terminals, activeProject: null }
    }

    const activeProject = this.projectStore.getProject(activeProjectId)
    if (!activeProject) {
      return { terminals, activeProject: null }
    }

    return {
      terminals: terminals.filter(term => term.projectId === activeProjectId),
      activeProject
    }
  }

  private resolveTerminal(query: string, terminals: Terminal[]): TerminalQueryResult {
    const trimmed = query.trim()
    if (!trimmed) return { terminal: null }

    if (/^\d+$/.test(trimmed)) {
      const index = parseInt(trimmed, 10)
      if (index < 1 || index > terminals.length) {
        return { terminal: null }
      }

      return { terminal: terminals[index - 1] }
    }

    const normalized = trimmed.toLowerCase()
    const matches = terminals.filter(term => (
      term.id.toLowerCase() === normalized || term.title.toLowerCase() === normalized
    ))

    if (matches.length > 1) {
      return {
        terminal: null,
        error: `Multiple terminals match ${this.esc(trimmed)}\\. Use /status and target by index\\.`
      }
    }

    return { terminal: matches[0] ?? null }
  }

  private parseSendTarget(
    args: string[],
    terminals: Terminal[]
  ): { terminal: Terminal | null; text: string; query: string; error?: string } {
    if (/^\d+$/.test(args[0])) {
      const query = args[0]
      const resolved = this.resolveTerminal(query, terminals)
      return {
        terminal: resolved.terminal,
        text: args.slice(1).join(' ').trim(),
        query,
        error: resolved.error
      }
    }

    const fullQuery = args.join(' ')
    const fullMatch = this.resolveTerminal(fullQuery, terminals)

    for (let prefixLength = args.length - 1; prefixLength >= 1; prefixLength -= 1) {
      const query = args.slice(0, prefixLength).join(' ')
      const resolved = this.resolveTerminal(query, terminals)

      if (resolved.error) {
        return { terminal: null, text: '', query, error: resolved.error }
      }

      if (resolved.terminal) {
        return {
          terminal: resolved.terminal,
          text: args.slice(prefixLength).join(' ').trim(),
          query
        }
      }
    }

    if (fullMatch.error) {
      return { terminal: null, text: '', query: fullQuery, error: fullMatch.error }
    }

    if (fullMatch.terminal) {
      return {
        terminal: null,
        text: '',
        query: fullQuery,
        error: 'Usage: `/send <index|title> <text>`'
      }
    }

    return { terminal: null, text: '', query: fullQuery }
  }

  private parseTailTarget(
    args: string[],
    terminals: Terminal[]
  ): { terminal: Terminal | null; lineCount: number; query: string; error?: string } {
    if (/^\d+$/.test(args[0])) {
      const query = args[0]
      const resolved = this.resolveTerminal(query, terminals)
      const lineCount = args[1] && /^\d+$/.test(args[1])
        ? Math.max(1, parseInt(args[1], 10))
        : DEFAULT_TAIL_LINES

      return {
        terminal: resolved.terminal,
        lineCount,
        query,
        error: resolved.error
      }
    }

    const fullQuery = args.join(' ')
    const fullMatch = this.resolveTerminal(fullQuery, terminals)
    if (fullMatch.error) {
      return { terminal: null, lineCount: DEFAULT_TAIL_LINES, query: fullQuery, error: fullMatch.error }
    }

    if (fullMatch.terminal) {
      return {
        terminal: fullMatch.terminal,
        lineCount: DEFAULT_TAIL_LINES,
        query: fullQuery
      }
    }

    if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) {
      const query = args.slice(0, -1).join(' ')
      const resolved = this.resolveTerminal(query, terminals)
      return {
        terminal: resolved.terminal,
        lineCount: Math.max(1, parseInt(args[args.length - 1], 10)),
        query,
        error: resolved.error
      }
    }

    return { terminal: null, lineCount: DEFAULT_TAIL_LINES, query: fullQuery }
  }

  private getTerminalOutput(terminalId: string, lineCount: number): string | null {
    const sessions = this.terminalManager.getSessions()
    const session = sessions.find((s: { id: string; outputBuffer?: string }) => s.id === terminalId)
    if (!session?.outputBuffer) return null

    const clean = session.outputBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07/g, '')
    const lines = clean.split('\n').filter((l: string) => l.trim())
    const tail = lines.slice(-lineCount)
    return tail.length > 0 ? tail.join('\n') : null
  }

  private esc(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
