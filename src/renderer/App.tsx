import { useEffect, useCallback, useState, useRef } from 'react'
import { ActivityBar } from './components/activity-bar'
import { ProjectTabs } from './components/project-tabs'
import { TitlebarLogo } from './components/titlebar'
import { TerminalGrid, TerminalActionBar } from './components/terminal'
import { WelcomeScreen } from './components/welcome-screen'
import { GitHubView } from './components/github-view'
import { ToastContainer } from './components/toast-container'
import { SettingsModal } from './components/settings'
import { GitInitDialog, GitHubConnectDialog } from './components/github-setup'
import { useAppStore, useSettingsStore, useToastStore, setupNotificationListener, setupUpdateListener } from './stores'
import { useKeyboardShortcuts, TERMINAL_DISPOSE_DELAY } from './hooks'
import { COLOR_THEMES, TERMINAL_FONTS, TERMINAL_COLOR_PRESETS } from '@shared/constants'
import type { WindowsShell, Project } from '@shared/types'

// Detect macOS for title bar layout (traffic lights on left)
const isMac = navigator.platform.toLowerCase().includes('mac')

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
    switchToProject,
    activityBarState,
    setActivityBarState,
    activeView
  } = useAppStore()

  const { pendingSettings, loadSettings, detectWsl, getTerminalLimitValue, settingsModalOpen, setSettingsModalOpen } = useSettingsStore()

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
  }, [projects, switchToProject, removeProject])

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

    // Use default shell from settings if not specified (Windows only)
    const effectiveShell = shell ?? useSettingsStore.getState().settings.windowsShell

    const terminal = await window.electron.terminal.create({
      cwd: activeProject?.path,
      projectId: activeProject?.id,
      shell: effectiveShell
    })
    addTerminal(terminal)
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
    onSelectProject: handleSelectProject
  })


  // Load settings and detect WSL on mount
  useEffect(() => {
    loadSettings().then(() => {
      // Sync activity bar state from settings to app store
      const settings = useSettingsStore.getState().savedSettings
      if (settings.activityBarState) {
        setActivityBarState(settings.activityBarState)
      }
    })
    detectWsl()
  }, [])

  // Persist activity bar state changes to settings
  useEffect(() => {
    const settingsState = useSettingsStore.getState()
    if (settingsState.savedSettings.activityBarState !== activityBarState) {
      window.electron.settings.set({ ...settingsState.savedSettings, activityBarState })
    }
  }, [activityBarState])

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

  // Apply theme classes to document
  useEffect(() => {
    const root = document.documentElement

    // Determine actual mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = pendingSettings.themeMode === 'dark' ||
      (pendingSettings.themeMode === 'system' && prefersDark)

    // Remove old classes
    root.classList.remove('light', 'dark')
    COLOR_THEMES.forEach(t => root.classList.remove(`theme-${t.id}`))

    // Apply new classes
    root.classList.add(isDark ? 'dark' : 'light')
    root.classList.add(`theme-${pendingSettings.colorTheme}`)

    // ===== TERMINAL STYLE LOGIC =====
    // Remove all terminal classes (derived from TERMINAL_COLOR_PRESETS for DRY)
    const presetClasses = Object.keys(TERMINAL_COLOR_PRESETS).map(k => `terminal-preset-${k}`)
    root.classList.remove('ui-terminal', ...presetClasses, 'use-border-chars')

    const terminalOpts = pendingSettings.terminalStyleOptions ?? {
      colorPreset: 'green',
      fontFamily: 'jetbrains-mono',
      useBorderChars: false
    }

    if (pendingSettings.uiStyle === 'terminal') {
      root.classList.add('ui-terminal')
      root.classList.add(`terminal-preset-${terminalOpts.colorPreset}`)

      if (terminalOpts.useBorderChars) {
        root.classList.add('use-border-chars')
      }

      // Set font variable
      const font = TERMINAL_FONTS.find(f => f.id === terminalOpts.fontFamily)
      root.style.setProperty('--mc-terminal-font', font?.family || "'JetBrains Mono', monospace")
    } else {
      root.style.removeProperty('--mc-terminal-font')

      // Set modern font variable
      const modernFontId = pendingSettings.modernFontFamily ?? 'jetbrains-mono'
      const modernFont = TERMINAL_FONTS.find(f => f.id === modernFontId)
      root.style.setProperty('--mc-modern-font', modernFont?.family || "'JetBrains Mono', monospace")
    }

    // Update title bar overlay to match theme
    let bgColor: string
    let symbolColor: string

    if (pendingSettings.uiStyle === 'terminal') {
      // Use terminal preset colors for title bar
      const preset = TERMINAL_COLOR_PRESETS[terminalOpts.colorPreset] ?? TERMINAL_COLOR_PRESETS.green
      bgColor = preset.bg
      symbolColor = preset.text
    } else {
      // Default theme colors
      bgColor = isDark ? '#2d2d2d' : '#ebebeb'
      symbolColor = isDark ? '#d4d4d4' : '#1e1e1e'
    }
    window.electron.window.updateTitleBarOverlay({ color: bgColor, symbolColor })
  }, [
    pendingSettings.themeMode,
    pendingSettings.colorTheme,
    pendingSettings.uiStyle,
    pendingSettings.terminalStyleOptions?.colorPreset,
    pendingSettings.terminalStyleOptions?.fontFamily,
    pendingSettings.terminalStyleOptions?.useBorderChars,
    pendingSettings.modernFontFamily
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
    <div className="h-screen flex flex-col bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)]">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />

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

      {/* Unified Titlebar with Logo and Project Tabs */}
      <div className={`h-10 bg-[var(--mc-bg-tertiary)] flex items-center px-3 titlebar-drag ${isMac ? 'pl-20' : ''}`}>
        {/* Logo */}
        <TitlebarLogo showText={activityBarState === 'expanded'} />

        {/* Project Tabs - inline after logo */}
        <div className="flex-1 min-w-0 ml-3 titlebar-no-drag">
          <ProjectTabs
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeProjectId ? (
          <>
            <ActivityBar />
            <div className="flex-1 min-w-0 flex flex-col relative">
              {/* Terminal View - always rendered, hidden via visibility to preserve xterm state */}
              <div
                className="flex flex-col"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  visibility: activeView === 'terminals' ? 'visible' : 'hidden',
                  pointerEvents: activeView === 'terminals' ? 'auto' : 'none',
                  zIndex: activeView === 'terminals' ? 1 : 0
                }}
              >
                <TerminalActionBar
                  terminalCount={visibleTerminals.length}
                  terminalLimit={getTerminalLimitValue()}
                  yoloEnabled={yoloEnabled}
                  onAddTerminal={handleAddTerminal}
                  onToggleYolo={handleYoloToggle}
                  onKillAll={handleKillAll}
                />
                <div data-testid="terminal-area" className="flex-1 min-h-0">
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
              {/* GitHub View - always rendered, hidden via visibility to preserve state */}
              <div
                className="flex flex-col flex-1"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  visibility: activeView === 'github' ? 'visible' : 'hidden',
                  pointerEvents: activeView === 'github' ? 'auto' : 'none',
                  zIndex: activeView === 'github' ? 1 : 0
                }}
              >
                <GitHubView projectPath={activeProject?.path} isActive={activeView === 'github'} />
              </div>
            </div>
          </>
        ) : (
          <WelcomeScreen onAddProject={handleAddProject} />
        )}
      </div>
    </div>
  )
}

export default App
