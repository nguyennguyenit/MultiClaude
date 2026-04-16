import { useAppStore, useImageStore, usePendingMediaStore } from '../stores'
import { writeToDisplay } from '../stores/display-writer-registry'
import { buildMediaToken } from './media-classifier'
import { formatPathForTerminal } from './terminal-path-utils'

export async function pasteFromClipboard(
  terminalId: string,
  onBeforeWrite?: () => void
): Promise<void> {
  try {
    const items = await navigator.clipboard.read()
    const handled = await tryPasteImage(items, terminalId, onBeforeWrite)
    if (handled) return
    await tryPasteText(terminalId, onBeforeWrite)
  } catch {
    await tryPasteText(terminalId, onBeforeWrite)
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

async function tryPasteText(terminalId: string, onBeforeWrite?: () => void): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      onBeforeWrite?.()
      window.electron.terminal.write(terminalId, text)
    }
  } catch {
    // Clipboard permission denied
  }
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
