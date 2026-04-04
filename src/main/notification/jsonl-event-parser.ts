import path from 'path'
import type { TaskEvent, NotificationEventType } from '@shared/types'
import { generateTaskEventId } from './parser-utils'

/** A single parsed line from a Claude Code JSONL transcript */
interface JsonlLine {
  type: string
  cwd?: string
  sessionId?: string
  message?: {
    stop_reason?: string
    content?: Array<{ type: string; text?: string }>
  }
}

/**
 * Parses incremental JSONL content from Claude Code transcript files.
 * Detects task completion when Claude finishes a turn and waits for user.
 *
 * Detection strategy:
 * - `assistant` event with `stop_reason: "end_turn"` + text content = Claude is idle
 * - `cwd` field in event = project directory for naming
 *
 * Subagents use `isSidechain: true` — we skip those to avoid notification spam.
 */
export class JsonlEventParser {
  /**
   * Parse one or more JSONL lines. Returns a TaskEvent if a completion
   * is detected, otherwise null.
   */
  parseLines(lines: string[], filePath: string): TaskEvent | null {
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      const event = this.tryParseEvent(filePath, line)
      if (event) return event
    }
    return null
  }

  private tryParseEvent(filePath: string, line: string): TaskEvent | null {
    let obj: JsonlLine
    try {
      obj = JSON.parse(line) as JsonlLine
    } catch {
      return null
    }

    // Skip subagent sidechains to avoid duplicate notifications
    if ((obj as unknown as Record<string, unknown>).isSidechain === true) return null

    if (obj.type === 'assistant') {
      return this.handleAssistantEvent(obj, filePath)
    }

    return null
  }

  private handleAssistantEvent(obj: JsonlLine, filePath: string): TaskEvent | null {
    if (obj.message?.stop_reason !== 'end_turn') return null

    // Extract text content from the assistant message
    const textBlock = obj.message.content?.find(c => c.type === 'text')
    if (!textBlock?.text) return null

    const taskName = this.extractSummary(textBlock.text)
    if (!taskName) return null

    const cwd = obj.cwd || path.dirname(filePath)
    const projectName = path.basename(cwd)
    const sessionId = obj.sessionId || path.basename(filePath, '.jsonl')

    return {
      id: generateTaskEventId(sessionId, 'taskComplete', taskName),
      terminalId: sessionId, // used for dedup & focus detection
      type: 'taskComplete' as NotificationEventType,
      taskName,
      projectName,
      cwd,
      timestamp: Date.now()
    }
  }

  /**
   * Extract a short, meaningful summary from Claude's response text.
   * Takes the first non-empty line and truncates to 100 chars.
   */
  private extractSummary(text: string): string {
    const firstLine = text
      .split('\n')
      .map(l => l.replace(/^#+\s*/, '').trim()) // strip markdown headers
      .find(l => l.length > 5) // skip very short lines
    return firstLine?.slice(0, 100) ?? ''
  }
}
