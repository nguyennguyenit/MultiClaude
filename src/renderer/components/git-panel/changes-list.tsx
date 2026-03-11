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
      <div className="px-4 py-2 text-[10px] text-[var(--mc-text-muted)] opacity-50 italic">
        No changes
      </div>
    )
  }

  const groups = groupByDir(files)

  return (
    <div>
      {Array.from(groups.entries()).map(([dirLabel, dirFiles]) => (
        <div key={dirLabel}>
          {/* Directory sub-header */}
          <div className="flex items-center justify-between px-2.5 py-[3px] bg-[var(--mc-bg-secondary)]/30">
            <div className="flex items-center gap-1 min-w-0">
              <svg className="w-2.5 h-2.5 text-[var(--mc-text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-[10px] text-[var(--mc-text-muted)] truncate">{dirLabel}</span>
            </div>
            <span className="text-[10px] text-[var(--mc-text-muted)] flex-shrink-0 ml-1 opacity-60">{dirFiles.length}</span>
          </div>

          {/* Files in this directory */}
          {dirFiles.map(file => (
            <FileItem
              key={file.path}
              file={file}
              mode={mode}
              onFileClick={onFileClick}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onDiscardFile={onDiscardFile}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface FileItemProps {
  file: GitFileStatus
  mode: 'staged' | 'unstaged'
  onFileClick: (file: GitFileStatus) => void
  onStageFile?: (path: string) => void
  onUnstageFile?: (path: string) => void
  onDiscardFile?: (path: string) => void
}

function FileItem({ file, mode, onFileClick, onStageFile, onUnstageFile, onDiscardFile }: FileItemProps) {
  const fileName = file.path.split(/[/\\]/).pop() ?? file.path
  const statusLabel = getStatusLabel(file.status)
  const statusColor = getStatusColor(file.status)

  return (
    <div
      className="group/file flex items-center gap-1.5 pl-3 pr-2 py-[3px] cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors"
      onClick={() => onFileClick(file)}
    >
      {/* Status badge */}
      <span className={`font-mono text-[9px] font-bold w-3 flex-shrink-0 text-center ${statusColor}`}>
        {statusLabel}
      </span>

      {/* File name */}
      <span className="text-[11px] text-[var(--mc-text-primary)] truncate flex-1 leading-tight">
        {fileName}
      </span>

      {/* Line stats */}
      {(file.additions !== undefined || file.deletions !== undefined) && (
        <div className="flex items-center gap-0.5 text-[10px] font-mono flex-shrink-0 opacity-70 group-hover/file:opacity-100 transition-opacity">
          {(file.additions ?? 0) > 0 && (
            <span className="text-green-400">+{file.additions}</span>
          )}
          {(file.deletions ?? 0) > 0 && (
            <span className="text-red-400">-{file.deletions}</span>
          )}
        </div>
      )}

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity flex-shrink-0 ml-0.5">
        {mode === 'staged' && onUnstageFile && (
          <ActionButton
            onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path) }}
            title="Unstage"
            variant="warning"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </ActionButton>
        )}
        {mode === 'unstaged' && (
          <>
            {onDiscardFile && (
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Discard changes to "${file.path}"? This cannot be undone.`)) {
                    onDiscardFile(file.path)
                  }
                }}
                title="Discard changes"
                variant="danger"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </ActionButton>
            )}
            {onStageFile && (
              <ActionButton
                onClick={(e) => { e.stopPropagation(); onStageFile(file.path) }}
                title="Stage file"
                variant="success"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </ActionButton>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  title,
  variant,
  children
}: {
  onClick: (e: React.MouseEvent) => void
  title: string
  variant: 'default' | 'danger' | 'success' | 'warning'
  children: React.ReactNode
}) {
  const getColors = () => {
    switch(variant) {
      case 'danger':
        return {
          color: 'rgba(248, 113, 113, 0.6)', // text-red-500/60
          hoverColor: '#f87171', // text-red-400
          hoverBg: 'rgba(127, 29, 29, 0.2)', // bg-red-900/20
        }
      case 'success':
        return {
          color: 'var(--mc-text-muted)',
          hoverColor: '#4ade80', // text-green-400
          hoverBg: 'rgba(20, 83, 45, 0.15)', // bg-green-900/15
        }
      case 'warning':
        return {
          color: 'var(--mc-text-muted)',
          hoverColor: '#fbbf24', // text-amber-400
          hoverBg: 'rgba(180, 83, 9, 0.15)', // amber background
        }
      default:
        return {
          color: 'var(--mc-text-muted)',
          hoverColor: 'var(--mc-text-primary)',
          hoverBg: 'var(--mc-bg-tertiary)',
        }
    }
  }

  const colors = getColors()

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 16,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        background: 'transparent',
        border: 'none',
        color: colors.color,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = colors.hoverColor
        e.currentTarget.style.background = colors.hoverBg
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = colors.color
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
