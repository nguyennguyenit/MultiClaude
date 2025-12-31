import { useEffect } from 'react'
import { Sidebar } from './components/sidebar'
import { TerminalTabs, TerminalView } from './components/terminal'
import { useAppStore, useSettingsStore } from './stores'
import { COLOR_THEMES } from '@shared/constants'

function App() {
  const {
    terminals,
    activeTerminalId,
    addTerminal,
    setProjects,
    setActiveProject,
    sidebarOpen,
    toggleSidebar
  } = useAppStore()

  const { settings, loadSettings } = useSettingsStore()

  // Load settings on mount
  useEffect(() => {
    loadSettings()
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
      const projects = await window.electron.project.list()
      setProjects(projects)

      // Restore session
      const session = await window.electron.session.restore()
      if (session?.terminals?.length) {
        // Recreate terminals from session
        for (const termSession of session.terminals) {
          const terminal = await window.electron.terminal.create({
            cwd: termSession.cwd,
            projectId: termSession.projectId
          })
          addTerminal(terminal)
        }
      } else {
        // Create initial terminal
        const terminal = await window.electron.terminal.create()
        addTerminal(terminal)
      }
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
      <div className="h-10 bg-[#323232] flex items-center px-4 titlebar-drag">
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-[#4d4d4d] rounded titlebar-no-drag mr-2"
          title="Toggle Sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-medium">MultiClaude</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <TerminalTabs />

          <div className="flex-1 relative">
            {terminals.map((terminal) => (
              <TerminalView
                key={terminal.id}
                terminalId={terminal.id}
                isActive={terminal.id === activeTerminalId}
              />
            ))}

            {terminals.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="mb-2">No terminals open</p>
                  <p className="text-sm">Click the + button to create one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
