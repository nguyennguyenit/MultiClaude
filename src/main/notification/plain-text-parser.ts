import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import type { TaskEvent, NotificationEventType, AgentType } from '@shared/types'
import { ENHANCED_DETECTION_PATTERNS, REVIEW_PROMPT_PATTERN } from '@shared/constants'
import { generateTaskEventId, MAX_REGEX_INPUT_LENGTH } from './parser-utils'
import { cleanTerminalOutput } from './terminal-output-cleaner'

/**
 * Detects approval prompts from raw terminal output.
 * Only handles `reviewNeeded` — taskComplete and taskFailed are now
 * sourced from JSONL transcripts via ClaudeLogWatcher (clean, no ANSI codes).
 *
 * These prompts don't appear in JSONL because the session is still running
 * when Claude Code asks for user confirmation.
 *
 * Maintains a rolling buffer of recent lines per terminal to extract
 * meaningful context (tool name, question) from surrounding output.
 *
 * False-trigger defense (redraw/resize):
 *  - Tight REVIEW_PATTERN rejects loose keywords (`approve`, `waiting for input`)
 *    that match unrelated shell output during SIGWINCH redraws.
 *  - Per-terminal content-hash map dedupes repeated emissions of the SAME
 *    prompt within HASH_TTL_MS (60s). Hash input prefers the tool-approval
 *    line so a redraw that re-orders `[Y/n]` vs the approval body still hashes
 *    identically. See hash-contract comment in output-parser.spec.ts.
 */
const REVIEW_PATTERN = REVIEW_PROMPT_PATTERN

