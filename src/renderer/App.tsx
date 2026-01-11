import { useEffect, useCallback, useState, useRef } from 'react'
import { Sidebar } from './components/sidebar'
import { ProjectTabs } from './components/project-tabs'
import { TerminalGrid, TerminalActionBar } from './components/terminal'
import { WelcomeScreen } from './components/welcome-screen'
import { GitHubView } from './components/github-view'
import { ToastContainer } from './components/toast-container'
import { SettingsModal } from './components/settings'
import { useAppStore, useSettingsStore, useToastStore, setupNotificationListener, setupUpdateListener } from './stores'
import { useKeyboardShortcuts, TERMINAL_DISPOSE_DELAY } from './hooks'
import { COLOR_THEMES } from '@shared/constants'
import type { WindowsShell } from '@shared/types'

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
    sidebarOpen,
    toggleSidebar,
    activeView
  } = useAppStore()

  const { pendingSettings, loadSettings, detectWsl, getTerminalLimitValue, settingsModalOpen, setSettingsModalOpen } = useSettingsStore()

  // YOLO mode state
  const [yoloEnabled, setYoloEnabled] = useState(false)

  // Project switch transition state
  const [projectSwitching, setProjectSwitching] = useState(false)
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
      setActiveTerminal(null) // Clear terminal selection when no project
      return
    }

    // Guard against rapid switching - ignore if already transitioning
    if (projectSwitching) return

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

    // Start transition if switching between projects (not initial load)
    if (prevProjectIdRef.current && prevProjectIdRef.current !== id) {
      setProjectSwitching(true)
      // Allow old terminals to start unmounting
      setActiveProject(id)
      // Wait for disposal + buffer (TERMINAL_DISPOSE_DELAY + 50ms safety margin)
      await new Promise(resolve => setTimeout(resolve, TERMINAL_DISPOSE_DELAY + 50))
      setProjectSwitching(false)
    } else {
      setActiveProject(id)
    }

    // Auto-select first terminal of new project to fix cursor blink bug.
    // Uses getState() for fresh terminals after dispose delay completes.
    const { terminals } = useAppStore.getState()
    const newProjectTerminals = terminals.filter(t => t.projectId === id)
    setActiveTerminal(newProjectTerminals[0]?.id || null)

    prevProjectIdRef.current = id
  }, [projects, projectSwitching, setActiveProject, setActiveTerminal, removeProject])

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

  // Handler: Start Claude in terminal
  const handleStartClaude = useCallback(async (terminalId: string) => {
    await window.electron.terminal.invokeClaude(terminalId)
  }, [])

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

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onAddTerminal: handleAddTerminal,
    onCloseTerminal: handleCloseTerminal,
    onSelectProject: handleSelectProject
  })


  // Load settings and detect WSL on mount
  useEffect(() => {
    loadSettings()
    detectWsl()
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

    // Update title bar overlay to match theme (--mc-bg-tertiary)
    const bgColor = isDark ? '#2d2d2d' : '#ebebeb'
    const symbolColor = isDark ? '#d4d4d4' : '#1e1e1e'
    window.electron.window.updateTitleBarOverlay({ color: bgColor, symbolColor })
  }, [pendingSettings.themeMode, pendingSettings.colorTheme])

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

      {/* Title Bar */}
      <div className="h-10 bg-[var(--mc-bg-tertiary)] flex items-center px-4 titlebar-drag relative">
        <button
          data-testid="titlebar-sidebar-toggle"
          onClick={toggleSidebar}
          className={`p-1 hover:bg-[var(--mc-bg-hover)] rounded titlebar-no-drag ${isMac ? 'ml-16' : ''}`}
          title="Toggle Sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium">MultiClaude</span>
      </div>

      {/* Project Tabs */}
      <ProjectTabs
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeProjectId ? (
          <>
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              {activeView === 'terminals' && (
                <>
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
                </>
              )}
              {activeView === 'github' && (
                <GitHubView projectPath={activeProject?.path} />
              )}
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
