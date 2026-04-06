/**
 * Formats DetailSummary into a Telegram MarkdownV2 message.
 * Escaping logic ported from ccpoke's escape-markdown.ts.
 */
import type { DetailSummary } from './terminal-summary-formatter'

const TELEGRAM_MSG_LIMIT = 4096

// MarkdownV2 special chars that need escaping outside formatting entities
const MD_SPECIAL = /[_*[\]()~`>#+\-=|{}.!\\]/g

/**
 * Escapes all MarkdownV2 special characters for use outside code spans/blocks.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MD_SPECIAL, m => `\\${m}`)
}

/**
 * Inside backtick code spans, only ` and \ need escaping.
 */
function escapeInsideCode(text: string): string {
  return text.replace(/[\\`]/g, m => `\\${m}`)
}

/**
 * Smart truncation preserving code fence balance (inspired by ccpoke's truncateMarkdown).
 */
function truncateMarkdownV2(text: string, maxLen: number): string {
  const slice = text.slice(0, maxLen - 20)
  // Check for unbalanced code fences
  const fenceCount = (slice.match(/```/g) || []).length
  if (fenceCount % 2 !== 0) {
    const lastNewline = slice.lastIndexOf('\n')
    const cutAt = lastNewline > 0 ? lastNewline : maxLen - 20
    return slice.slice(0, cutAt) + '\n```\n\\.\\.\\.'
  }
  // Cut at paragraph boundary
  const lastPara = slice.lastIndexOf('\n\n')
  if (lastPara > maxLen * 0.6) return slice.slice(0, lastPara) + '\n\n\\.\\.\\.'
  // Cut at line boundary
  const lastLine = slice.lastIndexOf('\n')
  if (lastLine > maxLen * 0.6) return slice.slice(0, lastLine) + '\n\\.\\.\\.'
  return slice + '\\.\\.\\.'
}

/**
 * Formats a DetailSummary into a structured Telegram MarkdownV2 message.
 *
 * @param summary - Enriched detail summary from terminal output
 * @param label - Pre-formatted MarkdownV2 label (e.g. "*Terminal 5* — SEOKitGUI")
 */
export function formatDetailMessage(summary: DetailSummary, label: string): string {
  const sections: string[] = [`📄 ${label}`]

  // Question section
  if (summary.question) {
    sections.push('')
    sections.push('❓ *Awaiting:*')
    sections.push(`\`${escapeInsideCode(summary.question.slice(0, 200))}\``)
  }

  // Tools section
  if (summary.currentTools.length > 0) {
    sections.push('')
    sections.push('🔧 *Tools:*')
    for (const tool of summary.currentTools) {
      const target = tool.target ? ` → ${escapeMarkdownV2(tool.target)}` : ''
      sections.push(`• \`${escapeInsideCode(tool.name)}\`${target}`)
    }
  }

  // Activity section
  if (summary.activityLines.length > 0) {
    sections.push('')
    sections.push('📋 *Recent:*')
    for (const line of summary.activityLines) {
      sections.push(escapeMarkdownV2(line))
    }
  }

  // Progress hint
  if (summary.progressHint) {
    sections.push('')
    sections.push(`📊 ${escapeMarkdownV2(summary.progressHint)}`)
  }

  // Empty state
  if (!summary.question && summary.activityLines.length === 0 && summary.currentTools.length === 0) {
    sections.push('')
    sections.push('_\\(no meaningful output\\)_')
  }

  const msg = sections.join('\n')
  return msg.length > TELEGRAM_MSG_LIMIT ? truncateMarkdownV2(msg, TELEGRAM_MSG_LIMIT) : msg
}
