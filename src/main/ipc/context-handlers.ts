import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { ContextSnapshot } from '@shared/types/context-window'
import type { ContextWindowAnalyzer } from '@main/context'

/**
 * Wires `context:get` invoke + broadcasts `context:snapshot` events to every
 * BrowserWindow. Called once from the main bootstrap after the analyzer is
 * instantiated.
 */
export function registerContextHandlers(analyzer: ContextWindowAnalyzer): () => void {
  ipcMain.removeHandler(IPC_CHANNELS.CONTEXT_GET)
  ipcMain.handle(IPC_CHANNELS.CONTEXT_GET, (_event, sessionId: string) => {
    if (typeof sessionId !== 'string' || !sessionId) return null
    return analyzer.getSnapshot(sessionId)
  })

  const onSnapshot = (snap: ContextSnapshot) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) {
        w.webContents.send(IPC_CHANNELS.CONTEXT_SNAPSHOT, snap)
      }
    }
  }
  analyzer.on('snapshot', onSnapshot)

  return () => {
    analyzer.off('snapshot', onSnapshot)
    ipcMain.removeHandler(IPC_CHANNELS.CONTEXT_GET)
  }
}
