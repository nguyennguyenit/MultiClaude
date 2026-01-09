import type { GitFileStatus } from '@shared/types'

interface ChangesListProps {
  files: GitFileStatus[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  onStageFile: (path: string) => void
  onUnstageFile: (path: string) => void
  onDiscardFile: (path: string) => void
  onStageAll: () => void
}

export function ChangesList({
  files,
  selectedFile,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll
}: ChangesListProps) {
  const staged = files.filter(f => f.staged)
  const unstaged = files.filter(f => !f.staged)

  const getStatusIcon = (status: GitFileStatus['status']) => {
    switch (status) {
      case 'staged': return 'M'
      case 'modified': return 'M'
      case 'untracked': return 'U'
      case 'deleted': return 'D'
      case 'renamed': return 'R'
      default: return '?'
    }
  }

  const getStatusColor = (status: GitFileStatus['status']) => {
    switch (status) {
      case 'staged': return 'text-green-400'
      case 'modified': return 'text-amber-400'
      case 'untracked': return 'text-green-400'
      case 'deleted': return 'text-red-400'
      case 'renamed': return 'text-blue-400'
      default: return 'text-[var(--mc-text-muted)]'
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()

    // Simple icon mapping (could be expanded)
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <span className="text-blue-400">TS</span>
      case 'js':
      case 'jsx':
        return <span className="text-yellow-400">JS</span>
      case 'css':
      case 'scss':
        return <span className="text-blue-300">#</span>
      case 'html':
        return <span className="text-orange-400">&lt;&gt;</span>
      case 'json':
        return <span className="text-yellow-200">{ }</span>
      case 'md':
        return <span className="text-gray-300">M↓</span>
      default:
        return <span className="text-gray-400">📄</span>
    }
  }

  const FileRow = ({ file }: { file: GitFileStatus }) => (
    <div
      className={`
        group flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-l-2 transition-colors
        ${selectedFile === file.path
          ? 'bg-[var(--mc-bg-active)] border-[var(--mc-accent)]'
          : 'border-transparent hover:bg-[var(--mc-bg-hover)]'
        }
      `}
      onClick={() => onSelectFile(file.path)}
    >
      <div className="font-mono text-[10px] w-4 opacity-70">
        {getFileIcon(file.path)}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="truncate text-xs font-medium text-[var(--mc-text-primary)] leading-tight mb-0.5">
          {file.path.split(/[/\\]/).pop()}
        </span>
        <span className="truncate text-[10px] text-[var(--mc-text-muted)] leading-tight opacity-70">
          {file.path.split(/[/\\]/).slice(0, -1).join('/') || './'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <span className={`text-[9px] font-mono font-bold mr-1 ${getStatusColor(file.status)}`}>
          {getStatusIcon(file.status)}
        </span>
        {file.staged ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path) }}
            className="w-5 h-5 flex items-center justify-center hover:bg-[var(--mc-bg-tertiary)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
            title="Unstage"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Discard changes to "${file.path}"? This cannot be undone.`)) {
                  onDiscardFile(file.path)
                }
              }}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-900/30 rounded text-red-500/50 hover:text-red-400 transition-colors"
              title="Discard changes"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStageFile(file.path) }}
              className="w-5 h-5 flex items-center justify-center hover:bg-[var(--mc-bg-tertiary)] rounded text-[var(--mc-text-muted)] hover:text-green-400 transition-colors"
              title="Stage file"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Staged Section */}
      {staged.length > 0 && (
        <div className="mb-4">
          <div className="sticky top-0 z-10 bg-[var(--mc-bg-secondary)]/95 backdrop-blur-sm flex items-center justify-between px-3 py-2 text-xs font-semibold text-green-400 border-b border-[var(--mc-border)]">
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Staged Changes
            </span>
            <span className="bg-green-400/10 px-1.5 rounded-sm text-[10px]">{staged.length}</span>
          </div>
          <div className="pt-1">
            {staged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {/* Changes Section */}
      {unstaged.length > 0 && (
        <div className="mb-2">
          <div className="sticky top-0 z-10 bg-[var(--mc-bg-secondary)]/95 backdrop-blur-sm flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--mc-text-secondary)] border-b border-[var(--mc-border)]">
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Changes
            </span>
            <div className="flex items-center gap-2">
              <span className="bg-[var(--mc-bg-tertiary)] px-1.5 rounded-sm text-[10px]">{unstaged.length}</span>
              <button
                onClick={onStageAll}
                className="text-[10px] font-medium text-[var(--mc-accent)] hover:underline ml-1"
              >
                Stage All
              </button>
            </div>
          </div>
          <div className="pt-1">
            {unstaged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-[var(--mc-text-muted)] opacity-50">
          <svg className="w-12 h-12 mb-2 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs">No changes to commit</span>
        </div>
      )}
    </div>
  )
}
