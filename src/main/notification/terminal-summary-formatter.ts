/**
 * Formats raw PTY terminal output into a structured summary for Telegram detail views.
 * Handles \r overwrite simulation (unlike cleanTerminalOutput which converts \r to \n).
 */

// Same ANSI pattern as terminal-output-cleaner.ts — strip all escape sequence families
const ANSI_PATTERN =
  /\x1b\[[0-9;?>=!]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[()][0-9A-Za-z]|\x1b[A-Za-z=><\\[\]^_]/g

// Non-printable control chars except \t (0x09) \n (0x0A) \r (0x0D)
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f]/g

// Matches approval/review prompts from Claude Code
const REVIEW_PATTERN =
  /\[Y\/n\]|\(y\/N\)|approve|allow\s+(?:this\s+)?tool|waiting\s+for\s+(?:your\s+)?(?:input|response|confirmation)/i

// Lines that are just terminal noise (bare prompts, separator lines)
const NOISE_LINE_PATTERN = /^[>$%\s\-─━═*]+$/

const MAX_ACTIVITY_LINES = 10
/** Limit raw buffer size to avoid processing megabytes of PTY history */
const RAW_BUFFER_LIMIT = 8000

export interface DetailSummary {
  /** Review question/prompt Claude is waiting for, if detected */
  question: string | null
  /** Recent meaningful activity lines, max 10 */
  activityLines: string[]
}

/**
 * Converts inline markdown to Telegram-friendly text (lightweight subset).
 * **bold** → *bold*, `code` → `code`, # heading → *heading*
 */
export function applyInlineMarkdown(text: string): string {
  return text
    .replace(/^#+\s+(.+)$/gm, '*$1*')          // # heading → *heading*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')          // **bold** → *bold*
    .replace(/`([^`]+)`/g, '`$1`')              // `code` → `code` (identity, kept for clarity)
}

/**
 * Cleans raw PTY output for summary display.
 *
 * Key difference from `cleanTerminalOutput`: bare `\r` is treated as a
 * terminal line overwrite (moves cursor to start of line) — the last
 * segment written to that line position survives. This avoids the
 * "thisfileexists:" garbling caused by cursor-positioned text segments.
 */
export function cleanOutputForDisplay(raw: string): string {
  return raw
    .replace(ANSI_PATTERN, '')           // strip escape sequences
    .replace(CONTROL_CHARS_PATTERN, '')  // strip non-printable chars
    .replace(/\r\n/g, '\n')              // CRLF → LF first (before bare \r handling)
    .replace(/\t/g, '    ')              // expand tabs
    .split('\n')
    .map(line => {
      if (!line.includes('\r')) return line
      // Bare \r simulates cursor-to-line-start; last segment wins
      const parts = line.split('\r')
      // Find last non-empty segment (handles trailing \r like "text\r")
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].length > 0) return parts[i]
      }
      return ''
    })
    .filter(l => l.trim().length > 0)
    .join('\n')
}

/**
 * Extracts a structured summary from raw terminal output.
 * Separates the current review prompt from recent activity lines.
 */
export function buildDetailSummary(rawOutput: string): DetailSummary {
  if (!rawOutput) return { question: null, activityLines: [] }

  const limited = rawOutput.slice(-RAW_BUFFER_LIMIT)
  const cleaned = cleanOutputForDisplay(limited)
  const lines = cleaned
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2 && !NOISE_LINE_PATTERN.test(l))

  let question: string | null = null
  const activityLines: string[] = []

  // Scan the most recent lines for question and activity
  for (const line of lines.slice(-(MAX_ACTIVITY_LINES + 5))) {
    if (REVIEW_PATTERN.test(line)) {
      question = line.slice(0, 200)
    } else {
      activityLines.push(line)
    }
  }

  return {
    question,
    activityLines: activityLines.slice(-MAX_ACTIVITY_LINES)
  }
}
