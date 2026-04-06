import type { TerminalManager } from '../terminal/terminal-manager'
import type { ProjectStore } from '../project/project-store'
import type { Project, Terminal, NotificationEventType } from '@shared/types'
import { cleanTerminalOutput } from './terminal-output-cleaner'
import { buildDetailSummary } from './terminal-summary-formatter'
import { formatDetailMessage } from './detail-message-formatter'

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
 * Responds via sendReply callback (TelegramNotifier.sendMarkdown — MarkdownV2 format).
 */
export class TelegramCommandRouter {
  private terminalManager: TerminalManager
  private projectStore: ProjectStore
  private sendReply: SendReply

  private pendingChat: { terminalId: string } | null = null

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

    // Chat mode: route non-command text to pending terminal
    if (this.pendingChat && !trimmed.startsWith('/')) {
      const { terminalId } = this.pendingChat
      this.pendingChat = null
      await this.sendChatInput(terminalId, trimmed)
      return
    }

    // /cancel clears pending chat mode
    if (trimmed === '/cancel') {
      this.pendingChat = null
      await this.sendReply('❌ Cancelled')
      return
    }

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

    const ok = this.terminalManager.write(parsed.terminal.id, parsed.text + '\r')
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
      const ok = this.terminalManager.write(terminal.id, `${arg}\r`)
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

  async handleCallback(callbackId: string, data: string): Promise<void> {
    const colonIdx = data.indexOf(':')
    if (colonIdx === -1) return

    const action = data.slice(0, colonIdx)
    const terminalId = data.slice(colonIdx + 1)

    if (action === 'tail') {
      // Support both legacy "tail:terminalId" and new "tail:eventType:terminalId"
      const rest = data.slice(colonIdx + 1)
      const secondColon = rest.indexOf(':')
      const knownTypes = new Set<string>(['reviewNeeded', 'taskComplete', 'taskFailed'])

      if (secondColon !== -1 && knownTypes.has(rest.slice(0, secondColon))) {
        const eventType = rest.slice(0, secondColon) as NotificationEventType
        const tId = rest.slice(secondColon + 1)
        await this.handleTailById(tId, eventType)
      } else {
        await this.handleTailById(rest)
      }
    } else if (action === 'chat' || action === 'reply') {
      // Use all terminals (not scoped) — callback has exact terminalId, no ambiguity
      const terminals = this.terminalManager.list()
      let terminal = terminals.find(t => t.id === terminalId)
      // Defense-in-depth: resolve Claude session ID if direct lookup fails
      if (!terminal) {
        terminal = terminals.find(t => t.claudeSessionId === terminalId)
      }
      if (!terminal) {
        const ghost = this.terminalManager.getExitedSession(terminalId)
        const title = ghost ? `_${this.esc(ghost.title)}_` : 'this'
        await this.sendReply(`⚠️ Terminal ${title} is closed\\. Cannot chat\\.`)
        return
      }
      const index = terminals.findIndex(t => t.id === terminal!.id) + 1
      this.pendingChat = { terminalId: terminal.id }
      await this.sendReply(
        `💬 *Terminal ${index}* \\(${this.esc(terminal.title)}\\) waiting for input\\.\nType a message \\(or /cancel\\):`
      )
    }
  }

  private async handleTailById(terminalId: string, eventType?: NotificationEventType): Promise<void> {
    // Use all terminals (not scoped) — called from callback with exact terminalId
    const terminals = this.terminalManager.list()
    let terminal = terminals.find(t => t.id === terminalId)

    // Defense-in-depth: if ID is a Claude session ID (from JSONL watcher), resolve via claudeSessionId
    if (!terminal) {
      terminal = terminals.find(t => t.claudeSessionId === terminalId)
    }

    // Fallback: terminal may have exited after notification was sent
    const resolvedId = terminal?.id ?? terminalId
    const ghost = terminal ? null : this.terminalManager.getExitedSession(resolvedId)
    if (!terminal && !ghost) {
      await this.sendReply('📄 Session ended — no cached output available\\.')
      return
    }

    const title = terminal?.title ?? ghost!.title
    const index = terminal ? terminals.findIndex(t => t.id === resolvedId) + 1 : null
    const label = index ? `*Terminal ${index}* — ${this.esc(title)}` : `*${this.esc(title)}* _\\(closed\\)_`

    const rawOutput = this.getRawTerminalOutput(resolvedId)
    if (!rawOutput) {
      await this.sendReply(`📄 ${label} — no output`)
      return
    }

    const summary = buildDetailSummary(rawOutput)
    const msg = formatDetailMessage(summary, label)
    await this.sendReply(msg)
  }

  private async sendChatInput(terminalId: string, text: string): Promise<void> {
    const terminals = this.terminalManager.list()
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal) {
      await this.sendReply('⚠️ Terminal not found\\. Chat session expired\\.')
      return
    }
    const index = terminals.findIndex(t => t.id === terminalId) + 1

    if (this.isTerminalBusy(terminalId)) {
      await this.sendReply(`⏳ Terminal ${index} is busy, try again later`)
      return
    }

    const ok = this.terminalManager.write(terminalId, text + '\r')
    if (!ok) {
      await this.sendReply(`Failed to write to terminal ${index}`)
      return
    }

    await this.sleep(SEND_OUTPUT_DELAY_MS)
    const output = this.getTerminalOutput(terminalId, SEND_OUTPUT_LINES)
    const reply = [`✅ Sent to terminal ${index} \\(${this.esc(terminal.title)}\\)`]
    if (output) {
      reply.push('', '```', output, '```')
    }
    await this.sendReply(reply.join('\n'))
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

    const lines = cleanTerminalOutput(session.outputBuffer).split('\n')
    const tail = lines.slice(-lineCount)
    return tail.length > 0 ? tail.join('\n') : null
  }

  /** Returns raw output buffer for smart summary (no pre-cleaning, formatter handles it) */
  private getRawTerminalOutput(terminalId: string): string | null {
    const sessions = this.terminalManager.getSessions()
    const session = sessions.find((s: { id: string; outputBuffer?: string }) => s.id === terminalId)
    if (session?.outputBuffer) return session.outputBuffer
    // Fallback: exited terminal ghost cache
    return this.terminalManager.getExitedSession(terminalId)?.outputBuffer ?? null
  }

  private esc(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
