import { useEffect, useCallback, useState, useRef } from 'react'
import { Toolbar } from './components/toolbar'
import { UpdateBanner } from './components/update-banner'
import { TerminalGrid, TerminalActionBar } from './components/terminal'
import { YoloWarningDialog } from './components/terminal/yolo-warning-dialog'
import { ThemedContextMenu } from './components/context-menu/themed-context-menu'
import { WelcomeScreen } from './components/welcome-screen'
import { ToastContainer } from './components/toast-container'
import { SettingsModal } from './components/settings'
import { SlidePanel } from './components/slide-panel'
import { GitHubPanelContent } from './components/github-view/github-view'
import { GitInitDialog, GitHubConnectDialog } from './components/github-setup'
import { useAppStore, useImageStore, useNotificationStore, usePendingMediaStore, useSettingsStore, useToastStore, setupNotificationListener, setupUpdateListener } from './stores'
import { useContextMenuStore } from './stores/context-menu-store'
import { writeToDisplay } from './stores/display-writer-registry'
import { useKeyboardShortcuts, TERMINAL_DISPOSE_DELAY } from './hooks'
import { getCurrentTerminalTheme } from './hooks/use-terminal-font-theme'
import { useExecuteSplit } from './hooks/use-execute-split'
import { usePaneTreeStore, flushPaneTreeSaves } from './stores/pane-tree-store'
import { closeLeafAndCollapse } from '@shared/utils/pane-tree'
import { registerSplitHandlers } from './utils/terminal-context-actions'
import { joinPathsForTerminal, shellInfoToWindowsShell } from './utils'
import { buildMediaToken, classifyMediaFile } from './utils/media-classifier'
import { formatPathForTerminal } from './utils/terminal-path-utils'
import { reconcileSavedDefaultShell } from './utils/default-shell-selection'
import { attachTerminalOutputDispatcher } from './utils/terminal-output-dispatcher'
import { THEMES, APP_FONTS, getTerminalFontFamilyById } from '@shared/constants'
import type { ShellInfo, Project } from '@shared/types'

