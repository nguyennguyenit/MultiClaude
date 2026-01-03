import { useEffect, useCallback } from 'react'
import { Sidebar } from './components/sidebar'
import { ProjectTabs } from './components/project-tabs'
import { TerminalGrid } from './components/terminal'
import { WelcomeScreen } from './components/welcome-screen'
import { GitPanel } from './components/git-panel'
import { ToastContainer } from './components/toast-container'
import { useAppStore, useSettingsStore, useToastStore, setupNotificationListener } from './stores'
import { useKeyboardShortcuts } from './hooks'
import { COLOR_THEMES } from '@shared/constants'

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
    toggleSidebar
  } = useAppStore()

  const { settings, loadSettings, gitPanelOpen, setGitPanelOpen } = useSettingsStore()

  // Get active project for terminal creation
  const activeProject = projects.find(p => p.id === activeProjectId)

  // Filter terminals for active project
  const projectTerminals = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId)
    : terminals

  // Handler: Add new project via folder picker
  const handleAddProject = useCallback(async () => {
    const path = await window.electron.project.openFolder()
    if (!path) return

    const name = path.split('/').pop() || 'Untitled'
    const project = await window.electron.project.create({ name, path })
    addProject(project)
    setActiveProject(project.id)
  }, [addProject, setActiveProject])

  // Handler: Delete project
  const handleDeleteProject = useCallback(async (id: string) => {
    await window.electron.project.delete(id)
    removeProject(id)
  }, [removeProject])

  // Handler: Add new terminal in active project
  const handleAddTerminal = useCallback(async () => {
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

    const terminal = await window.electron.terminal.create({
      cwd: activeProject?.path,
      projectId: activeProject?.id
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

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onAddTerminal: handleAddTerminal,
    onCloseTerminal: handleCloseTerminal
  })

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Setup notification listener
  useEffect(() => {
    const cleanup = setupNotificationListener()
    return cleanup
  }, [])

  // Apply theme classes to document
  useEffect(() => {
    const root = document.documentElement

    // Determine actual mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = settings.themeMode === 'dark' ||
      (settings.themeMode === 'system' && prefersDark)

    // Remove old classes
    root.classList.remove('light', 'dark')
    COLOR_THEMES.forEach(t => root.classList.remove(`theme-${t.id}`))

    // Apply new classes
    root.classList.add(isDark ? 'dark' : 'light')
    root.classList.add(`theme-${settings.colorTheme}`)
  }, [settings.themeMode, settings.colorTheme])

  // Load saved projects on mount
  useEffect(() => {
    const init = async () => {
      const loadedProjects = await window.electron.project.list()
      setProjects(loadedProjects)
    }
    init()
  }, [])

  // Create initial terminal when project is selected and no terminals exist
  useEffect(() => {
    if (activeProjectId && projectTerminals.length === 0) {
      handleAddTerminal()
    }
  }, [activeProjectId, projectTerminals.length, handleAddTerminal])

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

      {/* Title Bar */}
      <div className="h-10 bg-[var(--mc-bg-tertiary)] flex items-center px-4 titlebar-drag">
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-[var(--mc-bg-hover)] rounded titlebar-no-drag mr-2"
          title="Toggle Sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-medium">MultiClaude</span>
      </div>

      {/* Project Tabs */}
      <ProjectTabs
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeProjectId ? (
          <>
            <Sidebar />
            <div className="flex-1 min-w-0">
              <TerminalGrid
                terminals={projectTerminals}
                activeTerminalId={activeTerminalId}
                onTerminalClick={setActiveTerminal}
                onAddTerminal={handleAddTerminal}
                onCloseTerminal={handleCloseTerminal}
                onStartClaude={handleStartClaude}
                onInsertFilePath={handleInsertFilePath}
              />
            </div>
            <GitPanel
              projectPath={activeProject?.path}
              isOpen={gitPanelOpen}
              onToggle={() => setGitPanelOpen(!gitPanelOpen)}
            />
          </>
        ) : (
          <WelcomeScreen onAddProject={handleAddProject} />
        )}
      </div>
    </div>
  )
}

export default App
