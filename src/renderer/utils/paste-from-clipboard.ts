import type { Terminal as XTerm } from '@xterm/xterm'
import { useAppStore, useImageStore, usePendingMediaStore } from '../stores'
import { writeToDisplay } from '../stores/display-writer-registry'
import { buildMediaToken } from './media-classifier'
import { formatPathForTerminal } from './terminal-path-utils'

/** Chunk size for text pastes. Beyond this, writes are split and yielded
 *  between so other IPC traffic (terminal output, resize, etc.) can interleave. */
const PASTE_CHUNK_SIZE = 64 * 1024

const BRACKETED_PASTE_START = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'

export async function pasteFromClipboard(
  terminalId: string,
  onBeforeWrite?: () => void,
  term?: XTerm
): Promise<void> {
  try {
    const items = await navigator.clipboard.read()
    const handled = await tryPasteImage(items, terminalId, onBeforeWrite)
    if (handled) return
    await tryPasteText(terminalId, term, onBeforeWrite)
  } catch {
    await tryPasteText(terminalId, term, onBeforeWrite)
  }
}

async function tryPasteImage(
  items: readonly ClipboardItem[],
  terminalId: string,
  onBeforeWrite?: () => void
): Promise<boolean> {
  for (const item of items) {
    const imageType = item.types.find((t) => t.startsWith('image/'))
    if (!imageType) continue
    try {
      const blob = await item.getType(imageType)
      const base64 = await blobToBase64(blob)
      const filePath = await window.electron.clipboard.saveImage(base64)
      if (!filePath) return true

      onBeforeWrite?.()
      const terminal = useAppStore.getState().terminals.find((t) => t.id === terminalId)
      const isClaudeMode = terminal?.isClaudeMode ?? false
      const entry = useImageStore.getState().addImage(terminalId, filePath, 'image')

      if (isClaudeMode) {
        window.electron.terminal.write(terminalId, formatPathForTerminal(filePath) + ' ')
      } else {
        const token = buildMediaToken('image', entry.index)
        usePendingMediaStore.getState().push(terminalId, {
          path: filePath,
          displayLength: token.length
        })
        writeToDisplay(terminalId, token + ' ')
      }
      return true
    } catch (err) {
      console.error('Failed to process clipboard image:', err)
      return true
    }
  }
  return false
}

async function tryPasteText(
  terminalId: string,
  term: XTerm | undefined,
  onBeforeWrite?: () => void
): Promise<void> {
  let text: string
  try {
    text = await navigator.clipboard.readText()
  } catch {
    // Clipboard permission denied
    return
  }
  if (!text) return

  // Windows clipboards deliver \r\n (and sometimes lone \r). Sent to a Unix
  // PTY, lone \r triggers carriage return and breaks interactive prompts.
  const normalized = text.replace(/\r\n?/g, '\n')

  onBeforeWrite?.()

  const bracketed = term?.modes?.bracketedPasteMode === true
  // Security: strip inner paste-bracket sentinels from the body so a
  // malicious clipboard cannot close our wrapper early and escape into
  // typed shell input (CVE-style paste-injection attack). Only applied in
  // bracketed mode — without wrapping there's no region to break out of
  // and stripping would corrupt legitimate literal escape sequences.
  const body = bracketed ? normalized.replace(/\x1b\[20[01]~/g, '') : normalized

  if (body.length <= PASTE_CHUNK_SIZE) {
    const payload = bracketed
      ? `${BRACKETED_PASTE_START}${body}${BRACKETED_PASTE_END}`
      : body
    window.electron.terminal.write(terminalId, payload)
    return
  }

  // Chunked path: sentinel bookends the WHOLE payload — never each chunk —
  // so the shell's paste parser sees exactly one paste region.
  if (bracketed) window.electron.terminal.write(terminalId, BRACKETED_PASTE_START)
  for (let i = 0; i < body.length; i += PASTE_CHUNK_SIZE) {
    window.electron.terminal.write(terminalId, body.slice(i, i + PASTE_CHUNK_SIZE))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  if (bracketed) window.electron.terminal.write(terminalId, BRACKETED_PASTE_END)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
