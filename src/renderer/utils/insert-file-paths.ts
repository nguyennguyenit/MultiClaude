import { useAppStore, useImageStore } from '../stores'
import { classifyMediaFile } from './media-classifier'
import { formatPathForTerminal, joinPathsForClaudeTerminal } from './terminal-path-utils'

/** Drop/picker/IPC file-insertion flow for one terminal.
 *
 *  Non-Claude mode (shells):
 *    - Write each path straight to the PTY with shell-safe quoting, just
 *      like a manual paste. Media paths are mirrored into the attachment
 *      strip (image-store) so the user can still see thumbnails and
 *      remove items, but the shell sees the literal path — no `[Image N]`
 *      placeholder.
 *
 *  Claude mode:
 *    - Send ALL paths in ONE plain write (NOT bracketed-paste). Claude
 *      Code v2.1.112 routes any quoted or bracket-pasted file path to
 *      its auto-attach handler, which swallows the text and surfaces a
 *      `[Image N]` indicator below the status bar instead of leaving
 *      it in the prompt. Writing the joined paths with backslash-
 *      escaped spaces (`/Users/a\ b.png` instead of `"/Users/a b.png"`)
 *      reads as typed input — Claude renders the path inline in the
 *      prompt at the cursor, right where the user dropped it. A single
 *      write still avoids the multi-paste drop-all-but-first bug the
 *      d888103 commit originally tried to fix. */
export function insertFilePathsIntoTerminal(terminalId: string, paths: string[]): void {
  const isClaudeMode = useAppStore.getState().terminals.find((t) => t.id === terminalId)?.isClaudeMode ?? false

  if (isClaudeMode) {
    for (const filePath of paths) {
      const mediaType = classifyMediaFile(filePath)
      if (mediaType) {
        useImageStore.getState().addImage(terminalId, filePath, mediaType)
      }
    }
    if (paths.length > 0) {
      window.electron.terminal.write(terminalId, joinPathsForClaudeTerminal(paths) + ' ')
    }
    return
  }

  for (const filePath of paths) {
    const mediaType = classifyMediaFile(filePath)
    if (mediaType) {
      useImageStore.getState().addImage(terminalId, filePath, mediaType)
    }
    window.electron.terminal.write(terminalId, formatPathForTerminal(filePath) + ' ')
  }
}
