import { useEffect, useCallback } from 'react'
import { Sidebar } from './components/sidebar'
import { ProjectTabs } from './components/project-tabs'
import { TerminalGrid } from './components/terminal'
import { useAppStore, useSettingsStore, setupNotificationListener } from './stores'
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
    addProject,
    setProjects,
    setActiveProject,
    setActiveTerminal,
    sidebarOpen,
    toggleSidebar
  } = useAppStore()

  const { settings, loadSettings } = useSettingsStore()

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

  // Handler: Add new terminal in active project
  const handleAddTerminal = useCallback(async () => {
    const terminal = await window.electron.terminal.create({
      cwd: activeProject?.path,
      projectId: activeProject?.id
    })
    addTerminal(terminal)
  }, [activeProject, addTerminal])

  // Handler: Close active terminal
  const handleCloseTerminal = useCallback(async () => {
    if (!activeTerminalId) return
    await window.electron.terminal.destroy(activeTerminalId)
    removeTerminal(activeTerminalId)
  }, [activeTerminalId, removeTerminal])

  // Handler: Start Claude in terminal
  const handleStartClaude = useCallback(async (terminalId: string) => {
    await window.electron.terminal.invokeClaude(terminalId)
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

  // Load saved projects and session on mount
  useEffect(() => {
    const init = async () => {
      // Load projects
      const loadedProjects = await window.electron.project.list()
      setProjects(loadedProjects)

      // Always create a single initial terminal on startup
      const terminal = await window.electron.terminal.create()
      addTerminal(terminal)
    }
    init()
  }, [])

  // Handle terminal exit
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onExit(({ terminalId }) => {
      useAppStore.getState().removeTerminal(terminalId)
    })
    return unsubscribe
  }, [])

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
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <TerminalGrid
            terminals={projectTerminals}
            activeTerminalId={activeTerminalId}
            onTerminalClick={setActiveTerminal}
            onAddTerminal={handleAddTerminal}
            onCloseTerminal={handleCloseTerminal}
            onStartClaude={handleStartClaude}
          />
        </div>
      </div>
    </div>
  )
}

export default App
