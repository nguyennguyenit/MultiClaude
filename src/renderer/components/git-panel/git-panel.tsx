import { useGitPanel } from '../../hooks/use-git-panel'
import { ChangesList } from './changes-list'
import { DiffViewer } from './diff-viewer'
import { CommitForm } from './commit-form'

interface GitPanelProps {
  projectPath: string | undefined
  isOpen: boolean
  onToggle: () => void
}

export function GitPanel({ projectPath, isOpen, onToggle }: GitPanelProps) {
  const {
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
  } = useGitPanel({ projectPath, enabled: isOpen })

  const stagedCount = files.filter(f => f.staged).length

  if (!isOpen) {
    return (
      <div className="w-8 bg-[var(--mc-bg-secondary)] border-l border-[var(--mc-border)] flex flex-col items-center pt-2">
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded"
          title="Open Git Panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="w-72 bg-[var(--mc-bg-secondary)] border-l border-[var(--mc-border)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--mc-border)]">
        <span className="text-sm font-medium">Git</span>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Refresh"
          >
            <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Close"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Changes List */}
      <ChangesList
        files={files}
        selectedFile={selectedFile}
        onSelectFile={selectFile}
        onStageFile={stageFile}
        onUnstageFile={unstageFile}
        onDiscardFile={discardFile}
        onStageAll={stageAll}
      />

      {/* Diff Viewer */}
      <DiffViewer diff={diff} fileName={selectedFile} />

      {/* Commit Form */}
      <CommitForm stagedCount={stagedCount} onCommit={commit} />
    </div>
  )
}
