import { EventEmitter } from 'events'
import type { TaskEvent } from '@shared/types'
import { generateTaskEventId, MAX_REGEX_INPUT_LENGTH } from './parser-utils'

/**
 * Detects approval prompts from raw terminal output.
 * Only handles `reviewNeeded` — taskComplete and taskFailed are now
 * sourced from JSONL transcripts via ClaudeLogWatcher (clean, no ANSI codes).
 *
 * These prompts don't appear in JSONL because the session is still running
 * when Claude Code asks for user confirmation.
 */
const REVIEW_PATTERN = /\[Y\/n\]|\(y\/N\)|approve|allow\s+(?:this\s+)?tool|waiting\s+for\s+(?:your\s+)?(?:input|response|confirmation)/i

export class PlainTextParser extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  private readonly debounceMs = 5000

  parse(terminalId: string, data: string, projectName: string): void {
    const safeData = data.length > MAX_REGEX_INPUT_LENGTH
      ? data.slice(0, MAX_REGEX_INPUT_LENGTH)
      : data

    if (!REVIEW_PATTERN.test(safeData)) return

    const key = `${terminalId}:reviewNeeded`
    const now = Date.now()
    if (now - (this.debounceMap.get(key) ?? 0) <= this.debounceMs) return

    this.debounceMap.set(key, now)

    const event: TaskEvent = {
      id: generateTaskEventId(terminalId, 'reviewNeeded', 'approval'),
      terminalId,
      type: 'reviewNeeded',
      taskName: 'Waiting for approval',
      projectName,
      timestamp: now
    }
    this.emit('taskEvent', event)
  }

  clearTerminal(terminalId: string): void {
    for (const key of this.debounceMap.keys()) {
      if (key.startsWith(`${terminalId}:`)) this.debounceMap.delete(key)
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) this.debounceMap.delete(key)
    }
  }
}