/** Matches "Allow `tool` to run" or "Allow tool to run" patterns */
const TOOL_APPROVAL_PATTERN = /[Aa]llow\s+[`']?(\w[\w-]*)[`']?\s+to\s+(?:run|execute)/

/** Lines to keep per terminal for context extraction */
const BUFFER_SIZE = 5

/** How long a content hash suppresses duplicate emissions per terminal */
const HASH_TTL_MS = 60_000

export class PlainTextParser extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  private readonly debounceMs = 5000
  /** Rolling buffer of recent clean lines per terminal */
  private lineBuffers: Map<string, string[]> = new Map()
  /** Per-terminal dedupe memory: last emitted reviewNeeded content hash + timestamp */
  private lastEventHash: Map<string, { hash: string; time: number }> = new Map()

  parse(terminalId: string, data: string, projectName: string, agentType?: AgentType): void {
    const safeData = data.length > MAX_REGEX_INPUT_LENGTH
      ? data.slice(0, MAX_REGEX_INPUT_LENGTH)
      : data
    const cleanData = cleanTerminalOutput(safeData)

    // Update rolling buffer with clean lines from this chunk
    this.updateBuffer(terminalId, cleanData)

    if (this.shouldDetectTaskState(agentType)) {
      const event = this.detectTaskState(terminalId, cleanData, projectName)
      if (event) {
        this.emit('taskEvent', event)
        return
      }
    }

    if (!REVIEW_PATTERN.test(cleanData)) return

    const taskName = this.extractContext(terminalId)
    const promptLine = this.firstMatchingLine(cleanData)
    const hash = createHash('sha1')
      .update(`${taskName}|${promptLine}`)
      .digest('hex')
      .slice(0, 16)

    const now = Date.now()
    const prev = this.lastEventHash.get(terminalId)
    if (prev && prev.hash === hash && (now - prev.time) < HASH_TTL_MS) return

    this.lastEventHash.set(terminalId, { hash, time: now })

    const event: TaskEvent = {
      id: generateTaskEventId(terminalId, 'reviewNeeded', 'approval'),
      terminalId,
      type: 'reviewNeeded',
      taskName,
      projectName,
      timestamp: now
    }
    this.emit('taskEvent', event)
  }

  private shouldDetectTaskState(agentType?: AgentType): boolean {
    return agentType !== undefined && agentType !== 'claude' && agentType !== 'generic'
  }

  private detectTaskState(terminalId: string, cleanData: string, projectName: string): TaskEvent | null {
    const taskCompleteMatch = cleanData.match(ENHANCED_DETECTION_PATTERNS.taskComplete)
    if (taskCompleteMatch) {
      return this.buildTaskEvent(
        terminalId,
        'taskComplete',
        taskCompleteMatch.groups?.taskName || taskCompleteMatch[0].slice(0, 100),
        projectName
      )
    }

    const taskFailedMatch = cleanData.match(ENHANCED_DETECTION_PATTERNS.taskFailed)
    if (taskFailedMatch) {
      const taskName = taskFailedMatch.groups?.taskName || (taskFailedMatch.groups?.exitCode
        ? `Exit code ${taskFailedMatch.groups.exitCode}`
        : taskFailedMatch[0].slice(0, 100))

      return this.buildTaskEvent(terminalId, 'taskFailed', taskName, projectName)
    }

    return null
  }

  private buildTaskEvent(
    terminalId: string,
    type: NotificationEventType,
    taskName: string,
    projectName: string
  ): TaskEvent | null {
    const key = `${terminalId}:${type}`
    const now = Date.now()
    if (now - (this.debounceMap.get(key) ?? 0) <= this.debounceMs) return null

    this.debounceMap.set(key, now)

    return {
      id: generateTaskEventId(terminalId, type, taskName),
      terminalId,
      type,
      taskName,
      projectName,
      timestamp: now
    }
  }

  /** Add clean lines from raw data to the terminal's rolling buffer */
  private updateBuffer(terminalId: string, clean: string): void {
    const newLines = clean.split('\n').filter(l => l.trim().length > 3)
    if (newLines.length === 0) return

    const buffer = this.lineBuffers.get(terminalId) || []
    buffer.push(...newLines)
    if (buffer.length > BUFFER_SIZE) buffer.splice(0, buffer.length - BUFFER_SIZE)
    this.lineBuffers.set(terminalId, buffer)
  }

  /**
   * Extract a meaningful task name from recent terminal lines.
   * Priority: tool name from "Allow X to run" > last non-trivial line > fallback.
   */
  private extractContext(terminalId: string): string {
    const buffer = this.lineBuffers.get(terminalId) || []

    // Scan buffer in reverse for tool approval pattern
    for (let i = buffer.length - 1; i >= 0; i--) {
      const toolMatch = buffer[i].match(TOOL_APPROVAL_PATTERN)
      if (toolMatch) return `${toolMatch[1]} requires approval`
    }

    // Fallback: last line that isn't the review prompt itself
    for (let i = buffer.length - 1; i >= 0; i--) {
      const line = buffer[i].trim()
      if (line.length > 5 && !REVIEW_PATTERN.test(line)) return line.slice(0, 100)
    }

    return 'Waiting for approval'
  }

  /**
   * Pick a stable line from cleaned data to feed the dedup hash.
   * Priority: tool-approval line (e.g. `Allow \`bash\` to run ...`) when present,
   * else first REVIEW_PATTERN line. The tool-approval preference keeps the hash
   * stable even when a redraw chunk writes `[Y/n]` and the body text in reverse
   * order (ANSI stripping preserves write-order, not render-order).
   */
  private firstMatchingLine(cleanData: string): string {
    let firstPatternLine = ''
    for (const rawLine of cleanData.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      if (TOOL_APPROVAL_PATTERN.test(line)) return line.slice(0, 200)
      if (!firstPatternLine && REVIEW_PATTERN.test(line)) firstPatternLine = line.slice(0, 200)
    }
    return firstPatternLine
  }

  clearTerminal(terminalId: string): void {
    this.lineBuffers.delete(terminalId)
    this.lastEventHash.delete(terminalId)
    for (const key of this.debounceMap.keys()) {
      if (key.startsWith(`${terminalId}:`)) this.debounceMap.delete(key)
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) this.debounceMap.delete(key)
    }
    for (const [tid, rec] of this.lastEventHash) {
      if (now - rec.time > HASH_TTL_MS * 2) this.lastEventHash.delete(tid)
    }
  }
}
