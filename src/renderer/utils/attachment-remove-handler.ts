import { useImageStore, type ImageEntry } from '../stores/image-store'

export interface AttachmentRemoveArgs {
  terminalId: string
  filePath: string
  entry: ImageEntry
  isClaudeMode: boolean
}

/** Handler for the ✕ button on an attachment tile. The strip is purely a
 *  preview layer now — file paths are written straight to the PTY in both
 *  modes, so removing a tile just clears the mirror in image-store. In
 *  Claude mode Claude Code still owns its own `[Image N]` buffer and we
 *  cannot retroactively rewrite it (documented limitation). */
export function handleAttachmentRemove({ terminalId, filePath }: AttachmentRemoveArgs): void {
  useImageStore.getState().removeImage(terminalId, filePath)
}
