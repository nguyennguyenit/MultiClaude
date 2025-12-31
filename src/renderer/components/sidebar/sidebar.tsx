import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores'
import { SettingsPanel } from '../settings'
import type { GitStatus, GitHubAuth } from '@shared/types'

export function Sidebar() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    addProject,
    removeProject,
    sidebarOpen
  } = useAppStore()

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [newRepoName, setNewRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [showGitModal, setShowGitModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showGitInitPrompt, setShowGitInitPrompt] = useState(false)
  const [pendingProject, setPendingProject] = useState<{ name: string; path: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)

  // Load git status when active project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.git.status(activeProject.path).then(setGitStatus)
    } else {
      setGitStatus(null)
    }
  }, [activeProject])

  // Load GitHub auth status
  useEffect(() => {
    window.electron.github.authStatus().then(setGithubAuth)
  }, [])

  const handleAddProject = async () => {
    const path = await window.electron.project.openFolder()
    if (!path) return

    const name = path.split('/').pop() || 'Untitled'

    // Check if folder is empty or has no git
    const folderInfo = await window.electron.project.checkFolder(path)

    if (!folderInfo.isGitRepo) {
      // Show prompt to initialize git
      setPendingProject({ name, path })
      setShowGitInitPrompt(true)
      return
    }

    // Folder already has git, proceed normally
    const project = await window.electron.project.create({ name, path })
    addProject(project)
    setActiveProject(project.id)
  }

  const handleConfirmAddProject = async (initGit: boolean) => {
    if (!pendingProject) return

    const project = await window.electron.project.create(pendingProject)
    addProject(project)
    setActiveProject(project.id)

    if (initGit) {
      await window.electron.git.init(pendingProject.path)
      const status = await window.electron.git.status(pendingProject.path)
      setGitStatus(status)
    }

    setPendingProject(null)
    setShowGitInitPrompt(false)
  }

  const handleDeleteProject = async (id: string) => {
    await window.electron.project.delete(id)
    removeProject(id)
  }

  const handleInitGit = async () => {
    if (!activeProject) return
    const success = await window.electron.git.init(activeProject.path)
    if (success) {
      const status = await window.electron.git.status(activeProject.path)
      setGitStatus(status)
    }
  }

  const handleGitHubLogin = async () => {
    await window.electron.github.login()
    // Refresh auth status after login
    setTimeout(async () => {
      const auth = await window.electron.github.authStatus()
      setGithubAuth(auth)
    }, 5000)
  }

  const handleCreateRepo = async () => {
    if (!activeProject || !newRepoName) return
    setIsCreating(true)
    setCreateError(null)
    const result = await window.electron.github.createRepo(newRepoName, isPrivate, activeProject.path)
    setIsCreating(false)
    if (result.success) {
      setShowGitModal(false)
      setNewRepoName('')
      const status = await window.electron.git.status(activeProject.path)
      setGitStatus(status)
    } else {
      setCreateError(result.error || 'Failed to create repository')
    }
  }

  if (!sidebarOpen) return null

  return (
    <div className="w-64 bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full">
      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--mc-text-muted)] uppercase">
          <span>Projects</span>
          <button
            onClick={handleAddProject}
            className="hover:bg-[var(--mc-bg-hover)] p-1 rounded"
            title="Add Project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="px-2">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`
                group flex items-center justify-between px-2 py-2 rounded cursor-pointer
                ${activeProjectId === project.id ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'}
              `}
            >
              <div className="flex items-center gap-2 truncate">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-sm truncate">{project.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteProject(project.id)
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-[#4d4d4d] rounded p-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No projects yet
            </div>
          )}
        </div>
      </div>

      {/* Git Section */}
      <div className="border-t border-[#3c3c3c] p-3">
        <div className="text-xs text-gray-400 uppercase mb-2">Git</div>

        {activeProject ? (
          <>
            {gitStatus?.isRepo ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">Branch:</span>
                  <span>{gitStatus.branch}</span>
                </div>

                {gitStatus.hasRemote ? (
                  <div className="text-xs text-gray-400 truncate">
                    {gitStatus.remoteUrl}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowGitModal(true)}
                    className="w-full px-3 py-1.5 text-sm bg-[#0d6efd] hover:bg-[#0b5ed7] rounded"
                  >
                    Connect to GitHub
                  </button>
                )}

                {gitStatus.isDirty && (
                  <div className="text-xs text-yellow-400">
                    {gitStatus.staged} staged, {gitStatus.unstaged} unstaged, {gitStatus.untracked} untracked
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleInitGit}
                className="w-full px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#4d4d4d] rounded"
              >
                Initialize Git
              </button>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">Select a project</div>
        )}

        {/* GitHub Auth */}
        <div className="mt-3 pt-3 border-t border-[#3c3c3c]">
          {githubAuth?.isAuthenticated ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span>{githubAuth.username}</span>
            </div>
          ) : (
            <button
              onClick={handleGitHubLogin}
              className="w-full px-3 py-1.5 text-sm bg-[#24292f] hover:bg-[#32383f] rounded flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Login to GitHub
            </button>
          )}
        </div>
      </div>

      {/* Git Modal */}
      {showGitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] rounded-lg p-4 w-80">
            <h3 className="text-lg font-semibold mb-4">Create GitHub Repository</h3>
            <input
              type="text"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              placeholder="Repository name"
              className="w-full px-3 py-2 bg-[#3c3c3c] rounded mb-3 text-sm"
              disabled={isCreating}
            />
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded"
                disabled={isCreating}
              />
              Private repository
            </label>
            {createError && (
              <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowGitModal(false)
                  setCreateError(null)
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#4d4d4d] rounded"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRepo}
                disabled={!newRepoName || isCreating}
                className="flex-1 px-3 py-1.5 text-sm bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:opacity-50 rounded"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Git Init Prompt Modal */}
      {showGitInitPrompt && pendingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] rounded-lg p-4 w-80">
            <h3 className="text-lg font-semibold mb-2">Initialize Git Repository?</h3>
            <p className="text-sm text-gray-400 mb-4">
              The folder <span className="text-white font-medium">{pendingProject.name}</span> doesn't have a git repository. Would you like to initialize one?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmAddProject(false)}
                className="flex-1 px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#4d4d4d] rounded"
              >
                Skip
              </button>
              <button
                onClick={() => handleConfirmAddProject(true)}
                className="flex-1 px-3 py-1.5 text-sm bg-[#0d6efd] hover:bg-[#0b5ed7] rounded"
              >
                Initialize Git
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Section - Bottom */}
      <div className="mt-auto">
        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        )}
        <div className="border-t border-[var(--mc-border)] p-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`
              w-full flex items-center gap-2 px-2 py-2 rounded text-sm
              ${showSettings
                ? 'bg-[var(--mc-bg-active)] text-[var(--mc-accent)]'
                : 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