function App() {
  const terminals = useAppStore((state) => state.terminals)
  const projects = useAppStore((state) => state.projects)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const activeTerminalId = useAppStore((state) => state.activeTerminalId)
  const addTerminal = useAppStore((state) => state.addTerminal)
  const removeTerminal = useAppStore((state) => state.removeTerminal)
  const updateTerminalTitle = useAppStore((state) => state.updateTerminalTitle)
  const updateTerminalClaudeMode = useAppStore((state) => state.updateTerminalClaudeMode)
  const updateTerminalAgentType = useAppStore((state) => state.updateTerminalAgentType)
  const addProject = useAppStore((state) => state.addProject)
  const removeProject = useAppStore((state) => state.removeProject)
  const setProjects = useAppStore((state) => state.setProjects)
  const setActiveProject = useAppStore((state) => state.setActiveProject)
  const setActiveTerminal = useAppStore((state) => state.setActiveTerminal)
  const switchToProject = useAppStore((state) => state.switchToProject)
  const savedDefaultShell = useSettingsStore((state) => state.savedSettings.defaultShell)
  const setDefaultShell = useSettingsStore((state) => state.setDefaultShell)

  // Active slide panel: 'github' | 'settings' | null
  const [activePanel, setActivePanel] = useState<string | null>(null)

  const togglePanel = useCallback((panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel)
  }, [])

  const { pendingSettings, loadSettings, detectWsl, getTerminalLimitValue } = useSettingsStore()
  const loadNotificationSettings = useNotificationStore((state) => state.loadSettings)

  // YOLO mode state
  const [yoloEnabled, setYoloEnabled] = useState(false)
  const [showYoloDialog, setShowYoloDialog] = useState(false)

  // Git setup dialog state
  const [gitInitDialogOpen, setGitInitDialogOpen] = useState(false)
  const [githubConnectDialogOpen, setGithubConnectDialogOpen] = useState(false)
  const [pendingSetupProject, setPendingSetupProject] = useState<Project | null>(null)

  const prevProjectIdRef = useRef<string | null>(null)

  // Shell switcher state (loaded from IPC on mount, persisted via settings)
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([])
  const [hasLoadedShells, setHasLoadedShells] = useState(false)
  const [selectedShell, setSelectedShell] = useState<ShellInfo | null>(null)

  // Get active project for terminal creation
  const activeProject = projects.find(p => p.id === activeProjectId)

  // Get visible terminals for UI displays (action bar count)
  // Note: All terminals are passed to TerminalGrid which handles hiding via CSS
  const visibleTerminals = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId)
    : terminals

  // Handler: Add new project via folder picker
  const handleAddProject = useCallback(async () => {
    const path = await window.electron.project.openFolder()
    if (!path) return

    // Handle both Unix (/) and Windows (\) path separators
    const name = path.split(/[/\\]/).pop() || 'Untitled'
    const project = await window.electron.project.create({ name, path })
    addProject(project)
    setActiveProject(project.id)

    // Check git status for setup flow
    if (project.skipGitSetup) return

    const gitStatus = await window.electron.git.status(path)

    if (!gitStatus.isRepo) {
      setPendingSetupProject(project)
      setGitInitDialogOpen(true)
    } else if (!gitStatus.hasRemote) {
      setPendingSetupProject(project)
      setGithubConnectDialogOpen(true)
    }
  }, [addProject, setActiveProject])

  // Handler: Delete project (cleanup terminals first to prevent orphans)
  const handleDeleteProject = useCallback(async (id: string) => {
    // Close all terminals for this project to prevent orphaned hidden terminals
    const projectTerminals = terminals.filter(t => t.projectId === id)
    for (const terminal of projectTerminals) {
      await window.electron.terminal.destroy(terminal.id)
      removeTerminal(terminal.id)
    }

    await window.electron.project.delete(id)
    removeProject(id)
  }, [terminals, removeProject, removeTerminal])

  // Handler: Switch to project with folder validation
  const handleSelectProject = useCallback(async (id: string | null) => {
    if (!id) {
      setActiveProject(null)
      setActiveTerminal(null)
      return
    }

    const project = projects.find(p => p.id === id)
    if (!project) return

    // Validate folder exists before switching
    const result = await window.electron.project.checkFolder(project.path)
    if (!result.exists) {
      useToastStore.getState().addToast(
        `Project "${project.name}" folder no longer exists. Removing from list.`,
        'warning'
      )
      await window.electron.project.delete(id)
      removeProject(id)
      return
    }

    // Atomic project switch - updates project + terminal in single state update
    switchToProject(id)
    prevProjectIdRef.current = id
  }, [projects, switchToProject, removeProject, setActiveProject, setActiveTerminal])

  // Handler: Add new terminal in active project
  const handleAddTerminal = useCallback(async (shell?: ShellInfo) => {
    // Get fresh state to avoid stale closure
    const { terminals } = useAppStore.getState()
    const currentProjectTerminals = activeProjectId
      ? terminals.filter(t => t.projectId === activeProjectId)
      : terminals

    // Check terminal limit
    const limit = useSettingsStore.getState().getTerminalLimitValue()
    if (currentProjectTerminals.length >= limit) {
      useToastStore.getState().addToast(
        `Terminal limit reached (${limit}). Close a terminal or increase limit in Settings.`,
        'warning'
      )
      return
    }

    // Resolve the effective shell (caller arg > app-level selection > saved settings for Windows)
    const effectiveShell = shell ?? selectedShell
    const savedSettings = useSettingsStore.getState().savedSettings

    // H6: use kind field instead of process.platform
    const isUnixShell = effectiveShell?.kind === 'unix'
    const isWindowsShell = effectiveShell && !isUnixShell

    try {
      const terminal = await window.electron.terminal.create({
        cwd: activeProject?.path,
        projectId: activeProject?.id,
        shellPath: isUnixShell ? effectiveShell.path : undefined,
        shell: isWindowsShell ? shellInfoToWindowsShell(effectiveShell) : savedSettings.windowsShell,
      })
      addTerminal(terminal)
    } catch (err) {
      console.error('[handleAddTerminal] Failed to create terminal:', err)
      useToastStore.getState().addToast('Failed to create terminal. Please try again.', 'error')
    }
  }, [activeProject, activeProjectId, addTerminal, selectedShell])

  // Handler: Shell selection — update state and persist to disk
  const handleShellSelect = useCallback((shell: ShellInfo | null) => {
    setSelectedShell(shell)
    useSettingsStore.getState().setDefaultShell(shell)
  }, [])

  // Handler: Close terminal by id (or active terminal if no id provided)
  const handleCloseTerminal = useCallback(async (terminalId?: string) => {
    const idToClose = terminalId ?? activeTerminalId
    if (!idToClose) return
    await window.electron.terminal.destroy(idToClose)
    removeTerminal(idToClose)
    // Collapse the pane tree node for this terminal so parents reflow.
    if (activeProjectId) {
      const current = usePaneTreeStore.getState().getTree(activeProjectId)
      if (current) {
        usePaneTreeStore.getState().setTree(activeProjectId, closeLeafAndCollapse(current, idToClose))
      }
    }
  }, [activeTerminalId, removeTerminal, activeProjectId])

  // Handler: Insert file path into terminal
  const handleInsertFilePath = useCallback((terminalId: string, paths: string[]) => {
    const isClaudeMode = useAppStore.getState().terminals.find(t => t.id === terminalId)?.isClaudeMode
    for (const filePath of paths) {
      const mediaType = classifyMediaFile(filePath)
      if (mediaType && !isClaudeMode) {
        const entry = useImageStore.getState().addImage(terminalId, filePath, mediaType)
        const token = buildMediaToken(mediaType, entry.index)
        usePendingMediaStore.getState().push(terminalId, {
          path: filePath,
          displayLength: token.length
        })
        writeToDisplay(terminalId, token + ' ')
      } else {
        // Claude mode or non-media file: write path directly to PTY
        if (mediaType) {
          useImageStore.getState().addImage(terminalId, filePath, mediaType)
        }
        window.electron.terminal.write(terminalId, formatPathForTerminal(filePath) + ' ')
      }
    }
  }, [])

  // Handler: Toggle YOLO mode (shows first-time warning dialog per project)
  const handleYoloToggle = useCallback(async (enabled: boolean) => {
    if (!activeProject) return

    if (enabled) {
      const warningKey = `yolo-warned-${activeProject.path}`
      if (!localStorage.getItem(warningKey)) {
        setShowYoloDialog(true)
        return
      }
    }

    const result = await window.electron.yolo.set(activeProject.path, enabled)
    if (result.success) setYoloEnabled(enabled)
  }, [activeProject])

  // Handler: User confirmed YOLO warning dialog
  const handleYoloConfirm = useCallback(async () => {
    if (!activeProject) return
    localStorage.setItem(`yolo-warned-${activeProject.path}`, '1')
    setShowYoloDialog(false)
    const result = await window.electron.yolo.set(activeProject.path, true)
    if (result.success) setYoloEnabled(true)
  }, [activeProject])

  // Handler: Kill all terminals in active project (with delay to prevent WebGL warnings)
  const handleKillAll = useCallback(async () => {
    const terminalsToKill = [...visibleTerminals]
    for (const terminal of terminalsToKill) {
      await window.electron.terminal.destroy(terminal.id)
      removeTerminal(terminal.id)
      // Delay must exceed TERMINAL_DISPOSE_DELAY to ensure WebGL context disposal
      if (terminalsToKill.indexOf(terminal) < terminalsToKill.length - 1) {
        await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
      }
    }
  }, [visibleTerminals, removeTerminal])

  // Handler: Initialize git for pending project
  const handleGitInit = useCallback(async () => {
    if (!pendingSetupProject) return

    const success = await window.electron.git.init(pendingSetupProject.path)
    if (success) {
      setGitInitDialogOpen(false)
      // After init, check if remote exists (it won't after fresh init)
      setGithubConnectDialogOpen(true)
    }
  }, [pendingSetupProject])

  // Handler: Skip git init dialog
  const handleGitInitSkip = useCallback(async (dontAskAgain: boolean) => {
    if (pendingSetupProject && dontAskAgain) {
      await window.electron.project.update(pendingSetupProject.id, { skipGitSetup: true })
    }
    setGitInitDialogOpen(false)
    setPendingSetupProject(null)
  }, [pendingSetupProject])

  // Handler: GitHub connect complete
  const handleGitHubConnectComplete = useCallback(async (
    action: 'created' | 'linked' | 'skipped',
    dontAskAgain: boolean
  ) => {
    if (pendingSetupProject && dontAskAgain) {
      await window.electron.project.update(pendingSetupProject.id, { skipGitSetup: true })
    }
    setGithubConnectDialogOpen(false)
    setPendingSetupProject(null)

    if (action !== 'skipped') {
      useToastStore.getState().addToast(
        action === 'created' ? 'GitHub repository created successfully' : 'Repository linked successfully',
        'info'
      )
    }
  }, [pendingSetupProject])

  // Visible (active project) terminal count — drives split gating
  const visibleCount = visibleTerminals.length
  const effectiveLimit = getTerminalLimitValue()
  const atLimit = visibleCount >= effectiveLimit

  const { executeSplit, canSplit } = useExecuteSplit({
    projectId: activeProjectId,
    projectPath: activeProject?.path,
    activeTerminalId,
    terminalLimit: effectiveLimit,
    terminalCount: visibleCount,
    selectedShell,
    windowsShellFallback: pendingSettings.windowsShell,
    addTerminal,
    notifyLimit: (limit) => {
      useToastStore.getState().addToast(
        `Terminal limit reached (${limit}). Close a terminal or increase limit in Settings.`,
        'warning'
      )
    },
    notifyError: (msg) => {
      useToastStore.getState().addToast(msg, 'error')
    }
  })

  // Expose executeSplit to the terminal right-click menu registry. Keep the
  // handler wired even when at the limit so menu items render as disabled with
  // a tooltip (the `disabled` flag in the menu gates the click).
  useEffect(() => {
    registerSplitHandlers({
      executeSplit: (dir, targetId) => void executeSplit(dir, targetId),
      canSplit,
      atLimit,
      limit: effectiveLimit
    })
  }, [executeSplit, canSplit, atLimit, effectiveLimit])

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onAddTerminal: handleAddTerminal,
    onCloseTerminal: handleCloseTerminal,
    onSelectProject: handleSelectProject,
    onToggleGitHubPanel: () => togglePanel('github'),
    // Always pass the handler — executeSplit's internal gate emits notifyLimit
    // uniformly, matching the xterm-focused hotkey path. Previously this was
    // gated by `canSplit`, which made the global hotkey silently no-op at limit.
    onSplit: (dir) => void executeSplit(dir)
  })


  // Load settings and detect WSL on mount
  useEffect(() => {
    loadSettings()
    loadNotificationSettings()
    detectWsl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load available shells on mount; restore saved default shell if still present
  useEffect(() => {
    window.electron.terminal.getAvailableShells().then(shells => {
      setAvailableShells(shells)
      setHasLoadedShells(true)
    }).catch(() => {
      // getAvailableShells is best-effort — continue without shell list
    })
  }, [])

  useEffect(() => {
    void reconcileSavedDefaultShell({
      hasLoadedShells,
      shells: availableShells,
      savedDefault: savedDefaultShell,
      setSelectedShell,
      persistDefaultShell: setDefaultShell
    })
  }, [availableShells, hasLoadedShells, savedDefaultShell, setDefaultShell])

  // Load YOLO status when project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.yolo.get(activeProject.path).then(setYoloEnabled)
    } else {
      setYoloEnabled(false)
    }
  }, [activeProject])

  // Close any open context menu when the active project changes — otherwise
  // menu items retain closures to a now-defunct terminal id, e.g. a lingering
  // Paste would call pasteFromClipboard(oldTerminalId, ...) with no effect.
  useEffect(() => {
    useContextMenuStore.getState().closeMenu()
  }, [activeProjectId])

  // Setup notification listener
  useEffect(() => {
    const cleanup = setupNotificationListener()
    return cleanup
  }, [])

  // Setup update listener
  useEffect(() => {
    const cleanup = setupUpdateListener()
    return cleanup
  }, [])

  // Sync active terminal with notification focus detector
  useEffect(() => {
    window.electron.notification.setActiveTerminal(activeTerminalId)
  }, [activeTerminalId])

  // Apply VibeTerminal theme via CSS variables
  useEffect(() => {
    const root = document.documentElement
    // Find theme by id, fall back to first (handles legacy theme IDs gracefully)
    const theme = THEMES.find(t => t.id === pendingSettings.colorTheme) ?? THEMES[0]

    // Set new CSS variable system
    root.style.setProperty('--bg-primary', theme.background)
    root.style.setProperty('--bg-secondary', theme.tabBg)
    root.style.setProperty('--bg-tertiary', theme.border)
    root.style.setProperty('--text-primary', theme.foreground)
    root.style.setProperty('--text-secondary', `${theme.foreground}99`)
    root.style.setProperty('--text-muted', `${theme.foreground}66`)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--hover', theme.hover)
    root.style.setProperty('--tab-bg', theme.tabBg)
    root.style.setProperty('--tab-active-bg', theme.tabActiveBg)
    root.style.setProperty('--cursor', theme.cursor)
    root.style.setProperty('--selection-bg', theme.selectionBg)

    // Set terminal font from settings (xterm uses this via use-terminal hook)
    const termFontId = pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
    root.style.setProperty('--terminal-font', getTerminalFontFamilyById(termFontId))

    // Set app/UI font from settings - apply to both CSS variable and directly to body
    // to ensure all elements (including fixed-position modals) pick up the change
    const appFontId = pendingSettings.modernFontFamily ?? 'system'
    const appFont = APP_FONTS.find(f => f.id === appFontId)
    if (appFont) {
      root.style.setProperty('--modern-font', appFont.family)
      document.body.style.fontFamily = appFont.family
    }
  }, [pendingSettings.colorTheme, pendingSettings.terminalFontFamily, pendingSettings.modernFontFamily])

  // Sync --terminal-bg CSS var whenever the xterm theme could change.
  // globals.css uses var(--terminal-bg) on .xterm + .xterm-viewport so every
  // terminal (including ones mounted before the change) picks it up without
  // needing a per-instance inline-style sync.
  useEffect(() => {
    const bg = getCurrentTerminalTheme().background
    if (bg) document.documentElement.style.setProperty('--terminal-bg', bg)
  }, [
    pendingSettings.colorTheme,
    pendingSettings.themeMode,
    pendingSettings.uiStyle,
    pendingSettings.terminalStyleOptions?.colorPreset,
  ])

  // Load saved projects on mount and validate folder existence
  useEffect(() => {
    const init = async () => {
      const loadedProjects = await window.electron.project.list()

      // Check which projects still have valid folders
      const validationResults = await Promise.all(
        loadedProjects.map(async (project) => {
          const result = await window.electron.project.checkFolder(project.path)
          return { project, exists: result.exists }
        })
      )

      const validProjects = validationResults
        .filter(r => r.exists)
        .map(r => r.project)
      const invalidProjects = validationResults
        .filter(r => !r.exists)
        .map(r => r.project)

      // Auto-remove invalid projects and notify user
      if (invalidProjects.length > 0) {
        for (const project of invalidProjects) {
          await window.electron.project.delete(project.id)
        }

        const names = invalidProjects.map(p => p.name).join(', ')
        useToastStore.getState().addToast(
          `Removed ${invalidProjects.length} project(s) with missing folders: ${names}`,
          'warning'
        )
      }

      setProjects(validProjects)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // NOTE: Removed auto-create terminal - now shows welcome screen instead
  // User can create terminal via "+ New Terminal" button or Ctrl+T

  // Handle terminal exit
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onExit(({ terminalId }) => {
      useAppStore.getState().removeTerminal(terminalId)
    })
    return unsubscribe
  }, [])

  useEffect(() => attachTerminalOutputDispatcher(window.electron.terminal.onOutput), [])

  // Handle terminal title changes (from OSC escape sequences)
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onTitleChange(({ terminalId, title }) => {
      updateTerminalTitle(terminalId, title)
    })
    return unsubscribe
  }, [updateTerminalTitle])

  useEffect(() => {
    const unsubscribe = window.electron.terminal.onStateChange(({ terminalId, isClaudeMode }) => {
      updateTerminalClaudeMode(terminalId, isClaudeMode)
    })
    return unsubscribe
  }, [updateTerminalClaudeMode])

  // Handle agent detection events (codex, gemini, aider, etc.)
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onAgentDetected(({ terminalId, agentType }) => {
      updateTerminalAgentType(terminalId, agentType as import('@shared/types').AgentType)
    })
    return unsubscribe
  }, [updateTerminalAgentType])

  // Handle terminals created externally (e.g. via Telegram /new command)
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onCreated((terminal) => {
      addTerminal(terminal)
    })
    return unsubscribe
  }, [addTerminal])

  // Save session + flush pending pane-tree saves before close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      flushPaneTreeSaves()
      await window.electron.session.save()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <div className="app">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Themed context menu (portal) */}
      <ThemedContextMenu />

      {/* Settings modal */}
      <SettingsModal
        isOpen={activePanel === 'settings'}
        onClose={() => setActivePanel(null)}
      />



      {/* GitHub slide panel */}
      <SlidePanel
        isOpen={activePanel === 'github'}
        onClose={() => setActivePanel(null)}
        title=""
        headerExtra={<GitHubHeaderExtra projectPath={activeProject?.path} />}
      >
        {activePanel === 'github' && <GitHubPanelContent projectPath={activeProject?.path} />}
      </SlidePanel>

      {/* Git Setup Dialogs */}
      <GitInitDialog
        isOpen={gitInitDialogOpen}
        projectName={pendingSetupProject?.name || ''}
        projectPath={pendingSetupProject?.path || ''}
        onInitialize={handleGitInit}
        onSkip={handleGitInitSkip}
        onClose={() => {
          setGitInitDialogOpen(false)
          setPendingSetupProject(null)
        }}
      />
      <GitHubConnectDialog
        isOpen={githubConnectDialogOpen}
        projectName={pendingSetupProject?.name || ''}
        projectPath={pendingSetupProject?.path || ''}
        onComplete={handleGitHubConnectComplete}
        onClose={() => {
          setGithubConnectDialogOpen(false)
          setPendingSetupProject(null)
        }}
      />

      {/* YOLO first-time warning dialog */}
      {showYoloDialog && (
        <YoloWarningDialog
          onConfirm={handleYoloConfirm}
          onCancel={() => setShowYoloDialog(false)}
        />
      )}

      {/* Toolbar with inline Chrome-style project tabs */}
      <Toolbar
        onAddTerminal={handleAddTerminal}
        terminalCount={visibleTerminals.length}
        terminalLimit={getTerminalLimitValue()}
        onToggleGitHub={() => togglePanel('github')}
        onToggleSettings={() => togglePanel('settings')}
        activePanel={activePanel}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
      />
      <UpdateBanner />

      {/* Main Content */}
      <div className="main-content">
        {activeProjectId ? (
          <div className="terminal-area">
            <div data-testid="terminal-area" style={{ flex: 1, minHeight: 0 }}>
              <TerminalGrid
                terminals={terminals}
                activeProjectId={activeProjectId}
                activeProjectPath={activeProject?.path}
                activeTerminalId={activeTerminalId}
                onTerminalClick={setActiveTerminal}
                onAddTerminal={handleAddTerminal}
                onCloseTerminal={handleCloseTerminal}
                onInsertFilePath={handleInsertFilePath}
                onTitleChange={updateTerminalTitle}
              />
            </div>
          </div>
        ) : (
          <WelcomeScreen onAddProject={handleAddProject} />
        )}
      </div>

      {/* Bottom icon action bar — replaces ProjectBar space */}
      {activeProjectId && (
        <TerminalActionBar
          terminalCount={visibleTerminals.length}
          terminalLimit={getTerminalLimitValue()}
          yoloEnabled={yoloEnabled}
          availableShells={availableShells}
          selectedShell={selectedShell}
          onShellSelect={handleShellSelect}
          onAddTerminal={handleAddTerminal}
          onToggleYolo={handleYoloToggle}
          onKillAll={handleKillAll}
          onSplit={(dir) => void executeSplit(dir)}
          canSplit={canSplit}
        />
      )}
    </div>
  )
}

