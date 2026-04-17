import { useImageStore, type ImageEntry } from '../stores/image-store'
import { usePendingMediaStore } from '../stores/pending-media-store'
import { writeToDisplay } from '../stores/display-writer-registry'

export interface AttachmentRemoveArgs {
  terminalId: string
  filePath: string
  entry: ImageEntry
  isClaudeMode: boolean
}

/**
 * Mode-aware handler for the ✕ button on an attachment tile.
 *
 * Non-Claude (token mode):
 *   1. Remove from image-store
 *   2. Remove matching token from pending-media queue
 *   3. If the removed token was still the trailing token on the input line
 *      (no chars typed after it), erase its display chars from xterm.
 *
 * Claude mode:
 *   Only clears the thumbnail. Claude Code owns its own `[Image N]` buffer —
 *   we cannot retroactively rewrite it. Documented limitation.
 */
export function handleAttachmentRemove({
  terminalId,
  filePath,
  entry: _entry,
  isClaudeMode
}: AttachmentRemoveArgs): void {
  const removedImage = useImageStore.getState().removeImage(terminalId, filePath)
  if (!removedImage) return
  if (isClaudeMode) return

  const pending = usePendingMediaStore.getState()
  const queueBefore = pending.getQueue(terminalId)
  const lastToken = queueBefore.tokens[queueBefore.tokens.length - 1]
  const isLastToken = !!lastToken && lastToken.path === filePath
  const safeToErase = isLastToken && queueBefore.charsAfterLastToken === 0

  const removedToken = pending.removeTokenByPath(terminalId, filePath)
  if (removedToken && safeToErase) {
    // Also account for the trailing space we wrote with the token.
    writeToDisplay(terminalId, '\b \b'.repeat(removedToken.displayLength + 1))
  }
}
