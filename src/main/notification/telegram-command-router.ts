import type { TerminalManager } from '../terminal/terminal-manager'
import type { ProjectStore } from '../project/project-store'

const DEFAULT_TAIL_LINES = 20
const SEND_OUTPUT_DELAY_MS = 2000
const SEND_OUTPUT_LINES = 5

type SendReply = (text: string) => Promise<boolean>

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
      default:
        await this.sendReply(`Unknown command: ${this.esc(command)}\\. Use /help`)
    }
  }

  private async handleHelp(): Promise<void> {
    const lines = [
      '🤖 *MultiClaude Remote Control*',
      '',
      '`/status` — List terminals',
      '`/send <id> <text>` — Send input to terminal',
      '`/kill <id>` — Kill terminal',
      '`/tail <id> [n]` — View last N lines \\(default 20\\)',
      '`/project [name]` — Switch or list projects',
      '`/help` — Show this message'
    ]
    await this.sendReply(lines.join('\n'))
  }

  private async handleStatus(): Promise<void> {
    const terminals = this.terminalManager.list()
    if (terminals.length === 0) {
      await this.sendReply('📋 No terminals running')
      return
    }

    const lines = [`📋 *Terminals* \\(${terminals.length}\\)`, '']
    terminals.forEach((term, i) => {
      const index = i + 1
      const mode = term.isClaudeMode ? '🟢' : '⚪'
      lines.push(`${index}️⃣ ${mode} ${this.esc(term.title)}`)
    })

    await this.sendReply(lines.join('\n'))
  }

  private async handleSend(args: string[]): Promise<void> {
    if (args.length < 2) {
      await this.sendReply('Usage: `/send <id> <text>`')
      return
    }

    const index = parseInt(args[0], 10)
    const text = args.slice(1).join(' ')
    const terminal = this.resolveTerminal(index)

    if (!terminal) {
      await this.sendReply(`Terminal ${args[0]} not found\\. Use /status`)
      return
    }

    const ok = this.terminalManager.write(terminal.id, text + '\n')
    if (!ok) {
      await this.sendReply(`Failed to write to terminal ${index}`)
      return
    }

    // Wait briefly then show recent output
    await this.sleep(SEND_OUTPUT_DELAY_MS)
    const output = this.getTerminalOutput(terminal.id, SEND_OUTPUT_LINES)
    const reply = [`✅ Sent to terminal ${index} \\(${this.esc(terminal.title)}\\)`]
    if (output) {
      reply.push('', '```', output, '```')
    }

    await this.sendReply(reply.join('\n'))
  }

  private async handleKill(args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.sendReply('Usage: `/kill <id>`')
      return
    }

    const index = parseInt(args[0], 10)
    const terminal = this.resolveTerminal(index)

    if (!terminal) {
      await this.sendReply(`Terminal ${args[0]} not found\\. Use /status`)
      return
    }

    const ok = this.terminalManager.destroy(terminal.id)
    if (!ok) {
      await this.sendReply(`Failed to kill terminal ${index}`)
      return
    }

    await this.sendReply(`🗑️ Terminal ${index} \\(${this.esc(terminal.title)}\\) killed`)
  }

  private async handleTail(args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.sendReply('Usage: `/tail <id> [lines]`')
      return
    }

    const index = parseInt(args[0], 10)
    const lineCount = args[1] ? parseInt(args[1], 10) : DEFAULT_TAIL_LINES
    const terminal = this.resolveTerminal(index)

    if (!terminal) {
      await this.sendReply(`Terminal ${args[0]} not found\\. Use /status`)
      return
    }

    const output = this.getTerminalOutput(terminal.id, lineCount)
    if (!output) {
      await this.sendReply(`📄 Terminal ${index} — no output`)
      return
    }

    await this.sendReply(`📄 Terminal ${index} — last ${lineCount} lines:\n\n\`\`\`\n${output}\n\`\`\``)
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

  private resolveTerminal(index: number) {
    const terminals = this.terminalManager.list()
    if (isNaN(index) || index < 1 || index > terminals.length) return null
    return { ...terminals[index - 1], id: terminals[index - 1].id }
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
