import { useState, useEffect, useCallback } from 'react'
import type { GitFileStatus, GitBranch, GitLogEntry, GitStashEntry, GitStatus } from '@shared/types'

interface UseGitPanelOptions {
  projectPath: string | undefined
  enabled?: boolean
}

interface UseGitPanelReturn {
  // Status
  gitStatus: GitStatus | null
  // Changes
  files: GitFileStatus[]
  selectedFile: string | null
  diff: string | null
  isLoading: boolean
  // Branches
  branches: GitBranch[]
  currentBranch: string | undefined
  // History
  logEntries: GitLogEntry[]
  // Stash
  stashEntries: GitStashEntry[]
  // Actions
  refresh: () => Promise<void>
  refreshAll: () => Promise<void>
  selectFile: (path: string | null) => void
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  discardFile: (path: string) => Promise<void>
  commit: (message: string) => Promise<boolean>
  // Git operations
  pull: () => Promise<{ success: boolean; message?: string; error?: string }>
  fetch: () => Promise<{ success: boolean; message?: string; error?: string }>
  push: () => Promise<boolean>
  // Branch operations
  checkoutBranch: (name: string) => Promise<void>
  createBranch: (name: string) => Promise<void>
  deleteBranch: (name: string, force?: boolean) => Promise<void>
  mergeBranch: (branch: string) => Promise<void>
  // Stash operations
  stashSave: (message?: string) => Promise<void>
  stashApply: (index: number) => Promise<void>
  stashPop: (index: number) => Promise<void>
  stashDrop: (index: number) => Promise<void>
}

export function useGitPanel({ projectPath, enabled = true }: UseGitPanelOptions): UseGitPanelReturn {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [logEntries, setLogEntries] = useState<GitLogEntry[]>([])
  const [stashEntries, setStashEntries] = useState<GitStashEntry[]>([])

  const currentBranch = gitStatus?.branch

  // Refresh file status
  const refresh = useCallback(async () => {
    if (!projectPath || !enabled) return
    setIsLoading(true)
    try {
      const [status, fileStatus] = await Promise.all([
        window.electron.git.status(projectPath),
        window.electron.git.fileStatus(projectPath)
      ])
      setGitStatus(status)
      setFiles(fileStatus)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath, enabled])

  // Refresh all data (branches, log, stash)
  const refreshAll = useCallback(async () => {
    if (!projectPath || !enabled) return
    setIsLoading(true)
    try {
      const [status, fileStatus, branchList, log, stash] = await Promise.all([
        window.electron.git.status(projectPath),
        window.electron.git.fileStatus(projectPath),
        window.electron.git.branches(projectPath),
        window.electron.git.log(projectPath, 50),
        window.electron.git.stashList(projectPath)
      ])
      setGitStatus(status)
      setFiles(fileStatus)
      setBranches(branchList)
      setLogEntries(log)
      setStashEntries(stash)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath, enabled])

  const selectFile = useCallback(async (path: string | null) => {
    setSelectedFile(path)
    if (!path || !projectPath) {
      setDiff(null)
      return
    }
    const file = files.find(f => f.path === path)
    const result = await window.electron.git.diff(projectPath, path, file?.staged)
    setDiff(result.success ? result.diff || '' : null)
  }, [projectPath, files])

  const stageFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.stageFile(projectPath, path)
    await refresh()
  }, [projectPath, refresh])

  const unstageFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.unstageFile(projectPath, path)
    await refresh()
  }, [projectPath, refresh])

  const stageAll = useCallback(async () => {
    if (!projectPath) return
    await window.electron.git.stageAll(projectPath)
    await refresh()
  }, [projectPath, refresh])

  const discardFile = useCallback(async (path: string) => {
    if (!projectPath) return
    await window.electron.git.discard(projectPath, path)
    await refresh()
    if (selectedFile === path) {
      setSelectedFile(null)
      setDiff(null)
    }
  }, [projectPath, refresh, selectedFile])

  const commit = useCallback(async (message: string): Promise<boolean> => {
    if (!projectPath || !message.trim()) return false
    const result = await window.electron.git.commit(projectPath, message)
    if (result.success) {
      await refreshAll()
      setSelectedFile(null)
      setDiff(null)
    }
    return result.success
  }, [projectPath, refreshAll])

  // Git operations
  const pull = useCallback(async () => {
    if (!projectPath) return { success: false, error: 'No project' }
    const result = await window.electron.git.pull(projectPath)
    await refreshAll()
    return result
  }, [projectPath, refreshAll])

  const fetch = useCallback(async () => {
    if (!projectPath) return { success: false, error: 'No project' }
    const result = await window.electron.git.fetch(projectPath)
    await refreshAll()
    return result
  }, [projectPath, refreshAll])

  const push = useCallback(async (): Promise<boolean> => {
    if (!projectPath) return false
    const result = await window.electron.git.push(projectPath)
    await refresh()
    return result.success
  }, [projectPath, refresh])

  // Branch operations
  const checkoutBranch = useCallback(async (name: string) => {
    if (!projectPath) return
    await window.electron.git.checkoutBranch(projectPath, name)
    await refreshAll()
    // Dispatch event for other components to react to branch change
    window.dispatchEvent(new CustomEvent('git-status-changed', { detail: { projectPath } }))
  }, [projectPath, refreshAll])

  const createBranch = useCallback(async (name: string) => {
    if (!projectPath) return
    await window.electron.git.createBranch(projectPath, name, true)
    await refreshAll()
    // Dispatch event for other components to react to branch change
    window.dispatchEvent(new CustomEvent('git-status-changed', { detail: { projectPath } }))
  }, [projectPath, refreshAll])

  const deleteBranch = useCallback(async (name: string, force = false) => {
    if (!projectPath) return
    await window.electron.git.deleteBranch(projectPath, name, force)
    await refreshAll()
  }, [projectPath, refreshAll])

  const mergeBranch = useCallback(async (branch: string) => {
    if (!projectPath) return
    await window.electron.git.merge(projectPath, branch)
    await refreshAll()
  }, [projectPath, refreshAll])

  // Stash operations
  const stashSave = useCallback(async (message?: string) => {
    if (!projectPath) return
    await window.electron.git.stashSave(projectPath, message)
    await refreshAll()
  }, [projectPath, refreshAll])

  const stashApply = useCallback(async (index: number) => {
    if (!projectPath) return
    await window.electron.git.stashApply(projectPath, index)
    await refreshAll()
  }, [projectPath, refreshAll])

  const stashPop = useCallback(async (index: number) => {
    if (!projectPath) return
    await window.electron.git.stashPop(projectPath, index)
    await refreshAll()
  }, [projectPath, refreshAll])

  const stashDrop = useCallback(async (index: number) => {
    if (!projectPath) return
    await window.electron.git.stashDrop(projectPath, index)
    await refreshAll()
  }, [projectPath, refreshAll])

  // Initial load and polling - only when enabled
  useEffect(() => {
    if (!enabled || !projectPath) return

    refreshAll()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh, refreshAll, enabled, projectPath])

  return {
    gitStatus,
    files,
    selectedFile,
    diff,
    isLoading,
    branches,
    currentBranch,
    logEntries,
    stashEntries,
    refresh,
    refreshAll,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    discardFile,
    commit,
    pull,
    fetch,
    push,
    checkoutBranch,
    createBranch,
    deleteBranch,
    mergeBranch,
    stashSave,
    stashApply,
    stashPop,
    stashDrop
  }
}