export default App

/** Convert git remote URL to a clean https GitHub URL */
function toGitHubUrl(remote: string): string | null {
  const ssh = remote.match(/git@github\.com[:/](.+?)(?:\.git)?$/)
  if (ssh) return `https://github.com/${ssh[1]}`
  const https = remote.match(/(https?:\/\/github\.com\/.+?)(?:\.git)?$/)
  if (https) return https[1]
  return null
}

/** GitHub icon + repo link in slide panel header — fetches remoteUrl from git status */
function GitHubHeaderExtra({ projectPath }: { projectPath?: string }) {
  const [repoUrl, setRepoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) { setRepoUrl(null); return }
    window.electron.git.status(projectPath).then(status => {
      setRepoUrl(status.remoteUrl ? toGitHubUrl(status.remoteUrl) : null)
    }).catch(() => setRepoUrl(null))
  }, [projectPath])

  if (!repoUrl) return null

  const label = repoUrl.match(/github\.com\/(.+)/)?.[1] ?? repoUrl

  return (
    <a
      href={repoUrl}
      onClick={e => { e.preventDefault(); window.electron.app.openExternal(repoUrl) }}
      title={repoUrl}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        color: 'var(--mc-text-muted, #6e7681)',
        textDecoration: 'none',
        fontSize: 11,
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--mc-accent, #58a6ff)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--mc-text-muted, #6e7681)' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
      <span style={{ whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </a>
  )
}
