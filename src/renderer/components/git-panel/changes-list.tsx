import type { GitFileStatus } from '@shared/types'
import { getStatusColor, getStatusLabel, groupByDir } from './git-file-utils'

interface ChangesListProps {
  files: GitFileStatus[]
  mode: 'staged' | 'unstaged'
  onFileClick: (file: GitFileStatus) => void
  onStageFile?: (path: string) => void
  onUnstageFile?: (path: string) => void
  onDiscardFile?: (path: string) => void
}

export function ChangesList({
  files,
  mode,
  onFileClick,
  onStageFile,
  onUnstageFile,
  onDiscardFile
}: ChangesListProps) {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-3 text-[var(--mc-text-muted)] opacity-50">
        <span className="text-[10px]">No changes</span>
      </div>
    )
  }

  const groups = groupByDir(files)

  return (
    <div>
      {Array.from(groups.entries()).map(([dirLabel, dirFiles]) => (
        <div key={dirLabel}>
          {/* Directory sub-header */}
          <div className="flex items-center justify-between px-3 py-[2px] bg-[var(--mc-bg-secondary)]/40">
            <span className="text-[10px] text-[var(--mc-text-muted)] truncate">{dirLabel}</span>
            <span className="text-[10px] text-[var(--mc-text-muted)] flex-shrink-0 ml-1">{dirFiles.length}</span>
          </div>

          {/* Files in this directory */}
          {dirFiles.map(file => (
            <div
              key={file.path}
              className="group flex items-center gap-1.5 px-3 py-[3px] cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors"
              onClick={() => onFileClick(file)}
            >
              {/* Status icon */}
              <span className={`font-mono text-[10px] font-bold w-3 flex-shrink-0 ${getStatusColor(file.status)}`}>
                {getStatusLabel(file.status)}
              </span>

              {/* File name */}
              <span className="text-[11px] text-[var(--mc-text-primary)] truncate flex-1 leading-tight">
                {file.path.split(/[/\\]/).pop()}
              </span>

              {/* Line stats — always visible */}
              {(file.additions !== undefined || file.deletions !== undefined) && (
                <div className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0">
                  {(file.additions ?? 0) > 0 && (
                    <span className="text-green-400">+{file.additions}</span>
                  )}
                  {(file.deletions ?? 0) > 0 && (
                    <span className="text-red-400">-{file.deletions}</span>
                  )}
                </div>
              )}

              {/* Action buttons — show on hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {mode === 'staged' && onUnstageFile && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path) }}
                    className="w-4 h-4 flex items-center justify-center hover:bg-[var(--mc-bg-tertiary)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
                    title="Unstage"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                )}
                {mode === 'unstaged' && (
                  <>
                    {onDiscardFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Discard changes to "${file.path}"? This cannot be undone.`)) {
                            onDiscardFile(file.path)
                          }
                        }}
                        className="w-4 h-4 flex items-center justify-center hover:bg-red-900/30 rounded text-red-500/50 hover:text-red-400 transition-colors"
                        title="Discard changes"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {onStageFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onStageFile(file.path) }}
                        className="w-4 h-4 flex items-center justify-center hover:bg-[var(--mc-bg-tertiary)] rounded text-[var(--mc-text-muted)] hover:text-green-400 transition-colors"
                        title="Stage file"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
