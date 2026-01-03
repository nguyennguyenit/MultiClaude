import { useState, useEffect, useCallback } from 'react'
import type { GitFileStatus } from '@shared/types'

interface UseGitPanelOptions {
  projectPath: string | undefined
  enabled?: boolean
}

interface UseGitPanelReturn {
  files: GitFileStatus[]
  selectedFile: string | null
  diff: string | null
  isLoading: boolean
  refresh: () => Promise<void>
  selectFile: (path: string | null) => void
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  discardFile: (path: string) => Promise<void>
  commit: (message: string) => Promise<boolean>
}

export function useGitPanel({ projectPath, enabled = true }: UseGitPanelOptions): UseGitPanelReturn {
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!projectPath || !enabled) return
    setIsLoading(true)
    try {
      const status = await window.electron.git.fileStatus(projectPath)
      setFiles(status)
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
      await refresh()
      setSelectedFile(null)
      setDiff(null)
    }
    return result.success
  }, [projectPath, refresh])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return {
    files,
    selectedFile,
    diff,
    isLoading,
    refresh,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    discardFile,
    commit
  }
}
