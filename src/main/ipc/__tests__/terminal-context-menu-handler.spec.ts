import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  buildFromTemplateMock,
  popupMock,
  readTextMock,
  ipcHandleMock,
  ipcRemoveHandlerMock,
  ipcOnMock,
  ipcRemoveAllListenersMock,
  handleRegistry
} = vi.hoisted(() => {
  const registry = new Map<string, (...args: unknown[]) => unknown>()
  return {
    buildFromTemplateMock: vi.fn(),
    popupMock: vi.fn(),
    readTextMock: vi.fn(),
    ipcHandleMock: vi.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
      registry.set(channel, listener)
    }),
    ipcRemoveHandlerMock: vi.fn(),
    ipcOnMock: vi.fn(),
    ipcRemoveAllListenersMock: vi.fn(),
    handleRegistry: registry
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: ipcHandleMock,
    removeHandler: ipcRemoveHandlerMock,
    on: ipcOnMock,
    removeAllListeners: ipcRemoveAllListenersMock
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn()
  },
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '0.0.0')
  },
  screen: {
    getDisplayMatching: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }))
  },
  Menu: {
    buildFromTemplate: buildFromTemplateMock
  },
  clipboard: {
    readText: readTextMock
  }
}))

vi.mock('../../updater', () => ({
  checkForUpdatesManually: vi.fn(),
  getUpdateState: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn()
}))

import { registerIpcHandlers } from '../handlers'

function createWindowMock() {
  return {
    isDestroyed: vi.fn(() => false),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1280, height: 720 })),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn()
    }
  }
}

function createManagersMock() {
  return {
    terminalManager: {
      on: vi.fn(),
      write: vi.fn(),
      create: vi.fn(),
      list: vi.fn(() => []),
      destroyAsync: vi.fn(),
      invokeClaudeCode: vi.fn(),
      getAvailableShells: vi.fn(() => []),
      get: vi.fn()
    },
    gitManager: {},
    gitHeadWatcher: {
      onBranchChange: vi.fn()
    },
    projectStore: {
      getProjects: vi.fn(() => [])
    },
    settingsStore: {
      get: vi.fn(),
      set: vi.fn(),
      reset: vi.fn()
    },
    notificationManager: {
      processOutput: vi.fn(),
      handleAgentExit: vi.fn(),
      setTerminalAgentType: vi.fn(),
      registerTerminalCwd: vi.fn(),
      clearTerminal: vi.fn(),
      setManagers: vi.fn(),
      syncRemoteControl: vi.fn(),
      getRemoteControlStatus: vi.fn(),
      setActiveTerminal: vi.fn(),
      clearTelegram: vi.fn(),
      clearDiscord: vi.fn(),
      testTelegram: vi.fn(),
      testDiscord: vi.fn()
    }
  }
}

describe('terminal context menu IPC handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handleRegistry.clear()
    buildFromTemplateMock.mockReturnValue({ popup: popupMock })
    readTextMock.mockReturnValue('clipboard text')
  })

  it('registers a terminal context-menu handler that shows a Paste item and only pastes on click', async () => {
    const window = createWindowMock()
    const managers = createManagersMock()

    registerIpcHandlers(window as never, managers as never)

    const handler = handleRegistry.get('terminal:show-context-menu')
    expect(handler).toBeTypeOf('function')

    await handler?.({}, { terminalId: 'term-1', x: 25, y: 40 })

    expect(buildFromTemplateMock).toHaveBeenCalledTimes(1)
    const template = buildFromTemplateMock.mock.calls[0]?.[0]
    expect(template).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Paste' })
      ])
    )
    expect(managers.terminalManager.write).not.toHaveBeenCalled()

    const pasteItem = template[0]
    await pasteItem.click()

    expect(readTextMock).toHaveBeenCalledTimes(1)
    expect(managers.terminalManager.write).toHaveBeenCalledWith('term-1', 'clipboard text')
    expect(popupMock).toHaveBeenCalledWith({ window, x: 25, y: 40 })
  })
})
