import { useEffect, useCallback, useState, useRef } from 'react'
import { Toolbar, ProjectBar } from './components/toolbar'
import { TerminalGrid, TerminalActionBar } from './components/terminal'
import { WelcomeScreen } from './components/welcome-screen'
import { ToastContainer } from './components/toast-container'
import { SettingsModal } from './components/settings'
import { SlidePanel } from './components/slide-panel'
import { GitHubPanelContent } from './components/github-view/github-view'
import { GitInitDialog, GitHubConnectDialog } from './components/github-setup'
import { useAppStore, useSettingsStore, useToastStore, setupNotificationListener, setupUpdateListener } from './stores'
import { useKeyboardShortcuts, TERMINAL_DISPOSE_DELAY } from './hooks'
import { THEMES, TERMINAL_FONTS, APP_FONTS } from '@shared/constants'
import type { WindowsShell, Project } from '@shared/types'

function App() {
  const {
    terminals,
    projects,
    activeProjectId,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    updateTerminalTitle,
    addProject,
    removeProject,
    setProjects,
    setActiveProject,
    setActiveTerminal,
    switchToProject
  } = useAppStore()

  // Active slide panel: 'git' | 'github' | 'settings' | null (Phase 4 adds actual panels)
  const [activePanel, setActivePanel] = useState<string | null>(null)

  const togglePanel = useCallback((panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel)
  }, [])

  const { pendingSettings, loadSettings, detectWsl, getTerminalLimitValue } = useSettingsStore()

  // YOLO mode state
  const [yoloEnabled, setYoloEnabled] = useState(false)

  // Git setup dialog state
  const [gitInitDialogOpen, setGitInitDialogOpen] = useState(false)
  const [githubConnectDialogOpen, setGithubConnectDialogOpen] = useState(false)
  const [pendingSetupProject, setPendingSetupProject] = useState<Project | null>(null)

  const prevProjectIdRef = useRef<string | null>(null)

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
  const handleAddTerminal = useCallback(async (shell?: WindowsShell) => {
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

    // Use default shell from saved settings if not specified (Windows only)
    // Use savedSettings (persisted to disk) instead of pendingSettings to ensure consistency
    const effectiveShell = shell ?? useSettingsStore.getState().savedSettings.windowsShell

    try {
      const terminal = await window.electron.terminal.create({
        cwd: activeProject?.path,
        projectId: activeProject?.id,
        shell: effectiveShell
      })
      addTerminal(terminal)
    } catch (err) {
      console.error('[handleAddTerminal] Failed to create terminal:', err)
      useToastStore.getState().addToast('Failed to create terminal. Please try again.', 'error')
    }
  }, [activeProject, activeProjectId, addTerminal])

  // Handler: Close terminal by id (or active terminal if no id provided)
  const handleCloseTerminal = useCallback(async (terminalId?: string) => {
    const idToClose = terminalId ?? activeTerminalId
    if (!idToClose) return
    await window.electron.terminal.destroy(idToClose)
    removeTerminal(idToClose)
  }, [activeTerminalId, removeTerminal])

  // Handler: Insert file path into terminal
  const handleInsertFilePath = useCallback((terminalId: string, paths: string[]) => {
    const formatted = paths.map(p => {
      // Quote paths with special characters
      if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(p)) {
        return `"${p.replace(/"/g, '\\"')}"`
      }
      return p
    }).join(' ')
    window.electron.terminal.write(terminalId, formatted)
  }, [])

  // Handler: Toggle YOLO mode
  const handleYoloToggle = useCallback(async (enabled: boolean) => {
    if (!activeProject) return
    const result = await window.electron.yolo.set(activeProject.path, enabled)
    if (result.success) {
      setYoloEnabled(enabled)
    }
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

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onAddTerminal: handleAddTerminal,
    onCloseTerminal: handleCloseTerminal,
    onSelectProject: handleSelectProject,
    onToggleGitPanel: () => togglePanel('github')
  })


  // Load settings and detect WSL on mount
  useEffect(() => {
    loadSettings()
    detectWsl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load YOLO status when project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.yolo.get(activeProject.path).then(setYoloEnabled)
    } else {
      setYoloEnabled(false)
    }
  }, [activeProject])

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
    const termFont = TERMINAL_FONTS.find(f => f.id === termFontId)
    if (termFont) {
      root.style.setProperty('--terminal-font', `${termFont.family}, Menlo, Monaco, Consolas, monospace`)
    }

    // Set app/UI font from settings - apply to both CSS variable and directly to body
    // to ensure all elements (including fixed-position modals) pick up the change
    const appFontId = pendingSettings.modernFontFamily ?? 'system'
    const appFont = APP_FONTS.find(f => f.id === appFontId)
    if (appFont) {
      root.style.setProperty('--modern-font', appFont.family)
      document.body.style.fontFamily = appFont.family
    }
  }, [pendingSettings.colorTheme, pendingSettings.terminalFontFamily, pendingSettings.modernFontFamily])

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

  // Handle terminal title changes (from OSC escape sequences)
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onTitleChange(({ terminalId, title }) => {
      updateTerminalTitle(terminalId, title)
    })
    return unsubscribe
  }, [updateTerminalTitle])

  // Save session before close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      await window.electron.session.save()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <div className="app">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Settings modal */}
      <SettingsModal
        isOpen={activePanel === 'settings'}
        onClose={() => setActivePanel(null)}
      />



      {/* GitHub slide panel */}
      <SlidePanel
        isOpen={activePanel === 'github'}
        onClose={() => setActivePanel(null)}
        title="GitHub"
      >
        <GitHubPanelContent projectPath={activeProject?.path} />
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

      {/* Toolbar - replaces old titlebar + activity bar */}
      <Toolbar
        onAddTerminal={handleAddTerminal}
        terminalCount={visibleTerminals.length}
        terminalLimit={getTerminalLimitValue()}
        onToggleGitHub={() => togglePanel('github')}
        onToggleSettings={() => togglePanel('settings')}
        activePanel={activePanel}
      />

      {/* Main Content */}
      <div className="main-content">
        {activeProjectId ? (
          <div className="terminal-area">
            <TerminalActionBar
              terminalCount={visibleTerminals.length}
              terminalLimit={getTerminalLimitValue()}
              yoloEnabled={yoloEnabled}
              onAddTerminal={handleAddTerminal}
              onToggleYolo={handleYoloToggle}
              onKillAll={handleKillAll}
            />
            <div data-testid="terminal-area" style={{ flex: 1, minHeight: 0 }}>
              <TerminalGrid
                terminals={terminals}
                activeProjectId={activeProjectId}
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

      {/* Project bar - horizontal tab list below terminal */}
      <ProjectBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
        onToggleSettings={() => togglePanel('settings')}
        settingsActive={activePanel === 'settings'}
      />
    </div>
  )
}

export default App
