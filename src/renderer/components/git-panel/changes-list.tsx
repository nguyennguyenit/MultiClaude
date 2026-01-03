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
      case 'modified': return 'text-yellow-400'
      case 'untracked': return 'text-green-400'
      case 'deleted': return 'text-red-400'
      case 'renamed': return 'text-blue-400'
      default: return 'text-[var(--mc-text-muted)]'
    }
  }

  const FileRow = ({ file }: { file: GitFileStatus }) => (
    <div
      className={`
        group flex items-center gap-2 px-2 py-1 cursor-pointer rounded text-xs
        ${selectedFile === file.path ? 'bg-[var(--mc-bg-active)]' : 'hover:bg-[var(--mc-bg-hover)]'}
      `}
      onClick={() => onSelectFile(file.path)}
    >
      <span className={`font-mono ${getStatusColor(file.status)}`}>
        {getStatusIcon(file.status)}
      </span>
      <span className="flex-1 truncate">{file.path}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        {file.staged ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path) }}
            className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Unstage"
            aria-label="Unstage file"
          >
            −
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onStageFile(file.path) }}
              className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded"
              title="Stage"
              aria-label="Stage file"
            >
              +
            </button>
            {file.status !== 'untracked' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Discard changes to "${file.path}"? This cannot be undone.`)) {
                    onDiscardFile(file.path)
                  }
                }}
                className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-red-400"
                title="Discard"
                aria-label="Discard changes"
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Staged Section */}
      {staged.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[var(--mc-text-muted)]">
            <span>Staged ({staged.length})</span>
          </div>
          <div>
            {staged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {/* Changes Section */}
      {unstaged.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[var(--mc-text-muted)]">
            <span>Changes ({unstaged.length})</span>
            <button
              onClick={onStageAll}
              className="text-[var(--mc-accent)] hover:underline"
            >
              Stage All
            </button>
          </div>
          <div>
            {unstaged.map(file => <FileRow key={file.path} file={file} />)}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="px-2 py-4 text-xs text-[var(--mc-text-muted)] text-center">
          No changes
        </div>
      )}
    </div>
  )
}
